import type { NodeVersion } from "@graphrefly/ts/core";
import { summarizeVersions } from "./__b121_entry_validation__.js";
declare const versions: readonly (NodeVersion | undefined)[];
type Report = {kind: "disabled"} | {kind: "counter"; counter: number} | {kind: "content"; counter: number; cid: string; prev: string | null};
const result: readonly Report[] = summarizeVersions(versions);
void result;
