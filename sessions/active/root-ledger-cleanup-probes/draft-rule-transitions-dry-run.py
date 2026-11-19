# Dry run for Q3 of PROPOSAL-root-ledger-cleanup.md: give seven never-activated draft rules,
# written before D797, a transition, under one stand-in decision. It rewrites ledgers, so it
# only runs inside a copy.
#
#   rsync -a --exclude .git --exclude node_modules --exclude website \
#     --exclude sessions/active/b121-comparison-design-v1 --exclude formal/states ./ /tmp/copy/
#   python3 sessions/active/root-ledger-cleanup-probes/draft-rule-transitions-dry-run.py /tmp/copy
#
# D9998 stands in for the decision a real change would admit; its text here is a placeholder
# with the fields the admission check requires, not the draft in the proposal.
import json, os, subprocess, sys

target = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else ""
if not target or os.path.exists(os.path.join(target, ".git")):
    sys.exit("give the path of a copy without .git; this script rewrites ledgers")
os.chdir(target)

BY = "D9998"
SURFACE = {"id": "R-graph-surface", "revision": 2}
TRANSITIONS = {
    ("R-edges-derived", 1): {"kind": "replace", "by": BY, "to": SURFACE},
    ("R-inspection-set", 1): {"kind": "replace", "by": BY, "to": SURFACE},
    ("R-meta-presentation", 1): {"kind": "retire", "by": BY},
    ("R-no-polling", 1): {"kind": "replace", "by": BY, "to": {"id": "R-no-imperative", "revision": 2}},
    ("R-data-not-peek", 1): {"kind": "retire", "by": BY},
    ("R-no-raw-async", 1): {"kind": "retire", "by": BY},
    ("R-clock", 1): {"kind": "retire", "by": BY},
}
dump = lambda r: json.dumps(r, ensure_ascii=False, separators=(",", ":"))


def metrics():
    run = subprocess.run(["node", "authority/check.mjs"], capture_output=True, text=True)
    block, on = [], False
    for l in run.stdout.splitlines():
        if l.startswith("metrics:"):
            on = True
        if on:
            block.append(l.strip())
            if l.strip().endswith("}"):
                break
    dash = subprocess.run(["node", "dashboard/build.mjs", "--check"], capture_output=True, text=True)
    return run.returncode, dash.returncode, " ".join(block)


print("before:", *metrics())

rows, done = [], set()
for l in open("spec/rules.jsonl"):
    if not l.strip():
        continue
    r = json.loads(l)
    key = (r["id"], r["revision"])
    if key in TRANSITIONS:
        assert not r.get("transition") and not r.get("activated_by"), key
        r["transition"] = TRANSITIONS[key]
        done.add(key)
    rows.append(dump(r))
assert done == set(TRANSITIONS), set(TRANSITIONS) - done
open("spec/rules.jsonl", "w").write("\n".join(rows) + "\n")

decision = {
    "id": BY, "layer": "L0-L4 / drafts written before D797", "date": "2026-11-18",
    "question": "placeholder", "decision": "placeholder", "rationale": "placeholder",
    "supersedes": [], "status": "locked", "session": "DS-17",
    "concerns": ["protocol.pre-kernel-draft-rules"], "decision_kind": "protocol-decision",
    "change_kind": "clarification", "protocol_impact": "semantic",
    "spec_amend": "placeholder", "conformance_obligations": ["placeholder"],
    "formal_obligations": ["placeholder"],
    "completion": {"complete_when": "placeholder", "historical_when": "placeholder"},
}
with open("decisions/decisions.jsonl", "a") as f:
    f.write(dump(decision) + "\n")

print("after: ", *metrics())
