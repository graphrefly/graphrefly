import type { Graph } from "@graphrefly/ts/graph";
import type { Node } from "@graphrefly/ts/core";
import { filter, map, scan } from "@graphrefly/ts/operators";
export interface Payment { accepted: boolean; cents: number }
export function buildAcceptedTotal(graph: Graph, payments: Node<Payment>): Node<number> {
  const accepted = graph.initNode(filter((p: Payment) => p.accepted && !!p.cents), [payments]);
  const cents = graph.initNode(map((p: Payment) => p.cents), [accepted]);
  return graph.initNode(scan((total: number, value: number) => total + value, 0), [cents]);
}
