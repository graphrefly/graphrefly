import type { NodeVersion } from "@graphrefly/ts/core";
type Report = {kind: "disabled"} | {kind: "counter"; counter: number} | {kind: "content"; counter: number; cid: string; prev: string | null};
export function summarizeVersions(versions: readonly (NodeVersion | undefined)[]): Report[] {
 return versions.map(v => v === undefined ? {kind: "disabled"} : v.level === 0 ? {kind: "counter", counter: v.counter} : {kind: "content", counter: v.counter, cid: v.cid, prev: v.prev});
}
