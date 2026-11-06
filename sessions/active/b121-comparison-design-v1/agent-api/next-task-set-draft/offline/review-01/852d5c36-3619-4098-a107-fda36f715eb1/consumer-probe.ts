import type { Graph, GraphTopologySnapshot } from "@graphrefly/ts/graph";
import { captureStructure } from "./__b121_entry_validation__.js";
declare const graph: Graph;
const result: GraphTopologySnapshot = captureStructure(graph);
void result;
