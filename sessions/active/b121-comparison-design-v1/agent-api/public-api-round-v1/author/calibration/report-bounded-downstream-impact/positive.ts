import { reachable, type DescribeSnapshot, type ReachableResult } from "@graphrefly/ts/graph";
export function downstreamReport(snapshot: DescribeSnapshot, start: string, maxDepth: number): ReachableResult {
  return reachable(snapshot, start, "downstream", { maxDepth, withDetail: true });
}
