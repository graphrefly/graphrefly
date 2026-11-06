import type { Graph } from "../../packages/ts/src/graph/graph.js";
import type { spendingAlertsFor } from "./causal-entry.js";
type App = ReturnType<ReturnType<typeof spendingAlertsFor>["compose"]>;
export function inspect(graph: Graph, app: App) {
 const fullGraph = graph.describe();
 const host = app.inspect();
 const publication = app.view.publication.cache;
 const retainedQuiescence = app.capabilities.retained.retainedQuiescence.cache;
 const authorityId = publication?.authorityId;
 const authority = authorityId === undefined ? undefined : graph.find(authorityId);
 return {fullGraph, host, publication, authority};
}
