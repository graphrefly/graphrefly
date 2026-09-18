import { readAppendLogPage } from "@graphrefly/ts/storage";
import type { AppendLogStorageTier } from "@graphrefly/ts/storage";

export interface AuditRow {
	readonly key: string;
	readonly sequence: number;
	readonly id: string;
	readonly amount: number;
}

export interface AuditPage {
	readonly rows: readonly AuditRow[];
	readonly nextAfter: number;
	readonly done: boolean;
}

/**
 * Read exactly one logical page of the caller-owned append log through the
 * public paging helper. The helper owns ordering, the continuation cursor and
 * the exhaustion indicator; this function only maps records to rows.
 */
export function readAuditPage(
	log: AppendLogStorageTier<{ id: string; amount: number }>,
	after: number,
	limit: number,
): Promise<AuditPage> {
	return readAppendLogPage(log, { after, limit }).then((page) => ({
		rows: page.entries.map((entry) => ({
			key: entry.key,
			sequence: entry.seq,
			id: entry.value.id,
			amount: entry.value.amount,
		})),
		nextAfter: page.nextAfter,
		done: page.done,
	}));
}
