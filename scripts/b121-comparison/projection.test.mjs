import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectTopology} from './projection.mjs';
const raw=JSON.parse(readFileSync(new URL('../../../graphrefly-ts/docs/design/causal-comparison-preparation/memory-checkpoints.json',import.meta.url)));
const snapshot=raw.results[0].topology;
test('actual graph edges survive grouping without DATA leakage',()=>{
 const p=projectTopology(snapshot);
 assert.equal(p.nodeCount,62); assert.ok(p.displayUnits<=20);
 assert.equal(p.crossEdges.length+p.groups.reduce((n,g)=>n+g.internalEdges.length,0),snapshot.edges.length);
 assert.ok(p.nodes.every(n=>Object.keys(n).sort().join(',')==='factory,id'));
 for(const run of raw.results.filter(r=>r.arm==='graph'))assert.deepEqual(projectTopology(run.topology),p);
});
test('missing node, dangling edge and dependency discrepancy fail closed',()=>{
 for(const change of [s=>s.nodes.pop(),s=>s.edges.push({from:'missing',to:'pack'}),s=>s.edges.pop()]){
  const s=structuredClone(snapshot);change(s);assert.throws(()=>projectTopology(s));
 }
});
test('one absent deps array cannot disable the independent edge check',()=>{
 const s=structuredClone(snapshot);delete s.nodes[0].deps;s.edges=[];
 assert.throws(()=>projectTopology(s),/dependency arrays/);
});
test('C6 capture retains real collection contents and unknown effect across display changes',()=>{
 for(const r of raw.results.filter(r=>r.caseId==='C6')){
  const before=r.snapshots.find(s=>s.label==='outcome-r1');
  const after=r.snapshots.find(s=>s.label==='display-reattached');
  assert.deepEqual(after.authority,before.authority);
  assert.equal(after.host.normalEndReady,false);
  assert.equal(after.host.records[0].outcome.state,'unknown');
  const effects=r.arm==='graph'?after.authority.effects.entries.map(([,v])=>v):after.authority.effects;
  assert.equal(effects.length,1);assert.equal(effects[0].outcome.state,'unknown');
 }
});
