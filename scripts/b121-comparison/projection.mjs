import assert from 'node:assert/strict';
const GROUPS = {
 inputs:['pack','arrivals','current','verification','local'],
 startup:['proof/startup'],
 business:['proof/evaluationSelections','proof/transaction','proof/vendorStats','proof/userProfile','proof/policy','proof/anomalyScore','proof/thresholdGate','proof/reasonFactors','proof/alertMessage','proof/assessment'],
 material:['proof/requestMaterials','proof/materialStore','proof/materialSnapshot','proof/effectProposals','proof/requestMaterialJoin'],
 facts:['proof/currentFacts','proof/verificationFacts','proof/localFacts','proof/inboxFacts','proof/publicationPolicy'],
 observations:['proof/occurrences','proof/occurrenceAdmissions','proof/branchTerminals','proof/effectAdmissions','proof/effectOutcomes','proof/evidence','proof/watermarks'],
 lanes:['proof/causal/input/occurrences','proof/causal/input/admissions','proof/causal/input/branch-terminals','proof/causal/input/effect-proposals','proof/causal/input/effect-admissions','proof/causal/input/effect-outcomes','proof/causal/input/evidence','proof/causal/input/watermarks','proof/causal/arrivals'],
 authority:['proof/causal/authority'],
 release:['proof/causal/release-candidates','proof/causal/release-port','proof/causal/released','proof/causal/release-events','proof/causal/release-controller'],
 evidence:['proof/causal/currentness','proof/causal/terminals','proof/causal/conservation','proof/causal/coverage','proof/causal/quiescence','proof/causal/issues','proof/causal/committed-effects','proof/causal/causal-quiescence'],
 publication:['proof/publication'],
 issues:['proof/consumerIssues'],
 host:['proof/hostFacts','proof/hostPackFacts','proof/hostGuard','proof/runEndReady'],
};
/** Pure projection of exact observed edges. No cached DATA/status or verdict travels into this view. */
export function projectTopology(snapshot) {
 const ownership=new Map();
 for(const [group,members] of Object.entries(GROUPS))for(const id of members){assert.ok(!ownership.has(id));ownership.set(id,group);}
 const nodes=snapshot.nodes.map(({id,factory})=>({id,factory}));
 assert.deepEqual(nodes.map(n=>n.id).sort(),[...ownership.keys()].sort(),'snapshot must match reviewed node inventory');
 const edges=snapshot.edges.map(({from,to})=>{assert.ok(ownership.has(from)&&ownership.has(to),'unknown edge endpoint');return {from,to};});
 assert.equal(new Set(edges.map(e=>JSON.stringify(e))).size,edges.length,'duplicate edges');
 // Node deps provide an independent source of the edge list when the raw snapshot contains them.
 assert.ok(snapshot.nodes.every(n=>Array.isArray(n.deps)), 'complete dependency arrays required');
 {
  const expected=snapshot.nodes.flatMap(n=>n.deps.map(from=>({from,to:n.id})));
  assert.deepEqual(expected.map(JSON.stringify).sort(),edges.map(JSON.stringify).sort(),'deps/edges mismatch');
 }
 return {kind:'exact-topology-projection',nodeCount:nodes.length,displayUnits:Object.keys(GROUPS).length,nodes,edges,
  groups:Object.entries(GROUPS).map(([id,members])=>({id,members,internalEdges:edges.filter(e=>ownership.get(e.from)===id&&ownership.get(e.to)===id)})),
  crossEdges:edges.filter(e=>ownership.get(e.from)!==ownership.get(e.to)).map(e=>({...e,fromGroup:ownership.get(e.from),toGroup:ownership.get(e.to)}))};
}
