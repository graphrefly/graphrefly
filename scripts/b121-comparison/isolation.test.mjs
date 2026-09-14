import test from 'node:test';
import assert from 'node:assert/strict';
import {PROBE_CHECKS,verifyProbeChecks} from './isolation.mjs';
test('frozen isolation probes reject omission, false, extra or nonboolean success',()=>{
 const complete=Object.fromEntries(PROBE_CHECKS.map(k=>[k,true]));verifyProbeChecks(complete);
 for(const key of PROBE_CHECKS){const missing={...complete};delete missing[key];assert.throws(()=>verifyProbeChecks(missing));assert.throws(()=>verifyProbeChecks({...complete,[key]:false}));}
 for(const bad of [{},{...complete,extra:true},{...complete,rootReadOnly:1}])assert.throws(()=>verifyProbeChecks(bad));
});
