# Dry run for Q4 of PROPOSAL-root-ledger-cleanup.md: relocate closed root backlog rows into
# archive/plan/backlog-history.jsonl, registered as a historical_only work ledger with one
# line per row in authority/work-relocations.jsonl. It rewrites ledgers, so it only runs
# inside a copy.
#
#   mkdir -p /tmp/ws && rsync -a --exclude .git --exclude node_modules --exclude website \
#     --exclude sessions/active/b121-comparison-design-v1 --exclude formal/states ./ /tmp/ws/graphrefly/
#   for d in ts rs py canvas stack; do ln -s ~/src/graphrefly-$d /tmp/ws/graphrefly-$d; done
#   python3 sessions/active/root-ledger-cleanup-probes/backlog-relocation-dry-run.py /tmp/ws/graphrefly all
#   python3 sessions/active/root-ledger-cleanup-probes/backlog-relocation-dry-run.py /tmp/ws/graphrefly unnamed
#
# The sibling links let the --workspace checks read the runtime, Canvas and Stack work ledgers,
# which name root rows as prerequisites. Each run needs a fresh copy.
#
# Closed means resolved, done, superseded or complete. A deferred row waits for its trigger and
# is not closed. "unnamed" keeps every closed row that something current still names; that is a
# mechanical bound, not a judgment. D9997 stands in for the decision a real relocation would name.
import glob, hashlib, json, os, re, subprocess, sys

target = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else ""
mode = sys.argv[2] if len(sys.argv) > 2 else ""
if not target or os.path.exists(os.path.join(target, ".git")) or mode not in ("all", "unnamed"):
    sys.exit("usage: <copy without .git> all|unnamed; this script rewrites ledgers")
os.chdir(target)

BY, DEST = "D9997", "archive/plan/backlog-history.jsonl"
CLOSED = {"resolved", "done", "superseded", "complete"}
J = lambda p: [json.loads(l) for l in open(p) if l.strip()]
dump = lambda r: json.dumps(r, ensure_ascii=False, separators=(",", ":"))
sha = lambda raw: hashlib.sha256(raw.encode()).hexdigest()
state = lambda b: b.get("status") or b.get("state")

lines = [l.rstrip("\n") for l in open("plan/backlog.jsonl") if l.strip()]
rows = [json.loads(l) for l in lines]
closed = {b["id"] for b in rows if state(b) in CLOSED}

named = set()
if mode == "unnamed":
    ref = re.compile(r"\bB\d+\b")

    def scan(text, skip=None):
        named.update(x for x in ref.findall(text) if x in closed and x != skip)

    for b in rows:
        if state(b) not in CLOSED:
            scan(json.dumps(b), b["id"])
    for p in J("plan/phases.jsonl"):
        if (p.get("status") or p.get("state")) not in ("done", "complete", "superseded"):
            scan(json.dumps(p))
    for d in J("decisions/decisions.jsonl"):
        if d.get("concerns"):
            scan(json.dumps(d))
    for s in J("sessions/sessions.jsonl"):
        if s["status"] == "active":
            scan(json.dumps(s))
    for f in (glob.glob("guide/*.jsonl") + glob.glob(".agents/skills/*/SKILL.md") + glob.glob("authority/*.mjs")
              + glob.glob("scripts/**/*.mjs", recursive=True) + glob.glob("reference/**/*.md", recursive=True)
              + ["AGENTS.md", "README.md", "docs/README.md", "formal/README.md", "authority/README.md", "dashboard/README.md"]):
        scan(open(f).read())
    for d in ("ts", "rs", "py", "canvas", "stack"):
        base = f"../graphrefly-{d}"
        if os.path.isdir(base):
            out = subprocess.run(["git", "-C", base, "grep", "-h", "-o", "-E", "graphrefly:B[0-9]+"],
                                 capture_output=True, text=True).stdout
            named.update(x.split(":")[1] for x in out.split() if x.split(":")[1] in closed)

move = [i for i, b in enumerate(rows) if b["id"] in closed and b["id"] not in named]
moving = set(move)


def checks():
    out = {}
    for name, cmd in (("authority", ["node", "authority/check.mjs"]),
                      ("authority --workspace", ["node", "authority/check.mjs", "--workspace"]),
                      ("work", ["node", "authority/work-check.mjs"]),
                      ("work --workspace", ["node", "authority/work-check.mjs", "--workspace"]),
                      ("dashboard", ["node", "dashboard/build.mjs", "--check"]),
                      ("dashboard --workspace", ["node", "dashboard/build.mjs", "--workspace", "--check"]),
                      ("authority tests", ["node", "--test"] + sorted(glob.glob("authority/*.test.mjs")))):
        run = subprocess.run(cmd, capture_output=True, text=True)
        out[name] = run.returncode
        if run.returncode:
            text = run.stdout + run.stderr
            errs = [l.strip() for l in text.splitlines() if "relocation" in l or "missing work" in l or "unresolved" in l]
            out[name + " errors"] = len(errs)
            out[name + " sample"] = errs[:3]
    return out


print(f"mode {mode}: {len(rows)} rows, {len(closed)} closed, {len(named)} of them still named, {len(move)} to move")
print("before:", checks())

os.makedirs(os.path.dirname(DEST), exist_ok=True)
open(DEST, "w").write("\n".join(lines[i] for i in move) + "\n")
open("plan/backlog.jsonl", "w").write("\n".join(l for i, l in enumerate(lines) if i not in moving) + "\n")
with open("authority/work-ledgers.jsonl", "a") as f:
    f.write(dump({"origin": "graphrefly", "owner": "graphrefly", "work_class": "backlog-item", "path": DEST,
                  "adapter": "backlog-jsonl-v0", "availability": "required", "historical_only": True}) + "\n")
with open("authority/work-relocations.jsonl", "a") as f:
    for i in move:
        f.write(dump({"qualified_id": f"graphrefly:{rows[i]['id']}", "origin": "graphrefly", "owner": "graphrefly",
                      "canonical_path": DEST, "sha256": sha(lines[i]), "former_sha256": sha(lines[i]),
                      "relocated_from": "plan/backlog.jsonl", "relocated_from_owner": "graphrefly",
                      "relocated_from_adapter": "backlog-jsonl-v0", "migration_ref": f"graphrefly:{BY}"}) + "\n")
with open("decisions/decisions.jsonl", "a") as f:
    f.write(dump({"id": BY, "layer": "planning / root backlog history", "date": "2026-11-18", "question": "placeholder",
                  "decision": "placeholder", "rationale": "placeholder", "supersedes": [], "status": "locked",
                  "session": "DS-21", "concerns": ["planning.backlog-history"], "decision_kind": "durable-architecture",
                  "change_kind": "extension", "protocol_impact": "none",
                  "completion": {"complete_when": "placeholder", "historical_when": "placeholder"}}) + "\n")

print("after: ", checks())
print(f"plan/backlog.jsonl {os.path.getsize('plan/backlog.jsonl')} bytes, {DEST} {os.path.getsize(DEST)} bytes")
