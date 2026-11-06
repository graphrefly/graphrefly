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
const oldBase=join(root,'sessions/active/b121-comparison-design-v1/agent-api/candidate-round-v5-submit');
const base=join(root,'sessions/active/b121-comparison-design-v1/agent-api/candidate-round-v6-coverage');
const out=join(base,'live');
const read=p=>JSON.parse(readFileSync(p));
const save=(name,x)=>durableWrite(join(out,name),JSON.stringify(x,null,2)+'\n');
const snapshot=read(join(out,'key-before.json'));
const previous=read(join(oldBase,'live/billing.json'));
const reportedUsageUSD=Math.max(snapshot.data.usage+0.022818016,previous.reportedCumulativeUSD);
const unresolvedReservationsUSD=previous.totalUnknownReservationsUSD;
const budget={ceilingUSD:CEILING_USD,reportedUsageUSD,unresolvedReservationsUSD,asOf:snapshot.checkedAt,
 receiptSHA256:hash({snapshot,previous})};
const recordedBudget=read(join(out,'budget.json'));
for(const [key,value]of Object.entries(budget))if(hash(recordedBudget[key])!==hash(value))throw Error('Budget receipt drift');
const manifest=prepareCandidateManifest({candidateDirectory:base,outputRoot:join(root,'sessions/active/b121-comparison-design-v1/agent-api/candidate-runs'),budget});
const prior=read(join(oldBase,'live/manifest.json'));
const freeze=read(join(base,'frozen-candidate.json'));
const sha=x=>createHash('sha256').update(x).digest('hex');
for(const [p,h]of Object.entries(freeze.artifactSHA256))if(sha(readFileSync(join(base,p)))!==h)throw Error('Frozen artifact drift');
const identity=rows=>rows.map(({sampleId,taskId,role})=>({sampleId,taskId,role}));
if(hash(identity(manifest.samples))!==hash(identity(prior.samples)))throw Error('Sample identity drift');
for(const [p,h]of Object.entries(manifest.artifactSHA256))if(h!==freeze.artifactSHA256[p])throw Error('Manifest not bound to v6 freeze');
if(hash(manifest.contract)!==hash(freeze.unchangedRunnerContract))throw Error('Runner contract drift');
if(hash(manifest.codeBindings)!==hash(freeze.unchangedExecutionCodeBindings))throw Error('Code binding drift');
if(CEILING_USD!==4) throw Error('Authorized cap is exactly $4');
save('manifest.json',manifest);
const approval={manifestSHA:hash(manifest),action:'B121-agent-api-one-shot',acceptAliasLimitation:true,acceptInputEstimateLimitation:true,
 expiresAt:new Date(Date.now()+6*3600000).toISOString(),maxGenerationCalls:MAX_GENERATION_CALLS,maxUSD:4,retries:RETRY_POLICY,
 model:ROUTE.model,providerTag:ROUTE.tag,priorUsageUSD:reportedUsageUSD+unresolvedReservationsUSD,
 authorizationSource:'User confirmed cumulative $4 including prior usage and all unresolved reservations. After v6 four-task/16-criterion offline freeze and proposal to run each once, user replied 继续. Authorizes one v6 development campaign, same frozen provider, retry policy and hard limits, no replacement or score-driven model repair; not an unseen holdout.',
};
save('execution-approval.json',approval);
const apiKey=readFileSync('/Users/davidchenallio/.local/share/graphrefly-private/b121-qwen3.8-flash-20260914/openrouter.key','utf8').trim();
console.log(JSON.stringify({event:'starting',manifestSHA:hash(manifest),directory:join(manifest.outputRoot,hash(manifest)),budget}));
const result=await runCandidateCampaign({candidateDirectory:base,manifest,approval,apiKey});
const recovered=readCandidateCampaign(result.directory);
if(hash(recovered)!==hash(result.summary)) throw Error('Readback mismatch');
save('outcome.json',{directory:result.directory,summary:recovered});
console.log(JSON.stringify({event:'finished',directory:result.directory,summary:recovered}));
