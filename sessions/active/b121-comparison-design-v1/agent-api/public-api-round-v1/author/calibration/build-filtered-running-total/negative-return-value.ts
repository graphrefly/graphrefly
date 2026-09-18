import type { Graph } from "@graphrefly/ts/graph";
import type { Node } from "@graphrefly/ts/core";
import { filter, map, scan } from "@graphrefly/ts/operators";
export interface Payment { accepted: boolean; cents: number }
export function buildAcceptedTotal(graph: Graph, payments: Node<Payment>): number {
  const accepted = graph.initNode(filter((p: Payment) => p.accepted), [payments]);
  const cents = graph.initNode(map((p: Payment) => p.cents), [accepted]);
  return 0;
}
