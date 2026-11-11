import json, sys
sys.path.insert(0, sys.path[0])
import os; from importlib import import_module; Graph = import_module(os.environ.get("K", "kernel")).Graph
def sum_of(ctx): return sum(d.value if d.has else 0 for d in ctx.deps)
def f_sum(ctx):
    if all(d.has for d in ctx.deps): ctx.down([("DATA", sum_of(ctx))])
def f_sumv(ctx): ctx.down([("DATA", sum_of(ctx))])
def f_waves(ctx): ctx.down([("DATA", sum(sum(len(w) for w in d.waves) + (100 if d.terminal else 0) + (1000 if d.invalidated else 0) for d in ctx.deps))])
def f_even(ctx):
    s = sum_of(ctx)
    if s % 2 == 0: ctx.down([("DATA", s)])
def f_throw(ctx):
    s = sum_of(ctx)
    if s > 7: raise Exception("big")
    ctx.down([("DATA", s)])
def f_twice(ctx):
    s = sum_of(ctx); ctx.down([("DATA", s)]); ctx.down([("DATA", s + 1)])
def f_inv(ctx):
    s = sum_of(ctx)
    ctx.down([("INVALIDATE",)] if s % 3 == 0 else [("DATA", s)])
FNS = dict(sum=f_sum, sumv=f_sumv, waves=f_waves, even=f_even, throw=f_throw, twice=f_twice, inv=f_inv)
out = []
for sc in json.load(sys.stdin):
    g = Graph(report=lambda e: g.trace.append({"report": e["source"]}), trace=True)
    for n in sc["nodes"]:
        if n["kind"] == "state":
            if n["initial"] is None: g.state(n["id"])
            else: g.state(n["id"], n["initial"])
        else: g.node(n["id"], n["deps"], FNS[n["fn"]], n["opts"])
    def run(op):
        try:
            k = op[0]
            if k == "subscribe": g.subscribe(op[1], op[2])
            elif k == "unsubscribe": g.unsubscribe(op[1], op[2])
            elif k == "set": g.set(op[1], op[2])
            elif k == "setfn": b = op[2]; g.set(op[1], lambda p: (p or 0) + b)
            elif k == "invalidate": g.invalidate(op[1])
            elif k == "complete": g.complete(op[1])
            elif k == "error": g.error(op[1], op[2])
            elif k == "batch": g.batch(lambda: [run(x) for x in op[1]])
        except Exception as e:
            g.trace.append({"thrown": str(e)})
    for op in sc["ops"]: run(op)
    out.append([{"to": t["to"], "from": t["from"], "msgs": [list(m) for m in t["msgs"]]} if "msgs" in t else t for t in g.trace])
print(json.dumps(out))
