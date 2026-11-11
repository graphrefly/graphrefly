"""Pure-Python port of graphrefly/reference/kernel/kernel.mjs (D797 kernel set).

A line-by-line translation for a performance comparison, not package code. Messages are
tuples: ("DATA", v), ("PENDING",), ... The only deliberate difference from the reference:
the delivery trace is optional (trace=True records it, as the reference always does).
"""

from __future__ import annotations

import inspect

TIER = {"START": 0, "PENDING": 2, "DATA": 3, "RESOLVED": 3, "INVALIDATE": 4, "COMPLETE": 5, "ERROR": 5}

_INV = ("INVALIDATE",)
_PENDING = ("PENDING",)
_RESOLVED = ("RESOLVED",)
_COMPLETE = ("COMPLETE",)


class KernelError(Exception):
    pass


def _is_value(m):
    return m[0] == "DATA" or m[0] == "RESOLVED"


def _is_terminal(m):
    return m[0] == "COMPLETE" or m[0] == "ERROR"


def _settles(m):
    t = m[0]
    return t == "DATA" or t == "RESOLVED" or t == "COMPLETE" or t == "ERROR" or t == "INVALIDATE"


_marks = _settles


def _has_mark(frames):
    return any(_marks(m) for f in frames for m in f)


def _message_of(e):
    return str(e) if isinstance(e, BaseException) else e


class _Input:
    __slots__ = ("has", "value", "ended", "frames", "invalidated")

    def __init__(self, has=False, value=None, ended=None, frames=None):
        self.has = has
        self.value = value
        self.ended = ended
        self.frames = frames if frames is not None else []
        self.invalidated = False


class _Signal:
    __slots__ = ("aborted",)

    def __init__(self):
        self.aborted = False


class _Lifetime:
    __slots__ = ("open", "controller", "setup_done", "cleanup")

    def __init__(self):
        self.open = True
        self.controller = None
        self.setup_done = False
        self.cleanup = None


class _Sub:
    __slots__ = ("kind", "id", "cb", "dep")

    def __init__(self, kind, id, cb=None, dep=None):
        self.kind = kind
        self.id = id
        self.cb = cb
        self.dep = dep


class _Node:
    __slots__ = (
        "id", "kind", "deps", "fn", "declared_deps", "seed_deps", "terminal", "invalidate",
        "quiet", "setup", "recipe", "seed_note", "subs", "active", "lifetime", "values",
        "has", "cache", "ended", "private_state", "pending", "pending_deps", "inputs",
    )


def _prepare(msgs):
    if len(msgs) == 1 and msgs[0][0] == "DATA":  # fast path: one DATA
        return [[msgs[0]]]
    for m in msgs:
        if m[0] not in TIER:
            raise KernelError(f"unknown message type {m[0]}")
    end = next((i for i, m in enumerate(msgs) if _is_terminal(m)), -1)
    if 0 <= end < len(msgs) - 1:
        raise KernelError("a terminal must be the last message of its array")
    cut = -1
    for i in range(len(msgs) - 1, -1, -1):
        if msgs[i][0] == "INVALIDATE":
            cut = i
            break
    rest = msgs[cut + 1:]
    frames = [[_INV]] if cut >= 0 else []
    if rest:
        frames.append(list(rest))
    return frames


class _Deferred:
    __slots__ = ("fn",)

    def __init__(self, fn):
        self.fn = fn


_UNSET = object()


class _DepView:
    """Lazy view: has/value read straight through; waves/terminal computed on first access."""

    __slots__ = ("_inp", "_n", "_i")

    def __init__(self, inp, n, i):
        self._inp = inp
        self._n = n
        self._i = i

    @property
    def id(self):
        return self._n.deps[self._i]

    @property
    def has(self):
        return self._inp.has

    @property
    def value(self):
        return self._inp.value

    @property
    def waves(self):
        return [[m[1] for m in f if m[0] == "DATA"] for f in self._inp.frames if any(_is_value(m) for m in f)]

    @property
    def terminal(self):
        return next((m for f in self._inp.frames for m in f if _is_terminal(m)), None)

    @property
    def invalidated(self):
        return self._n.invalidate == "manual" and self._inp.invalidated


