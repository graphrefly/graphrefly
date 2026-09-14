/** Fixed synthetic IPC qualification, NOT a provider or participant runner. */
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import {createSession, verifyAudit} from './session.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const image='0c1b0dc4d863c5c9873aa4e92c2bf8e6e8db24b572f28a09d534d8f5fb6eeae3';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const PROBE_CHECKS=Object.freeze(['hostCanary','repository','oracle','dockerSocket','unprivileged','noIPv4Routes','rootReadOnly','externalConnectionDenied','onlyAListed','readA','earlyB','oracleTool','traversal','shellTool','clientSeal',...Array.from({length:8},(_,i)=>'submitA'+(i+1)),'overwriteDenied','sealedByController','BVisibleAfterSeal','oldPhaseDenied','budgetDenied']);
export function verifyProbeChecks(checks){
 assert.ok(checks&&typeof checks==='object'&&!Array.isArray(checks));
 assert.deepEqual(Object.keys(checks).sort(),[...PROBE_CHECKS].sort(),'complete frozen probe set');
 assert.ok(Object.values(checks).every(x=>x===true),JSON.stringify(checks));
}
export async function qualifyIsolation({negativeControl=null}={}){
 assert.ok(negativeControl===null||negativeControl==='writable-root');
 const prepared=join(root,'sessions/active/b121-comparison-design-v1/revision-2');
 const receipt=JSON.parse(readFileSync(join(prepared,'readiness.json')));
 for(const a of receipt.artifacts)assert.equal(digest(readFileSync(join(prepared,a.ref))),a.sha256);
 const material=JSON.parse(readFileSync(join(prepared,'material.json')));
 const packets=material.packets.G.user;
 const session=createSession({sessionId:'synthetic-isolation-control',files:Object.fromEntries(['A','B'].map(phase=>[phase+'.json',{phase,content:JSON.stringify(packets[phase])}]))});
 const directory=mkdtempSync(join(tmpdir(),'b121-isolation-'));
 const canary=join(directory,'goldens-canary.txt'),secret=randomUUID();writeFileSync(canary,secret);
 const probe=readFileSync(join(root,'scripts/b121-comparison/isolation-probe.py'),'utf8');
 const name='b121-isolation-'+randomUUID();
 const args=['run','--pull=never','--rm','--name='+name,'--network=none','--read-only','--read-only-tmpfs=false',
 '--cap-drop=all','--security-opt=no-new-privileges','--pids-limit=32','--memory=128m','--timeout=25',
 '--user=65534:65534','--unsetenv-all','--workdir=/','--entrypoint=/opt/python/cp311-cp311/bin/python',
 '-i',image,'-I','-S','-u','-c',probe];
 if(negativeControl==='writable-root')args.splice(args.indexOf('--read-only'),1);
 let result;let checks,stderr='',failure;const seen=[];
 try{
  const child=spawn('podman',args,{stdio:['pipe','pipe','pipe']});
  const completed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve(code));});
  child.stdin.on('error',error=>{failure??=error;});
  const timer=setTimeout(()=>{failure??=new Error('probe timeout');child.kill('SIGKILL');},30000);
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-8192);});
  const lines=createInterface({input:child.stdout});
  child.stdin.write(JSON.stringify({hiddenPaths:{hostCanary:canary,repository:join(root,'AGENTS.md'),oracle:join(prepared,'goldens.json'),dockerSocket:'/var/run/docker.sock'}})+'\n');
  try{
   for await(const line of lines){
    if(line.length>65536||seen.length>128)throw new Error('probe output limit');
    assert.ok(!line.includes(secret),'host canary leaked');const request=JSON.parse(line);seen.push(request);
    if(request.probeResult){assert.equal(checks,undefined);checks=request.probeResult;continue;}
    let response;
    if(request.probe==='ready-for-controller-seal'){
     const snap=session.snapshot();assert.equal(snap.phase,'A');assert.equal(Object.keys(snap.answers.A).length,8);
     session.sealA();response={ok:true};
    }else response=session.broker.request(request);
    child.stdin.write(JSON.stringify(response)+'\n');
   }
   const code=await completed;assert.equal(code,0,stderr+' '+JSON.stringify(checks));if(failure)throw failure;
  }finally{clearTimeout(timer);lines.close();child.stdin.destroy();child.kill();}
  verifyProbeChecks(checks);
  const snapshot=session.finish();assert.ok(verifyAudit(snapshot.audit));
  assert.ok(Object.values(snapshot.answers.B).every(a=>a.status==='budget-exhausted'));
  result={kind:'synthetic-container-broker-qualification',image,command:args.slice(0,-1).concat('<sha256:'+digest(probe)+'>'),
   probeSha256:digest(probe),materialSha256:digest(readFileSync(join(prepared,'material.json'))),checks,
   audit:snapshot.audit,closed:snapshot.phase,allMissingB:'budget-exhausted',stderr,
   scope:'Host filesystem/network separation and broker phase control for this fixed synthetic client only.',
   limitations:['Not a provider adapter or model context isolation test','No environment-variable inspection performed','Container interpreter exists; model-facing shell is not provided by broker','Host/controller/container engine are trusted','No participant, provider, human or runtime consumer execution'],
   executionReady:false,participantRuns:0,providerCalls:0};
 }finally{
  const cleanup=spawnSync('podman',['rm','--force','--ignore',name],{encoding:'utf8',timeout:10000});
  rmSync(directory,{recursive:true,force:true});
  assert.equal(cleanup.status,0,'container cleanup failed: '+(cleanup.stderr??cleanup.error));
  const absent=spawnSync('podman',['container','exists',name],{encoding:'utf8',timeout:10000});
  assert.equal(absent.status,1,'container absence not verified');
  if(result)result.cleanupVerified=true;
 }
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert.equal(process.argv.length,2);const result=await qualifyIsolation();
 const out=join(root,'sessions/active/b121-comparison-design-v1/isolation');mkdirSync(out,{recursive:true});
 writeFileSync(join(out,'probe-receipt.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({checks:Object.keys(result.checks).length,passed:true,executionReady:false}));
}
