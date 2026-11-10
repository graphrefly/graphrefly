------------------------- MODULE kernel_lifetime -------------------------
(***************************************************************************
GraphReFly D797 kernel — lifetimes, request order, batch, rewire and replace.

A candidate model for the D797 draft rules R-lifetime and R-request-order,
the second D797 model beside kernel_wave. Written 2026-11-09 for
graphrefly:B140; the older wave_* models verify the currently active rules and
are retired or rescoped at activation. Status: draft, like the rules it checks.

kernel_wave checks what happens inside a wave. Here a wave is one step: each
open node in the cone of its source runs once, in dependency order. What this
model checks is around the waves: which nodes are active, which lifetime a ctx
belongs to, when cleanups run, and in what order requests run.

Topology: a state S, computed P over S, A over P, M over A, and N over {A} at
first. A rewire or replace may give N the dependencies {P}, {A} or {P, A}, so
P is shared between A and N. Host sinks can subscribe to M and N. All nodes
use the default auto terminal policies.

Every request is one step that runs to its end; the requests a sink callback,
a node function or a cleanup makes while it runs (phase "busy") wait in the
queue and run after it, in the order they were made. A write to S from a node
function is one of them, also when S is that node's own upstream: it reaches
the node in a later wave and never reenters it (R-invocation, decided by the
user 2026-11-09; RunOncePerRequest, FIFO, AfterMaker). A node's function, each
time it runs, sends DATA and chooses one more effect: none, register one
onDeactivation cleanup, start late work that keeps its ctx, set private
state, or send COMPLETE. P and M choose none; A chooses none or a cleanup; N
may choose any of them. Late work later either calls the old ctx.down, which
is a request, or registers a cleanup through the old ctx.
A batch body, opened at a wave boundary or from a callback while a request
runs, stages writes to S and topology requests; it returns or throws. Opened
at a boundary, its commit runs when it returns; opened while a request runs,
its commit waits in the queue like any other request.

The step semantics follow reference/kernel/kernel.mjs: activation acquires the
dependencies in order, activating them, then runs the function once; the last
release deactivates a node, which closes its lifetime (releases its
dependencies, then runs its cleanups) and drops its private state and, for a
computed node that has not ended, its values; an ended node closes its
lifetime but keeps its subscribers; each run replaces the previous run's cleanup
registrations without running them; late output is dropped unless its
lifetime is still the node's open one; rewire acquires added dependencies
before it releases removed ones; replace closes the instance and starts a new
one under the same subscribers.

Invariants, each mutation-checked (see formal/README.md):
  ActiveIffDemand        a node is active exactly while it has a sink or a
                         dependent that holds it (R-lifetime)
  EdgesMatchDeps         a node holds its dependencies exactly while it is
                         active and has not ended (R-lifetime, R-terminals)
  OpenIffLive            a computed node's lifetime is open exactly while it
                         is active and has not ended (R-lifetime)
  InactiveHoldsNothing   an inactive computed node holds no private state, and
                         no values unless it has ended (R-lifetime,
                         R-subscription)
  StateKeeps             the state node keeps its value across deactivation
  PrivOfCurrentLifetime  private state belongs to the current lifetime
  RetainedFromCurrentLifetime
                         a computed node's values were sent through a ctx of
                         its current lifetime: old ctx output is dropped
  CleanupOnce            a cleanup runs at most once
  ClosedLiveRan          every live cleanup of a closed lifetime has run, one
                         registered after close included (it runs at once)
  OpenNotRun             no cleanup of an open lifetime has run
  DroppedNotRun          a registration replaced by a later run never runs
  LiveIsLatestRun        the live registrations of an open lifetime are its
                         latest run's
  RunOncePerRequest      within one request a function runs at most once, so a
                         batch's writes commit as one wave (R-request-order)
  KeptUpstreamStays      no node's lifetime closes and opens again within one
                         request, other than the node a replace renews: rewire
                         and replace acquire before they release
  RewireKeeps            rewire keeps the instance: its lifetime, private
                         state, values and sinks (R-request-order)
  FIFO                   requests run in the order they were made
  AfterMaker             a request made while another runs starts only after
                         that one has finished
  IdleDrained            nothing is queued at a wave boundary
  BodyAfterCommit        a batch's topology requests run after its commit
  ThrownDropped          the requests of a body that threw never run
  BatchThrowNothing      a body that throws changes nothing

Out of scope here: nested batches, late output
inside a batch body, manual policies, ERROR, INVALIDATE and quiet nodes, and
the signal (it is aborted exactly when the lifetime closes, which is "open").
 ***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS MaxReq, MaxBatches

Nodes    == {"S", "P", "A", "M", "N"}
Computed == {"P", "A", "M", "N"}
Sinks    == {"M", "N"}
Rank == [n \in Nodes |-> CASE n = "S" -> 0 [] n = "P" -> 1 [] n = "A" -> 2
                           [] n = "M" -> 3 [] n = "N" -> 4]
InitDeps == [n \in Nodes |-> CASE n = "S" -> {} [] n = "P" -> {"S"} [] n = "A" -> {"P"}
                               [] n = "M" -> {"A"} [] n = "N" -> {"A"}]
DepChoices == {{"P"}, {"A"}, {"P", "A"}}

\* One choice per computed node for the runs of one request.
\* P and M only send DATA; A may register a cleanup; N has every effect.
ChoiceFns == {[P |-> "plain", A |-> a, M |-> "plain", N |-> x] :
                a \in {"plain", "cleanup"},
                x \in {"plain", "cleanup", "late", "priv", "end"}}

Rq(t, n, d) == [t |-> t, n |-> n, d |-> d, w |-> <<"", 0>>, s |-> 0, c |-> FALSE]
TopoReq == {Rq("sub", x, {}) : x \in Sinks} \cup {Rq("unsub", x, {}) : x \in Sinks}
           \cup {Rq("rewire", "N", D) : D \in DepChoices}
           \cup {Rq("replace", "N", D) : D \in DepChoices}
Req == TopoReq \cup {Rq("set", "S", {}), Rq("complete", "S", {})}
LateReq(w) == [Rq("late", w[1], {}) EXCEPT !.w = w]
CommitReq(s, c) == [Rq("commit", "S", {}) EXCEPT !.s = s, !.c = c]

VARIABLE k
vars == <<k>>

Min(S) == CHOOSE x \in S : \A y \in S : Rank[x] <= Rank[y]
Demand(s, d) == (d \in Sinks /\ s.sink[d]) \/ (\E m \in Nodes : <<d, m>> \in s.edge)

\* The live registrations of lifetime lid of n run once each, in registration order.
RunCleanups(s, n, lid) ==
  LET cl == s.cl
  IN [s EXCEPT !.cl = [i \in DOMAIN cl |->
        IF cl[i].n = n /\ cl[i].lid = lid /\ cl[i].st = "live" /\ cl[i].runs = 0
        THEN [cl[i] EXCEPT !.runs = @ + 1] ELSE cl[i]]]

OpenLife(s, n) ==
  [s EXCEPT !.life[n] = @ + 1, !.open[n] = TRUE,
            !.reopened = IF n \in s.closedNow /\ n # s.replTarget THEN @ \cup {n} ELSE @]

RECURSIVE Activate(_, _, _), AcquireAll(_, _, _, _), Acquire(_, _, _, _),
          FirstRun(_, _, _), Run(_, _, _), End(_, _), AutoComplete(_, _),
          CloseLife(_, _), ReleaseAll(_, _, _), Release(_, _, _), Deactivate(_, _)

\* The function of n runs once in its open lifetime. This run's registrations
\* replace the previous run's, which are dropped without running.
Run(s, n, c) ==
  LET lid == s.life[n]
      r   == s.runNo[n] + 1
      ch  == c[n]
      cl  == s.cl
      cl1 == [i \in DOMAIN cl |->
                IF cl[i].n = n /\ cl[i].lid = lid /\ cl[i].st = "live" /\ cl[i].runs = 0
                THEN [cl[i] EXCEPT !.st = "dropped"] ELSE cl[i]]
      cl2 == IF ch = "cleanup"
             THEN Append(cl1, [n |-> n, lid |-> lid, run |-> r, st |-> "live", runs |-> 0])
             ELSE cl1
      s1  == [s EXCEPT !.runNo[n] = r, !.runs[n] = @ + 1, !.has[n] = TRUE,
                       !.valLife[n] = lid, !.cl = cl2,
                       !.late = IF ch = "late" THEN @ \cup {<<n, lid>>} ELSE @,
                       !.priv[n] = IF ch = "priv" THEN lid ELSE @]
  IN IF ch = "end" THEN End(s1, n) ELSE s1

\* A terminal ends n for good and closes its lifetime; n stays subscribed.
End(s, n) == CloseLife([s EXCEPT !.ended[n] = TRUE], n)

AutoComplete(s, n) ==
  IF ~s.ended[n] /\ s.deps[n] # {} /\ \A d \in s.deps[n] : s.ended[d] THEN End(s, n) ELSE s

\* Closing: release the dependencies in order, then run this lifetime's cleanups.
CloseLife(s, n) ==
  IF ~s.open[n] THEN s
  ELSE LET s1 == [s EXCEPT !.open[n] = FALSE, !.closedNow = @ \cup {n}]
       IN RunCleanups(ReleaseAll(s1, n, s1.deps[n]), n, s.life[n])

ReleaseAll(s, m, D) ==
  IF D = {} THEN s ELSE LET d == Min(D) IN ReleaseAll(Release(s, d, m), m, D \ {d})

Release(s, d, m) ==
  LET s1 == [s EXCEPT !.edge = @ \ {<<d, m>>}]
  IN IF s1.active[d] /\ ~Demand(s1, d) THEN Deactivate(s1, d) ELSE s1

\* A state node keeps its value; a computed node closes its lifetime and drops its
\* private state and, unless it has ended, its values.
Deactivate(s, n) ==
  LET s1 == [s EXCEPT !.active[n] = FALSE]
  IN IF n = "S" THEN s1
     ELSE LET s2 == CloseLife(s1, n)
          IN [s2 EXCEPT !.priv[n] = 0, !.has[n] = IF s2.ended[n] THEN @ ELSE FALSE]

\* An ended node is connected and gives its snapshot, but never runs again.
Activate(s, n, c) ==
  IF s.active[n] THEN s
  ELSE LET s1 == [s EXCEPT !.active[n] = TRUE]
       IN IF n = "S" \/ s1.ended[n] THEN s1
          ELSE LET s2 == OpenLife(s1, n)
               IN FirstRun(AcquireAll(s2, n, s2.deps[n], c), n, c)

AcquireAll(s, m, D, c) ==
  IF D = {} THEN s ELSE LET d == Min(D) IN AcquireAll(Acquire(s, d, m, c), m, D \ {d}, c)

Acquire(s, d, m, c) == LET s1 == Activate(s, d, c) IN [s1 EXCEPT !.edge = @ \cup {<<d, m>>}]

\* The first run sees the snapshots; auto COMPLETE follows if every dependency has ended.
FirstRun(s, n, c) == AutoComplete(Run(s, n, c), n)

\* ---- waves (one step each) ----
RECURSIVE ReachFrom(_, _)
ReachFrom(s, X) ==
  LET nxt == X \cup {m \in Nodes : \E x \in X : <<x, m>> \in s.edge}
  IN IF nxt = X THEN X ELSE ReachFrom(s, nxt)
Cone(s, src) == ReachFrom(s, {src}) \ {src}

\* A node in the cone runs once if the wave carries values, then completes if every
\* dependency has ended.
Settle(s, m, c, vals) ==
  IF s.ended[m] \/ ~s.open[m] THEN s
  ELSE AutoComplete(IF vals THEN Run(s, m, c) ELSE s, m)

RECURSIVE Propagate(_, _, _, _)
Propagate(s, todo, c, vals) ==
  IF todo = {} THEN s
  ELSE LET m == Min(todo) IN Propagate(Settle(s, m, c, vals), todo \ {m}, c, vals)

\* A wave from S: sets values written, then COMPLETE if term. An ended S refuses input.
SourceWave(s, c, sets, term) ==
  IF s.ended["S"] THEN s
  ELSE LET cone == Cone(s, "S")
           s1   == [s EXCEPT !.sGen = @ + sets, !.ended["S"] = @ \/ term]
       IN Propagate(s1, cone, c, sets > 0)

\* Late output through the ctx of lifetime w[2]: dropped unless it is n's open lifetime.
LateOut(s, w, c) ==
  LET n == w[1]
  IN IF ~(s.open[n] /\ s.life[n] = w[2]) THEN s
     ELSE Propagate([s EXCEPT !.has[n] = TRUE, !.valLife[n] = w[2]], Cone(s, n), c, TRUE)

\* ---- topology requests ----
Sub(s, x, c) ==
  IF s.sink[x] THEN s ELSE LET s1 == Activate(s, x, c) IN [s1 EXCEPT !.sink[x] = TRUE]

Unsub(s, x) ==
  IF ~s.sink[x] THEN s
  ELSE LET s1 == [s EXCEPT !.sink[x] = FALSE]
       IN IF s1.active[x] /\ ~Demand(s1, x) THEN Deactivate(s1, x) ELSE s1

\* Shared by rewire and replace: kept dependencies keep their connection, added ones
\* are acquired before removed ones are released. An inactive node only changes its list.
Exchange(s, n, D, c) ==
  IF ~s.active[n] THEN [s EXCEPT !.deps[n] = D]
  ELSE LET added   == D \ s.deps[n]
           removed == s.deps[n] \ D
           s1 == [s EXCEPT !.deps[n] = D]
       IN ReleaseAll(AcquireAll(s1, n, added, c), n, removed)

\* Rewire keeps the instance; the added dependencies' snapshots are one input wave.
\* An ended node refuses a rewire.
Rewire(s, D, c) ==
  IF s.ended["N"] THEN s
  ELSE LET added == D \ s.deps["N"]
           s1    == Exchange(s, "N", D, c)
           s2    == IF s.active["N"] /\ \E d \in added : s1.has[d] \/ s1.ended[d]
                    THEN Settle(s1, "N", c, \E d \in added : s1.has[d])
                    ELSE s1
           keeps == ~(s.active["N"] /\ ~s.ended["N"])
                    \/ /\ s2.life["N"] = s.life["N"]
                       /\ (s.priv["N"] # 0 => s2.priv["N"] = s.priv["N"])
                       /\ (s.has["N"] => s2.has["N"])
                       /\ s2.sink = s.sink
       IN [s2 EXCEPT !.rwOK = @ /\ keeps]

\* Replace closes the instance (its late output is dropped, its cleanups run after the
\* exchange) and starts a new one under the same subscribers, as on a first activation.
Replace(s, D, c) ==
  LET n   == "N"
      old == s.open[n]
      s0  == [s EXCEPT !.replTarget = n]
      s1  == IF old THEN [s0 EXCEPT !.open[n] = FALSE, !.closedNow = @ \cup {n}]
             ELSE [s0 EXCEPT !.deps[n] = {}]   \* an ended instance has released its dependencies
      s2  == Exchange(s1, n, D, c)
      s3  == IF old THEN RunCleanups(s2, n, s.life[n]) ELSE s2
      s4  == [s3 EXCEPT !.has[n] = FALSE, !.ended[n] = FALSE, !.priv[n] = 0]
  IN IF ~s4.active[n] THEN s4 ELSE FirstRun(OpenLife(s4, n), n, c)

Exec(s, r, c) ==
  CASE r.t = "sub"      -> Sub(s, r.n, c)
    [] r.t = "unsub"    -> Unsub(s, r.n)
    [] r.t = "set"      -> SourceWave(s, c, 1, FALSE)
    [] r.t = "complete" -> SourceWave(s, c, 0, TRUE)
    [] r.t = "rewire"   -> Rewire(s, r.d, c)
    [] r.t = "replace"  -> Replace(s, r.d, c)
    [] r.t = "late"     -> LateOut(s, r.w, c)
    [] r.t = "commit"   -> SourceWave(s, c, r.s, r.c)

\* ---- requests ----
Zero == [n \in Nodes |-> 0]
Entry(s, r, tag) == [id |-> s.nid + 1, r |-> r, maker |-> s.cur, tag |-> tag]

\* The request-order checks are made as each request starts, and what one request ran
\* or reopened is checked when it ends; the flags stay false once a check fails.
Start(s, e, c) ==
  LET s0 == [s EXCEPT !.phase = "busy", !.cur = e.id,
                      !.fifoOK  = @ /\ e.id = s.lastDone + 1,
                      !.afterOK = @ /\ e.maker \in s.finished \cup {0},
                      !.bodyOK  = @ /\ (e.tag # 0 /\ e.r.t # "commit" => e.tag \in s.committed),
                      !.thrownOK = @ /\ e.tag \notin s.thrown,
                      !.lastDone = e.id,
                      !.committed = IF e.r.t = "commit" THEN @ \cup {e.tag} ELSE @]
      s1 == Exec(s0, e.r, c)
  IN [s1 EXCEPT !.runOK = @ /\ \A m \in Nodes : s1.runs[m] <= 1,
                !.reopenOK = @ /\ s1.reopened = {},
                !.runs = Zero, !.closedNow = {}, !.reopened = {}, !.replTarget = ""]

Issued(s, e) == [s EXCEPT !.nid = @ + 1]

\* The host makes a request at a wave boundary; it runs at once.
HostRequest ==
  /\ k.phase = "idle" /\ k.nid < MaxReq
  /\ \E r \in Req, c \in ChoiceFns :
       LET e == Entry(k, r, 0) IN k' = Start(Issued(k, e), e, c)

\* A sink callback, node function or cleanup makes a request while one runs: it waits.
CallbackRequest ==
  /\ k.phase = "busy" /\ k.nid < MaxReq
  /\ \E r \in Req :
       LET e == Entry(k, r, 0) IN k' = [Issued(k, e) EXCEPT !.queue = Append(@, e)]

\* Late work calls its old ctx.down: a request like any other.
LateFire ==
  /\ k.phase \in {"idle", "busy"} /\ k.nid < MaxReq
  /\ \E w \in k.late :
       LET e  == Entry(k, LateReq(w), 0)
           s1 == [Issued(k, e) EXCEPT !.late = @ \ {w}]
       IN IF k.phase = "idle"
          THEN \E c \in ChoiceFns : k' = Start(s1, e, c)
          ELSE k' = [s1 EXCEPT !.queue = Append(@, e)]

\* Late work registers a cleanup through its old ctx: after close it runs once at once,
\* otherwise it joins the current run's registrations.
LateCleanup ==
  /\ k.phase \in {"idle", "busy"}
  /\ \E w \in k.late :
       LET n == w[1]
           current == k.open[n] /\ k.life[n] = w[2]
           reg == [n |-> n, lid |-> w[2], run |-> IF current THEN k.runNo[n] ELSE 0,
                 st |-> "live", runs |-> IF current THEN 0 ELSE 1]
       IN k' = [k EXCEPT !.late = @ \ {w}, !.cl = Append(@, reg)]

\* The running request ends; the queue drains in order before the boundary.
EndRequest ==
  /\ k.phase = "busy"
  /\ LET s1 == [k EXCEPT !.finished = @ \cup {k.cur}]
     IN IF k.queue # <<>>
        THEN \E c \in ChoiceFns : k' = Start([s1 EXCEPT !.queue = Tail(@)], Head(k.queue), c)
        ELSE k' = [s1 EXCEPT !.phase = "idle", !.cur = 0]

\* ---- batch ----
NoBatch == [id |-> 0, from |-> "idle", sets |-> 0, term |-> FALSE, reqs |-> <<>>, snap |-> <<>>]

Proj(s) == <<s.active, s.sink, s.deps, s.edge, s.has, s.valLife, s.ended, s.life, s.open,
             s.priv, s.cl, s.late, s.sGen, s.queue, s.nid, s.lastDone, s.finished>>

\* The body runs at once, at a boundary or from a callback while a request runs.
BatchBegin ==
  /\ k.phase \in {"idle", "busy"} /\ k.nid < MaxReq /\ k.nbatch < MaxBatches
  /\ k' = [k EXCEPT !.phase = "body", !.nbatch = @ + 1,
                    !.batch = [id |-> k.nbatch + 1, from |-> k.phase, sets |-> 0, term |-> FALSE,
                               reqs |-> <<>>, snap |-> Proj(k)]]

\* A write after a staged COMPLETE, or to an ended S, is refused to the body.
BodySet ==
  /\ k.phase = "body" /\ ~k.ended["S"] /\ ~k.batch.term /\ k.batch.sets < 2
  /\ k' = [k EXCEPT !.batch.sets = @ + 1]

BodyComplete ==
  /\ k.phase = "body" /\ ~k.ended["S"] /\ ~k.batch.term
  /\ k' = [k EXCEPT !.batch.term = TRUE]

BodyRequest ==
  /\ k.phase = "body" /\ k.nid + Len(k.batch.reqs) + 2 <= MaxReq
  /\ \E r \in TopoReq : k' = [k EXCEPT !.batch.reqs = Append(@, r)]

BodyThrow ==
  /\ k.phase = "body"
  /\ LET s1 == [k EXCEPT !.phase = k.batch.from, !.thrown = @ \cup {k.batch.id}, !.batch = NoBatch]
     IN k' = [s1 EXCEPT !.btOK = @ /\ Proj(s1) = k.batch.snap]

\* The body returns: its writes commit as one wave, then its requests run in order.
\* The commit is a request: at a boundary it runs now; during a request it is queued.
BodyReturn ==
  /\ k.phase = "body"
  /\ LET b  == k.batch
         ce == Entry(k, CommitReq(b.sets, b.term), b.id)
         n  == Len(b.reqs)
         es == [i \in 1..n |-> [id |-> k.nid + 1 + i, r |-> b.reqs[i], maker |-> ce.id, tag |-> b.id]]
         s1 == [k EXCEPT !.nid = @ + 1 + n, !.batch = NoBatch]
     IN IF b.from = "idle"
        THEN \E c \in ChoiceFns : k' = Start([s1 EXCEPT !.queue = es], ce, c)
        ELSE k' = [s1 EXCEPT !.phase = "busy", !.queue = @ \o <<ce>> \o es]

Init ==
  k = [active |-> [n \in Nodes |-> FALSE], sink |-> [x \in Sinks |-> FALSE],
       deps |-> InitDeps, edge |-> {},
       has |-> [n \in Nodes |-> n = "S"], valLife |-> Zero, ended |-> [n \in Nodes |-> FALSE],
       life |-> Zero, open |-> [n \in Nodes |-> FALSE], priv |-> Zero, runNo |-> Zero,
       cl |-> <<>>, late |-> {}, sGen |-> 0,
       phase |-> "idle", queue |-> <<>>, nid |-> 0, cur |-> 0, lastDone |-> 0, finished |-> {},
       runs |-> Zero, closedNow |-> {}, reopened |-> {}, replTarget |-> "",
       runOK |-> TRUE, reopenOK |-> TRUE, rwOK |-> TRUE, btOK |-> TRUE,
       fifoOK |-> TRUE, afterOK |-> TRUE, bodyOK |-> TRUE, thrownOK |-> TRUE,
       batch |-> NoBatch,
       nbatch |-> 0, thrown |-> {}, committed |-> {}]

Next ==
  \/ HostRequest \/ CallbackRequest \/ LateFire \/ LateCleanup \/ EndRequest
  \/ BatchBegin \/ BodySet \/ BodyComplete \/ BodyRequest \/ BodyThrow \/ BodyReturn

Spec == Init /\ [][Next]_vars

\* ---- invariants ----
Cl(i) == k.cl[i]
CurrentOpen(c) == k.open[c.n] /\ k.life[c.n] = c.lid

ActiveIffDemand == \A n \in Nodes : k.active[n] <=> Demand(k, n)
EdgesMatchDeps ==
  \A d, m \in Nodes :
    (<<d, m>> \in k.edge) <=> (m \in Computed /\ k.active[m] /\ ~k.ended[m] /\ d \in k.deps[m])
OpenIffLive == \A m \in Computed : k.open[m] <=> (k.active[m] /\ ~k.ended[m])
InactiveHoldsNothing ==
  \A m \in Computed : ~k.active[m] => (k.priv[m] = 0 /\ (~k.ended[m] => ~k.has[m]))
StateKeeps == k.has["S"]
PrivOfCurrentLifetime == \A m \in Computed : k.priv[m] # 0 => k.priv[m] = k.life[m]
RetainedFromCurrentLifetime == \A m \in Computed : k.has[m] => k.valLife[m] = k.life[m]
CleanupOnce   == \A i \in DOMAIN k.cl : Cl(i).runs <= 1
ClosedLiveRan == \A i \in DOMAIN k.cl : (Cl(i).st = "live" /\ ~CurrentOpen(Cl(i))) => Cl(i).runs = 1
OpenNotRun    == \A i \in DOMAIN k.cl : CurrentOpen(Cl(i)) => Cl(i).runs = 0
DroppedNotRun == \A i \in DOMAIN k.cl : Cl(i).st = "dropped" => Cl(i).runs = 0
LiveIsLatestRun ==
  \A i \in DOMAIN k.cl : (Cl(i).st = "live" /\ CurrentOpen(Cl(i))) => Cl(i).run = k.runNo[Cl(i).n]
RunOncePerRequest == k.runOK
KeptUpstreamStays == k.reopenOK
RewireKeeps == k.rwOK
\* Ids are given in the order requests are made (a batch's requests right after its
\* commit), so FIFO is: each request that starts is the next id.
FIFO == k.fifoOK
AfterMaker == k.afterOK
IdleDrained == k.phase = "idle" => k.queue = <<>>
BodyAfterCommit == k.bodyOK
ThrownDropped == k.thrownOK /\ \A i \in DOMAIN k.queue : k.queue[i].tag \notin k.thrown
BatchThrowNothing == k.btOK
=============================================================================
