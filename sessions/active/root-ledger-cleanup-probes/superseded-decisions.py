# Q1, batch 1 of PROPOSAL-root-ledger-cleanup.md: the legacy decisions (no concerns) that another
# decision's `supersedes` names. For each: who supersedes it and with which change_kind, which rule
# rows cite it, and what else current still names it. Read-only; run from the repository root.
# What a superseder's text says about the remainder was read by hand and is in the proposal.
import json,re,glob,collections,os,subprocess
J=lambda p:[json.loads(l) for l in open(p) if l.strip()]
D=J('decisions/decisions.jsonl'); byid={d['id']:d for d in D}
sup=collections.defaultdict(list)
for d in D:
    for s in d.get('supersedes',[]): sup[s].append(d['id'])
batch=[d for d in D if not d.get('concerns') and d['id'] in sup]
ids={d['id'] for d in batch}
ref=re.compile(r'\bD\d+\b')
R=J('spec/rules.jsonl')
rule_cur=collections.defaultdict(set); rule_draft=collections.defaultdict(set); rule_hist=collections.defaultdict(set)
for r in R:
    refs=set(r.get('introduced_by',[])+(r.get('activated_by') or []))
    if r.get('transition'): refs.add(r['transition']['by'])
    kind = rule_hist if r.get('transition') else (rule_cur if r.get('activated_by') else rule_draft)
    for x in refs&ids: kind[x].add(f"{r['id']}@{r['revision']}")
other=collections.defaultdict(set)
def scan(name,text):
    for x in set(ref.findall(text))&ids: other[x].add(name)
for b in J('plan/backlog.jsonl'): scan('backlog '+b['id'], json.dumps(b))
for p in J('plan/phases.jsonl'):
    if (p.get('status') or p.get('state')) not in ('done','complete','superseded'): scan('phase '+p['id'], json.dumps(p))
for d in D:
    if d.get('concerns'):
        body=json.dumps({k:v for k,v in d.items() if k not in ('id','supersedes')})
        scan('text of '+d['id'], body)
for f in glob.glob('guide/*.jsonl'):
    for r in J(f):
        if r.get('status','active')=='active': scan('guide '+str(r.get('id')), json.dumps(r))
for f in glob.glob('.agents/skills/*/SKILL.md')+['AGENTS.md','README.md','docs/README.md','formal/README.md','authority/README.md']+glob.glob('formal/*.tla')+glob.glob('formal/*.cfg')+glob.glob('reference/**/*.mjs',recursive=True)+glob.glob('reference/**/*.md',recursive=True):
    scan(os.path.relpath(f), open(f).read())
for f in glob.glob('spec/conformance.jsonl'):
    for c in J(f): scan('scenario '+c['id'], json.dumps(c))
kinds=lambda i: [(s, byid[s].get('change_kind') or 'legacy') for s in sup[i]]
rows=[]
for d in sorted(batch,key=lambda d:int(d['id'][1:])):
    i=d['id']
    rows.append(dict(id=i, layer=d.get('layer'), by=kinds(i), cur=sorted(rule_cur[i]), draft=sorted(rule_draft[i]), hist=len(rule_hist[i]), other=sorted(other[i]), size=len(json.dumps(d,ensure_ascii=False)), text=(d.get('decision') or '')[:110]))

print(len(rows),'superseded legacy decisions;', sum(r['size'] for r in rows),'bytes')
c=collections.Counter()
for r in rows:
    k=[]
    if r['cur']: k.append('cited by a current rule row')
    if r['draft']: k.append('cited by an open draft rule row')
    if r['hist'] and not r['cur'] and not r['draft']: k.append('cited only by history rule rows')
    if r['other']: k.append('named elsewhere')
    c[' + '.join(k) or 'cited by nothing']+=1
for k,v in c.most_common(): print(v,k)
print(collections.Counter(tuple(sorted({k for _,k in r['by']})) for r in rows))
for r in rows:
    print(f"{r['id']:5} {str(r['layer'])[:14]:14} by {','.join(s+'/'+k[:7] for s,k in r['by']):34} cur={r['cur']} draft={r['draft']} hist={r['hist']} other={r['other'][:4]}")
