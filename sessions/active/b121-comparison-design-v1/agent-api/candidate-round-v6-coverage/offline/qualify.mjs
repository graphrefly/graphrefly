import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {digest} from '/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/frozen-compiler.mjs';
import {openCandidateRound} from '/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/candidate-entry.mjs';
import {candidatePreflight} from '/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/candidate-preflight.mjs';
import {createSourceAccess} from '/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/source-access.mjs';
const root='/Users/davidchenallio/src/graphrefly';const base=root+'/sessions/active/b121-comparison-design-v1/agent-api/candidate-round-v6-coverage';
const old=root+'/sessions/active/b121-comparison-design-v1/agent-api/candidate-round-v5-submit';
const read=(dir,name)=>readFileSync(join(dir,name),'utf8');const json=(dir,name)=>JSON.parse(read(dir,name));
const environmentJSON=gunzipSync(readFileSync(join(base,'compiler-environment.json.gz'))).toString();
const round=openCandidateRound({materialsJSON:read(base,'materials.json'),tasksJSON:read(base,'tasks.json'),rubricJSON:read(base,'reviewer-rubric.json'),environmentJSON,pins:json(base,'integration-pins.json'),receiptRoot:join(base,'offline/compiler')});
const manifest=json(old,'live/manifest.json');for(const [p,h]of Object.entries(manifest.artifactSHA256))assert.equal(digest(readFileSync(join(old,p))),h);for(const b of manifest.codeBindings)assert.equal(digest(readFileSync(join(root,b.path))),b.sha256);
const before=json(old,'materials.json'),after=json(base,'materials.json');const changed=Object.keys(after.files).filter(p=>before.files[p]!==after.files[p]);assert.deepEqual(changed,['examples/spending-alerts/README.md']);assert.deepEqual(Object.keys(before.files),Object.keys(after.files));
const oldEnv=JSON.parse(gunzipSync(readFileSync(join(old,'compiler-environment.json.gz'))));const env=JSON.parse(environmentJSON);for(const k of ['compilerJS','compilerVersion','nodeVersion','options','snippetLocation'])assert.deepEqual(env[k],oldEnv[k]);for(const [p,v]of Object.entries(env.files))if(p!=='/b121-frozen/examples/spending-alerts/README.md')assert.equal(v,oldEnv.files[p]);
const packets=[];for(const id of round.taskIds){const p=round.prepare(id,'offline-check');const broker=createSourceAccess(p.entryFiles);for(const path of ['reviewer-rubric.json','compiler-environment.json.gz','offline/calibration-cases.json','offline/calibration-expected.json'])assert.throws(()=>broker.request({op:'read',path}),/entry path unavailable/);assert.equal(broker.request({op:'read',path:'entry/task.json'}).ok,true);packets.push({taskId:id,packetFiles:Object.keys(p.entryFiles).length,reviewerPathsDenied:4});}
const smoke=await candidatePreflight(base,{receiptRoot:join(base,'offline/compiler')});assert.ok(smoke.readyForCandidateTypechecking);
const cases=[];for(const c of json(base,'offline/calibration-cases.json').cases){const result=await round.typecheck(c.snippet,{context:{kind:'reviewer-calibration',caseId:c.id,providerCalls:0}});assert.ok(result.compilation?.ok,JSON.stringify(result));cases.push({id:c.id,snippetSHA256:digest(c.snippet),compiled:true,compilerReceipt:result.receiptDirectory});}
const report={kind:'offline-development-coverage-qualification',generationCalls:0,participantSubmissions:0,formalReady:false,changedMaterialFiles:changed,materialFiles:Object.keys(after.files).length,priorFrozenArtifactsUnchanged:5,priorCodeBindingsUnchanged:manifest.codeBindings.length,toolchainUnchanged:true,packets,moduleProbes:smoke,calibrationCompilation:cases,basis:'Compile-only plus packet boundary checks. Semantic calibration reviewed independently; neither compile success nor fixtures are model results.'};
writeFileSync(join(base,'offline/qualification.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({moduleProbes:smoke.rows.length,calibrationCompiles:cases.length,packets:packets.length,changed}));
