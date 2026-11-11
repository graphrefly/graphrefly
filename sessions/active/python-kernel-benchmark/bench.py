"""Pure-Python kernel port vs the PyO3 binding (public facade and raw _native)."""
import gc, sys, time, platform
sys.path.insert(0, sys.path[0])
import kernel as pk
import kernel_fast as pkf
import kernel_c as pkc
import graphrefly as gr
from graphrefly import _native

def inc(x): return x + 1
def add(*xs): return sum(xs)
def heavy(x):  # ~ a few microseconds of real Python work per run
    s = 0
    for i in range(40): s += i * x
    return x + 1
WORK = {"inc": (inc, add), "heavy": (heavy, add)}

# Each builder returns (setup, step): setup builds and subscribes; step does one unit of host input.
class PyK:
    name = "pure-python"
    def __init__(self): self.g = pk.Graph(); self.i = 0
    def state(self, v): self.i += 1; return self.g.state(f"n{self.i}", v)
    def derived(self, deps, fn): self.i += 1; return self.g.node(f"n{self.i}", deps, pk.derived(fn))
    def sink(self, n): self.g.subscribe("sink" + n, n, lambda m: None)
    def set(self, n, v): self.g.set(n, v)
    def batch(self, body): self.g.batch(body)

class PyFast(PyK):
    name = "pure-python tuned"
    def __init__(self): self.g = pkf.Graph(); self.i = 0
    def derived(self, deps, fn): self.i += 1; return self.g.node(f"n{self.i}", deps, pkf.derived_direct(fn))

class PyC(PyK):
    name = "tuned + mypyc"
    def __init__(self): self.g = pkc.Graph(); self.i = 0
    def derived(self, deps, fn): self.i += 1; return self.g.node(f"n{self.i}", deps, pkc.derived_direct(fn))

class Facade:
    name = "rust (facade)"
    def __init__(self): self.g = gr.Graph(); self.subs = []
    def state(self, v): return self.g.state(v)
    def derived(self, deps, fn): return self.g.derived(deps, fn)
    def sink(self, n): self.subs.append(n.subscribe(lambda m: None))
    def set(self, n, v): n.set(v)
    def batch(self, body): self.g.batch(body)

class Raw:
    name = "rust (raw _native)"
    def __init__(self): self.g = _native.Graph(None); self.subs = []
    def state(self, v): return self.g.state(v, None)
    def derived(self, deps, fn): return self.g.derived(deps, fn, None)
    def sink(self, n): self.subs.append(n.subscribe(lambda k, v: None))
    def set(self, n, v): n.set(v)
    def batch(self, body): self.g.batch(body)

def chain(R, work, depth=100):
    f, _ = WORK[work]; r = R(); s = r.state(0); n = s
    for _ in range(depth): n = r.derived([n], f)
    r.sink(n)
    v = [0]
    def step(): v[0] += 1; r.set(s, v[0])
    return step, depth
def fan(R, work, width=100):
    f, g = WORK[work]; r = R(); s = r.state(0)
    mids = [r.derived([s], f) for _ in range(width)]
    out = r.derived(mids, g); r.sink(out)
    v = [0]
    def step(): v[0] += 1; r.set(s, v[0])
    return step, width + 1
def batch(R, work, width=100):
    f, g = WORK[work]; r = R(); ss = [r.state(0) for _ in range(width)]
    mids = [r.derived([s], f) for s in ss]
    out = r.derived(mids, g); r.sink(out)
    v = [0]
    def body():
        for s in ss: r.set(s, v[0])
    def step(): v[0] += 1; r.batch(body)
    return step, width + 1
def build(R, work, width=200):
    f, _ = WORK[work]
    def step():
        r = R(); s = r.state(0)
        for _ in range(width): r.sink(r.derived([s], f))
    return step, width

def time_it(make, R, work, budget=0.4, repeats=5):
    step, runs = make(R, work)
    step()  # warm
    n = 1
    while True:
        t = time.perf_counter()
        for _ in range(n): step()
        if time.perf_counter() - t > 0.05: break
        n *= 2
    n = max(1, int(n * budget / 0.05 / repeats / 2))
    best = float("inf")
    gc.collect(); gc.disable()
    try:
        for _ in range(repeats):
            t = time.perf_counter()
            for _ in range(n): step()
            best = min(best, (time.perf_counter() - t) / n)
    finally:
        gc.enable()
    return best * 1e6, best * 1e6 / runs  # us per step, us per node run

print(f"Python {platform.python_version()} {platform.machine()}")
RUNNERS = [PyK, PyFast, PyC, Facade, Raw]
for work in ("inc", "heavy"):
    print(f"\n== node function: {work} ==")
    print(f"{'scenario':<28}" + "".join(f"{R.name:>24}" for R in RUNNERS) + f"{'mypyc/facade':>14}")
    for label, make in [("chain 100 (per set)", chain), ("fan 100 -> 1 (per set)", fan),
                        ("batch 100 states (per batch)", batch), ("build+subscribe 200 nodes", build)]:
        res = [time_it(make, R, work) for R in RUNNERS]
        cells = "".join(f"{f'{a:,.0f}us ({b:.2f}/node)':>24}" for a, b in res)
        print(f"{label:<28}{cells}{res[2][0] / res[3][0]:>13.2f}x")
