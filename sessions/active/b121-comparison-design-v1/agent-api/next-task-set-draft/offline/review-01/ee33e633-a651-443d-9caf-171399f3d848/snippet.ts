import type { Graph } from "@graphrefly/ts/graph";
import { topologyFromDescribe } from "../../packages/ts/src/graph/describe.js";
export function captureStructure(graph: Graph) { return topologyFromDescribe(graph.describe()); }
