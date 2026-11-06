"""Offline descriptive audit of retained v11 events; no model or scoring calls."""
import collections
import hashlib
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
RUN = BASE.parent / 'candidate-runs' / '88c2fc7e66bdd554ef62ba8ab91ddbde634d4ade1f48ffe4ec424d937960f518'
raw = (RUN / 'journal.jsonl').read_bytes()
rows = [json.loads(line) for line in raw.splitlines()]
sessions = []
current = None
for row in rows:
    event = row['event']
    kind, data = event['type'], event['data']
    if kind == 'sample-started':
        current = dict(sampleId=data['sampleId'], reads=[], searches=[], usage=[], finalization=[])
        sessions.append(current)
    if current is None:
        continue
    if kind == 'generation-response':
        usage = json.loads(data['rawBody'])['usage']
        current['usage'].append(usage)
    if kind == 'entry-finalization':
        current['finalization'].append(data)
    if kind == 'broker-batch':
        assert len(data['requests']) == len(data['results'])
        for request, result in zip(data['requests'], data['results']):
            if request['op'] == 'read':
                current['reads'].append(dict(journalIndex=row['index'], request=request, result=result))
            if request['op'] == 'search':
                current['searches'].append(dict(journalIndex=row['index'], request=request,
                                                totalMatches=result.get('totalMatches')))
    if kind == 'sample-finished':
        current = None

observations = json.loads((BASE / 'live/session-observations.json').read_text())['sessions']
output = []
for session, observation in zip(sessions, observations):
    assert session['sampleId'] == observation['sampleId']
    seen = set()
    files = collections.Counter()
    delivered = overlap = 0
    trace = []
    for read in session['reads']:
        result = read['result']
        path = result.get('path', read['request']['path'])
        lines = result.get('lines', [])
        duplicate = 0
        for line in lines:
            coordinate = (path, result.get('sha256'), line['line'])
            if coordinate in seen:
                duplicate += 1
            seen.add(coordinate)
        delivered += len(lines)
        overlap += duplicate
        files[path] += 1
        trace.append(dict(journalIndex=read['journalIndex'], path=path,
                          startLine=result.get('startLine'), endLine=result.get('endLine'),
                          deliveredLines=len(lines), previouslyDeliveredLines=duplicate))
    usage = session['usage']
    total = sum(u['prompt_tokens'] for u in usage)
    cached = sum(u.get('prompt_tokens_details', {}).get('cached_tokens', 0) for u in usage)
    assert total == observation['usage']['inputTokens']
    assert len(usage) == observation['turns']
    assert len(trace) == observation['reads']
    assert len(session['searches']) == observation['searches']
    output.append(dict(sampleId=session['sampleId'], turns=len(usage), cumulativeInputTokens=total,
                       maxRequestInputTokens=max(u['prompt_tokens'] for u in usage),
                       cachedInputTokens=cached, cachedShare=cached / total,
                       readOperations=len(trace), uniqueReadPaths=len(files),
                       deliveredSourceLines=delivered, uniqueSourceLines=len(seen),
                       repeatedSourceLines=overlap, repeatedSourceLineShare=overlap / delivered,
                       readCountsByPath=dict(files.most_common()), searches=session['searches'],
                       finalization=session['finalization'], readTrace=trace))
assert len(output) == len(observations) == 4
report = dict(journalSHA256=hashlib.sha256(raw).hexdigest(), sessions=output,
              methodology='Counts generation-response once, excludes qualification. Source overlap uses successful read result path/digest/line; task.json has no line array and is excluded from line counts. Search results are excluded from line-overlap counts. Cache hits count toward cumulative input. Descriptive only; no causal attribution or rescoring.')
(BASE / 'retrieval-audit.json').write_text(json.dumps(report, indent=2) + '\n')
for item in output:
    print(json.dumps({k: v for k, v in item.items() if k not in ('readTrace', 'readCountsByPath', 'searches', 'finalization')}))
    print('finalization:', [x['reason'] for x in item['finalization']])
    print('top paths:', list(item['readCountsByPath'].items())[:6])
