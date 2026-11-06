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
const oldBase=join(root,'sessions/active/b121-comparison-design-v1/agent-api/candidate-round-v11-connection-close');
const base=join(root,'sessions/active/b121-comparison-design-v1/agent-api/next-task-set-draft');
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
const freeze=read(join(base,'prepared-manifest.json'));
for(const field of ['artifactSHA256','binding','contract','codeBindings','samples','policy'])
 if(hash(manifest[field])!==hash(freeze[field]))throw Error('Frozen drift: '+field);
const endpoint=read(join(out,'provider-pricing.json')).data.endpoints.find(e=>e.tag==='together');
if(!endpoint || endpoint.context_length!==1048576 || Number(endpoint.pricing.prompt)!==0.0000003 || Number(endpoint.pricing.completion)!==0.0000012 || Number(endpoint.pricing.input_cache_read)!==0.000000006 || !endpoint.supported_parameters.includes('tools') || !endpoint.supported_parameters.includes('tool_choice'))throw Error('Provider qualification metadata changed');
if(manifest.samples.length!==3||manifest.policy.denominator!==3)throw Error('Expected fixed three');
if(CEILING_USD!==5.5) throw Error('Authorized cap is exactly $5.50');
save('manifest.json',manifest);
const approval={manifestSHA:hash(manifest),action:'B121-agent-api-one-shot',acceptAliasLimitation:true,acceptInputEstimateLimitation:true,
 expiresAt:new Date(Date.now()+6*3600000).toISOString(),maxGenerationCalls:MAX_GENERATION_CALLS,maxUSD:5.5,retries:RETRY_POLICY,
 model:ROUTE.model,providerTag:ROUTE.tag,priorUsageUSD:reportedUsageUSD+unresolvedReservationsUSD,
 authorizationSource:'User replied 继续 to the explicit proposal to refresh costs and execute one fixed three-task evaluation under cumulative USD5.50, preserving all historical unknown reservations, with no replacement runs. Same reviewed task artifacts and source, model/provider/session limits/retry policy; key lifetime cap1.97 unchanged. This grant is consumed by this one campaign.',
};
save('execution-approval.json',approval);
const apiKey=readFileSync('/Users/davidchenallio/.local/share/graphrefly-private/b121-qwen3.8-flash-20260914/openrouter.key','utf8').trim();
console.log(JSON.stringify({event:'starting',manifestSHA:hash(manifest),directory:join(manifest.outputRoot,hash(manifest)),budget}));
const result=await runCandidateCampaign({candidateDirectory:base,manifest,approval,apiKey});
const recovered=readCandidateCampaign(result.directory);
if(hash(recovered)!==hash(result.summary)) throw Error('Readback mismatch');
save('outcome.json',{directory:result.directory,summary:recovered});
console.log(JSON.stringify({event:'finished',directory:result.directory,summary:recovered}));
