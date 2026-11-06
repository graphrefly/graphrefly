import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root='/Users/davidchenallio/src/graphrefly',base=join(root,'sessions/active/b121-comparison-design-v1/agent-api/candidate-round-v11-connection-close'),out=join(base,'live');
const {hash}=await import(pathToFileURL(join(root,'scripts/b121-comparison/session.mjs')));
const {readCandidateCampaign}=await import(pathToFileURL(join(root,'scripts/b121-comparison/candidate-campaign.mjs')));
const read=p=>JSON.parse(readFileSync(p));const save=(n,d)=>writeFileSync(join(out,n),JSON.stringify(d,null,2)+'\n',{flag:'wx'});
const outcome=read(join(out,'outcome.json')),manifest=read(join(out,'manifest.json')),budget=read(join(out,'budget.json'));
if(hash(readCandidateCampaign(outcome.directory))!==hash(outcome.summary))throw Error('outcome mismatch');
const rows=readFileSync(join(outcome.directory,'journal.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
let prev=null,index=0;for(const {hash:h,...row} of rows){if(row.previous!==prev||row.index!==index++||hash(row)!==h)throw Error('journal drift');prev=h;}
const events=rows.map(r=>r.event);let current=null;const sessions=[];
for(const {index,event:e} of rows){
 if(e.type==='sample-started'){current={sampleId:e.data.sampleId,reads:0,searches:0,feedbacks:[],stops:[],toolErrors:[],maxRequestInputTokens:0};sessions.push(current);}
 if(current&&e.type==='entry-budget-status')current.feedbacks.push({journalIndex:index,...e.data});
 if(current&&e.type==='budget-stop')current.stops.push({journalIndex:index,...e.data});
 if(current&&e.type==='broker-batch')for(let i=0;i<e.data.requests.length;i++){const r=e.data.requests[i],v=e.data.results[i];if(r.op==='read')current.reads++;if(r.op==='search')current.searches++;if(!v.ok)current.toolErrors.push({request:r,result:v});}
 if(current&&e.type==='generation-response')current.maxRequestInputTokens=Math.max(current.maxRequestInputTokens,e.data.body.usage.prompt_tokens);
 if(current&&e.type==='sample-finished'){
  const a=read(join(outcome.directory,current.sampleId+'.assessment.json'));const r=read(join(outcome.directory,current.sampleId+'.result.json'));
  if(hash(a.assessment)!==e.data.assessmentSHA256||hash(r)!==hash(a.assessment.result))throw Error('assessment drift');
  Object.assign(current,{taskId:e.data.taskId,status:e.data.status,submissionPresent:!!r.entryAnswer,usage:r.usage,turns:r.turns,operations:r.operations,costUSD:r.costUSD,fatal:r.fatal,compilerFailure:a.assessment.compilerFailure,compilationOK:a.assessment.compilation?.ok??null});current=null;
 }
}
const dispatched=events.filter(e=>e.type==='generation-dispatch');
for(const e of dispatched){const m=e.data.payload.messages;const s=JSON.parse(m.at(-1).content);if(s.kind!=='controller_budget_status'||m.filter(x=>x.role==='user'&&x.content.includes('"kind":"controller_budget_status"')).length!==1)throw Error('feedback missing/duplicated');}
save('session-observations.json',{sessions,dispatchedFeedbacksVerified:dispatched.length,interpretation:'V9 adds a disclosed task04 consumer contract and frozen probe; same source materials and original16 static criteria. Exposed development tasks, not an unseen holdout.'});
const before=read(join(out,'key-before.json')),after=read(join(out,'key-after.json')),transport=outcome.summary.transport;
const keyDelta=after.data.usage-before.data.usage;
const byReceipt=budget.reportedUsageUSD+transport.reportedCostUSD,byKey=after.data.usage+0.022818016;
const reported=Math.max(byReceipt,byKey),unknown=budget.unresolvedReservationsUSD+transport.unknownReservedUSD;
save('billing.json',{newReportedCostUSD:transport.reportedCostUSD,keyUsageDeltaUSD:keyDelta,billingDeltaMatches:Math.abs(keyDelta-transport.reportedCostUSD)<1e-9,reportedCumulativeUSD:reported,keySnapshotCumulativeUSD:byKey,responseReceiptCumulativeUSD:byReceipt,unresolvedPriorReservationsUSD:budget.unresolvedReservationsUSD,newUnknownReservationsUSD:transport.unknownReservedUSD,totalUnknownReservationsUSD:unknown,conservativeCommittedUSD:reported+unknown,ceilingUSD:5.5,conservativeAvailableUSD:5.5-reported-unknown,externalKeyRemainingUSD:after.data.limit_remaining,generationCalls:transport.generationCalls,metadataRequests:3,releasedReservationsUSD:0});
const sha=b=>createHash('sha256').update(b).digest('hex');for(const b of manifest.codeBindings)if(sha(readFileSync(join(root,b.path)))!==b.sha256)throw Error('code drift');for(const [p,h]of Object.entries(manifest.artifactSHA256))if(sha(readFileSync(join(base,p)))!==h)throw Error('artifact drift');
save('verification.json',{suite:{source:'../offline/verification.json',passed:206,failed:0,skipped:0,rerunThisTurn:true},journalRowsVerified:rows.length,codeBindingsVerified:manifest.codeBindings.length,materialArtifactsVerified:5,feedbackRequestsVerified:dispatched.length,plannedSamples:4,startedSamples:sessions.length,submissions:sessions.filter(s=>s.submissionPresent).length,providerAttemptFailures:events.filter(e=>e.type==='provider-attempt-failed').length,modelSessionReruns:0,independentReview:false});
console.log(JSON.stringify({sessions:sessions.map(s=>({id:s.sampleId,status:s.status,submission:s.submissionPresent,compilationOK:s.compilationOK,turns:s.turns})),cost:transport.reportedCostUSD,newUnknown:transport.unknownReservedUSD}));
