import type { DataResult, DataIssue } from "../../packages/ts/src/data/index.js";
function collectBusinessResults<T>(results: readonly DataResult<T>[]): {values: readonly T[]; issues: readonly DataIssue[]} {
 const values: T[] = []; const issues: DataIssue[] = [];
 for (const result of results) {
  if (result.kind === "ok") values.push(result.value);
  else issues.push(result.error);
  if (result.issues) issues.push(...result.issues);
 }
 return {values, issues};
}
