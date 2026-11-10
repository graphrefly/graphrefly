// Committed-output observation (DS-17 H5) as a module over the reference kernel. Non-normative.
//
// The kernel needs no hook for it. A subscriber already receives exactly what a node
// committed, after the node applied it: an INVALIDATE that removed nothing is not sent, and
// the kernel's own RESOLVED and PENDING are. observe() subscribes one sink per node and hands
// each array on as { id, msgs }, in the order the kernel delivers them, which is the order
// the wave reaches them. Like TS Graph.observe it is a real subscriber: observing a cold
// node activates it, and the node stays active while observed. A write from inside the
// sink is a later wave (K8), and a sink that throws goes to the host reporter (P10).
//
// Differences from TS Graph.observe:
//   - an event carries one array (msgs), not one message, because every kernel sink
//     receives arrays (R-wave-boundary); TS sinks get one message plus delivery metadata;
//   - no tier field: TIER[msg[0]] gives it;
//   - no seq field: events arrive in order, and a log that appends keeps that order;
//   - the caller passes the ids: whoever builds the graph knows them (O14), and the kernel
//     has no subtree paths.

let next = 0;

export function observe(g, ids, sink) {
  const sinkId = `observe#${++next}`;
  for (const id of ids) g.subscribe(sinkId, id, (msgs) => sink({ id, msgs }));
  return () => { for (const id of ids) g.unsubscribe(sinkId, id); };
}
