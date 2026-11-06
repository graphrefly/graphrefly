import {nonPersistentRequestOptions} from "../../../../../scripts/b121-comparison/api-transport.mjs";
import http from 'node:http';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const results=[];
for(const scenario of ['healthy','close-reused-connection','close-any-second-request']){
 for(const policy of ['default','connection-close']){
  let total=0,nextSocket=0;const sockets=new Map(),requests=[];
  const server=http.createServer(async(req,res)=>{
   total++;const socket=sockets.get(req.socket);socket.requests++;
   for await(const _ of req){}
   const drop=(scenario==='close-reused-connection'&&socket.requests>1)||(scenario==='close-any-second-request'&&total%2===0);
   requests.push({sequence:total,socket:socket.id,requestOnSocket:socket.requests,connectionHeader:req.headers.connection,drop});
   if(drop){req.socket.destroy();return;}
   res.setHeader('content-type','application/json');res.end('{"ok":true}');
  });
  server.on('connection',socket=>sockets.set(socket,{id:++nextSocket,requests:0}));
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}/probe`;const outcomes=[];
  try{
   for(let i=0;i<20;i++){
    // Yield until the consumed socket becomes eligible for reuse.
    await new Promise(r=>setTimeout(r,5));
    const start=performance.now();
    try{const options={method:'POST',headers:{'content-type':'application/json'},body:'{"synthetic":true}',signal:AbortSignal.timeout(2000)};const r=await fetch(url,policy==='connection-close'?nonPersistentRequestOptions(options):options);await r.json();outcomes.push({ok:true,elapsedMs:Math.round(performance.now()-start)});}
    catch(e){outcomes.push({ok:false,code:e.cause?.code??e.code??null,elapsedMs:Math.round(performance.now()-start)});}
   }
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
  const result={scenario,policy,requests,connections:nextSocket,outcomes,successes:outcomes.filter(x=>x.ok).length,failures:outcomes.filter(x=>!x.ok).length};
  if(scenario==='healthy')assert.equal(result.failures,0);
  if(policy==='connection-close'){assert.ok(requests.every(r=>r.requestOnSocket===1&&r.connectionHeader==='close'));assert.equal(nextSocket,20);}
  if(scenario==='close-reused-connection')assert.equal(result.failures,policy==='default'?10:0);
  if(scenario==='close-any-second-request')assert.equal(result.failures,10);
  if(result.failures)assert.ok(outcomes.filter(x=>!x.ok).every(x=>x.code==='UND_ERR_SOCKET'));
  results.push(result);
 }
}
const report={kind:'loopback-only-connection-policy-experiment',node:process.version,undici:process.versions.undici,externalRequests:0,generationCalls:0,limitations:['HTTP loopback, not TLS or OpenRouter','Server intentionally closes sockets; this establishes mechanism and mitigation scope, not cause of prior production failures','Elapsed loopback times do not estimate provider latency'],results};
writeFileSync(new URL('./results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(results.map(({scenario,policy,successes,failures,connections})=>({scenario,policy,successes,failures,connections})),null,2));
