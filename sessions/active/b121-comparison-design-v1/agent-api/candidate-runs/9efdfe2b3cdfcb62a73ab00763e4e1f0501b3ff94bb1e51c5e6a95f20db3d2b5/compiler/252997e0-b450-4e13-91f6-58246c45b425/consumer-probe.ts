import { readAuditPage } from "./__b121_entry_validation__.js";
import type { AppendLogStorageTier } from "@graphrefly/ts/storage";
declare const log: AppendLogStorageTier<{ id: string; amount: number }>;
const pending: Promise<{ rows: readonly { key: string; sequence: number; id: string; amount: number }[]; nextAfter: number; done: boolean }> = readAuditPage(log, -1, 2);
void pending;
