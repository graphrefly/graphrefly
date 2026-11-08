/**
 * The operation tree: every piece of work that spans time is a run of a slot in one tree. A run may
 * write state only while it is alive, and it dies when it settles, is cancelled, or an ancestor is
 * cancelled or restarted. Follows the user's own design; see docs/decisions/scene-architecture.md.
 */

export type Outcome =
	| { status: "completed" }
	| { status: "failed"; error: unknown }
	| { status: "aborted" }
	| { status: "dropped" };

export interface Flags {
	isRunning: boolean;
	isBusy: boolean;
}

/** A node with work: running from `start()` until its body and its waited promises settle. */
export interface TaskDefinition<Args = void> {
	run(op: Operation, args: Args): Promise<void> | void;
	/** While running, makes this task and every ancestor report `isBusy`. Default false. */
	shouldCountAsBusy?: boolean;
	/** What `start` does when a conflicting run or waiting start exists. Default "preempt". */
	conflictPolicy?: "preempt" | "drop" | "queue";
	/** Names that make two sibling tasks conflict. */
	locks?: readonly string[];
	/** Tasks are leaves: only containers group. */
	children?: never;
}

/** A node that only groups: running from `start()` until it is cancelled or restarted. */
export interface ContainerDefinition {
	children: { readonly [name: string]: Definition };
	/** A container never ends on its own, so it cannot queue. */
	conflictPolicy?: "preempt" | "drop";
	run?: never;
	locks?: never;
	shouldCountAsBusy?: never;
}

// biome-ignore lint/suspicious/noExplicitAny: a task of any argument type is a valid child.
export type Definition = TaskDefinition<any> | ContainerDefinition;

/** A defined node, present whether or not it is running. */
export interface Slot<Args = void> {
	readonly path: string;
	/** Counts runs that began; +1 on every start that runs. */
	readonly revision: number;
	readonly parent: Slot<unknown> | null;
	readonly flags: Flags;
	start(args: Args): Promise<Outcome>;
	cancel(): void;
}

/** What a task's `run` receives: bound to that one run for good. */
export interface Operation {
	readonly path: string;
	/** This run's number, frozen. */
	readonly revision: number;
	/** The parent container, through handles that act only while this run is alive. */
	readonly parent: ContainerHandle | null;
	readonly flags: Flags;
	readonly signal: AbortSignal;
	/** Awaits, then re-checks this run. Rejects at once with an aborted error when the run dies. */
	wait<T>(promise: Promise<T>): Promise<T>;
	/** Applies a synchronous effect only while this run is alive. Returns whether it ran. */
	sync(effect: () => void): boolean;
	/** Cancels this run if it is still alive; does nothing to a replacement. */
	cancel(): void;
}

/** A container reached from an operation: its starts are refused once that operation is dead. */
export interface ContainerHandle extends Slot<void> {
	readonly children: { readonly [name: string]: Slot<unknown> & Partial<ContainerHandle> };
}

// biome-ignore lint/suspicious/noConfusingVoidType: a container starts with no argument, so `start()` must compile.
type ArgsOf<D> = D extends TaskDefinition<infer A> ? (unknown extends A ? void : A) : void;
/** The slot tree for a definition literal: child names and each task's argument type are kept. */
export type SlotOf<D extends Definition> = Slot<ArgsOf<D>> &
	(D extends ContainerDefinition
		? { readonly children: { readonly [K in keyof D["children"]]: SlotOf<D["children"][K]> } }
		: unknown);

export interface Options {
	onFlagsChange?: (flags: Record<string, Flags>) => void;
	log?: (entry: { path: string; revision: number; outcome: Outcome["status"]; ms: number }) => void;
}

class OperationAbortedError extends Error {
	override name = "OperationAbortedError";
	constructor() {
		super("The operation was cancelled or replaced.");
	}
}

/** Tells cancellation apart from a real failure in a `catch`. */
export function isAborted(error: unknown): boolean {
	return (
		error instanceof OperationAbortedError ||
		(typeof error === "object" &&
			error !== null &&
			(error as { name?: unknown }).name === "AbortError")
	);
}

