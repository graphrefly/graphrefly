# Dry run for Q5 of PROPOSAL-root-ledger-cleanup.md: archive DS-12, DS-15 and DS-16.
# It moves session bodies and rewrites the session index, so it only runs inside a copy.
#
#   rsync -a --exclude .git --exclude node_modules --exclude website \
#     --exclude sessions/active/b121-comparison-design-v1 --exclude formal/states ./ /tmp/copy/
#   python3 sessions/active/root-ledger-cleanup-probes/session-archive-dry-run.py /tmp/copy
#   (cd /tmp/copy && node authority/check.mjs && node dashboard/build.mjs --check)
#
# Neither gate resolves a session's `path` or a Markdown link, so this script checks both
# itself, before and after the move, and prints only what the move newly breaks.
#
# The move follows what B142 did on 2026-11-05 (sessions/archive/docs-reorganization-evidence/
# 2026-11-05-session-archive-moves.json): bodies move byte for byte, and an old path that a
# record which is not rewritten still names keeps a short pointer file.
import hashlib, json, os, re, shutil, sys

target = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else ""
if not target or os.path.exists(os.path.join(target, ".git")):
    sys.exit("give the path of a copy without .git; this script moves files")
os.chdir(target)

MOVES = {
    "DS-12": ["SESSION-federated-sequencer-consolidation.md"],
    "DS-15": ["SESSION-protocol-reconciliation-values-occurrences.md"],
    "DS-16": ["SESSION-protocol-reconciliation-propagation-demand.md", "protocol-reconciliation-probes"],
}
# D796's spec_amend field names this path, and a locked decision is not rewritten.
STUBS = {"SESSION-protocol-reconciliation-propagation-demand.md": "DS-16"}

TEXT = (".md", ".jsonl", ".json", ".mjs", ".py", ".tla", ".cfg", ".txt")
SKIP = ("node_modules", "website", "dashboard/dashboard.html", "sessions/active/b121-comparison-design-v1",
        "sessions/archive/docs-reorganization-evidence", "sessions/active/root-ledger-cleanup-probes",
        "sessions/active/PROPOSAL-root-ledger-cleanup.md")
link = re.compile(r"\]\(([^)\s]+)\)")
named = re.compile(r"sessions/(?:active|archive)/[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*")


def files():
    for root, dirs, names in os.walk("."):
        dirs[:] = [d for d in dirs if not any(os.path.relpath(os.path.join(root, d)).startswith(s) for s in SKIP)]
        for n in names:
            p = os.path.relpath(os.path.join(root, n))
            if n.endswith(TEXT) and not any(p.startswith(s) for s in SKIP):
                yield p


def broken():
    out = set()
    for p in files():
        try:
            text = open(p, encoding="utf-8").read()
        except UnicodeDecodeError:
            continue
        if p.endswith(".md") and p.startswith("sessions/"):
            for m in link.finditer(text):
                t = re.sub(r":\d+(?:-\d+)?$", "", m.group(1).split("#")[0])  # file:line links
                if not t or re.match(r"[a-z]+:", t):
                    continue
                if not os.path.exists(os.path.normpath(os.path.join(os.path.dirname(p), t))):
                    out.add((p, "link", m.group(1)))
        for m in named.finditer(text):
            t = m.group(0).rstrip(".")
            if not os.path.exists(t):
                out.add((p, "path", t))
    for l in open("sessions/sessions.jsonl"):
        if l.strip():
            r = json.loads(l)
            if not os.path.exists(r["path"]):
                out.add(("sessions/sessions.jsonl", "index", f'{r["id"]} {r["path"]}'))
    return out


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


before = broken()
print(f"before the move: {len(before)} references already do not resolve")

moved = {}
for ds, names in MOVES.items():
    for n in names:
        src, dst = f"sessions/active/{n}", f"sessions/archive/{n}"
        h = sha(src) if os.path.isfile(src) else None
        shutil.move(src, dst)
        moved[src] = dst
        if h:
            assert sha(dst) == h
for n, ds in STUBS.items():
    with open(f"sessions/active/{n}", "w") as f:
        f.write(f"# Archived {ds} session\n\nThe [session body](../archive/{n}) is archived unchanged.\n"
                f"Its index row is {ds} in [the session index](../sessions.jsonl).\n")

rows = []
for l in open("sessions/sessions.jsonl"):
    if not l.strip():
        continue
    r = json.loads(l)
    if r["id"] in MOVES:
        r["status"] = "archived"
        r["path"] = moved[r["path"]]
    rows.append(json.dumps(r, ensure_ascii=False))
open("sessions/sessions.jsonl", "w").write("\n".join(rows) + "\n")

after = broken() - before
print(f"after the move: {len(after)} references newly do not resolve")
by = {}
for p, kind, t in sorted(after):
    by.setdefault((p, kind), []).append(t)
for (p, kind), ts in by.items():
    print(f"  {p} [{kind}] x{len(ts)}")
    for t in sorted(set(ts))[:6]:
        print(f"      {t}")
    if len(set(ts)) > 6:
        print(f"      ... {len(set(ts)) - 6} more distinct")