class Ctx:
    __slots__ = ("_g", "_n", "_lifetime", "_out", "_invoking", "deps", "seed")

    def __init__(self, g, n, lifetime):
        self._g = g
        self._n = n
        self._lifetime = lifetime
        self._out = []
        self._invoking = True
        # Frames are cleared right after the run, so views read inputs only during it.
        self.deps = [_DepView(inp, n, i) for i, inp in enumerate(n.inputs)]
        self.seed = _UNSET

    @property
    def state(self):
        return self._n.private_state

    @state.setter
    def state(self, v):
        self._n.private_state = v

    def down(self, msgs):
        n = self._n
        if len(msgs) == 1 and msgs[0][0] == "DATA":
            if self._invoking:
                self._out.append([msgs[0]])
                return
            self._g._later(n, self._lifetime, [[msgs[0]]])
            return
        for m in msgs:
            if m[0] == "PENDING" or m[0] == "RESOLVED":
                raise KernelError(f"{n.id}: {m[0]} is sent by the kernel, not by node output")
        frames = _prepare(msgs)
        if self._invoking:
            self._out.extend(frames)
            return
        self._g._later(n, self._lifetime, frames)

    @property
    def signal(self):
        lt = self._lifetime
        if lt.controller is None:
            lt.controller = _Signal()
            if not lt.open:
                lt.controller.aborted = True
        return lt.controller

    def rewire(self, deps):
        g, n, lifetime = self._g, self._n, self._lifetime
        if not lifetime.open:
            return
        g._assert_distinct("rewire", n, deps)
        for d in deps:
            if d == n.id or g._depends_on(g._node_of(d), n.id):
                raise KernelError(f"rewire: {n.id} would depend on itself through {d}")
        deps = list(deps)
        g._request(lambda: g._rewire_node(n, deps) if lifetime.open and n.lifetime is lifetime else None)


