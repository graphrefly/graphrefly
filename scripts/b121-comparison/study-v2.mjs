/** Frozen offline evidence projection for the approved judgment-only revision. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateMaterials,verifyFactEquivalence,allocate,QUESTIONS} from './materials.mjs';
import {projectTopology} from './projection.mjs';
import {verifyStudyEvidence} from './verify-study-v2.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
export function loadStudyEvidence(tsRoot=resolve(root,'../graphrefly-ts')){
 const load=name=>JSON.parse(readFileSync(join(tsRoot,'docs/design/causal-comparison-preparation',name)));
 const verify=spawnSync('python3',[join(root,'scripts/b121-comparison/verify_catalog.py'),tsRoot],{encoding:'utf8'});assert.equal(verify.status,0,verify.stderr);
 const editRun=spawnSync('python3',[join(root,'scripts/b121-comparison/source-edits.py'),tsRoot],{encoding:'utf8'});assert.equal(editRun.status,0,editRun.stderr);
 for(const [name,capture] of [['capture-binding.json','memory-checkpoints.json'],['equivalent-binding.json','equivalent-checkpoints.json']]){
  const b=load(name);for(const s of b.sources)assert.equal(sha(readFileSync(join(tsRoot,s.path))),s.sha256,s.path);
  assert.equal(sha(readFileSync(join(tsRoot,'docs/design/causal-comparison-preparation',capture))),b.storedCaptureSha256);
 }
 const passive=load('passive-facts.json');for(const s of passive.inputs)assert.equal(sha(readFileSync(join(tsRoot,s.path))),s.sha256);
 assert.equal(sha(readFileSync(join(tsRoot,passive.plain.path))),passive.plain.sha256);
 return {catalog:load('source-catalog.json'),memory:load('memory-checkpoints.json'),equivalent:load('equivalent-checkpoints.json'),passive,edits:JSON.parse(editRun.stdout)};
}
export function prepareStudy(data){
 const decisions=verifyStudyEvidence(data);
 const graph=projectTopology(data.memory.results.find(r=>r.arm==='graph'&&r.caseId==='C3').topology);
 const canonical=t=>JSON.stringify({nodes:t.nodes.map(n=>[n.id,n.factory]).sort(),edges:t.edges.map(e=>[e.from,e.to]).sort()});
 for(const c of Object.values(data.catalog.cases))assert.equal(canonical(c.graph.topology),canonical(graph));
 for(const c of data.equivalent.results.filter(r=>r.arm==='graph'))assert.equal(canonical(c.topology),canonical(graph));
 const plain=data.passive.plain.relations;assert.ok(plain,'complete plain dependency projection required');
 const evidence={},commonFacts=[],cases=Object.keys(decisions).map(id=>({id,facts:[]})),bindings=[];
 function add(id,subject,predicate,value,stage,source){
  const ref='E'+id; evidence[ref]={kind:stage==='B'?'receipt':'trace',stage,content:{subject,predicate,value}};
  const fact={id,subject,predicate,value,stage,refs:[ref]};
  if(id.startsWith('F'))commonFacts.push(fact);else cases.find(c=>id.startsWith(c.id+'F')).facts.push(fact);
  bindings.push({factId:id,source});
 }
 add('F1','numeric policy','required squared z-score','delta²(n−1)/(n*d); n=count, delta=n*x−sum(values), d=n*sum(values²)−sum(values)²','A','sample policy; exact independent rational arithmetic');
 add('F2','supplied source pairs','change graph topology or plain method-call relationships',false,'A','all bound graph snapshots and arithmetic-only source edits; AST plain calls');
 add('F3','packet','contains authenticated author provenance',false,'A','deliberate absence from participant packet; no claim about provenance available elsewhere');
 add('F4','packet','contains host lifecycle-end receipt',false,'A','none supplied; readiness and end are distinct, absence does not prove alive');
 add('F5','first physical transport at the frozen observation','permitted by supplied evidence exactly when','a current successful final-guard record is supplied for that exact first request','A','consumer host dispatch contract; request/admission/binding independently matched');
 add('F6','confirmed identical effect','may be physically submitted a second time',false,'A','frozen no-duplicate execution policy');
 add('F7','unknown physical result','permits normal host end',false,'A','host normal-end policy');
 add('F8','implementation changes in this packet','case IDs','C1,C2','A','bound source transforms; C3-C8 passive input/timing observations');
 const addCase=(id,rows)=>rows.forEach(([subject,predicate,value,stage,source],i)=>add(id+'F'+(i+1),subject,predicate,value,stage,source));
 addCase('C1',[
 ['numeric expression','replacement','delta*delta*(n-1n) → delta*delta*n','A','both actual loaded source edits in archive'],
 ['numeric input','values; current is last','[1,2,3]','A','S1 frozen evaluation prefix'],
 ['target request','current final-guard record supplied at A',false,'A','business-observed checkpoint before verification feed; no admitted host record'],
 ['independent numerical comparison','candidate equals required result',false,'B','observed zScore versus independently computed sample/population rational'],
 ]);
 addCase('C2',[
 ['numeric expression','replacement','delta*delta*(n-1n) → delta*delta*n-delta*delta','A','new equivalent source bindings; archived equivalent physical proof separate'],
 ['numeric input','values; current is last','[1,2,3]','A','bound equivalent evaluation prefix'],
 ['target request','current final-guard record supplied at A',false,'A','before-verification-r1 checkpoint; no admitted host record'],
 ['first transport','exact final-guard success at B',true,'B','writer-entry-before-transport in both equivalent arms'],
 ]);
 addCase('C3',[
 ['target occurrence','revision',2,'A','second revision before-verification-r2'],
 ['completed verified occurrence','revision',1,'A','first revision successful request'],
 ['target occurrence','has final-guard success',false,'A','records only contain revision1 at r2 checkpoint'],
 ['target occurrence','external verification delivered',false,'B','bound worker captures before verification feed for revision2'],
 ]);
 const s4=data.passive.cases.find(c=>c.id==='S4-stale-current');
 addCase('C4',[
 ['current-policy input','digest',s4.steps.find(s=>s.kind==='feed'&&s.lane==='current').value.current[0].policyDigest,'A','frozen passive schedule current input'],
 ['target policy','digest',s4.evaluations[0].policyDigest,'A','frozen evaluation policy'],
 ['target request','has final-guard success',false,'A','both traces have zero attempts'],
 ['independent policy comparison','current digest matches target',false,'B','direct equality comparison of preceding two digests'],
 ]);
 addCase('C5',[
 ['earlier physical effect','outcome','succeeded','A','archived host result and independent readback retained separately'],
 ['replayed proposal','identical to earlier proposal',true,'A','two identical arrivals and immutable evaluation'],
 ['earlier physical effect','submission count',1,'A','prior host record'],
 ['exact replay','additional submissions',0,'B','read-only-analysis-replay checkpoint and one total attempt'],
 ]);
 addCase('C6',[
 ['physical result','state','unknown','A','one-byte injected result and actual host outcome'],
 ['host','dispatch stopped',true,'A','short-result observation'],
 ['after display detach','retained effect records',1,'A','display-detached snapshot'],
 ['display reconnect','preserves that record',true,'B','exact real Map/Set contents compared, not empty JSON objects'],
 ]);
 addCase('C7',[
 ['current verification','supplied',false,'A','no verification feed in frozen schedule'],
 ['target request','has final-guard success',false,'A','zero attempts'],
 ['assessment','produced',true,'B','candidate assessment present in both independent arms'],
 ]);
 addCase('C8',[
 ['first physical transport','exact final-guard success',true,'A','base first revision writer-entry-before-transport, not an end-of-run receipt'],
 ['physical transport','calls before observation',0,'A','outer injected writer count before transport'],
 ]);
 const material=generateMaterials({commonFacts,cases,evidence,relations:{G:{...graph,kind:'graph'},P:plain},method:'judgment-only-v2'});
 const fieldRefs=(id,stage,dimension)=>{
  if(dimension==='implementationChanged')return id==='C1'||id==='C2'?[id+'F1']:['F8'];
  if(dimension==='topologyChanged')return ['F2'];if(dimension==='author')return ['F3'];if(dimension==='lifecycleEnded')return ['F4'];
  if(dimension==='effectNow')return id==='C1'?['F5','C1F3']:id==='C2'?['F5',stage==='A'?'C2F3':'C2F4']:id==='C3'?['F5','C3F3']:id==='C4'?['F5','C4F3']:id==='C5'?['F6','C5F1','C5F2']:id==='C6'?['C6F2']:id==='C7'?['F5','C7F2']:['F5','C8F1','C8F2'];
  if(dimension==='uncertainty'&&['C1','C2'].includes(id)&&decisions[id].uncertainty[stage==='A'?0:1]==='target-authorization-unestablished')return ['F5',id+'F3'];
  if(dimension==='uncertainty'&&decisions[id].uncertainty[stage==='A'?0:1].includes('authorship'))return ['F3',...((id==='C7')?['C7F1']:[])];
  if(dimension==='consequence'&&['C1','C2'].includes(id))return ['F1',id+'F1',id+'F2'];
  return cases.find(c=>c.id===id).facts.filter(f=>stage==='B'||f.stage==='A').map(f=>f.id);
 };
 const goldens=Object.fromEntries(['A','B'].map((stage,index)=>[stage,Object.fromEntries(Object.entries(decisions).map(([id,d])=>[id,Object.fromEntries(Object.entries({implementationChanged:d.sourceChanged?'changed':'unchanged',topologyChanged:'unchanged',consequence:id==='C3'&&stage==='A'?'authorization-unestablished':d.consequence,uncertainty:d.uncertainty[index],effectNow:d.allow[index]?'allow':'deny',lifecycleEnded:'not-established',author:'unknown'}).map(([field,expected])=>[field,{expected,requiredCitations:fieldRefs(id,stage,field),...(field==='effectNow'?{safety:'allow'}:field==='lifecycleEnded'?{safety:'end'}:field==='author'||field==='consequence'?{certainty:true}:{})}]))]))]));
 for(const role of ['user','framework','maintainer'])for(const stage of ['A','B']){
  const g=material.packets.G[role][stage],p=material.packets.P[role][stage];
  verifyFactEquivalence(g,p);
  for(const packet of [g,p]){
   packet.questions.instructions += ' lifecycleEnded asks whether end is established by supplied evidence, not whether an unobserved end is impossible. B may provide independent checks of the same frozen observation, not necessarily a later runtime moment. Code formulas use the variables defined in F1. Numeric consequences are limited to this input; no whole-program equivalence claim. The uncertainty field asks for the primary remaining support gap: choose the first SUPPORTED label in this priority order: physical-outcome-unknown, current-policy-not-established, revision-2-verification-missing, verification-and-authorship-missing, none-for-duplicate-request, target-authorization-unestablished, authorship-unknown; otherwise unknown. More specific gaps take priority over generic missing authorization; duplicate requests need no new authorization. Author is also answered separately. Plain relationships show static possible calls and function references, not observed runtime calls; injected writer/listener implementations lie outside that source inventory.';
   // No expected per-case answers are included; all allowable labels are a common vocabulary.
   packet.answerVocabulary={implementationChanged:['changed','unchanged','unknown'],topologyChanged:['changed','unchanged','unknown'],consequence:[...new Set(Object.values(decisions).map(d=>d.consequence)),'authorization-unestablished','unknown'].sort(),uncertainty:[...new Set(Object.values(decisions).flatMap(d=>d.uncertainty)),'unknown'].sort(),effectNow:['allow','deny','unknown'],lifecycleEnded:['ended','not-established','unknown'],author:['unknown','authenticated-author']};
  }
  for(const arm of ['G','P']){const text=JSON.stringify(material.packets[arm][role][stage],null,2)+'\n';material.inventory[arm][role][stage]={sha256:sha(text),bytes:Buffer.byteLength(text),lines:text.split('\n').length-1};}
 }
 return {material,goldens,bindings,decisions,allocation:{human:allocate('b121-comparison-v2','human'),agent:allocate('b121-comparison-v2','agent')},scope:{method:'judgment-only-v2',entryTasks:'Graph only after A and B closure',facts:material.budget.total,codeDiffs:2,consumerExecutions:0,participantRuns:0,executionReady:false}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert.equal(process.argv.length,2);const result=prepareStudy(loadStudyEvidence());
 const out=join(root,'sessions/active/b121-comparison-design-v1/revision-2');mkdirSync(out,{recursive:true});
 for(const [name,value] of Object.entries(result))writeFileSync(join(out,name+'.json'),JSON.stringify(value,null,2)+'\n');
 console.log(JSON.stringify(result.scope));
}
