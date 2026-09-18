import { downstreamReport } from "./__b121_entry_validation__.js";
import type { DescribeSnapshot } from "@graphrefly/ts/graph";
declare const snapshot: DescribeSnapshot;
const report = downstreamReport(snapshot, "caller/path", 2);
const paths: readonly string[] = report.paths;
const depths: Readonly<Record<string, number>> = report.depths;
const truncated: boolean = report.truncated;
void paths; void depths; void truncated;
