import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { captureCompiler, openFrozenCompiler, digest } from '/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/frozen-compiler.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const materialsJSON = readFileSync(join(here,'../materials.json'),'utf8');
const rubric = JSON.parse(readFileSync(join(here,'rubric-draft.json'),'utf8'));
const cases = JSON.parse(readFileSync(join(here,'calibration-index.json'),'utf8'));
const environmentJSON = captureCompiler({tsRoot:'/Users/davidchenallio/src/graphrefly-ts',materialsJSON,snippetLocation:'consumer/__b121_entry_validation__.ts'});
const compiler = openFrozenCompiler(environmentJSON,digest(environmentJSON));
const sourceEvidence = rubric.tasks.flatMap(task=>task.criteria.map(c=>({taskId:task.id,criterion:c.id,path:c.evidencePath,match:digest(JSON.parse(materialsJSON).files[c.evidencePath])===c.evidenceSHA256})));
const results=[];
for(const c of cases){
 const snippet=readFileSync(resolve(here,c.snippet),'utf8');
 const probe=rubric.tasks.find(t=>t.id===c.taskId).consumerProbe;
 const result=compiler.compile(snippet,probe);
 const row={...c,snippetSHA256:digest(snippet),consumerProbeSHA256:digest(probe),actualCompilation:result.ok,matched:result.ok===c.expectedCompilation,materialDiagnostics:result.materialDiagnostics,diagnostics:result.diagnostics,checkedFiles:result.checkedFiles.length};
 results.push(row);
 console.log(JSON.stringify({taskId:c.taskId,case:c.case,expected:c.expectedCompilation,actual:result.ok,matched:row.matched,diagnostics:result.diagnostics}));
}
const out={schema:'b121-public-api-author-static-calibration-v1',createdAt:new Date().toISOString(),materialSHA256:digest(materialsJSON),environmentSHA256:digest(environmentJSON),compilerVersion:compiler.compilerVersion,executedParticipantCode:false,sourceEvidence,results,allMatched:sourceEvidence.every(c=>c.match)&&results.every(c=>c.matched&&c.materialDiagnostics.length===0)};
writeFileSync(join(here,'static-validation.json'),JSON.stringify(out,null,2)+'\n');
if(!out.allMatched)process.exitCode=1;
