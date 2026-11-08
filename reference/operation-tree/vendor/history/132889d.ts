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

	constructor(private options: Options) {}

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

	publish() {
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
			if (conflictingRuns.some((run) => run.alive) || conflictingWaiters.length > 0)
				return Promise.resolve({ status: "dropped" });
			return this.begin(node, args, parent);
		}
		if (policy === "preempt") {
			for (const waiter of conflictingWaiters) this.discard(waiter);
			for (const run of conflictingRuns) if (run.alive) this.cancelRun(run);
			return this.begin(node, args, parent);
		}
		return new Promise((resolve) => {
			this.waiting.push({ node, args, parent, resolve });
			this.drain();
		});
	}

	private conflicts(a: Node, b: Node): boolean {
		if (a === b) return true;
		if (a.parent !== b.parent || a.isContainer || b.isContainer) return false;
		const locksA = (a.definition as TaskDefinition).locks ?? [];
		const locksB = (b.definition as TaskDefinition).locks ?? [];
		return locksA.some((lock) => locksB.includes(lock));
	}

	/** Starts queued tasks whose conflicts have all settled, first in, first out. */
	private drain() {
		const ahead: Waiter[] = [];
		for (const waiter of [...this.waiting]) {
			const blocked =
				[...this.unsettled].some((run) => this.conflicts(waiter.node, run.node)) ||
				ahead.some((earlier) => this.conflicts(waiter.node, earlier.node));
			if (blocked) {
				ahead.push(waiter);
				continue;
			}
			this.waiting.splice(this.waiting.indexOf(waiter), 1);
			if (!waiter.parent.alive) {
				waiter.resolve({ status: "aborted" });
				continue;
			}
			this.begin(waiter.node, waiter.args, waiter.parent).then(waiter.resolve);
		}
	}

	private discard(waiter: Waiter) {
		const index = this.waiting.indexOf(waiter);
		if (index >= 0) this.waiting.splice(index, 1);
		waiter.resolve({ status: "aborted" });
	}

	private begin(node: Node, args: unknown, parent: Run): Promise<Outcome> {
		const definition = node.definition as TaskDefinition<unknown>;
		const run = this.newRun(node, parent);
		node.current = run;
		this.unsettled.add(run);
		this.publish();
		const started = now();
		const op = this.operation(run);
		const body = (async (): Promise<Outcome> => {
			try {
				await definition.run(op, args);
				return run.alive ? { status: "completed" } : { status: "aborted" };
			} catch (error) {
				return run.alive && !isAborted(error) ? { status: "failed", error } : { status: "aborted" };
			}
		})();
		return body.then(async (outcome) => {
			this.end(run);
			// Hold the locks until every promise handed to `wait` has settled too.
			while (run.pending.size > 0) await Promise.allSettled([...run.pending]);
			run.settled = true;
			this.unsettled.delete(run);
			run.parent?.children.delete(run);
			this.options.log?.({
				path: node.path,
				revision: run.revision,
				outcome: outcome.status,
				ms: now() - started,
			});
			this.publish();
			this.drain();
			return outcome;
		});
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
		for (const waiter of this.waiting.filter((w) => w.node === node)) this.discard(waiter);
		if (node.current?.alive) this.cancelRun(node.current);
	}

	/** Children first: each descendant run dies and aborts before its parent. */
	cancelRun(run: Run) {
		if (!run.alive) return;
		for (const child of [...run.children]) this.cancelRun(child);
		for (const waiter of this.waiting.filter((w) => w.parent === run)) this.discard(waiter);
		run.alive = false;
		if (run.node.current === run) run.node.current = null;
		run.controller.abort();
		if (run.node.isContainer) run.parent?.children.delete(run);
		this.publish();
	}
}

/** Builds the tree for a definition literal. The root is usually a container named after the app. */
export function defineOperations<const D extends Definition>(
	root: D & { path: string },
	options: Options = {},
): SlotOf<D> {
	const tree = new Tree(options);
	const { path, ...definition } = root;
	tree.root = tree.build(definition as unknown as Definition, path, null);
	return tree.root.slot as unknown as SlotOf<D>;
}
