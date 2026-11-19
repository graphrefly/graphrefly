# Measures size and staleness of the root ledgers. Reads only.
# Run from the repository root: python3 sessions/active/root-ledger-cleanup-probes/ledger-staleness.py
import collections, glob, json, os, re

J = lambda p: [json.loads(l) for l in open(p) if l.strip()]
size = lambda rows: sum(len(json.dumps(r, ensure_ascii=False)) for r in rows)
D, R, C = J("decisions/decisions.jsonl"), J("spec/rules.jsonl"), J("spec/conformance.jsonl")
B, S = J("plan/backlog.jsonl"), J("sessions/sessions.jsonl")
state = lambda r: r.get("status") or r.get("state")
LIVE = ("open", "proposed", "in-progress", "planned")

superseded = {s for r in D for s in r.get("supersedes", [])}
legacy = [r for r in D if not r.get("concerns")]
legacy_ids = {r["id"] for r in legacy}
print(f"decisions: {os.path.getsize('decisions/decisions.jsonl')} bytes, {len(D)} records, "
      f"{len(D) - len(legacy)} with admission metadata, {len(legacy)} legacy without concerns "
      f"({len([r for r in legacy if r['id'] in superseded])} of them superseded)")
print("legacy by session", collections.Counter(r.get("session") for r in legacy).most_common(4))
print("legacy by layer", collections.Counter((r.get("layer") or "?").split("/")[0].split()[0] for r in legacy).most_common(8))
print("legacy by month", sorted(collections.Counter((r.get("date") or "")[:7] for r in legacy).items()))

ref = re.compile(r"\bD\d+\b|\bDR-\d+\b")
cited = collections.defaultdict(set)
for r in R:
    kind = "rule row with a transition" if r.get("transition") else "public or draft rule"
    cited[kind] |= set(r.get("introduced_by", []) + r.get("activated_by", []))
    if r.get("transition"):
        cited[kind].add(r["transition"]["by"])
for r in D:
    if r.get("concerns") and r["id"] not in superseded:
        cited["current admitted decision"] |= set(ref.findall(json.dumps({k: v for k, v in r.items() if k != "id"})))
for r in B:
    if state(r) in LIVE:
        cited["live backlog row"] |= set(ref.findall(json.dumps(r)))
for p in glob.glob(".agents/skills/*/SKILL.md") + ["AGENTS.md", "README.md", "formal/README.md"] + glob.glob("guide/*.jsonl") + glob.glob("formal/*.tla"):
    cited["skills, guide, formal"] |= set(ref.findall(open(p).read()))
any_cited = set()
for kind, ids in cited.items():
    print(f"  legacy decisions cited by {kind}: {len(ids & legacy_ids)}")
    any_cited |= ids & legacy_ids
uncited = [r for r in legacy if r["id"] not in any_cited]
print(f"legacy decisions cited by none of these: {len(uncited)} ({size(uncited)} bytes)")

live = [r for r in B if state(r) in LIVE]
deferred = [r for r in B if state(r) == "deferred"]  # waiting for a trigger, not closed (corrected 2026-11-18)
closed = [r for r in B if state(r) not in LIVE and state(r) != "deferred"]
bref = re.compile(r"\bB\d+\b")
still = {b for r in live for b in bref.findall(json.dumps({k: v for k, v in r.items() if k != "id"}))} & {r["id"] for r in closed}
print(f"backlog: {os.path.getsize('plan/backlog.jsonl')} bytes, {len(live)} live ({size(live)} bytes), "
      f"{len(deferred)} deferred, {len(closed)} closed ({size(closed)} bytes), {len(still)} closed rows named by live rows; "
      f"{len([r for r in B if r.get('work_contract')])} rows on the strict work contract")

public = {r["id"] for r in R if r.get("activated_by") and not r.get("transition")}
drafts = [r for r in R if not r.get("activated_by") and not r.get("transition")]
print("open draft rule rows:", [(r["id"], r["revision"], r["introduced_by"]) for r in drafts])
draft_ids = {r["id"] for r in drafts}
for s in C:
    if not any(c in public or c in draft_ids for c in s.get("covers", [])):
        print(f"scenario {s['id']} covers no public or draft rule: {s.get('covers')} runtimes {s['runtimes']}")
print("scenarios with any pass flag:", [s["id"] for s in C if "pass" in s["runtimes"].values()])
print("conformance note bytes", sum(len(s.get("note") or "") for s in C), "of", os.path.getsize("spec/conformance.jsonl"))
print("active sessions:", [(s["id"], s["opened"]) for s in S if s["status"] == "active"])
