import type { DataResult, DataIssue } from "../../packages/ts/src/data/index.js";
import { collectBusinessResults } from "./__b121_entry_validation__.js";
declare const objects: readonly DataResult<{id: string}>[];
declare const numbers: readonly DataResult<number>[];
const a: {values: readonly {id: string}[]; issues: readonly DataIssue[]} = collectBusinessResults(objects);
const b: {values: readonly number[]; issues: readonly DataIssue[]} = collectBusinessResults(numbers);
const c: {values: readonly string[]; issues: readonly DataIssue[]} = collectBusinessResults<string>([]);
void [a, b, c];
