import pathlib,json
b=pathlib.Path('/Users/davidchenallio/src/graphrefly/sessions/active/b121-comparison-design-v1/agent-api/candidate-round-v7-visible-limits/live');out=json.loads((b/'outcome.json').read_text());p=pathlib.Path(out['directory']);rows=[json.loads(l) for l in (p/'journal.jsonl').read_text().splitlines()];sessions=[];cur=None
for row in rows:
 e=row['event'];t=e['type'];d=e['data']
 if t=='sample-started':cur={'sampleId':d['sampleId'],'outputs':[],'lengthChecks':[],'finalizations':[],'dispatches':[]};sessions.append(cur)
 if cur and t=='entry-output-observation':cur['outputs'].append({'journalIndex':row['index'],**d})
 if cur and t=='entry-answer-lengths':cur['lengthChecks'].append({'journalIndex':row['index'],**d})
 if cur and t=='entry-finalization':cur['finalizations'].append({'journalIndex':row['index'],**d})
 if cur and t=='generation-dispatch':
  payload=d['payload'];feedback=json.loads(payload['messages'][-1]['content']);assert feedback['currentRequest']['maxOutputTokens']==payload['max_tokens'];assert feedback['answerLimits']['explanation']==6000 and feedback['answerLimits']['snippet']==32000
  cur['dispatches'].append({'journalIndex':row['index'],'requestHash':d['requestHash'],'stage':feedback['stage'],'currentRequest':feedback['currentRequest'],'remaining':feedback['remaining'],'answerLimits':feedback['answerLimits']})
 if cur and t=='sample-finished':cur['status']=d['status'];cur=None
with (b/'output-diagnostics.json').open('x') as f:json.dump({'sessions':sessions,'allDispatchedRequestCapsAndFieldLimitsVerified':True,'interpretation':'Exact observed fields; no inferred root cause, salvage or answer repair.'},f,indent=2)
print([{k:v for k,v in s.items() if k in ['sampleId','status','lengthChecks']} for s in sessions])
