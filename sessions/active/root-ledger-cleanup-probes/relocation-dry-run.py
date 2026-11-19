# Dry run: relocate legacy root decisions that nothing live and no rule row cites into
# archive/decisions/root-history.jsonl, registered as a historical_only ledger with one
# relocation line per record. It rewrites ledgers, so it only runs inside a copy.
#
#   rsync -a --exclude .git --exclude node_modules --exclude website \
#     --exclude sessions/active/b121-comparison-design-v1 --exclude formal/states ./ /tmp/copy/
#   python3 sessions/active/root-ledger-cleanup-probes/relocation-dry-run.py /tmp/copy
#   python3 sessions/active/root-ledger-cleanup-probes/relocation-dry-run.py /tmp/copy D194,D195   (an explicit list)
#   (cd /tmp/copy && node authority/check.mjs && node dashboard/build.mjs --check)
#
# "Cited by nothing" is a mechanical upper bound, not a judgment that a decision no longer
# governs. D9999 stands in for the decision a real relocation would name.
import glob, hashlib, json, os, re, sys

target = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else ""
if not target or os.path.exists(os.path.join(target, ".git")):
    sys.exit("give the path of a copy without .git; this script rewrites ledgers")
os.chdir(target)
J = lambda p: [json.loads(l) for l in open(p) if l.strip()]
lines = [l.rstrip("\n") for l in open("decisions/decisions.jsonl") if l.strip()]
D = [json.loads(l) for l in lines]
superseded = {s for r in D for s in r.get("supersedes", [])}
ref = re.compile(r"\bD\d+\b|\bDR-\d+\b")
cited = set()
for r in J("spec/rules.jsonl"):  # every rule row: the checker resolves history rows too
    cited |= set(r.get("introduced_by", []) + r.get("activated_by", []))
    if r.get("transition"):
        cited.add(r["transition"]["by"])
for r in D:
    if r.get("concerns") and r["id"] not in superseded:
        cited |= set(ref.findall(json.dumps({k: v for k, v in r.items() if k != "id"})))
for r in J("plan/backlog.jsonl"):
    if (r.get("status") or r.get("state")) in ("open", "proposed", "in-progress", "planned"):
        cited |= set(ref.findall(json.dumps(r)))
for p in glob.glob(".agents/skills/*/SKILL.md") + ["AGENTS.md", "README.md", "formal/README.md"] + glob.glob("guide/*.jsonl") + glob.glob("formal/*.tla"):
    cited |= set(ref.findall(open(p).read()))
move = [i for i, r in enumerate(D) if not r.get("concerns") and r["id"] not in cited]
if len(sys.argv) > 2:  # an explicit list instead of the mechanical bound: D194,D195,...
    wanted = set(sys.argv[2].split(","))
    pinned = sorted(wanted & cited & {r["id"] for r in D if any(r["id"] in (x.get("introduced_by", []) + (x.get("activated_by") or []) + ([x["transition"]["by"]] if x.get("transition") else [])) for x in J("spec/rules.jsonl"))})
    if pinned:
        sys.exit(f"cited by a rule row, so they must stay: {pinned}")
    move = [i for i, r in enumerate(D) if r["id"] in wanted]
    assert len(move) == len(wanted), "unknown id in the list"
moving = set(move)

path, cls = "archive/decisions/root-history.jsonl", "durable-root-history"
os.makedirs(os.path.dirname(path), exist_ok=True)
open(path, "w").write("".join(lines[i] + "\n" for i in move))
stand_in = {"id": "D9999", "layer": "dry run", "date": "2026-11-18", "question": "dry run", "decision": "dry run",
            "rationale": "dry run", "supersedes": [], "status": "locked", "session": "DS-20",
            "concerns": ["authority.root-ledger-history"], "decision_kind": "durable-architecture",
            "change_kind": "new", "protocol_impact": "none",
            "completion": {"complete_when": "dry run", "historical_when": "dry run"}}
kept = [l for i, l in enumerate(lines) if i not in moving] + [json.dumps(stand_in)]
open("decisions/decisions.jsonl", "w").write("\n".join(kept) + "\n")
with open("authority/ledgers.jsonl", "a") as f:
    f.write(json.dumps({"origin": "graphrefly", "owner": "graphrefly", "authority_class": cls, "path": path,
                        "availability": "required", "include_in_root_dashboard": False, "historical_only": True}) + "\n")
with open("authority/relocations.jsonl", "a") as f:
    for i in move:
        f.write(json.dumps({"qualified_id": "graphrefly:" + D[i]["id"], "id": D[i]["id"], "origin": "graphrefly",
                            "owner": "graphrefly", "authority_class": cls, "canonical_path": path,
                            "sha256": hashlib.sha256(lines[i].encode()).hexdigest(),
                            "relocated_from": "decisions/decisions.jsonl", "relocation_decision": "D9999",
                            "relocated_on": "2026-11-18"}) + "\n")
S = J("sessions/sessions.jsonl")
for s in S:
    if s["id"] == "DS-20":
        s["locks"] = s.get("locks", []) + ["D9999"]
open("sessions/sessions.jsonl", "w").write("".join(json.dumps(s, ensure_ascii=False) + "\n" for s in S))
print(f"moved {len(move)} of {len(D)} records; decisions.jsonl is now {os.path.getsize('decisions/decisions.jsonl')} bytes, "
      f"{path} is {os.path.getsize(path)} bytes")
