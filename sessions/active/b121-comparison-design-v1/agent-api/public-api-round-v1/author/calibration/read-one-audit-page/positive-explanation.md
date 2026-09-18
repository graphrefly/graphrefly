Uses readAppendLogPage once; its lookahead distinguishes an exactly-full final page from a page with more available entries. Empty after=-1 yields nextAfter=-1 and done=true. A sole seq0/amount0 entry is retained and nextAfter=0, done=true. A full page with no lookahead is also done=true. done is a read-time observation, not closure against future appends. Source: packages/ts/src/storage/append-log.ts (AppendLogPage and readAppendLogPage).

Source line references: packages/ts/src/storage/append-log.ts:7–26 (entry/page shapes), 160–174 (lookahead, cursor and done).
