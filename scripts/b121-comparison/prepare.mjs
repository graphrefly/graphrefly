/** Offline material preflight. An incomplete packet never becomes an execution manifest. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {generateMaterials,allocate,verifyFactEquivalence} from './materials.mjs';
import {projectTopology} from './projection.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const ts=resolve(root,'../graphrefly-ts');
const output=join(root,'sessions/active/b121-comparison-design-v1/preparation');
mkdirSync(output,{recursive:true});
const sha=v=>createHash('sha256').update(v).digest('hex');
const load=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,v)=>writeFileSync(join(output,p),JSON.stringify(v,null,2)+'\n');
const intake=spawnSync('python3',[join(root,'scripts/b121-comparison/verify_catalog.py'),ts],{encoding:'utf8'});assert.equal(intake.status,0,intake.stderr);
const catalog=load(join(ts,'docs/design/causal-comparison-preparation/source-catalog.json'));
assert.equal(sha(readFileSync(join(ts,catalog.archive))),catalog.archiveSha256);
const binding=load(join(ts,'docs/design/causal-comparison-preparation/capture-binding.json'));
for(const source of binding.sources)assert.equal(sha(readFileSync(join(ts,source.path))),source.sha256,source.path);
const raw=readFileSync(join(ts,'docs/design/causal-comparison-preparation/memory-checkpoints.json'));
assert.equal(sha(raw),binding.storedCaptureSha256);
const capture=JSON.parse(raw);
const eqBinding=load(join(ts,'docs/design/causal-comparison-preparation/equivalent-binding.json'));
for(const source of eqBinding.sources)assert.equal(sha(readFileSync(join(ts,source.path))),source.sha256);
const eqBytes=readFileSync(join(ts,'docs/design/causal-comparison-preparation/equivalent-checkpoints.json'));assert.equal(sha(eqBytes),eqBinding.storedCaptureSha256);
const equivalent=JSON.parse(eqBytes);
assert.equal(eqBinding.edits.length,2);
for(const run of equivalent.results){const entry=run.snapshots.find(s=>s.label==='writer-entry-before-transport');assert.equal(entry.writes,0);assert.equal(entry.host.inFlight,1);}
const projection=projectTopology(capture.results[0].topology);
save('projection.json',projection);
// Reviewer inventory only: these facts are not promoted to a blind packet without semantic review.
const evidence={
 E1:{kind:'source',stage:'A',content:'Scoring policy uses sample variance.'},
 E2:{kind:'source',stage:'A',content:'Only current verification bound to the request can support execution.'},
 E3:{kind:'source',stage:'A',content:'A display subscription does not own the run lifecycle.'},
 E4:{kind:'source',stage:'A',content:'A content digest does not authenticate an author.'},
 E5:{kind:'topology',stage:'A',content:{nodes:projection.nodes,edges:projection.edges}},
};
const fact=(id,subject,predicate,value,ref,stage='A')=>({id,subject,predicate,value,refs:[ref],stage});
const commonFacts=[fact('F1','variance','policy','sample','E1'),fact('F2','verification','must be current',true,'E2'),fact('F3','display detach','ends lifecycle',false,'E3'),fact('F4','digest','authenticates author',false,'E4')];
const cases=Object.entries(catalog.cases).map(([id,arms],i)=>{
 const ref=`R${i+1}`;
 const g=arms.graph.trace;
 // This is a factual inventory, not a replacement for raw independently reviewable receipts.
 evidence[ref]={kind:'trace',stage:'B',content:{candidateCount:g.candidates.length,checkpointLabels:arms.graph.checkpoints.map((c,index)=>`observation-${index+1}`)}};
 return {id,facts:[fact(`${id}F1`,'archived candidates','count',g.candidates.length,ref,'B')]};
});
const material=generateMaterials({commonFacts,cases,evidence,entries:{},relations:{G:{...projection,kind:'graph'}}});
for(const role of ['user','framework','maintainer'])for(const phase of ['A','B'])verifyFactEquivalence(material.packets.G[role][phase],material.packets.P[role][phase]);
save('candidate-materials.json',material);
save('allocation.json',{seed:'b121-comparison-v1-offline-draft',human:allocate('b121-comparison-v1-offline-draft','human'),agent:allocate('b121-comparison-v1-offline-draft','agent')});
const gaps=[
 {id:'case-phase-binding',ready:true,detail:'C2 actual equivalent-source Graph/plain writer-entry memory captures precede transport invocation. Permission here concerns the first physical transport, not another admission or replay. No real-file claim.'},
 {id:'branch-coverage',ready:false,detail:'C3 new captures withhold external verification. They do not pause an internal synchronous business branch; approved branch wording needs resolution.'},
 {id:'role-entry-parity',ready:false,detail:'Plain host exposes constructor/feed/observe/observations, not matched graded factory/capability entry. No invented APIs in participant snippets.'},
 {id:'atomic-facts-and-goldens',ready:false,detail:'Candidate inventory is 12 facts, not a complete 40-fact participant packet or independently justified eight-case answer key. Source/diff/policy supporting material must pass independent semantic fact count.'},
 {id:'participant-isolation',ready:false,detail:'In-memory broker denies unavailable paths and stage B before seal, but no tested participant process/provider with only this broker. Shared Codex tools cannot be counted as isolated.'},
 {id:'execution-budget',ready:false,detail:'Model revision, price, consent and participant identities unavailable; zero participants and zero spend authorized.'},
];
save('readiness.json',{kind:'offline-preparation-incomplete',designRef:'../README.md',approvedScope:'User continued after design commit f049b99; offline preparation only.',sourceCatalogSha256:sha(readFileSync(join(ts,'docs/design/causal-comparison-preparation/source-catalog.json'))),captureSha256:binding.storedCaptureSha256,observationArms:6,projection:{nodes:62,units:projection.displayUnits,edges:projection.edges.length},gateResults:gaps,qualifiedPacket:false,executionReady:false,participantRuns:0,providerCalls:0,realInboxIO:0,formalPerformanceQualification:false});
console.log(JSON.stringify({preflightCompleted:true,executionReady:false,gaps:gaps.filter(g=>!g.ready).map(g=>g.id)}));
