import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadStudyEvidence,prepareStudy} from './study-v2.mjs';
import {verifyStudyEvidence} from './verify-study-v2.mjs';
import {createSession,gradeSealed} from './session.mjs';
const data=loadStudyEvidence();
const prepared=prepareStudy(data);
test('actual bound eight-case packet has matching facts, finite budget, and post-finalization hashes',()=>{
 assert.equal(prepared.scope.facts,37);assert.equal(prepared.scope.codeDiffs,2);
 for(const arm of ['G','P'])for(const role of ['user','framework','maintainer'])for(const stage of ['A','B']){
  const p=prepared.material.packets[arm][role][stage];assert.equal(p.entry,null);
  assert.equal(p.task.objective,'same-facts judgment');assert.ok(!p.task.task.includes('Write a composition'));
  const ids=new Set([...p.commonFacts,...p.cases.flatMap(c=>c.facts)].map(f=>f.id));
  for(const c of Object.values(prepared.goldens[stage]))for(const rule of Object.values(c))for(const ref of rule.requiredCitations)assert.ok(ids.has(ref));
  const text=JSON.stringify(p,null,2)+'\n';assert.equal(prepared.material.inventory[arm][role][stage].sha256,createHash('sha256').update(text).digest('hex'));
  assert.equal(prepared.material.inventory[arm][role][stage].bytes,Buffer.byteLength(text));
  if(stage==='A')assert.ok(!Object.values(p.evidence).some(e=>e.stage==='B'));
 }
});
test('A keeps undisclosed cause unknown; B may establish it; lifecycle proof is not inferred from readiness',()=>{
 for(const [phase,id] of [['A','C1'],['B','C1'],['A','C2']])assert.equal(prepared.goldens[phase][id].uncertainty.expected,'target-authorization-unestablished');
 assert.equal(prepared.goldens.A.C3.consequence.expected,'authorization-unestablished');
 assert.equal(prepared.goldens.B.C3.consequence.expected,'external-verification-pending');
 assert.equal(prepared.goldens.A.C3.uncertainty.expected,'target-authorization-unestablished');
 for(const stage of ['A','B'])for(const c of Object.values(prepared.goldens[stage]))assert.equal(c.lifecycleEnded.expected,'not-established');
});
test('real prepared materials flow through isolated broker map/sealing/grader, only synthetic answers',()=>{
 const packets=prepared.material.packets.G.user;
 const s=createSession({sessionId:'offline-control-not-participant',files:{'A.json':{phase:'A',content:JSON.stringify(packets.A)},'B.json':{phase:'B',content:JSON.stringify(packets.B)}}});
 assert.equal(s.broker.request({op:'read',path:'B.json'}).ok,false);
 for(const phase of ['A','B']){
  for(const [scenario,golden] of Object.entries(prepared.goldens[phase])){
   const fields=Object.fromEntries(Object.entries(golden).map(([f,r])=>[f,{value:r.expected,citations:r.requiredCitations}]));
   assert.equal(s.broker.request({op:'submit',phase,scenario,fields}).ok,true);
  }
  const seal=phase==='A'?s.sealA():s.finish().sealB;
  const result=gradeSealed(seal,prepared.goldens[phase],seal.hash);assert.equal(result.totals.correct,56);
 }
 assert.deepEqual(prepared.goldens.A.C4.effectNow.requiredCitations,['F5','C4F3']);
});
test('real evidence corruptions cannot retain the prepared goldens',()=>{
 const edits=[
  d=>{const r=d.equivalent.results[0].snapshots.find(s=>s.label==='writer-entry-before-transport').host.records[0];r.request.body.occurrence.revision=999;r.admission.occurrence.revision=999;},
  d=>d.equivalent.results[0].evaluations[0].prefix[0].amount=500,
  d=>d.equivalent.results[0].snapshots.find(s=>s.label==='writer-entry-before-transport').host.records[0].request.body.payloadText='altered',
  d=>d.equivalent.results[0].snapshots.find(s=>s.label==='before-verification-r1').writes=1,
  d=>d.equivalent.results[0].snapshots.find(s=>s.label==='before-verification-r1').host.records.push({}),
  d=>d.memory.results.find(r=>r.arm==='graph'&&r.caseId==='C6').snapshots.find(s=>s.label==='display-detached').host.dispatchStopped=false,
  d=>d.catalog.cases.C7.graph.trace.candidates=[],
  d=>d.catalog.cases.C1.graph.trace.candidates[0].business.score.zScore=1,
  d=>d.equivalent.results[0].snapshots.find(s=>s.label==='writer-entry-before-transport').host.records[0].admission.effectId='wrong',
  d=>d.memory.results.find(r=>r.arm==='graph'&&r.caseId==='C3').snapshots.find(s=>s.label==='before-verification-r2').writes=2,
  d=>{const p=d.passive.cases.find(c=>c.id==='S4-stale-current');p.steps.find(s=>s.kind==='feed'&&s.lane==='current').value.current[0].policyDigest=p.evaluations[0].policyDigest;},
  d=>d.catalog.cases.C5.plain.trace.attemptedPayloads.push('duplicate'),
  d=>d.memory.results.find(r=>r.arm==='graph'&&r.caseId==='C6').snapshots.find(s=>s.label==='display-reattached').host.records[0].outcome.state='succeeded',
  d=>d.passive.cases.find(c=>c.id==='S7-missing-verifier').steps.push({kind:'feed',lane:'verification',value:{}}),
 ];
 for(const mutate of edits){const d=structuredClone(data);mutate(d);assert.throws(()=>verifyStudyEvidence(d));}
});
