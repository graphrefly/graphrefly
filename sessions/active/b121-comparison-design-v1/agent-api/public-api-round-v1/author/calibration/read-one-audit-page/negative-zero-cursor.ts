import { readAppendLogPage, type AppendLogStorageTier } from "@graphrefly/ts/storage";
export interface AuditEvent { id: string; amount: number }
export async function readAuditPage(log: AppendLogStorageTier<AuditEvent>, after: number, limit: number) {
  const page = await readAppendLogPage(log, { after, limit });
  return {
    rows: page.entries.map(entry => ({ key: entry.key, sequence: entry.seq, id: entry.value.id, amount: entry.value.amount })),
    nextAfter: page.nextAfter || after,
    done: page.done,
  };
}