interface Run {
	node: Node;
	revision: number;
	parent: Run | null;
	children: Set<Run>;
	controller: AbortController;
	alive: boolean;
	/** Promises handed to `wait`; the run holds its locks until they settle. */
	pending: Set<Promise<unknown>>;
	settled: boolean;
}
interface Waiter {
	node: Node;
	args: unknown;
	parent: Run;
	resolve(outcome: Outcome): void;
}
interface Node {
	path: string;
	definition: Definition;
	isContainer: boolean;
	parent: Node | null;
	children: Map<string, Node>;
	revision: number;
	/** The alive run, if any. */
	current: Run | null;
	slot: Slot<unknown>;
}

const now = () => (typeof performance === "undefined" ? Date.now() : performance.now());

class Tree {
	/** Task runs whose body or waited promises have not settled, alive or not. */
	private unsettled = new Set<Run>();
	private waiting: Waiter[] = [];
	private lastFlags = "";
	/**
	 * Callbacks into outside code (abort listeners, flag observers, task bodies) wait here until
	 * the tree's own state is consistent, then run in order. Each one rechecks what it acts on, so
	 * outside code can never observe, or attach work to, a half-cancelled subtree.
	 */
	private effects: (() => void)[] = [];
	private depth = 0;
	private flushing = false;
	private publishQueued = false;

	constructor(private options: Options) {}

	/** Runs a change to the tree, then the queue and the callbacks it caused. */
	batch<T>(change: () => T): T {
		this.depth++;
		try {
			return change();
		} finally {
			this.depth--;
			if (this.depth === 0 && !this.flushing) this.flush();
		}
	}

	private defer(effect: () => void) {
		this.effects.push(effect);
	}

	private flush() {
		this.flushing = true;
		let failure: { error: unknown } | null = null;
		try {
			for (;;) {
				this.drain();
				const effect = this.effects.shift();
				if (!effect) break;
				try {
					effect();
				} catch (error) {
					failure ??= { error };
				}
			}
		} finally {
			this.flushing = false;
		}
		if (failure) throw failure.error;
	}

	build(definition: Definition, path: string, parent: Node | null): Node {
		const isContainer = !("run" in definition && typeof definition.run === "function");
		if (isContainer && !definition.children)
			throw new Error(`${path}: a container needs children; a task needs run`);
		if (!isContainer && "children" in definition && definition.children)
			throw new Error(`${path}: only containers have children`);
		const node: Node = {
			path,
			definition,
			isContainer,
			parent,
			children: new Map(),
			revision: 0,
			current: null,
			slot: undefined as unknown as Slot<unknown>,
		};
		if (isContainer)
			for (const [name, child] of Object.entries((definition as ContainerDefinition).children))
				node.children.set(name, this.build(child, `${path}/${name}`, node));
		node.slot = this.slot(node, null);
		return node;
	}

	/** A slot handle. Bound to a run, it acts only while that run is alive. */
	slot(
		node: Node,
		boundTo: Run | null,
	): Slot<unknown> & { children: Record<string, Slot<unknown>> } {
		const alive = () => boundTo === null || boundTo.alive;
		const children: Record<string, Slot<unknown>> = {};
		const handle = {
			path: node.path,
			get revision() {
				return node.revision;
			},
			get parent() {
				return node.parent ? tree.slot(node.parent, boundTo) : null;
			},
			children,
			get flags() {
				return tree.flagsOf(node);
			},
			start: (args: unknown): Promise<Outcome> =>
				alive() ? this.start(node, args) : Promise.resolve({ status: "aborted" }),
			cancel: () => {
				if (alive()) this.cancelNode(node);
			},
		};
		const tree = this;
		for (const [name, child] of node.children)
			Object.defineProperty(children, name, {
				enumerable: true,
				get: () => (boundTo ? tree.slot(child, boundTo) : child.slot),
			});
		return handle;
	}

	flagsOf(node: Node): Flags {
		const isRunning = node.current?.alive === true;
		const ownBusy =
			isRunning &&
			!node.isContainer &&
			(node.definition as TaskDefinition).shouldCountAsBusy === true;
		return {
			isRunning,
			isBusy: ownBusy || [...node.children.values()].some((child) => this.flagsOf(child).isBusy),
		};
	}

	root!: Node;

	/** Publishes the flags once the current change is complete. */
	publish() {
		if (!this.options.onFlagsChange || this.publishQueued) return;
		this.publishQueued = true;
		this.defer(() => {
			this.publishQueued = false;
			this.emitFlags();
		});
	}

