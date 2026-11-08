import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
	defineOperations,
	isAborted,
	type Operation,
	type Outcome,
} from "@photo-scenes/operations";
import { expect, test } from "@playwright/test";

// Pure tests: deferred promises settle only when a test says so, so every interleaving is explicit.
function deferred<T = void>() {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}
/** Lets every queued promise callback run; no wall-clock delay is involved. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const settled = async <T>(promise: Promise<T>) => {
	let done = false;
	promise.then(
		() => {
			done = true;
		},
		() => {
			done = true;
		},
	);
	await flush();
	return done;
};

test("a restarted container kills the task's wait and sync; start resolves aborted", async () => {
	const source = deferred<string>();
	const writes: string[] = [];
	let caught: unknown;
	const app = defineOperations({
		path: "app",
		children: {
			place: {
				children: {
					plate: {
						run: async (op: Operation) => {
							try {
								const value = await op.wait(source.promise);
								op.sync(() => writes.push(value));
							} catch (error) {
								caught = error;
							}
						},
					},
				},
			},
		},
	});
	const started = app.children.place.children.plate.start();
	await flush();
	await app.children.place.start(); // another place
	source.resolve("old plate");
	expect(await started).toEqual({ status: "aborted" });
	expect(writes).toEqual([]);
	expect(isAborted(caught)).toBe(true);
});

test("cancelling a container cancels every run under it children first, runs finally, discards waiters", async () => {
	const events: string[] = [];
	const gates = [deferred(), deferred()];
	const task = (name: string, gate: Promise<void>) => ({
		run: async (op: Operation) => {
			op.signal.addEventListener("abort", () => events.push(`abort ${name}`));
			try {
				await op.wait(gate);
			} finally {
				events.push(`finally ${name}`);
			}
		},
	});
	const app = defineOperations({
		path: "app",
		children: {
			session: {
				children: {
					place: {
						children: {
							a: task("a", gates[0]?.promise as Promise<void>),
							q: {
								...task("q", gates[1]?.promise as Promise<void>),
								conflictPolicy: "queue" as const,
							},
						},
					},
				},
			},
		},
	});
	const place = app.children.session.children.place;
	const a = place.children.a.start();
	const q1 = place.children.q.start();
	const q2 = place.children.q.start(); // waits behind q1
	await flush();
	app.children.session.cancel();
	gates[0]?.resolve();
	gates[1]?.resolve();
	expect(await Promise.all([a, q1, q2])).toEqual([
		{ status: "aborted" },
		{ status: "aborted" },
		{ status: "aborted" },
	]);
	expect(events.filter((e) => e.startsWith("abort"))).toEqual(["abort a", "abort q"]);
	expect(events).toContain("finally a");
	expect(events).toContain("finally q");
	expect(events.filter((e) => e === "finally q")).toHaveLength(1); // q2 never ran
});

test("preempt aborts the running start; drop refuses the second; container drop keeps the running one", async () => {
	const gate = deferred();
	let preemptRuns = 0;
	let dropRuns = 0;
	const app = defineOperations({
		path: "app",
		children: {
			place: {
				conflictPolicy: "drop" as const,
				children: {
					save: {
						run: async (op: Operation) => {
							preemptRuns++;
							if (preemptRuns === 1) await op.wait(gate.promise);
						},
					},
					advance: {
						conflictPolicy: "drop" as const,
						run: async (op: Operation) => {
							dropRuns++;
							await op.wait(gate.promise);
						},
					},
				},
			},
		},
	});
	const place = app.children.place;
	const first = place.children.save.start();
	await flush();
	const second = place.children.save.start();
	expect(await second).toEqual({ status: "completed" });
	gate.resolve();
	expect(await first).toEqual({ status: "aborted" });
	expect(preemptRuns).toBe(2);

	const gate2 = deferred();
	const app2 = defineOperations({
		path: "app",
		children: {
			place: {
				conflictPolicy: "drop" as const,
				children: {
					advance: {
						conflictPolicy: "drop" as const,
						run: async (op: Operation) => {
							dropRuns++;
							await op.wait(gate2.promise);
						},
					},
				},
			},
		},
	});
	const one = app2.children.place.children.advance.start();
	await flush();
	expect(await app2.children.place.children.advance.start()).toEqual({ status: "dropped" });
	expect(await app2.children.place.start()).toEqual({ status: "dropped" });
	expect(app2.children.place.children.advance.flags.isRunning).toBe(true);
	gate2.resolve();
	expect(await one).toEqual({ status: "completed" });
	expect(dropRuns).toBe(1);
});

test("queued siblings sharing a lock run first in, first out; opposite lock orders do not deadlock", async () => {
	const order: string[] = [];
	const gates = new Map<string, ReturnType<typeof deferred<void>>>();
	const step = (name: string, locks: string[]) => ({
		conflictPolicy: "queue" as const,
		locks,
		run: async (op: Operation) => {
			order.push(`start ${name}`);
			const gate = deferred();
			gates.set(name, gate);
			await op.wait(gate.promise);
			order.push(`end ${name}`);
		},
	});
	const app = defineOperations({
		path: "app",
		children: {
			cache: {
				children: {
					write: step("write", ["a", "b"]),
					read: step("read", ["b", "a"]),
					clear: step("clear", ["a"]),
					other: step("other", ["z"]),
				},
			},
		},
	});
	const c = app.children.cache.children;
	const all = [c.write.start(), c.read.start(), c.clear.start(), c.other.start()];
	await flush();
	expect(order).toEqual(["start write", "start other"]); // a disjoint lock proceeds at once
	gates.get("write")?.resolve();
	await flush();
	expect(order).toEqual(["start write", "start other", "end write", "start read"]);
	gates.get("read")?.resolve();
	await flush();
	gates.get("clear")?.resolve();
	gates.get("other")?.resolve();
	expect((await Promise.all(all)).map((o) => o.status)).toEqual([
		"completed",
		"completed",
		"completed",
		"completed",
	]);
	expect(order.filter((e) => e.startsWith("start")).slice(2)).toEqual([
		"start read",
		"start clear",
	]);
});

test("a preempting start discards queued conflicting starts, which never run", async () => {
	const gate = deferred();
	let queuedRuns = 0;
	const app = defineOperations({
		path: "app",
		children: {
			user: {
				children: {
					restore: {
						conflictPolicy: "queue" as const,
						locks: ["set"],
						run: async (op: Operation) => {
							queuedRuns++;
							await op.wait(gate.promise);
						},
					},
					switchUser: { locks: ["set"], run: () => {} },
				},
			},
		},
	});
	const u = app.children.user.children;
	const first = u.restore.start();
	await flush();
	const waiting = u.restore.start();
	expect(await u.switchUser.start()).toEqual({ status: "completed" });
	gate.resolve();
	expect(await first).toEqual({ status: "aborted" });
	expect(await waiting).toEqual({ status: "aborted" });
	expect(queuedRuns).toBe(1);
});

test("busy flags are derived for ancestors and published on every change", async () => {
	const gate = deferred();
	const published: Record<string, { isRunning: boolean; isBusy: boolean }>[] = [];
	const app = defineOperations(
		{
			path: "app",
			children: {
				place: {
					children: {
						job: { shouldCountAsBusy: true, run: (op: Operation) => op.wait(gate.promise) },
						autosave: { run: (op: Operation) => op.wait(gate.promise) },
					},
				},
			},
		},
		{ onFlagsChange: (flags) => published.push(flags) },
	);
	const job = app.children.place.children.job.start();
	await flush();
	expect(app.flags).toEqual({ isRunning: true, isBusy: true });
	expect(app.children.place.flags.isBusy).toBe(true);
	expect(published.at(-1)?.["app/place/job"]).toEqual({ isRunning: true, isBusy: true });
	gate.resolve();
	await job;
	expect(app.children.place.flags).toEqual({ isRunning: true, isBusy: false });
	expect(published.at(-1)?.app?.isBusy).toBe(false);
	// A non-busy task never makes its ancestors busy.
	const save = app.children.place.children.autosave.start();
	await flush();
	expect(app.flags.isBusy).toBe(false);
	await save;
});

test("real failures resolve failed; cancellation, even followed by a rejection, resolves aborted", async () => {
	const boom = new Error("boom");
	const late = deferred();
	const app = defineOperations({
		path: "app",
		children: {
			c: {
				children: {
					throwsNow: {
						run: () => {
							throw boom;
						},
					},
					rejects: { run: (op: Operation) => op.wait(Promise.reject(boom)) },
					late: { run: (op: Operation) => op.wait(late.promise) },
				},
			},
		},
	});
	const c = app.children.c.children;
	expect(await c.throwsNow.start()).toEqual({ status: "failed", error: boom });
	expect(await c.rejects.start()).toEqual({ status: "failed", error: boom });
	const pending = c.late.start();
	await flush();
	c.late.cancel();
	late.reject(new Error("provider failed after cancel"));
	expect(await pending).toEqual({ status: "aborted" });
	expect(isAborted(new DOMException("x", "AbortError"))).toBe(true);
	expect(isAborted(boom)).toBe(false);
});

test("a synchronous run completes and can sync; its sync fails after it settles", async () => {
	let kept: Operation | undefined;
	const state: string[] = [];
	const app = defineOperations({
		path: "app",
		children: {
			c: {
				children: {
					drop: {
						run: (op: Operation) => {
							kept = op;
							expect(op.sync(() => state.push("placed"))).toBe(true);
						},
					},
				},
			},
		},
	});
	expect(await app.children.c.children.drop.start()).toEqual({ status: "completed" });
	expect(state).toEqual(["placed"]);
	expect(kept?.sync(() => state.push("late"))).toBe(false);
	expect(state).toEqual(["placed"]);
});

test("photo-scene races leave no stale write", async () => {
	const store = { plate: "", batch: [] as string[], crops: [] as string[], cache: [] as string[] };
	const plate = deferred<string>();
	const decode = deferred<string[]>();
	const save = deferred<string>();
	const write = deferred();
	let reset = 0;
	const app = defineOperations({
		path: "app",
		children: {
			session: {
				children: {
					importBatch: {
						run: async (op: Operation, args: { files: string[]; slow: boolean }) => {
							const batch = args.slow ? await op.wait(decode.promise) : args.files;
							op.sync(() => {
								store.batch = batch;
							});
						},
					},
					place: {
						children: {
							plate: {
								run: async (op: Operation, args: { id: string }) => {
									const url = args.id === "old" ? await op.wait(plate.promise) : "new.webp";
									op.sync(() => {
										store.plate = url;
									});
								},
							},
							saveCrop: {
								run: async (op: Operation) => {
									const crop = await op.wait(save.promise);
									op.sync(() => store.crops.push(crop));
								},
							},
						},
					},
				},
			},
			cacheWrite: {
				conflictPolicy: "queue" as const,
				locks: ["cache"],
				run: async (op: Operation, args: { value: string }) => {
					await op.wait(write.promise);
					op.sync(() => store.cache.push(`${args.value} after reset ${reset}`));
				},
			},
			cacheReset: {
				locks: ["cache"],
				run: (op: Operation) => {
					op.sync(() => {
						reset++;
						store.cache = [];
					});
				},
			},
		},
	});
	const session = app.children.session.children;
	// A plate from the old place lands after travel.
	const oldPlate = session.place.children.plate.start({ id: "old" });
	await flush();
	await session.place.start();
	await session.place.children.plate.start({ id: "new" });
	plate.resolve("old.webp");
	expect(await oldPlate).toEqual({ status: "aborted" });
	expect(store.plate).toBe("new.webp");
	// An import replaced mid-decode.
	const slowImport = session.importBatch.start({ files: ["a.heic"], slow: true });
	await flush();
	await session.importBatch.start({ files: ["b.jpg"], slow: false });
	decode.resolve(["a.jpg"]);
	await slowImport;
	expect(store.batch).toEqual(["b.jpg"]);
	// A crop saved after leaving the place.
	const crop = session.place.children.saveCrop.start();
	await flush();
	await session.place.start();
	save.resolve("crop");
	await crop;
	expect(store.crops).toEqual([]);
	// A queued cache write requested before a reset.
	const pendingWrite = app.children.cacheWrite.start({ value: "w1" });
	await flush();
	const queuedWrite = app.children.cacheWrite.start({ value: "w2" });
	await app.children.cacheReset.start();
	write.resolve();
	expect(await pendingWrite).toEqual({ status: "aborted" });
	expect(await queuedWrite).toEqual({ status: "aborted" });
	expect(store.cache).toEqual([]);
});

test("handles from a replaced run start nothing and never touch the replacement", async () => {
	const gateA = deferred();
	const gateB = deferred();
	const finallyA = deferred();
	let stale: Operation | undefined;
	let saves = 0;
	const app = defineOperations({
		path: "app",
		children: {
			place: {
				children: {
					travel: {
						locks: ["place"],
						run: async (op: Operation, args: { gate: Promise<void>; last?: Promise<void> }) => {
							stale ??= op;
							try {
								await op.wait(args.gate);
							} finally {
								if (args.last) await args.last;
							}
						},
					},
					save: { run: () => void saves++ },
					queued: { conflictPolicy: "queue" as const, locks: ["place"], run: () => {} },
				},
			},
		},
	});
	const travel = app.children.place.children.travel;
	const a = travel.start({ gate: gateA.promise, last: finallyA.promise });
	await flush();
	const b = travel.start({ gate: gateB.promise });
	await flush();
	const queued = app.children.place.children.queued.start();
	expect(await stale?.parent?.children.save?.start()).toEqual({ status: "aborted" });
	expect(saves).toBe(0);
	stale?.cancel();
	expect(stale?.sync(() => {})).toBe(false);
	finallyA.resolve();
	gateA.resolve();
	expect(await a).toEqual({ status: "aborted" });
	expect(travel.flags.isRunning).toBe(true);
	expect(await settled(queued)).toBe(false); // still waiting for B
	gateB.resolve();
	expect(await b).toEqual({ status: "completed" });
	expect(await queued).toEqual({ status: "completed" });
});

test("sync answers for its own run; signals are distinct, propagate down and never cross runs", async () => {
	const ops: Operation[] = [];
	const gates = [deferred(), deferred(), deferred()];
	const aborts: string[] = [];
	const app = defineOperations({
		path: "app",
		children: {
			place: {
				children: {
					task: {
						run: async (op: Operation, args: { gate: Promise<void> }) => {
							ops.push(op);
							op.signal.addEventListener("abort", () => aborts.push(`run ${op.revision}`));
							try {
								await op.wait(args.gate);
							} finally {
								// late cleanup in an old run must not abort a newer run
								ops.at(-1)?.revision !== op.revision && op.cancel();
							}
						},
					},
				},
			},
		},
	});
	const task = app.children.place.children.task;
	const first = task.start({ gate: gates[0]?.promise as Promise<void> });
	await flush();
	const second = task.start({ gate: gates[1]?.promise as Promise<void> }); // replaces first
	await flush();
	const [a, b] = ops;
	expect(a?.signal).not.toBe(b?.signal);
	expect(a?.signal.aborted).toBe(true);
	expect(b?.signal.aborted).toBe(false);
	expect(a?.sync(() => {})).toBe(false);
	expect(b?.sync(() => {})).toBe(true);
	gates[0]?.resolve();
	await first;
	expect(b?.signal.aborted).toBe(false);
	// Descendant propagation: restarting the container aborts the running task's signal.
	await app.children.place.start();
	expect(b?.signal.aborted).toBe(true);
	gates[1]?.resolve();
	await second;
	const third = task.start({ gate: gates[2]?.promise as Promise<void> });
	gates[2]?.resolve();
	await third;
	expect(ops.at(-1)?.sync(() => {})).toBe(false); // completed
	expect(aborts).toEqual(["run 1", "run 2"]);
});

test("commit or release: each produced resource is released exactly once", async () => {
	let allocated = 0;
	let released = 0;
	const adopted: number[] = [];
	const producer = (signal: AbortSignal, gate: Promise<void>) =>
		gate.then(() => {
			const id = ++allocated;
			if (signal.aborted) {
				released++;
				throw new DOMException("aborted", "AbortError");
			}
			return id;
		});
	const gates = [deferred(), deferred(), deferred()];
	const app = defineOperations({
		path: "app",
		children: {
			session: {
				children: {
					importBatch: {
						run: async (
							op: Operation,
							args: { gate: Promise<void>; dieAfter?: boolean; adoptThrows?: boolean },
						) => {
							const id = await producer(op.signal, args.gate);
							if (args.dieAfter) op.cancel();
							// Commit or release: adopt is transactional; release unless adoption succeeded.
							let committed = false;
							try {
								committed = op.sync(() => {
									if (args.adoptThrows) throw new Error("adopt failed before taking it");
									adopted.push(id);
								});
							} finally {
								if (!committed) released++;
							}
						},
					},
				},
			},
		},
	});
	const s = app.children.session.children.importBatch;
	// Dies before the producer settles: the producer releases its own work.
	const before = s.start({ gate: gates[0]?.promise as Promise<void> });
	await flush();
	app.children.session.cancel();
	gates[0]?.resolve();
	await before;
	// Dies after the producer settles but before adoption: the caller releases.
	const after = s.start({ gate: gates[1]?.promise as Promise<void>, dieAfter: true });
	gates[1]?.resolve();
	await after;
	// Lives: adopted, not released.
	const lives = s.start({ gate: gates[2]?.promise as Promise<void> });
	gates[2]?.resolve();
	await lives;
	expect(allocated).toBe(3);
	expect(released).toBe(2);
	expect(adopted).toEqual([3]);
	// The adopter throws before taking ownership: the run fails and the resource is released once.
	const throwing = s.start({ gate: Promise.resolve(), adoptThrows: true });
	expect((await throwing).status).toBe("failed");
	expect(allocated).toBe(4);
	expect(released).toBe(3);
	expect(adopted).toEqual([3]);
});

test("wait rejects at once, but the run holds its locks until its waited promise settles", async () => {
	const source = deferred();
	const cleanup = deferred();
	const events: string[] = [];
	let startOutcome: Outcome | undefined;
	const app = defineOperations({
		path: "app",
		children: {
			cache: {
				children: {
					write: {
						locks: ["cache"],
						run: async (op: Operation, args: { id: string; slow?: boolean }) => {
							events.push(`start ${args.id}`);
							try {
								if (args.slow) await op.wait(source.promise);
							} catch {
								events.push(`caught ${args.id}`);
							} finally {
								if (args.slow) await cleanup.promise;
								events.push(`finally ${args.id}`);
							}
						},
					},
					queuedWrite: {
						conflictPolicy: "queue" as const,
						locks: ["cache"],
						run: () => void events.push("start queued"),
					},
				},
			},
		},
	});
	const c = app.children.cache.children;
	const slow = c.write.start({ id: "a", slow: true }).then((o) => {
		startOutcome = o;
		return o;
	});
	await flush();
	c.write.cancel();
	await flush();
	expect(events).toEqual(["start a", "caught a"]); // wait rejected without the source settling
	// preempt hands over at once, even while a's cleanup is held
	expect(await c.write.start({ id: "b" })).toEqual({ status: "completed" });
	// queue waits for every conflicting run to settle, including the cancelled a
	const queued = c.queuedWrite.start();
	cleanup.resolve();
	await flush();
	expect(events).toContain("finally a");
	expect(startOutcome).toBeUndefined(); // the source has not settled
	expect(events).not.toContain("start queued");
	source.resolve();
	expect(await slow).toEqual({ status: "aborted" });
	await queued;
	expect(events.at(-1)).toBe("start queued");
});

test("each settled run is logged with its path, revision and outcome", async () => {
	const entries: { path: string; revision: number; outcome: string }[] = [];
	const app = defineOperations(
		{ path: "app", children: { c: { children: { t: { run: () => {} } } } } },
		{ log: ({ path, revision, outcome }) => entries.push({ path, revision, outcome }) },
	);
	await app.children.c.children.t.start();
	await app.children.c.children.t.start();
	expect(entries).toEqual([
		{ path: "app/c/t", revision: 1, outcome: "completed" },
		{ path: "app/c/t", revision: 2, outcome: "completed" },
	]);
});

test("definitions are typed: argument types, child names and container rules", () => {
	const app = defineOperations({
		path: "app",
		children: {
			place: {
				children: { travel: { run: async (_op: Operation, _args: { placeId: string }) => {} } },
			},
		},
	});
	// Compile-time checks only: never called.
	const typeOnly = () => {
		void app.children.place.children.travel.start({ placeId: "desk" });
		// @ts-expect-error wrong payload
		void app.children.place.children.travel.start({ placeId: 3 });
		// @ts-expect-error unknown child: no open index signature
		void app.children.place.children.nowhere;
		// @ts-expect-error unknown child, even with optional chaining
		void app.children.place.children.nowhere?.start();
		// @ts-expect-error missing required payload
		void app.children.place.children.travel.start();
		// @ts-expect-error a container has no run
		defineOperations({ path: "x", children: {}, run: () => {} });
		// @ts-expect-error a container cannot queue
		defineOperations({ path: "x", children: {}, conflictPolicy: "queue" });
		// @ts-expect-error a task has no children
		defineOperations({ path: "x", children: { t: { run: () => {}, children: {} } } });
		// @ts-expect-error the root is a container, never a task (QA Q5)
		defineOperations({ path: "job", run: () => {} });
	};
	void typeOnly;
	expect(() =>
		defineOperations({ path: "x", children: { t: { run: () => {}, children: {} } } } as never),
	).toThrow("only containers have children");
	// Refused when the tree is defined, not later at start (QA Q5).
	expect(() => defineOperations({ path: "job", run: () => {} } as never)).toThrow(
		"the root must be a container",
	);
});

// Codex code QA, 2026-11-05: each test below replays one of its probes.

test("a start from an abort listener never joins the cancelled container (QA Q1)", async () => {
	const source = deferred();
	const gate = deferred();
	const writes: string[] = [];
	const outside: { startSave?: () => Promise<Outcome>; placeRunning?: () => boolean } = {};
	let late: Promise<Outcome> | undefined;
	let placeRunningInListener: boolean | undefined;
	let lateSignal: AbortSignal | undefined;
	const app = defineOperations({
		path: "app",
		children: {
			place: {
				children: {
					plate: {
						run: async (op: Operation) => {
							op.signal.addEventListener("abort", () => {
								placeRunningInListener = outside.placeRunning?.();
								late = outside.startSave?.(); // the stable slot, not op.parent
							});
							await op.wait(source.promise).catch(() => {});
						},
					},
					save: {
						run: async (op: Operation) => {
							lateSignal = op.signal;
							await op.wait(gate.promise);
							op.sync(() => writes.push("save"));
						},
					},
				},
			},
		},
	});
	const place = app.children.place;
	outside.startSave = () => place.children.save.start();
	outside.placeRunning = () => place.flags.isRunning;
	const plate = place.children.plate.start();
	await flush();
	const cancelledRevision = place.revision;
	place.cancel();
	// The whole subtree was dead before any listener ran.
	expect(placeRunningInListener).toBe(false);
	// So the late start began a fresh place instead of joining the cancelled one.
	expect(place.revision).toBe(cancelledRevision + 1);
	expect(place.flags.isRunning).toBe(true);
	expect(lateSignal?.aborted).toBe(false);
	// Cancelling the fresh place reaches the late task.
	place.cancel();
	expect(lateSignal?.aborted).toBe(true);
	gate.resolve();
	source.resolve();
	expect(await late).toEqual({ status: "aborted" });
	expect(await plate).toEqual({ status: "aborted" });
	expect(writes).toEqual([]);
});

test("a task cancelled by a flags observer before its body is entered never runs (QA Q1)", async () => {
	let entered = 0;
	const outside: { cancel?: () => void } = {};
	const app = defineOperations(
		{ path: "app", children: { c: { children: { t: { run: () => void entered++ } } } } },
		{
			onFlagsChange: (flags) => {
				if (flags["app/c/t"]?.isRunning) outside.cancel?.();
			},
		},
	);
	const task = app.children.c.children.t;
	outside.cancel = () => task.cancel();
	expect(await task.start()).toEqual({ status: "aborted" });
	expect(entered).toBe(0);
});

test("a queued start cancelled while the queue drains never runs; others stay queued (QA Q2)", async () => {
	const xy = deferred();
	const z = deferred();
	const calls = { b: 0, c: 0, e: 0 };
	const outside: { cancelC?: () => void } = {};
	const app = defineOperations({
		path: "app",
		children: {
			c: {
				children: {
					x: {
						conflictPolicy: "queue",
						locks: ["x", "y"],
						run: (op: Operation) => op.wait(xy.promise),
					},
					hold: {
						conflictPolicy: "queue",
						locks: ["z"],
						run: (op: Operation) => op.wait(z.promise),
					},
					b: {
						conflictPolicy: "queue",
						locks: ["x"],
						run: () => {
							calls.b++;
							outside.cancelC?.();
						},
					},
					c: { conflictPolicy: "queue", locks: ["y"], run: () => void calls.c++ },
					e: { conflictPolicy: "queue", locks: ["z"], run: () => void calls.e++ },
				},
			},
		},
	});
	const slots = app.children.c.children;
	outside.cancelC = () => slots.c.cancel();
	const x = slots.x.start();
	const hold = slots.hold.start();
	const b = slots.b.start();
	const c = slots.c.start();
	const e = slots.e.start();
	await flush();
	expect(calls).toEqual({ b: 0, c: 0, e: 0 });
	xy.resolve();
	expect(await x).toEqual({ status: "completed" });
	expect(await b).toEqual({ status: "completed" });
	expect(await c).toEqual({ status: "aborted" });
	expect(calls).toEqual({ b: 1, c: 0, e: 0 });
	expect(await settled(e)).toBe(false); // still queued behind hold, not lost
	z.resolve();
	expect(await hold).toEqual({ status: "completed" });
	expect(await e).toEqual({ status: "completed" });
	expect(calls).toEqual({ b: 1, c: 0, e: 1 });
});

test("cancelling a queued blocker lets the start behind it run at once (QA Q3)", async () => {
	const gate = deferred();
	let cCalls = 0;
	const app = defineOperations({
		path: "app",
		children: {
			c: {
				children: {
					a: {
						conflictPolicy: "queue",
						locks: ["x"],
						run: (op: Operation) => op.wait(gate.promise),
					},
					b: { conflictPolicy: "queue", locks: ["x", "y"], run: () => {} },
					c: { conflictPolicy: "queue", locks: ["y"], run: () => void cCalls++ },
				},
			},
		},
	});
	const slots = app.children.c.children;
	const a = slots.a.start();
	const b = slots.b.start();
	const c = slots.c.start();
	await flush();
	expect(cCalls).toBe(0); // behind b, which waits for a
	slots.b.cancel();
	expect(await b).toEqual({ status: "aborted" });
	expect(await c).toEqual({ status: "completed" });
	expect(cCalls).toBe(1);
	expect(await settled(a)).toBe(false); // a is still running
	gate.resolve();
	expect(await a).toEqual({ status: "completed" });
});

test("drop refuses while a cancelled run still holds the lock (QA Q4)", async () => {
	const source = deferred();
	let bCalls = 0;
	const app = defineOperations({
		path: "app",
		children: {
			c: {
				children: {
					a: { locks: ["cache"], run: (op: Operation) => op.wait(source.promise).catch(() => {}) },
					b: { conflictPolicy: "drop", locks: ["cache"], run: () => void bCalls++ },
				},
			},
		},
	});
	const slots = app.children.c.children;
	const a = slots.a.start();
	await flush();
	slots.a.cancel();
	expect(await slots.b.start()).toEqual({ status: "dropped" });
	expect(bCalls).toBe(0);
	source.resolve();
	expect(await a).toEqual({ status: "aborted" });
	expect(await slots.b.start()).toEqual({ status: "completed" });
	expect(bCalls).toBe(1);
});

test("locks are compared between siblings only (QA Q6)", async () => {
	const placeGate = deferred();
	const sessionGate = deferred();
	const app = defineOperations({
		path: "app",
		children: {
			session: {
				children: {
					write: {
						conflictPolicy: "queue",
						locks: ["cache"],
						run: (op: Operation) => op.wait(sessionGate.promise),
					},
				},
			},
			place: {
				children: {
					write: { locks: ["cache"], run: (op: Operation) => op.wait(placeGate.promise) },
				},
			},
		},
	});
	const session = app.children.session.children.write.start();
	const place = app.children.place.children.write.start(); // preempt, same lock name
	await flush();
	expect(app.children.session.children.write.flags.isRunning).toBe(true); // neither blocked
	expect(app.children.place.children.write.flags.isRunning).toBe(true); // nor aborted
	placeGate.resolve();
	sessionGate.resolve();
	expect(await Promise.all([session, place])).toEqual([
		{ status: "completed" },
		{ status: "completed" },
	]);
});

// Codex code QA recheck, 2026-11-05.

test("a throwing flags observer never costs a start its outcome (QA recheck Q7)", async () => {
	for (const prestart of [false, true]) {
		let entered = 0;
		let followed = 0;
		const errors: unknown[] = [];
		const app = defineOperations(
			{
				path: "app",
				children: {
					task: { conflictPolicy: "queue", locks: ["cache"], run: () => void entered++ },
					next: { conflictPolicy: "queue", locks: ["cache"], run: () => void followed++ },
				},
			},
			{
				onFlagsChange: (flags) => {
					if (flags["app/task"]?.isRunning) throw new Error("observer");
				},
				onError: (error) => errors.push(error),
			},
		);
		if (prestart) await app.start();
		const started = app.children.task.start(); // does not throw
		const queued = app.children.next.start();
		expect(started).toBeInstanceOf(Promise);
		expect(await started).toEqual({ status: "completed" });
		expect(await queued).toEqual({ status: "completed" }); // the lock was released
		expect({ entered, followed }).toEqual({ entered: 1, followed: 1 });
		expect(errors.map((e) => (e as Error).message)).toEqual(["observer"]);
		expect(app.children.task.flags.isRunning).toBe(false);
	}
});

test("a throwing logger never costs a start its outcome or stalls the queue (QA recheck Q7)", async () => {
	const gate = deferred();
	const reported: unknown[] = [];
	const host = globalThis as { reportError?: (error: unknown) => void };
	const original = host.reportError;
	host.reportError = (error) => reported.push(error); // the default, without onError
	try {
		const app = defineOperations(
			{
				path: "app",
				children: {
					c: {
						children: {
							a: {
								conflictPolicy: "queue",
								locks: ["x"],
								run: (op: Operation) => op.wait(gate.promise),
							},
							b: { conflictPolicy: "queue", locks: ["x"], run: () => {} },
						},
					},
				},
			},
			{
				log: () => {
					throw new Error("logger");
				},
			},
		);
		const a = app.children.c.children.a.start();
		const b = app.children.c.children.b.start();
		gate.resolve();
		expect(await a).toEqual({ status: "completed" });
		expect(await b).toEqual({ status: "completed" });
		expect(reported.map((e) => (e as Error).message)).toEqual(["logger", "logger"]);
	} finally {
		if (original) host.reportError = original;
		else delete host.reportError;
	}
});

test("a cancel made inside a callback has aborted the signal when it returns (QA recheck Q8)", async () => {
	// From a task body.
	let inBody: { aborted: boolean; threw: boolean; synced: boolean } | undefined;
	const app = defineOperations(
		{
			path: "app",
			children: {
				c: {
					children: {
						self: {
							run: (op: Operation) => {
								op.cancel();
								let threw = false;
								try {
									op.signal.throwIfAborted();
								} catch {
									threw = true;
								}
								inBody = { aborted: op.signal.aborted, threw, synced: op.sync(() => {}) };
							},
						},
						watched: {
							run: (op: Operation) => {
								watchedSignal = op.signal;
								return op.wait(new Promise<void>(() => {})).catch(() => {});
							},
						},
					},
				},
			},
		},
		{
			// From a flags observer.
			onFlagsChange: (flags) => {
				if (flags["app/c/watched"]?.isRunning && watchedSignal && !cancelled) {
					cancelled = true;
					outside.cancelWatched?.();
					abortedOnReturn = watchedSignal.aborted;
				}
			},
		},
	);
	let watchedSignal: AbortSignal | undefined;
	let cancelled = false;
	let abortedOnReturn: boolean | undefined;
	const outside: { cancelWatched?: () => void } = {};
	expect(await app.children.c.children.self.start()).toEqual({ status: "aborted" });
	expect(inBody).toEqual({ aborted: true, threw: true, synced: false });
	outside.cancelWatched = () => app.children.c.children.watched.cancel();
	const watched = app.children.c.children.watched.start();
	await flush();
	app.children.c.children.self.start(); // any change publishes flags again
	await flush();
	expect(cancelled).toBe(true);
	expect(abortedOnReturn).toBe(true);
	void watched;
});

// Codex's second code QA recheck, 2026-11-05.

test("calls from the logger and from onError get the same timing as other callbacks (QA recheck-2 Q8)", async () => {
	for (const via of ["log", "onError"] as const) {
		const gate = deferred();
		const seen: Record<string, unknown> = {};
		const outside: { cancelB?: () => void; startChild?: () => Promise<Outcome> } = {};
		let bSignal: AbortSignal | undefined;
		let childCalls = 0;
		let child: Promise<Outcome> | undefined;
		const act = (entry: { path: string }) => {
			if (entry.path !== "app/c/a") return;
			outside.cancelB?.();
			seen.bAbortedOnReturn = bSignal?.aborted;
			child = outside.startChild?.();
			seen.childCallsOnReturn = childCalls; // a body is entered after the callback returns
		};
		const app = defineOperations(
			{
				path: "app",
				children: {
					c: {
						children: {
							a: { run: () => {} },
							b: {
								conflictPolicy: "queue",
								locks: ["x"],
								run: (op: Operation) => {
									bSignal = op.signal;
									return op.wait(gate.promise);
								},
							},
							next: { conflictPolicy: "queue", locks: ["x"], run: () => {} },
							child: { run: () => void childCalls++ },
						},
					},
				},
			},
			via === "log"
				? { log: act }
				: {
						log: (entry) => {
							if (entry.path === "app/c/a") throw entry;
						},
						onError: (error) => act(error as { path: string }),
					},
		);
		const slots = app.children.c.children;
		outside.cancelB = () => slots.b.cancel();
		outside.startChild = () => slots.child.start();
		const b = slots.b.start();
		const next = slots.next.start(); // queued behind b's lock
		await flush();
		expect(await slots.a.start()).toEqual({ status: "completed" });
		expect(seen, via).toEqual({ bAbortedOnReturn: true, childCallsOnReturn: 0 });
		expect(await child).toEqual({ status: "completed" });
		expect(childCalls).toBe(1);
		gate.resolve();
		expect(await b).toEqual({ status: "aborted" });
		expect(await next).toEqual({ status: "completed" });
	}
});

test("a long chain of bodies that each start the next runs without recursion (QA recheck-2 Q9)", async () => {
	const depth = 5000;
	let entered = 0;
	const outcomes: Promise<Outcome>[] = [];
	const outside: { step?: (n: number) => Promise<Outcome> } = {};
	const app = defineOperations({
		path: "app",
		children: {
			c: {
				children: {
					step: {
						locks: ["x"],
						run: (_op: Operation, n: number) => {
							entered++;
							if (n > 0) outcomes.push(outside.step?.(n - 1) ?? Promise.reject());
						},
					},
					after: { conflictPolicy: "queue", locks: ["x"], run: () => {} },
				},
			},
		},
	});
	const slots = app.children.c.children;
	outside.step = (n) => slots.step.start(n);
	outcomes.push(slots.step.start(depth));
	expect(entered).toBe(depth + 1); // all entered before the first start returned
	const statuses = (await Promise.all(outcomes)).map((o) => o.status);
	// Each start preempts the run that made it; only the last of the chain completes.
	expect(statuses.filter((s) => s === "aborted")).toHaveLength(depth);
	expect(statuses.filter((s) => s === "completed")).toHaveLength(1);
	expect(slots.step.flags.isRunning).toBe(false);
	expect(await slots.after.start()).toEqual({ status: "completed" });
});

/** Runs a module script in a separate Node process, importing the operations package as `ops`. */
function node(script: string) {
	const ops = pathToFileURL(resolve("packages/operations/src/index.ts")).href;
	const result = spawnSync(
		process.execPath,
		[
			"--experimental-transform-types",
			"--no-warnings",
			"--input-type=module",
			"-e",
			`import { writeSync } from "node:fs"; import * as ops from ${JSON.stringify(ops)};
const say = (text) => writeSync(1, text + "\\n");
${script}`,
		],
		{ encoding: "utf8", timeout: 20_000 },
	);
	return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("observer errors reach the host when nothing else takes them (QA recheck-2 Q10)", () => {
	const tree = `const app = ops.defineOperations(
	{ path: "app", children: { t: { conflictPolicy: "queue", locks: ["x"], run() { say("body t"); } },
		next: { conflictPolicy: "queue", locks: ["x"], run() { say("body next"); } } } },
	{ onFlagsChange(flags) { if (flags["app/t"]?.isRunning) throw new Error("observer-boom"); }, ONERROR });
const started = [app.children.t.start(), app.children.next.start()];
say("promise " + (started[0] instanceof Promise));
Promise.all(started).then((all) => say("outcomes " + all.map((o) => o.status).join()));`;
	// No onError and no reportError (Node has none): an uncaught error, fatal by default, after the
	// start has returned its promise and the body has run.
	const fatal = node(tree.replace(", ONERROR", ""));
	expect(fatal.status).toBe(1);
	expect(fatal.stdout).toContain("promise true");
	expect(fatal.stdout).toContain("body t");
	expect(fatal.stderr).toContain("observer-boom");
	// A throwing onError: its own error goes to the host's reportError, and the work goes on.
	const reported = node(
		`globalThis.reportError = (error) => say("reported " + error.message);
${tree.replace("ONERROR", 'onError() { throw new Error("secondary"); }')}`,
	);
	expect(reported.status).toBe(0);
	expect(reported.stdout).toContain("reported secondary");
	expect(reported.stdout).toContain("outcomes completed,completed");
	// A throwing onError with no reportError: the secondary error is the uncaught one.
	const secondary = node(tree.replace("ONERROR", 'onError() { throw new Error("secondary"); }'));
	expect(secondary.status).toBe(1);
	expect(secondary.stderr).toContain("secondary");
	// A working onError: nothing reaches the host.
	const handled = node(
		tree.replace("ONERROR", 'onError(error) { say("handled " + error.message); }'),
	);
	expect(handled.status).toBe(0);
	expect(handled.stdout).toContain("handled observer-boom");
	expect(handled.stdout).toContain("outcomes completed,completed");
});
