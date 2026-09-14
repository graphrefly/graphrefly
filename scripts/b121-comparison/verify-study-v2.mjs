/** Root verifier: no Graph/plain business, admission, or material helper imports. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const digest=v=>'sha256:'+createHash('sha256').update(v).digest('hex');
import {independentScoreSquared} from './materials.mjs';
const equal=(a,b)=>{const norm=v=>Array.isArray(v)?v.map(norm):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,norm(v[k])])):v;return JSON.stringify(norm(a))===JSON.stringify(norm(b));};
export function exactGuardEntry(run){
 const point=run.snapshots.find(s=>s.label==='writer-entry-before-transport');
 assert.ok(point,'actual writer entry required');assert.equal(point.writes,0);assert.equal(point.host.inFlight,1);
 assert.equal(point.host.records.length,1);const {request,admission,outcome}=point.host.records[0];
 const target=run.evaluations[0];assert.ok(target);assert.ok(equal(request.body.occurrence,target.occurrence),'guard target occurrence');
 assert.equal(request.body.inputDigest,target.inputDigest);assert.equal(request.body.policyDigest,target.policyDigest);assert.equal(request.body.effectId,'alert:'+target.evaluationRef);
 assert.equal(request.body.payloadDigest,digest(request.body.payloadText));
 assert.deepEqual(request.requestRef,{kind:request.body.schema,id:digest(canonical(request.body))});
 assert.equal(request.proposalDigest,digest(canonical({schema:'spending-alerts/effect-proposal/v1',occurrence:target.occurrence,effectId:request.body.effectId,requestRef:request.requestRef})));
 assert.equal(outcome,undefined);assert.equal(admission.state,'admitted');
 for(const k of ['occurrence','effectId'])assert.ok(equal(admission[k],request.body[k]),`guard ${k}`);
 assert.ok(equal(admission.requestRef,request.requestRef));assert.equal(admission.proposalDigest,request.proposalDigest);
 for(const k of ['sourceDigest','runtimeDigest','compositionEpoch','hostEpoch','destinationRef'])assert.ok(equal(request.body[k],run.binding[k]),`binding ${k}`);
 return point;
}
export function verifyStudyEvidence({catalog,memory,equivalent,passive,edits}){
 const result={};
 const schedule=id=>{const p=passive.cases.find(c=>c.id===id);assert.ok(p);return p;};
 for(const arm of ['graph','plain']){
  const c=id=>catalog.cases[id][arm];
  const e=equivalent.results.find(r=>r.arm===arm);assert.ok(e);
  const m=id=>{const r=memory.results.find(r=>r.arm===arm&&r.caseId===id);assert.ok(r);return r;};
  const c1=c('C1'), normal=schedule('S1-score-mutant').evaluations[0];
  const values=normal.prefix.map(t=>t.amount), current=values.at(-1);
  const required=independentScoreSquared(values,current,'sample'),changed=independentScoreSquared(values,current,'population');
  assert.notEqual(BigInt(required.numerator)*BigInt(changed.denominator),BigInt(changed.numerator)*BigInt(required.denominator));
  const observed=c1.trace.candidates[0].business.score.zScore;
  assert.ok(Math.abs(observed-Math.sqrt(Number(changed.numerator)/Number(changed.denominator)))<1e-14);
  assert.equal(c1.trace.attemptedPayloads.length,0);
  assert.equal(c1.checkpoints[0].host.records.length,0);
  const eqBefore=e.snapshots.find(s=>s.label==='before-verification-r1');assert.ok(eqBefore);assert.equal(eqBefore.writes,0);assert.equal(eqBefore.host.records.length,0);
  const report=edits.reports[`sample-to-population-${arm}`];assert.equal(report.edits.length,1);
  assert.equal((c1.trace.candidates[0].business.binding ?? c1.trace.candidates[0].request.body).runtimeDigest,report.runtimeDigest);
  assert.deepEqual(values,[1,2,3]);
  const eqValues=e.evaluations[0].prefix.map(t=>t.amount);assert.deepEqual(eqValues,[1,2,3]);
  const eq=independentScoreSquared(eqValues,eqValues.at(-1),'equivalent');assert.deepEqual(eq,required);exactGuardEntry(e);
  const r2=m('C3').snapshots.find(s=>s.label==='before-verification-r2');assert.ok(r2);assert.equal(r2.writes,1);
  assert.ok(r2.host.records.every(r=>r.request.body.occurrence.revision===1));
  const s4=schedule('S4-stale-current'), current4=s4.steps.find(s=>s.kind==='feed'&&s.lane==='current').value.current[0];
  assert.notEqual(current4.policyDigest,s4.evaluations[0].policyDigest);assert.equal(c('C4').trace.attemptedPayloads.length,0);
  const s5=schedule('S5-exact-replay'), arrivals=s5.steps.filter(s=>s.kind==='feed'&&s.lane==='arrivals');assert.equal(arrivals.length,2);assert.ok(equal(arrivals[0].value,arrivals[1].value));
  assert.equal(c('C5').trace.attemptedPayloads.length,1);assert.equal(c('C5').trace.records[0].outcome.state,'succeeded');
  assert.equal(c('C5').checkpoints.find(p=>p.label==='read-only-analysis-replay').attemptedCalls,1);
  const short=m('C6'), before=short.snapshots.find(s=>s.label==='outcome-r1'), after=short.snapshots.find(s=>s.label==='display-reattached');
  const detached=short.snapshots.find(s=>s.label==='display-detached');assert.ok(detached);
  for(const point of [before,detached,after]){assert.ok(point);assert.equal(point.host.dispatchStopped,true);assert.equal(point.host.records.length,1);assert.equal(point.host.records[0].outcome.state,'unknown');}
  assert.ok(equal(before.authority,detached.authority));
  assert.ok(before&&after);assert.ok(equal(before.authority,after.authority));assert.equal(after.host.records[0].outcome.state,'unknown');assert.equal(after.host.normalEndReady,false);assert.equal(after.writes,1);
  const s7=schedule('S7-missing-verifier');assert.ok(!s7.steps.some(s=>s.kind==='feed'&&s.lane==='verification'));assert.equal(c('C7').trace.attemptedPayloads.length,0);assert.ok(c('C7').trace.candidates.length>0);
  exactGuardEntry(m('C3'));
  result[arm]={C1:{sourceChanged:true,consequence:'different-for-supplied-input',allow:[false,false],uncertainty:['target-authorization-unestablished','target-authorization-unestablished']},C2:{sourceChanged:true,consequence:'equivalent-for-supplied-input',allow:[false,true],uncertainty:['target-authorization-unestablished','authorship-unknown']},C3:{sourceChanged:false,consequence:'external-verification-pending',allow:[false,false],uncertainty:['target-authorization-unestablished','revision-2-verification-missing']},C4:{sourceChanged:false,consequence:'current-policy-mismatch',allow:[false,false],uncertainty:['current-policy-not-established','current-policy-not-established']},C5:{sourceChanged:false,consequence:'no-additional-effect-on-replay',allow:[false,false],uncertainty:['none-for-duplicate-request','none-for-duplicate-request']},C6:{sourceChanged:false,consequence:'unknown-effect-retained',allow:[false,false],uncertainty:['physical-outcome-unknown','physical-outcome-unknown']},C7:{sourceChanged:false,consequence:'verification-unavailable',allow:[false,false],uncertainty:['verification-and-authorship-missing','verification-and-authorship-missing']},C8:{sourceChanged:false,consequence:'normal-first-transport-supported',allow:[true,true],uncertainty:['authorship-unknown','authorship-unknown']}};
 }
 assert.deepEqual(result.graph,result.plain,'independent paired judgments');return result.graph;
}
