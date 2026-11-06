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
const oldBase=join(root,'sessions/active/b121-comparison-design-v1/agent-api/candidate-round-v10-diagnostics');
const base=join(root,'sessions/active/b121-comparison-design-v1/agent-api/candidate-round-v11-connection-close');
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
const freeze=read(join(base,'frozen-candidate.json'));
const sha=x=>createHash('sha256').update(x).digest('hex');
for(const [p,h]of Object.entries(freeze.artifactSHA256))if(sha(readFileSync(join(base,p)))!==h)throw Error('Frozen artifact drift');
const identity=rows=>rows.map(({sampleId,taskId,role})=>({sampleId,taskId,role}));
if(hash(identity(manifest.samples))!==hash(identity(prior.samples)))throw Error('Sample identity drift');
for(const [p,h]of Object.entries(manifest.artifactSHA256))if(h!==freeze.artifactSHA256[p])throw Error('Manifest not bound to v9 freeze');
if(hash(manifest.contract)!==hash(freeze.contract))throw Error('Runner contract drift');
if(hash(manifest.codeBindings)!==hash(freeze.codeBindings))throw Error('Code binding drift');
if(hash(manifest.samples)!==hash(freeze.samples)||hash(manifest.policy)!==hash(freeze.policy))throw Error('Frozen samples/policy drift');
if(CEILING_USD!==5.5) throw Error('Authorized cap is exactly $5.50');
save('manifest.json',manifest);
const approval={manifestSHA:hash(manifest),action:'B121-agent-api-one-shot',acceptAliasLimitation:true,acceptInputEstimateLimitation:true,
 expiresAt:new Date(Date.now()+6*3600000).toISOString(),maxGenerationCalls:MAX_GENERATION_CALLS,maxUSD:5.5,retries:RETRY_POLICY,
 model:ROUTE.model,providerTag:ROUTE.tag,priorUsageUSD:reportedUsageUSD+unresolvedReservationsUSD,
 authorizationSource:'User confirmed cumulative USD5.50 including all historical fees and unknown reservations, and one complete fixed-four run after B121 connection-close mitigation by 确认. External key lifetime limit1.97 unchanged, no recharge/reset. Same frozen v9/v10 artifacts and consumer contract, model/provider/session limits/retry policy; new per-attempt HTTP connection-close policy disclosed. No automatic replacement or rerun.',
};
save('execution-approval.json',approval);
const apiKey=readFileSync('/Users/davidchenallio/.local/share/graphrefly-private/b121-qwen3.8-flash-20260914/openrouter.key','utf8').trim();
console.log(JSON.stringify({event:'starting',manifestSHA:hash(manifest),directory:join(manifest.outputRoot,hash(manifest)),budget}));
const result=await runCandidateCampaign({candidateDirectory:base,manifest,approval,apiKey});
const recovered=readCandidateCampaign(result.directory);
if(hash(recovered)!==hash(result.summary)) throw Error('Readback mismatch');
save('outcome.json',{directory:result.directory,summary:recovered});
console.log(JSON.stringify({event:'finished',directory:result.directory,summary:recovered}));
