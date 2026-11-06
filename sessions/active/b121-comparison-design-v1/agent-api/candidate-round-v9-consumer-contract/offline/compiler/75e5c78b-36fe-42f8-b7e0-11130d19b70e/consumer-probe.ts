import { inspectSpendingInstance } from "./__b121_entry_validation__.js";
import type { Graph } from "../../packages/ts/src/graph/graph.js";
import { spendingAlertsFor } from "./causal-entry.js";
declare const graph: Graph;
declare const instance: ReturnType<ReturnType<typeof spendingAlertsFor>["compose"]>;
inspectSpendingInstance(graph, instance);
