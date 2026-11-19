# Measures how spec/rules.jsonl and spec/conformance.jsonl divide into parts.
# Run from the repository root: python3 sessions/active/ds20-review-probes/ledger-parts.py
import collections, json, re

rows = [json.loads(l) for l in open("spec/rules.jsonl") if l.strip()]
by_key = {(r["id"], r["revision"]): r for r in rows}
part = lambda area: {"module": "module", "graph": "graph", "principle": "principle"}.get(area, "kernel")
size = lambda rs: sum(len(json.dumps(r)) for r in rs)

public = {r["id"]: r for r in rows if r.get("activated_by") and not r.get("transition")}
draft_rows = [r for r in rows if not r.get("activated_by") and not r.get("transition")]
drafts = {r["id"]: r for r in draft_rows}  # the latest open draft of each id
moved = [r for r in rows if r.get("transition")]
print(f"rule rows {len(rows)}: public {len(public)} ({size(public.values())} bytes), "
      f"open draft rows {len(draft_rows)} over {len(drafts)} ids ({size(draft_rows)} bytes), "
      f"transitioned {len(moved)} ({size(moved)} bytes)")
print("public by part", dict(collections.Counter(part(r["area"]) for r in public.values())))
print("open draft ids by part", dict(collections.Counter(part(r["area"]) for r in drafts.values())))

retired = same = cross = 0
for r in moved:
    to = r["transition"].get("to")
    if not to:
        retired += 1
        continue
    target = by_key.get((to["id"], to["revision"]))
    if target and part(target["area"]) != part(r["area"]):
        cross += 1
    else:
        same += 1
print(f"transitioned rows: retired {retired}, successor in the same part {same}, successor in another part {cross}")

cite = re.compile(r"R-[a-z0-9]+(?:-[a-z0-9]+)*")
for name, rule in public.items():
    up = sorted(c for c in set(cite.findall(rule["statement"])) - {name}
                if c in public and part(public[c]["area"]) == "module" and part(rule["area"]) != "module")
    if up:
        print(f"upward citation: {name} ({part(rule['area'])}) cites {up}")
for name, rule in drafts.items():
    if part(rule["area"]) == "module":
        print(f"draft module rule {name} cites {sorted(set(cite.findall(rule['statement'])) - {name})}")

scenarios = [json.loads(l) for l in open("spec/conformance.jsonl") if l.strip()]
levels = collections.Counter()
for s in scenarios:
    covers = s.get("covers", [])
    parts = {part((public.get(c) or drafts.get(c))["area"]) for c in covers if c in public or c in drafts}
    level = "none" if not parts else "module" if "module" in parts else "graph" if "graph" in parts else "kernel"
    levels[level] += 1
    dead = [c for c in covers if c not in public and c not in drafts]
    if level == "none":
        print(f"{s['id']} ({s.get('status')}) covers no public or draft rule: {covers}")
    elif dead:
        print(f"{s['id']} also names rules that are neither public nor draft: {dead}")
print(f"scenarios {len(scenarios)} by highest part covered", dict(levels))