	private emitFlags() {
		if (!this.options.onFlagsChange) return;
		const all: Record<string, Flags> = {};
		const visit = (node: Node) => {
			all[node.path] = this.flagsOf(node);
			for (const child of node.children.values()) visit(child);
		};
		visit(this.root);
		const key = JSON.stringify(all);
		if (key === this.lastFlags) return;
		this.lastFlags = key;
		this.options.onFlagsChange(all);
	}

	/** The alive run of the parent container, starting idle container ancestors first. */
	private parentRun(node: Node): Run | null {
		if (!node.parent) return null;
		return this.ensureRunning(node.parent);
	}

	private ensureRunning(container: Node): Run {
		if (container.current?.alive) return container.current;
		return this.beginContainer(container, this.parentRun(container));
	}

	private beginContainer(node: Node, parent: Run | null): Run {
		const run = this.newRun(node, parent);
		node.current = run;
		this.publish();
		return run;
	}

	private newRun(node: Node, parent: Run | null): Run {
		node.revision++;
		const run: Run = {
			node,
			revision: node.revision,
			parent,
			children: new Set(),
			controller: new AbortController(),
			alive: true,
			pending: new Set(),
			settled: false,
		};
		parent?.children.add(run);
		return run;
	}

	start(node: Node, args: unknown): Promise<Outcome> {
		return this.batch(() => this.admit(node, args));
	}

	private admit(node: Node, args: unknown): Promise<Outcome> {
		if (node.isContainer) {
			const policy = (node.definition as ContainerDefinition).conflictPolicy ?? "preempt";
			if (node.current?.alive) {
				if (policy === "drop") return Promise.resolve({ status: "dropped" });
				this.cancelRun(node.current);
			}
			this.beginContainer(node, this.parentRun(node));
			return Promise.resolve({ status: "completed" });
		}
		const definition = node.definition as TaskDefinition<unknown>;
		const policy = definition.conflictPolicy ?? "preempt";
		const parent = this.parentRun(node);
		if (!parent) throw new Error(`${node.path}: a task needs a container parent`);
		const conflictingRuns = [...this.unsettled].filter((run) => this.conflicts(node, run.node));
		const conflictingWaiters = this.waiting.filter((waiter) => this.conflicts(node, waiter.node));
		if (policy === "drop") {
			// A cancelled run still holds its locks until it settles, so it still refuses a drop.
			if (conflictingRuns.length > 0 || conflictingWaiters.length > 0)
				return Promise.resolve({ status: "dropped" });
			return this.begin(node, args, parent);
		}
		if (policy === "preempt") {
			for (const waiter of conflictingWaiters) this.discard(waiter);
			for (const run of conflictingRuns) this.cancelRun(run);
			return this.begin(node, args, parent);
		}
		// Admitted by `drain` when the batch ends.
		return new Promise((resolve) => this.waiting.push({ node, args, parent, resolve }));
	}

	private conflicts(a: Node, b: Node): boolean {
		if (a === b) return true;
		if (a.parent !== b.parent || a.isContainer || b.isContainer) return false;
		const locksA = (a.definition as TaskDefinition).locks ?? [];
		const locksB = (b.definition as TaskDefinition).locks ?? [];
		return locksA.some((lock) => locksB.includes(lock));
	}

	/**
	 * Admits the first queued start whose conflicts have all settled, then looks again from the
	 * start of the queue, until none can go. It reads the queue as it is now, so a start removed
	 * meanwhile is never admitted, and it calls no outside code: bodies begin as deferred effects.
	 */
	private drain() {
		for (;;) {
			const next = this.waiting.find(
				(waiter, index) =>
					![...this.unsettled].some((run) => this.conflicts(waiter.node, run.node)) &&
					!this.waiting
						.slice(0, index)
						.some((earlier) => this.conflicts(waiter.node, earlier.node)),
			);
			if (!next) return;
			this.waiting.splice(this.waiting.indexOf(next), 1);
			if (next.parent.alive) this.begin(next.node, next.args, next.parent).then(next.resolve);
			else next.resolve({ status: "aborted" });
		}
	}

	/** Refuses a waiting start; the queue behind it is drained when the batch ends. */
	private discard(waiter: Waiter) {
		const index = this.waiting.indexOf(waiter);
		if (index >= 0) this.waiting.splice(index, 1);
		waiter.resolve({ status: "aborted" });
	}