class Graph:
    def __init__(self, report=None, trace=False):
        self._nodes = {}
        self.trace = [] if trace else None
        self._host_report = report
        self._staging = None
        self._batch_requests = None
        self._busy = False
        self._queue = []
        self._running = None

    # ---- helpers ----
    def _report(self, entry):
        if self._host_report is None:
            return
        try:
            self._host_report(entry)
        except Exception:
            pass

    def _node_of(self, id):
        n = self._nodes.get(id)
        if n is None:
            raise KernelError(f"unknown node {id}")
        return n

    def _edges_of(self, n):
        return list(dict.fromkeys([*n.deps, *n.declared_deps]))

    def _depends_on(self, n, target):
        return any(d == target or self._depends_on(self._node_of(d), target) for d in self._edges_of(n))

    def _make_node(self, id, kind, deps, fn, opts, initial):
        if id in self._nodes:
            raise KernelError(f"duplicate node {id}")
        for d in deps:
            self._node_of(d)
        opts = opts or {}
        seed = opts.get("seed")
        if seed:
            values = list(seed.get("values", []))
        elif initial is not _UNSET:
            values = [initial]
        else:
            values = []
        n = _Node()
        n.id, n.kind, n.deps, n.fn = id, kind, list(deps), fn
        n.declared_deps = n.deps
        n.seed_deps = list(seed["deps"]) if seed and seed.get("deps") else None
        n.terminal = {"complete": "auto", "error": "auto", **(opts.get("terminal") or {})}
        n.invalidate = opts.get("invalidate", "auto")
        n.quiet = bool(opts.get("quiet"))
        n.setup = opts.get("setup")
        n.recipe = opts.get("recipe")
        n.seed_note = seed.get("note", _UNSET) if seed else _UNSET
        n.subs = []
        n.active = False
        n.lifetime = None
        n.values = values
        n.has = len(values) > 0
        n.cache = values[-1] if values else None
        n.ended = seed.get("ended") if seed else None
        n.private_state = seed.get("state") if seed else None
        n.pending = False
        n.pending_deps = set()
        n.inputs = [_Input() for _ in n.deps]
        self._nodes[id] = n
        return n

    def _stage(self, n, lifetime, msgs):
        entry = self._staging.get(n.id) or {"msgs": [], "lifetime": lifetime}
        all_ = [*entry["msgs"], *msgs]
        try:
            _prepare(all_)
        except KernelError as e:
            raise KernelError(f"{n.id}: {e} (batch)") from None
        entry["msgs"] = all_
        self._staging[n.id] = entry

    # ---- requests (K8) ----
    def _request(self, op):
        if self._batch_requests is not None:
            self._batch_requests.append(op)
            return
        if self._busy:
            self._queue.append(op)
            return
        failure = None
        self._busy = True
        try:
            op()
        except Exception as e:
            failure = e
        finally:
            self._busy = False
        while self._queue:
            nxt = self._queue.pop(0)
            self._busy = True
            try:
                nxt()
            except Exception as e:
                self._report({"source": "queued request", "error": _message_of(e)})
            finally:
                self._busy = False
        if failure is not None:
            raise failure

    # ---- lifetimes (K7) ----
    def _open_lifetime(self, n):
        n.lifetime = _Lifetime()

    def _run_cleanup(self, n, f):
        try:
            f()
        except Exception as e:
            self._report({"source": f"cleanup {n.id}", "error": _message_of(e)})

    def _close_lifetime(self, n):
        lt = n.lifetime
        if lt is None or not lt.open:
            return
        lt.open = False
        if lt.controller is not None:
            lt.controller.aborted = True
        self._release_deps(n)
        n.deps = n.declared_deps
        n.inputs = [_Input() for _ in n.deps]
        cleanup = lt.cleanup
        lt.cleanup = None
        if cleanup:
            self._run_cleanup(n, cleanup)
        n.private_state = None
        n.lifetime = None

    def _assert_distinct(self, op, n, deps):
        if len(set(deps)) != len(deps) or len(set(n.deps)) != len(n.deps):
            raise KernelError(f"{op}: {n.id} needs distinct dependencies")

    def _activate(self, n):
        n.active = True
        if n.kind == "state" or n.ended:
            return
        self._open_lifetime(n)
        if n.seed_deps:
            n.deps = n.seed_deps
            n.inputs = [_Input() for _ in n.deps]
            n.seed_deps = None
        for i in range(len(n.deps)):
            self._acquire(n, i)
        self._down(n, self._first_run(n))

    def _first_run(self, n):
        dep_error = next((inp.ended for inp in n.inputs if inp.ended and inp.ended[0] == "ERROR"), None)
        out = [[dep_error]] if dep_error and n.terminal["error"] == "auto" else self._invoke(n)
        for inp in n.inputs:
            inp.frames = []
        all_ended = len(n.deps) > 0 and all(inp.ended for inp in n.inputs)
        return [*out, [_COMPLETE]] if n.terminal["complete"] == "auto" and all_ended else out

    def _acquire(self, n, i):
        dep = self._node_of(n.deps[i])
        if not dep.active:
            self._activate(dep)
        dep.subs.append(_Sub("node", n.id, dep=i))
        n.inputs[i] = self._snapshot_input(dep)

    def _snapshot_of(self, n):
        snap = [("DATA", v) for v in n.values]
        if n.ended:
            snap.append(n.ended)
        return snap

    def _snapshot_input(self, dep):
        snap = self._snapshot_of(dep)
        return _Input(dep.has, dep.cache, dep.ended, [snap] if snap else [])

    def _release(self, dep, sub):
        try:
            dep.subs.remove(sub)
        except ValueError:
            pass
        if not dep.subs and dep.active:
            self._deactivate(dep)

    def _release_deps(self, n):
        for i, dep_id in enumerate(n.deps):
            dep = self._node_of(dep_id)
            sub = next((s for s in dep.subs if s.kind == "node" and s.id == n.id and s.dep == i), None)
            if sub is not None:
                self._release(dep, sub)

    def _deactivate(self, n):
        n.active = False
        if n.kind == "state":
            return
        self._close_lifetime(n)
        n.private_state = None
        n.inputs = [_Input() for _ in n.deps]
        if not n.ended:
            n.has = False
            n.cache = None
            n.values = []

    # ---- invocation (K4) ----
    def _invoke(self, n):
        lifetime = n.lifetime
        ctx = Ctx(self, n, lifetime)
        if n.seed_note is not _UNSET:
            ctx.seed = n.seed_note
            n.seed_note = _UNSET
        self._running = n
        try:
            if not lifetime.setup_done:
                lifetime.setup_done = True
                if n.setup is not None:
                    cleanup = n.setup(ctx)
                    if callable(cleanup):
                        lifetime.cleanup = cleanup
            n.fn(ctx)
        except Exception as e:
            return [[("ERROR", _message_of(e))]]
        finally:
            self._running = None
            ctx._invoking = False
        return ctx._out

    def _later(self, n, lifetime, frames):
        if not frames:
            return
        if self._staging is not None and lifetime.open:
            self._stage(n, lifetime, [m for f in frames for m in f])
            return

        def op():
            if not lifetime.open or n.lifetime is not lifetime:
                return
            self._run_wave([(n, frames)])

        self._request(op)

    # ---- waves (K2, K6) ----
    def _mark_pending(self, n):
        for sub in n.subs:
            if sub.kind != "node":
                continue
            m = self._nodes[sub.id]
            if m.ended:
                continue
            m.pending_deps.add(sub.dep)
            if not m.pending:
                m.pending = True
                if not m.quiet:
                    self._mark_pending(m)

    def _deliver_to_sink(self, sub, frm, msgs):
        if self.trace is not None:
            self.trace.append({"to": sub.id, "from": frm, "msgs": msgs})
        if sub.cb is None:
            return
        try:
            sub.cb(msgs)
        except Exception as e:
            self._report({"source": f"sink {sub.id}", "error": _message_of(e)})

    def _down(self, n, frames):
        self._deliver(n, self._apply(n, frames))

    def _apply(self, n, frames):
        out = []
        for frame in frames:
            if n.ended:
                break
            f = []
            values = []
            for m in frame:
                t = m[0]
                if t == "DATA":
                    n.has = True
                    n.cache = m[1]
                    values.append(m[1])
                elif t == "INVALIDATE":
                    if not n.has:
                        continue
                    n.has = False
                    n.cache = None
                    n.values = []
                elif t == "COMPLETE" or t == "ERROR":
                    n.ended = m
                f.append(m)
            if values:
                n.values = values
            if f:
                out.append(f)
        return out

    def _deliver(self, n, out):
        flags = []
        any_mark = False
        for f in out:
            fl = False
            for m in f:
                t = m[0]
                if t == "DATA" or t == "RESOLVED" or t == "INVALIDATE" or t == "COMPLETE" or t == "ERROR":
                    fl = True
                    break
            flags.append(fl)
            if fl:
                any_mark = True
        if n.pending and not any_mark:
            out = [*out, [_RESOLVED]]
            flags.append(True)
            any_mark = True
        if not out:
            return
        if not n.pending and any_mark:
            n.pending = True
            self._mark_pending(n)
        n.pending = False
        out = [[_PENDING, *f] if fl else f for f, fl in zip(out, flags)]
        subs = n.subs
        nodes = self._nodes
        for sub in (subs[:] if len(subs) > 1 else subs and [subs[0]]):
            if sub.kind == "sink":
                for f in out:
                    self._deliver_to_sink(sub, n.id, f)
            else:
                self._receive(nodes[sub.id], sub.dep, out)
        if n.ended:
            self._close_lifetime(n)

    def _receive(self, m, i, frames):
        if m.ended:
            return
        inp = m.inputs[i]
        settled = False
        append = inp.frames.append
        for frame in frames:
            f = frame[1:] if frame[0][0] == "PENDING" else frame
            for msg in f:
                t = msg[0]
                if t == "DATA":
                    inp.has = True
                    inp.value = msg[1]
                    settled = True
                elif t == "INVALIDATE":
                    inp.has = False
                    inp.value = None
                    settled = True
                elif t == "RESOLVED":
                    settled = True
                elif t == "COMPLETE" or t == "ERROR":
                    inp.ended = msg
                    settled = True
            append(f)
        if settled:
            m.pending_deps.discard(i)
        if not m.pending_deps:
            self._settle(m)

    def _settle(self, m):
        # One scan; anything but plain values and COMPLETE goes to the full path.
        inputs = m.inputs
        any_frames = value = complete = False
        for inp in inputs:
            fr = inp.frames
            if not fr:
                continue
            any_frames = True
            for f in fr:
                for x in f:
                    t = x[0]
                    if t == "DATA" or t == "RESOLVED":
                        value = True
                    elif t == "COMPLETE":
                        complete = True
                    else:  # INVALIDATE or ERROR
                        return self._settle_slow(m)
        if not any_frames:
            return
        if m.quiet:
            return self._settle_slow(m)
        term = m.terminal
        out = self._invoke(m) if value or (complete and term["complete"] == "manual") else []
        for inp in inputs:
            inp.frames = []
            inp.invalidated = False
        if term["complete"] == "auto":
            for inp in inputs:
                if not inp.ended:
                    break
            else:
                if not any(_is_terminal(x) for f in out for x in f):
                    out = [*out, [_COMPLETE]]
        self._deliver(m, self._apply(m, out))

    def _settle_slow(self, m):
        if not any(inp.frames for inp in m.inputs):
            return

        def clear():
            for inp in m.inputs:
                inp.frames = []
                inp.invalidated = False

        dep_error = next((x for inp in m.inputs for f in inp.frames for x in f if x[0] == "ERROR"), None)
        if dep_error and m.terminal["error"] == "auto":
            invalidated_first = any(f and f[0][0] == "INVALIDATE" for inp in m.inputs for f in inp.frames)
            clear()
            end = [[_INV], [dep_error]] if invalidated_first else [[dep_error]]
            if m.quiet:
                m.pending = False
                self._later(m, m.lifetime, end)
            else:
                self._down(m, end)
            return

        lead = []
        invalidated = False
        for inp in m.inputs:
            at = -1
            for k in range(len(inp.frames) - 1, -1, -1):
                f = inp.frames[k]
                if f and f[0][0] == "INVALIDATE":
                    at = k
                    break
            if at < 0:
                continue
            inp.frames = inp.frames[at + 1:]
            inp.invalidated = True
            invalidated = True
        if invalidated and m.invalidate == "auto":
            lead = self._apply(m, [[_INV]])

        runs = invalidated and m.invalidate == "manual"
        if not runs:
            term = m.terminal
            for inp in m.inputs:
                for f in inp.frames:
                    for x in f:
                        t = x[0]
                        if t == "DATA" or t == "RESOLVED":
                            runs = True
                            break
                        if t == "COMPLETE" and term["complete"] == "manual":
                            runs = True
                            break
                        if t == "ERROR" and term["error"] == "manual":
                            runs = True
                            break
                    if runs:
                        break
                if runs:
                    break
        out = self._invoke(m) if runs else []
        clear()

        all_ended = all(inp.ended for inp in m.inputs)
        postlude = (
            [_COMPLETE]
            if m.terminal["complete"] == "auto" and all_ended and not any(_is_terminal(x) for f in out for x in f)
            else []
        )

        if m.quiet:
            if lead:
                self._deliver(m, lead)
            m.pending = False
            self._later(m, m.lifetime, out)
            if postlude:
                self._later(m, m.lifetime, [postlude])
            return
        self._deliver(m, [*lead, *self._apply(m, [*out, postlude] if postlude else out)])

    def _run_wave(self, entries):
        entries = [(n, fr) for n, fr in entries if not n.ended]
        if not entries:
            return
        applied = [(n, self._apply(n, fr)) for n, fr in entries]
        for n, out in applied:
            if not n.pending and _has_mark(out):
                n.pending = True
                self._mark_pending(n)
        for n, out in applied:
            self._deliver(n, out)

    # ---- replace / rewire ----
    def _replace_node(self, n, deps, fn, opts):
        opts = opts or {}
        old = n.lifetime
        if old is not None:
            old.open = False
            if old.controller is not None:
                old.controller.aborted = True
        if old is None:
            n.deps = []
        self._exchange(n, deps)
        if old is not None and old.cleanup:
            self._run_cleanup(n, old.cleanup)
        n.fn = fn
        n.setup = opts.get("setup")
        n.recipe = opts.get("recipe")
        n.seed_note = _UNSET
        n.declared_deps = deps
        n.seed_deps = None
        n.lifetime = None
        n.values = []
        n.has = False
        n.cache = None
        n.ended = None
        n.private_state = None
        n.pending = False
        n.pending_deps.clear()
        if not n.active:
            return
        self._open_lifetime(n)
        n.inputs = [self._snapshot_input(self._node_of(d)) for d in deps]
        self._apply(n, self._first_run(n))
        snap = self._snapshot_of(n)
        node_subs = []
        for sub in list(n.subs):
            if sub.kind == "sink":
                self._deliver_to_sink(sub, n.id, [("START",), *snap])
            else:
                self._node_of(sub.id).inputs[sub.dep] = _Input()
                node_subs.append(sub)
        if snap:
            if _has_mark([snap]):
                n.pending = True
                self._mark_pending(n)
                n.pending = False
            for sub in node_subs:
                self._receive(self._node_of(sub.id), sub.dep, [snap])
        if n.ended:
            self._close_lifetime(n)

    def _rewire_node(self, n, deps):
        added = self._exchange(n, deps)
        if any(n.inputs[i].frames for i in added):
            self._settle(n)

    def _exchange(self, n, deps):
        if not n.active:
            n.deps = deps
            n.inputs = [_Input() for _ in deps]
            return []
        held = {}
        for i, dep_id in enumerate(n.deps):
            dep = self._node_of(dep_id)
            held[dep_id] = (n.inputs[i], next((s for s in dep.subs if s.kind == "node" and s.id == n.id and s.dep == i), None))
        added = []
        inputs = []
        for i, dep_id in enumerate(deps):
            kept = held.pop(dep_id, None)
            if kept is None:
                added.append(i)
                inputs.append(_Input())
            else:
                kept[1].dep = i
                inputs.append(kept[0])
        n.inputs = inputs
        n.deps = deps
        for i in added:
            self._acquire(n, i)
        for dep_id, (_, sub) in held.items():
            self._release(self._node_of(dep_id), sub)
        return added

    # ---- host input ----
    def _resolve_staged(self, n, msgs):
        cur = n.cache if n.has else None
        out = []
        for m in msgs:
            if m[0] == "INVALIDATE":
                cur = None
            if m[0] != "DATA":
                out.append(m)
                continue
            if not isinstance(m[1], _Deferred):
                cur = m[1]
                out.append(m)
                continue
            v = m[1].fn(cur)
            if v is cur:
                continue
            cur = v
            out.append(("DATA", v))
        return out

    def _host_input(self, id, msg):
        n = self._node_of(id)
        if n.kind != "state":
            raise KernelError(f"{id} is not a state node")
        if n.ended:
            raise KernelError(f"{id} has ended")
        if self._staging is not None:
            self._stage(n, None, [msg])
            return

        def op():
            if n.ended:
                raise KernelError(f"{id} has ended")
            msgs = self._resolve_staged(n, [msg])
            if msgs:
                self._run_wave([(n, [msgs])])

        self._request(op)

    # ---- public surface ----
    def state(self, id, initial=_UNSET):
        self._make_node(id, "state", [], None, {}, initial)
        return id

    def node(self, id, deps, fn, opts=None):
        self._make_node(id, "node", deps, fn, opts, _UNSET)
        return id

    def subscribe(self, sink_id, id, cb=None):
        n = self._node_of(id)

        def op():
            if any(s.kind == "sink" and s.id == sink_id for s in n.subs):
                return
            if not n.active:
                self._activate(n)
            sub = _Sub("sink", sink_id, cb=cb)
            n.subs.append(sub)
            self._deliver_to_sink(sub, id, [("START",), *self._snapshot_of(n)])

        self._request(op)

    def unsubscribe(self, sink_id, id):
        n = self._node_of(id)

        def op():
            sub = next((s for s in n.subs if s.kind == "sink" and s.id == sink_id), None)
            if sub is not None:
                self._release(n, sub)

        self._request(op)

    def replace(self, id, deps, fn, opts=None):
        n = self._node_of(id)
        if n.kind != "node":
            raise KernelError(f"{id} is not a computed node")
        self._assert_distinct("replace", n, deps)
        for d in deps:
            if d == id or self._depends_on(self._node_of(d), id):
                raise KernelError(f"replace: {id} would depend on itself through {d}")
        deps = list(deps)
        self._request(lambda: self._replace_node(n, deps, fn, opts))

    def set(self, id, value):
        self._host_input(id, ("DATA", _Deferred(value) if callable(value) else value))

    def invalidate(self, id):
        self._host_input(id, _INV)

    def complete(self, id):
        self._host_input(id, _COMPLETE)

    def error(self, id, err):
        self._host_input(id, ("ERROR", err))

    def batch(self, body):
        if inspect.iscoroutinefunction(body):
            raise KernelError("batch body is an async function; await first, then batch the writes")
        if self._staging is not None:
            return body()
        self._staging = {}
        self._batch_requests = []
        try:
            result = body()
            staged, requests = self._staging, self._batch_requests
        finally:
            self._staging = None
            self._batch_requests = None

        def commit():
            self._queue[0:0] = requests
            resolved = [(id, entry, self._resolve_staged(self._node_of(id), entry["msgs"])) for id, entry in staged.items()]
            entries = []
            for id, entry, msgs in resolved:
                if not msgs:
                    continue
                lt = entry["lifetime"]
                node = self._node_of(id)
                if lt is not None and not (lt.open and node.lifetime is lt):
                    continue
                entries.append((node, _prepare(msgs)))
            self._run_wave(entries)

        self._request(commit)
        return result

    def get(self, id):
        n = self._node_of(id)
        return {"active": n.active, "has": n.has, "value": n.cache, "values": list(n.values), "ended": n.ended}

    def idle(self):
        return not self._busy and self._staging is None

    def status(self, id):
        n = self._node_of(id)
        return {
            "cache": "empty" if not n.has else "stale" if n.pending else "ready",
            "output": "open" if not n.ended else "completed" if n.ended[0] == "COMPLETE" else "errored",
            "lifecycle": "closing" if n.lifetime and not n.lifetime.open else "active" if n.active else "inactive",
        }

    def describe(self):
        return [{"id": n.id, "kind": n.kind, "deps": list(n.deps), "quiet": n.quiet} for n in self._nodes.values()]


def derived(fn):
    """Reference sugar.mjs derived: run fn on the latest values once every dep has one."""

    def node_fn(ctx):
        deps = ctx.deps
        for d in deps:
            if not d.has:
                return
        ctx.down([("DATA", fn(*[d.value for d in deps]))])

    return node_fn


def derived_direct(fn):
    """Package-side sugar: reads the node's input records directly instead of through views."""

    def node_fn(ctx):
        inputs = ctx._n.inputs
        for inp in inputs:
            if not inp.has:
                return
        ctx.down([("DATA", fn(*[inp.value for inp in inputs]))])

    return node_fn
