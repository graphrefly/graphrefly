import { reachable, type DescribeSnapshot, type ReachableResult } from "@graphrefly/ts/graph";
export function downstreamReport(snapshot: DescribeSnapshot, start: string, maxDepth: number): readonly string[] {
  return reachable(snapshot, start, "downstream", { maxDepth, withDetail: false });
}
