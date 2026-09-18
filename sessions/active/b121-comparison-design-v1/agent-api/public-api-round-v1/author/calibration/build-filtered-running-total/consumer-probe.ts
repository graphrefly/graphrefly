import { buildAcceptedTotal } from "./__b121_entry_validation__.js";
import type { Graph } from "@graphrefly/ts/graph";
import type { Node } from "@graphrefly/ts/core";
declare const graph: Graph;
declare const payments: Node<{ accepted: boolean; cents: number }>;
const total: Node<number> = buildAcceptedTotal(graph, payments);
void total;
