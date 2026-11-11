"""Generates random scenarios: a DAG of state/computed nodes and a list of host ops."""
import json, random, sys
FNS = ["sum", "waves", "even", "throw", "twice", "inv", "sumv"]
def scenario(seed):
    r = random.Random(seed)
    nodes = []
    ns = r.randint(1, 3)
    for i in range(ns):
        nodes.append({"id": f"s{i}", "kind": "state", "initial": r.choice([None, 0, 1, 2, 5])})
    for i in range(r.randint(1, 6)):
        pool = [n["id"] for n in nodes]
        deps = r.sample(pool, r.randint(1, min(3, len(pool))))
        opts = {}
        if r.random() < 0.25: opts["terminal"] = {"complete": "manual"}
        if r.random() < 0.2: opts.setdefault("terminal", {})["error"] = "manual"
        if r.random() < 0.25: opts["invalidate"] = "manual"
        nodes.append({"id": f"n{i}", "kind": "node", "deps": deps, "fn": r.choice(FNS), "opts": opts})
    states = [n["id"] for n in nodes if n["kind"] == "state"]
    allids = [n["id"] for n in nodes]
    ops = []
    for _ in range(r.randint(3, 14)):
        k = r.random()
        if k < 0.2: ops.append(["subscribe", f"k{r.randint(0,2)}", r.choice(allids)])
        elif k < 0.27: ops.append(["unsubscribe", f"k{r.randint(0,2)}", r.choice(allids)])
        elif k < 0.6: ops.append(["set", r.choice(states), r.randint(0, 9)])
        elif k < 0.67: ops.append(["setfn", r.choice(states), r.randint(1, 3)])
        elif k < 0.75: ops.append(["invalidate", r.choice(states)])
        elif k < 0.8: ops.append(["complete", r.choice(states)])
        elif k < 0.84: ops.append(["error", r.choice(states), "boom"])
        else: ops.append(["batch", [["set", r.choice(states), r.randint(0, 9)] for _ in range(r.randint(1, 3))]])
    # subscribe something early so waves flow
    ops.insert(0, ["subscribe", "k0", allids[-1]])
    return {"nodes": nodes, "ops": ops}
n = int(sys.argv[1]); base = int(sys.argv[2]) if len(sys.argv) > 2 else 0
print(json.dumps([scenario(base + i) for i in range(n)]))
