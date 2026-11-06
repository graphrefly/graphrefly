import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import assert from 'node:assert/strict';
import {openCandidateRound} from '/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/candidate-entry.mjs';
import {candidatePreflight} from '/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/candidate-preflight.mjs';
const parent='/Users/davidchenallio/src/graphrefly/sessions/active/b121-comparison-design-v1/agent-api/',base=parent+'candidate-round-v9-consumer-contract';
const read=p=>JSON.parse(readFileSync(p)); const save=(p,x)=>writeFileSync(base+'/'+p,JSON.stringify(x,null,2)+'\n');
const round=openCandidateRound({materialsJSON:readFileSync(base+'/materials.json','utf8'),tasksJSON:readFileSync(base+'/tasks.json','utf8'),rubricJSON:readFileSync(base+'/reviewer-rubric.json','utf8'),environmentJSON:gunzipSync(readFileSync(base+'/compiler-environment.json.gz')).toString(),pins:read(base+'/integration-pins.json'),receiptRoot:base+'/offline/compiler'});
const preflight=await candidatePreflight(base,{receiptRoot:base+'/offline/compiler'});assert.ok(preflight.readyForCandidateTypechecking);save('offline/module-preflight.json',preflight);
const outcome=read(parent+'candidate-round-v8-cap450/live/outcome.json');
const old=read(outcome.directory+'/candidate-entry-04.assessment.json').assessment.result;
const original=old.entryAnswer.snippet;
const corrected=original.replace('SpendingAlertsView["publication"]','import("../../packages/ts/src/node/node.js").Node<CausalQuiescence>');assert.notEqual(original,corrected);
const cases=[['v8-original',original,'compile-failed'],['synthetic-corrected-type',corrected,'pending-review'],['original-with-nocheck','// @ts-nocheck\n'+original,'compile-failed'],['missing-required-export',corrected.replace('export function inspectSpendingInstance','function inspectSpendingInstance'),'compile-failed']];
const results=[];
for(const [name,snippet,status]of cases){
 const result=structuredClone(old);result.entryAnswer.snippet=snippet;
 const events=[];const a=await round.assess({taskId:'inspect-with-detached-display',sampleId:old.slot.id,result,journal:e=>events.push(e),kind:'offline-candidate-replay'});
 assert.equal(a.assessment.status,status);assert.equal(a.assessment.compilation.materialDiagnostics.length,0);
 save('offline/'+name+'.json',{interpretation:'Offline diagnostic calibration from exposed v8 answer; not a new model answer, not execution, not changed historical score',...a,events});
 results.push({name,expected:status,actual:a.assessment.status,diagnostics:a.assessment.compilation.diagnostics});
}
save('offline/consumer-calibration.json',{generationCalls:0,passed:results.length,cases:results});
console.log(JSON.stringify({modules:4,calibrations:results.map(({name,actual})=>({name,actual}))}));
