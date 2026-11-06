import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const root='/Users/davidchenallio/src/graphrefly';
const load=async name=>import(pathToFileURL(join(root,'scripts/b121-comparison',name)));
const {prepareCandidateManifest,runCandidateCampaign,readCandidateCampaign}=await load('candidate-campaign.mjs');
const {durableWrite}=await load('recorded-process.mjs');
const {hash}=await load('session.mjs');
const {RETRY_POLICY}=await load('api-transport.mjs');
const {ROUTE,CEILING_USD,MAX_GENERATION_CALLS}=await load('api-provider.mjs');
const oldBase=join(root,'sessions/active/b121-comparison-design-v1/agent-api/next-task-set-draft');
const base=join(root,'sessions/active/b121-comparison-design-v1/agent-api/next-task-set-continuation');
const out=join(base,'live');
const read=p=>JSON.parse(readFileSync(p));
const save=(name,x)=>durableWrite(join(out,name),JSON.stringify(x,null,2)+'\n');
const snapshot=read(join(out,'key-before.json'));
const previous=read(join(oldBase,'live/billing.json'));
const reportedUsageUSD=Math.max(snapshot.data.usage+0.022818016,previous.reportedCumulativeUSD);
const unresolvedReservationsUSD=previous.totalUnknownReservationsUSD;
const budget={ceilingUSD:CEILING_USD,reportedUsageUSD,unresolvedReservationsUSD,asOf:snapshot.checkedAt,
 receiptSHA256:hash({snapshot,previous})};
save('budget.json',{...budget,previousAuditSHA256:hash(previous),keySnapshotSHA256:hash(snapshot),priorUsageUSD:reportedUsageUSD+unresolvedReservationsUSD});
const manifest=prepareCandidateManifest({candidateDirectory:base,outputRoot:join(root,'sessions/active/b121-comparison-design-v1/agent-api/candidate-runs'),budget});
const prior=read(join(oldBase,'live/manifest.json'));
const oldTasks=read(join(oldBase,'tasks.json')),oldRubric=read(join(oldBase,'reviewer-rubric.json'));
if(hash(read(join(base,'tasks.json')).tasks)!==hash(oldTasks.tasks.slice(1)))throw Error('Task change');
if(hash(read(join(base,'reviewer-rubric.json')).tasks)!==hash(oldRubric.tasks.slice(1)))throw Error('Rubric change');
for(const f of ['materials.json','compiler-environment.json.gz'])if(manifest.artifactSHA256[f]!==prior.artifactSHA256[f])throw Error('Material/toolchain change');
if(hash(manifest.contract)!==hash(prior.contract))throw Error('Contract change');
const changed=manifest.codeBindings.filter(x=>prior.codeBindings.find(y=>y.path===x.path)?.sha256!==x.sha256).map(x=>x.path);
if(hash(changed)!==hash(['scripts/b121-comparison/api-provider.mjs']))throw Error('Unexpected code change');
save('freeze-verification.json',{tasksUnchanged:true,rubricUnchanged:true,materialsUnchanged:true,compilerUnchanged:true,contractUnchanged:true,changedExecutionFiles:changed,reason:'Only cumulative budget constant changed 5.5 to11; sample subset explicitly mapped in continuation.json.'});
const endpoint=read(join(out,'provider-pricing.json')).data.endpoints.find(e=>e.tag==='together');
if(!endpoint || endpoint.context_length!==1048576 || Number(endpoint.pricing.prompt)!==0.0000003 || Number(endpoint.pricing.completion)!==0.0000012 || Number(endpoint.pricing.input_cache_read)!==0.000000006 || !endpoint.supported_parameters.includes('tools') || !endpoint.supported_parameters.includes('tool_choice'))throw Error('Provider qualification metadata changed');
if(manifest.samples.length!==2||manifest.policy.denominator!==2)throw Error('Expected fixed two');
if(CEILING_USD!==11) throw Error('Authorized cap is $11');
save('manifest.json',manifest);
const approval={manifestSHA:hash(manifest),action:'B121-agent-api-one-shot',acceptAliasLimitation:true,acceptInputEstimateLimitation:true,
 expiresAt:new Date(Date.now()+6*3600000).toISOString(),maxGenerationCalls:MAX_GENERATION_CALLS,maxUSD:11,retries:RETRY_POLICY,
 model:ROUTE.model,providerTag:ROUTE.tag,priorUsageUSD:reportedUsageUSD+unresolvedReservationsUSD,
 authorizationSource:'User authorized necessary internal budget increases <=100% and then said 好的，继续 after cap11 applied. Execute two prior tasks with no model HTTP attempts, once; preserve prior stopped campaign and first accepted answer. Standing budget authorization retained in budget-standing-authorization.md. External key limit remains1.97, no recharge.',
};
save('execution-approval.json',approval);
const apiKey=readFileSync('/Users/davidchenallio/.local/share/graphrefly-private/b121-qwen3.8-flash-20260914/openrouter.key','utf8').trim();
console.log(JSON.stringify({event:'starting',manifestSHA:hash(manifest),directory:join(manifest.outputRoot,hash(manifest)),budget}));
const result=await runCandidateCampaign({candidateDirectory:base,manifest,approval,apiKey});
const recovered=readCandidateCampaign(result.directory);
if(hash(recovered)!==hash(result.summary)) throw Error('Readback mismatch');
save('outcome.json',{directory:result.directory,summary:recovered});
console.log(JSON.stringify({event:'finished',directory:result.directory,summary:recovered}));