	/** Creates the run now; its body is entered later, and only if the run is still alive then. */
	private begin(node: Node, args: unknown, parent: Run): Promise<Outcome> {
		const run = this.newRun(node, parent);
		node.current = run;
		this.unsettled.add(run);
		this.publish();
		return new Promise((resolve) => this.defer(() => resolve(this.execute(run, args))));
	}

	private async execute(run: Run, args: unknown): Promise<Outcome> {
		const definition = run.node.definition as TaskDefinition<unknown>;
		const started = now();
		let outcome: Outcome = { status: "aborted" };
		if (run.alive) {
			try {
				await definition.run(this.operation(run), args);
				if (run.alive) outcome = { status: "completed" };
			} catch (error) {
				if (run.alive && !isAborted(error)) outcome = { status: "failed", error };
			}
		}
		this.batch(() => this.end(run));
		// Hold the locks until every promise handed to `wait` has settled too.
		while (run.pending.size > 0) await Promise.allSettled([...run.pending]);
		this.batch(() => {
			run.settled = true;
			this.unsettled.delete(run);
			run.parent?.children.delete(run);
			this.options.log?.({
				path: run.node.path,
				revision: run.revision,
				outcome: outcome.status,
				ms: now() - started,
			});
			this.publish();
		});
		return outcome;
	}

	/** A run is no longer alive once its body returns. */
	private end(run: Run) {
		if (!run.alive) return;
		run.alive = false;
		if (run.node.current === run) run.node.current = null;
		this.publish();
	}

	operation(run: Run): Operation {
		const node = run.node;
		const tree = this;
		const abortedError = () => new OperationAbortedError();
		return {
			path: node.path,
			revision: run.revision,
			get parent() {
				return node.parent ? (tree.slot(node.parent, run) as unknown as ContainerHandle) : null;
			},
			get flags() {
				return tree.flagsOf(node);
			},
			signal: run.controller.signal,
			wait<T>(promise: Promise<T>): Promise<T> {
				if (!run.alive) {
					promise.catch(() => {});
					return Promise.reject(abortedError());
				}
				run.pending.add(promise);
				const release = () => run.pending.delete(promise);
				return new Promise<T>((resolve, reject) => {
					const onAbort = () => reject(abortedError());
					run.controller.signal.addEventListener("abort", onAbort, { once: true });
					promise.then(
						(value) => {
							release();
							run.controller.signal.removeEventListener("abort", onAbort);
							if (run.alive) resolve(value);
							else reject(abortedError());
						},
						(error: unknown) => {
							release();
							run.controller.signal.removeEventListener("abort", onAbort);
							reject(run.alive ? error : abortedError());
						},
					);
				});
			},
			sync(effect: () => void): boolean {
				if (!run.alive) return false;
				effect();
				return true;
			},
			cancel() {
				if (run.alive) tree.cancelRun(run);
			},
		};
	}

	/** Cancels a slot's current run and its waiting starts. */
	cancelNode(node: Node) {
		this.batch(() => {
			for (const waiter of this.waiting.filter((w) => w.node === node)) this.discard(waiter);
			if (node.current) this.cancelRun(node.current);
		});
	}

	/**
	 * Cancels a run and everything under it. The whole subtree dies first, with no outside code
	 * running in between; then the signals abort children first, as deferred effects.
	 */
	cancelRun(run: Run) {
		if (!run.alive) return;
		this.batch(() => {
			const dying: Run[] = [];
			const invalidate = (r: Run) => {
				if (!r.alive) return;
				for (const child of r.children) invalidate(child);
				r.alive = false;
				if (r.node.current === r) r.node.current = null;
				dying.push(r);
			};
			invalidate(run);
			for (const waiter of this.waiting.filter((w) => !w.parent.alive)) this.discard(waiter);
			for (const r of dying) {
				if (r.node.isContainer) r.parent?.children.delete(r);
				this.defer(() => r.controller.abort());
			}
			this.publish();
		});
	}
}

/** Builds the tree for a definition literal. The root is a container, usually named after the app. */
export function defineOperations<const D extends ContainerDefinition>(
	root: D & { path: string },
	options: Options = {},
): SlotOf<D> {
	const tree = new Tree(options);
	const { path, ...definition } = root;
	if ("run" in definition) throw new Error(`${path}: the root must be a container, not a task`);
	tree.root = tree.build(definition as unknown as Definition, path, null);
	return tree.root.slot as unknown as SlotOf<D>;
}
