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
// The event is an array envelope, as in R-graph-surface. The caller supplies ids;
// this reference has no mount/path selector. Stop closes forwarding immediately,
// while the ordinary unsubscribe request releases the connection after this wave.

let next = 0;

export function observe(g, ids, sink) {
  const sinkId = `observe#${++next}`;
  let stopped = false;
  for (const id of ids) g.subscribe(sinkId, id, (msgs) => { if (!stopped) sink({ id, msgs }); });
  return () => {
    if (stopped) return;
    stopped = true;
    for (const id of ids) g.unsubscribe(sinkId, id);
  };
}

// R-graph-surface@1 (D805, 2026-11-11): find and retain, the two graph-layer reads and holds the
// reference kernel does not have itself. The kernel's ids are its handles, so find gives the id of
// a node that exists, and null otherwise; it activates nothing.
export function find(g, id) {
  return g.describe().some((n) => n.id === id) ? id : null;
}

// A subscriber that ignores what it receives: it activates the node and keeps it active until the
// release is called. Each retain is its own subscription.
let nextRetain = 0;
export function retain(g, id) {
  const sinkId = `retain#${++nextRetain}`;
  g.subscribe(sinkId, id);
  return () => g.unsubscribe(sinkId, id);
}
