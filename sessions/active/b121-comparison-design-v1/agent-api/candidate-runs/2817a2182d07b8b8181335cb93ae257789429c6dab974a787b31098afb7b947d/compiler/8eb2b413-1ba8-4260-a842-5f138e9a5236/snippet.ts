/**
 * Structural snapshot capture for a topology viewer.
 *
 * The caller supplies an existing Graph; this module only reads it. It reuses the
 * library's own pure-structure snapshot API (`Graph.topology()`, D173) instead of
 * re-projecting `describe()` output, so nested graphs, node identities, dependency
 * edges, factories and static annotations come from the library's single live
 * topology truth source.
 *
 * `Graph.topology()` is defined as `topologyFromDescribe(this.describe())`
 * (packages/ts/src/graph/graph.ts:663-665), and `topologyFromDescribe` copies only
 * id/factory/deps/name/meta per node plus edges and recursive subgraphs
 * (packages/ts/src/graph/describe.ts:63-83). Runtime `status`, cached `value` and
 * `version` live only on `DescribeNode` (packages/ts/src/graph/describe.ts:39-46)
 * and are therefore absent at every depth, including nested subgraphs, because the
 * projection recurses through `subgraphs.map(topologyFromDescribe)`
 * (packages/ts/src/graph/describe.ts:80-81).
 *
 * No node is created, subscribed, activated or modified, and no transport is
 * invoked: the only call is the read-only snapshot accessor.
 */
import type { Graph } from "../../packages/ts/src/graph/graph.js";
import type { GraphTopologySnapshot } from "../../packages/ts/src/graph/index.js";

/**
 * Capture a full structural snapshot of `graph` for a topology viewer.
 *
 * The declared return type is the library's actual `GraphTopologySnapshot`
 * (re-exported from `@graphrefly/ts/graph`, packages/ts/src/graph/index.ts:58-66),
 * so the result is assignable to it without any caller cast.
 */
export function captureStructure(graph: Graph): GraphTopologySnapshot {
	return graph.topology();
}
