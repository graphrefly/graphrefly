import { graph, filter, scan, type Graph, type Node } from "@graphrefly/ts";

type Payment = { accepted: boolean; cents: number };

/**
 * Build a reusable graph pipeline over a caller-owned Graph and a caller-owned
 * Node of payment facts already registered in that Graph.
 *
 * Emits the running sum of `cents` after each accepted fact, seeded at 0.
 * Rejected facts are dropped by `filter` and therefore emit no new total.
 * The accumulator lives in the `scan` node's own graph-local state, not in a
 * host variable; no subscription, input push, second graph or raw node body is
 * created here. The caller owns activation and the graph/input lifetime.
 */
export function buildAcceptedTotal(
  graph: Graph,
  payments: Node<Payment>,
): Node<number> {
  const accepted = graph.initNode(
    filter((p: Payment) => p.accepted),
    [payments],
    { name: "acceptedPayments" },
  );

  return graph.initNode(
    scan((total: number, p: Payment) => total + p.cents, 0),
    [accepted],
    { name: "acceptedTotal" },
  );
}
