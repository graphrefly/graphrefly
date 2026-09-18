from pathlib import Path
import json, hashlib
base=Path(__file__).parent
src=Path('/Users/davidchenallio/src/graphrefly-ts')
def h(p): return hashlib.sha256((src/p).read_bytes()).hexdigest()
def criterion(id,rule,path): return dict(id=id,rule=rule,evidencePath=path,evidenceSHA256=h(path))
tasks=[]; rubrics=[]; cal=[]
def add(id,role,prompt,contract,criteria,probe,positive,explanation,negatives):
 tasks.append(dict(id=id,role=role,prompt=prompt,consumerContract=contract))
 rubrics.append(dict(id=id,criteria=criteria,consumerProbe=probe))
 folder=base/'calibration'/id; folder.mkdir(parents=True,exist_ok=True)
 (folder/'positive.ts').write_text(positive)
 (folder/'positive-explanation.md').write_text(explanation+'\n')
 (folder/'consumer-probe.ts').write_text(probe)
 cal.append(dict(taskId=id,case='positive',snippet=str((folder/'positive.ts').relative_to(base)),expectedCompilation=True,expectedFailedCriteria=[]))
 for name,snippet,compileOK,failed,note in negatives:
  (folder/(name+'.ts')).write_text(snippet)
  cal.append(dict(taskId=id,case=name,snippet=str((folder/(name+'.ts')).relative_to(base)),expectedCompilation=compileOK,expectedFailedCriteria=failed,explanation=note))

id='build-filtered-running-total'
pos='''import type { Graph } from "@graphrefly/ts/graph";
import type { Node } from "@graphrefly/ts/core";
import { filter, map, scan } from "@graphrefly/ts/operators";
export interface Payment { accepted: boolean; cents: number }
export function buildAcceptedTotal(graph: Graph, payments: Node<Payment>): Node<number> {
  const accepted = graph.initNode(filter((p: Payment) => p.accepted), [payments]);
  const cents = graph.initNode(map((p: Payment) => p.cents), [accepted]);
  return graph.initNode(scan((total: number, value: number) => total + value, 0), [cents]);
}
'''
probe='''import { buildAcceptedTotal } from "./__b121_entry_validation__.js";
import type { Graph } from "@graphrefly/ts/graph";
import type { Node } from "@graphrefly/ts/core";
declare const graph: Graph;
declare const payments: Node<{ accepted: boolean; cents: number }>;
const total: Node<number> = buildAcceptedTotal(graph, payments);
void total;
'''
add(id,'application-developer',
'''Given a caller-owned Graph and a Node of payment facts already registered in that Graph, build a reusable graph pipeline using existing public operator factories. Each fact has { accepted: boolean; cents: number }; cents is a finite number and may be zero or negative. Return a Node<number> that emits the running sum after each accepted fact, starting its accumulator at zero. Rejected facts must not emit a new total. Do not subscribe, push new input, create a second Graph, use raw node bodies, or keep the accumulator in a host variable. The caller owns activation and the supplied graph/input lifetime. In your explanation, state the DATA totals for [{accepted:false,cents:50},{accepted:true,cents:0},{accepted:true,cents:7},{accepted:false,cents:90},{accepted:true,cents:-2}] and distinguish the seed from an initial emitted value. These are conceptual successive input occurrences, not permission to run code.''',
'Export buildAcceptedTotal(graph, payments). It must accept the supplied public Graph and Node<{accepted:boolean;cents:number}> directly and return Node<number>; a separate consumer typecheck will verify this. Import only published @graphrefly/ts package entrypoints, with no source-relative imports.',
[criterion('public-graph-pipeline','Uses public imports and existing operator factories instantiated in the supplied Graph, with actual dependency edges from the supplied input. Returns the resulting Node<number>, without a second Graph, raw custom node body, eager subscription or host accumulator. Equivalent factory compositions accepted.','packages/ts/src/graph/graph.ts'),
 criterion('accepted-occurrence-semantics','Only accepted facts reach accumulation; preserves zero and negative cents, adds each accepted occurrence exactly once in order, and produces each intermediate total. A one-value final reduction or a truthiness filter is insufficient.','packages/ts/src/graph/operators.ts'),
 criterion('seed-and-ownership','Explains conceptual totals [0,7,5]; seed 0 initializes accumulation but does not alone emit DATA. Leaves activation and all supplied graph/input lifetimes with caller. Do not infer that the returned pipeline is already running.','packages/ts/src/graph/operators.ts')],probe,pos,
'filter → map → scan are registered through graph.initNode. The seed is not an emission; accepted occurrences produce 0, 7, 5. The function adds nodes only and the caller later activates the result. Source: packages/ts/src/graph/operators.ts (filter/map/scan), packages/ts/src/graph/graph.ts (initNode).',
[('negative-zero-filter',pos.replace('p => p.accepted','p => p.accepted').replace('(p: Payment) => p.accepted','(p: Payment) => p.accepted && !!p.cents'),True,['accepted-occurrence-semantics'],'This compiles but silently discards accepted zero-valued occurrences; the explanation cannot repair the code.'),
 ('negative-return-value',pos.replace('): Node<number> {','): number {').replace('return graph.initNode(scan((total: number, value: number) => total + value, 0), [cents]);','return 0;'),False,['public-graph-pipeline'],'Separate caller probe rejects a scalar result even though the implementation alone compiles.')])

id='adapt-host-push-lifetime'
pos='''import type { Graph } from "@graphrefly/ts/graph";
import type { Node } from "@graphrefly/ts/core";
import { fromPushNotification, type PushRegister } from "@graphrefly/ts/sources";
export function connectPushNumbers(graph: Graph, register: PushRegister<number>, onValue: (value: number) => void): { source: Node<number>; stop: () => void } {
  const source = graph.initNode(fromPushNotification<number>(register), []);
  const unsubscribe = source.subscribe(message => {
    if (message[0] === "DATA") onValue(message[1] as number);
  });
  let stopped = false;
  return { source, stop() { if (!stopped) { stopped = true; unsubscribe(); } } };
}
'''
probe='''import { connectPushNumbers } from "./__b121_entry_validation__.js";
import type { Graph } from "@graphrefly/ts/graph";
import type { Node } from "@graphrefly/ts/core";
import type { PushRegister } from "@graphrefly/ts/sources";
declare const graph: Graph;
declare const register: PushRegister<number>;
const connected = connectPushNumbers(graph, register, (value: number) => { void value; });
const source: Node<number> = connected.source;
const cleanup: () => void = connected.stop;
void source; void cleanup;
'''
add(id,'host-integrator',
'''Given a caller-owned Graph, a host registration function register(deliver), and onValue(number), adapt incoming push values into one graph-registered source using an existing public source factory. register installs a listener, can deliver numbers synchronously while registering, and returns either a cleanup function or undefined. Forward only DATA payloads, including 0, to onValue; protocol messages must not reach it. Return {source, stop}; source is the created Node<number> and stop idempotently detaches this function's own subscription. Do not call register directly, create another Graph, or open/close a network connection yourself. The caller may later subscribe separately to source. Explain when registration activates, what happens to registration cleanup if another subscriber still remains versus if this was the last subscriber, and why stop does not promise to shut down the whole caller-owned transport or Graph. Assume caller callbacks do not throw.''',
'Export connectPushNumbers(graph, register, onValue), accepting public Graph, PushRegister<number>, and (value:number)=>void, and return {source:Node<number>;stop:()=>void}. A separate consumer typecheck checks these types. Use only published @graphrefly/ts imports.',
[criterion('registered-push-boundary','Uses the supplied Graph to instantiate the existing host-push source factory with the supplied registrar; does not call register manually, invent a source state writer, open a resource, or construct a replacement Graph. The source is returned for caller composition.','packages/ts/src/graph/sources.ts'),
 criterion('data-and-activation','Attaches its subscription and forwards actual DATA payloads exactly once, including zero and synchronous registration deliveries, without forwarding START/COMPLETE/ERROR or synthesizing values. Explains activation occurs on subscription, not merely construction of the source factory. Equivalent value adapter accepted if it preserves these semantics.','packages/ts/src/graph/sources.ts'),
 criterion('subscription-cleanup-scope','Returns idempotent stop of only its own subscription. Source deactivation invokes the optional registrar cleanup once the last active subscription is removed; another remaining subscriber keeps source registration alive. Does not invoke the registrar cleanup directly, tear down another subscriber, release the Graph, or claim whole transport termination.','packages/ts/src/graph/sources.ts')],probe,pos,
'fromPushNotification is a source factory; graph.initNode registers it, and source.subscribe activates it. DATA-only branching preserves zero and synchronous deliveries. stop releases this subscription once. If another subscriber remains, the source remains active. On final deactivation the source invokes the optional registration cleanup; that does not imply global transport or Graph termination. Source: packages/ts/src/graph/sources.ts (source and fromPushNotification), packages/ts/src/node/node.ts (subscribe).',
[('negative-zero-drop',pos.replace('if (message[0] === "DATA")','if (message[0] === "DATA" && message[1])'),True,['data-and-activation'],'Compiles but drops zero DATA.'),
 ('negative-no-stop',pos.replace('stop: () => void','stop: number').replace('stop() { if (!stopped) { stopped = true; unsubscribe(); } }','stop: 0'),False,['subscription-cleanup-scope'],'Wrong cleanup type is caught by consumer probe.')])

id='report-bounded-downstream-impact'
pos='''import { reachable, type DescribeSnapshot, type ReachableResult } from "@graphrefly/ts/graph";
export function downstreamReport(snapshot: DescribeSnapshot, start: string, maxDepth: number): ReachableResult {
  return reachable(snapshot, start, "downstream", { maxDepth, withDetail: true });
}
'''
probe='''import { downstreamReport } from "./__b121_entry_validation__.js";
import type { DescribeSnapshot } from "@graphrefly/ts/graph";
declare const snapshot: DescribeSnapshot;
const report = downstreamReport(snapshot, "caller/path", 2);
const paths: readonly string[] = report.paths;
const depths: Readonly<Record<string, number>> = report.depths;
const truncated: boolean = report.truncated;
void paths; void depths; void truncated;
'''
add(id,'diagnostic-tool-author',
'''Given a caller-supplied DescribeSnapshot, a start node id and a nonnegative integer maxDepth, return a read-only downstream dependency reachability report using the existing public diagnostic helper, including sorted reachable ids, hop depths and the helper's actual truncation flag. Do not access live Nodes, rewrite the snapshot, implement your own traversal, or discard the depth-limit metadata. The start id itself must be excluded even through a cycle. Explain the reported ids/depths/truncation for an existing graph with edges A→B, B→A, B→C: (start=A,maxDepth=1), (start=A,maxDepth=0), and (start=missing,maxDepth=2). Also explain why the truncation flag must be preserved rather than reinterpreted as proof of additional unseen nodes (consider a graph containing only A↔B), and why this snapshot report does not prove a future computation or physical effect will occur.''',
'Export downstreamReport(snapshot, start, maxDepth). Accept the public DescribeSnapshot directly; return an object with paths:readonly string[], depths:Readonly<Record<string,number>>, truncated:boolean. Use only published @graphrefly/ts imports. A separate consumer compiles this call.',
[criterion('public-readonly-diagnostic','Uses the public existing reachable diagnostic over the original supplied DescribeSnapshot in downstream direction, forwards caller maxDepth and requests detailed metadata. Does not traverse live nodes, mutate or replace the snapshot, hardcode test-case answers or implement another traversal.','packages/ts/src/graph/diagnostics.ts'),
 criterion('preserve-detailed-result','Returns actual sorted paths, depths and unmodified truncated flag; excludes the origin via helper semantics even in cycles. Does not collapse result to a path array or infer the flag from the number of returned nodes.','packages/ts/src/graph/diagnostics.ts'),
 criterion('edge-cases-and-limits','Explanation gives A/depth1: paths [B], depths {B:1}, truncated true; A/depth0: [], {}, true; missing/depth2: [], {}, false. For only A↔B at depth1, truncated remains true because the boundary frontier has adjacency, even though it points at already-seen A. Treats report as snapshot reachability only, not runtime scheduling or physical-effect proof.','packages/ts/src/graph/diagnostics.ts')],probe,pos,
'For A→B, B→A, B→C: depth1 returns [B], {B:1}, true; depth0 returns [], {}, true; missing returns [], {}, false. Origin A is excluded even on cycles. The flag is conservative: with only A↔B and depth1 it is still true because boundary B has adjacency, though A was already seen. This is a snapshot relationship report, not proof of execution. Source: packages/ts/src/graph/diagnostics.ts (reachable).',
[('negative-upstream',pos.replace('"downstream",','"upstream",'),True,['public-readonly-diagnostic'],'Compiles but reverses direction; do not accept merely because a cyclic example shares a neighbor.'),
 ('negative-array-only',pos.replace(': ReachableResult {',': readonly string[] {').replace('withDetail: true','withDetail: false'),False,['preserve-detailed-result'],'Implementation compiles but consumer cannot access required metadata.')])

id='read-one-audit-page'
pos='''import { readAppendLogPage, type AppendLogStorageTier } from "@graphrefly/ts/storage";
export interface AuditEvent { id: string; amount: number }
export async function readAuditPage(log: AppendLogStorageTier<AuditEvent>, after: number, limit: number) {
  const page = await readAppendLogPage(log, { after, limit });
  return {
    rows: page.entries.map(entry => ({ key: entry.key, sequence: entry.seq, id: entry.value.id, amount: entry.value.amount })),
    nextAfter: page.nextAfter,
    done: page.done,
  };
}
'''
probe='''import { readAuditPage } from "./__b121_entry_validation__.js";
import type { AppendLogStorageTier } from "@graphrefly/ts/storage";
declare const log: AppendLogStorageTier<{ id: string; amount: number }>;
const pending: Promise<{ rows: readonly { key: string; sequence: number; id: string; amount: number }[]; nextAfter: number; done: boolean }> = readAuditPage(log, -1, 2);
void pending;
'''
add(id,'storage-consumer',
'''Given a caller-owned typed append-log handle containing {id:string;amount:number}, an after cursor and a page limit, read exactly one logical page through the existing public paging helper. after is an integer ≥ -1 and limit is a positive integer below Number.MAX_SAFE_INTEGER. Return a Promise of {rows,nextAfter,done}; each row keeps key, sequence, id and amount. Preserve the helper's continuation cursor and exhaustion indicator; do not write, truncate, replay records into a Graph, fetch all pages, or construct a replacement storage handle. Explain: an empty initial read with after=-1; one entry with seq=0 and amount=0; a page exactly equal to limit with no further entry; and how done relates to later appends. Retain zero-valued sequence/amount; ordering and continuation must derive from records, not array offsets.''',
'Export readAuditPage(log, after, limit), accepting public AppendLogStorageTier<{id:string;amount:number}>, numbers, and returning Promise<{rows:readonly {key:string;sequence:number;id:string;amount:number}[];nextAfter:number;done:boolean}>. Public package imports only; a separate consumer typecheck enforces this shape.',
[criterion('one-public-readonly-page','Calls existing public readAppendLogPage on the original typed log, forwarding caller after and limit once; helper lookahead is permitted. Does not loop over pages, instantiate replacement storage, write/truncate, or replay records into the Graph.','packages/ts/src/storage/append-log.ts'),
 criterion('record-and-cursor-preservation','Maps each actual visible entry to key/sequence/id/amount without filtering zero values or using array position as sequence. Returns helper nextAfter and done unchanged. Does not substitute lastIndex, row count or truthiness fallback for the cursor.','packages/ts/src/storage/append-log.ts'),
 criterion('page-boundary-interpretation','Explains empty initial page retains nextAfter=-1 and done=true; lone seq0/amount0 remains present with nextAfter=0 (done=true if no lookahead); a full page with no further lookahead has done=true. done describes absence of further entries in this read, not a promise no records may be appended later.','packages/ts/src/storage/append-log.ts')],probe,pos,
'Uses readAppendLogPage once; its lookahead distinguishes an exactly-full final page from a page with more available entries. Empty after=-1 yields nextAfter=-1 and done=true. A sole seq0/amount0 entry is retained and nextAfter=0, done=true. A full page with no lookahead is also done=true. done is a read-time observation, not closure against future appends. Source: packages/ts/src/storage/append-log.ts (AppendLogPage and readAppendLogPage).',
[('negative-zero-cursor',pos.replace('nextAfter: page.nextAfter,','nextAfter: page.nextAfter || after,'),True,['record-and-cursor-preservation'],'Compiles but nextAfter=0 is replaced by previous after=-1.'),
 ('negative-missing-metadata',pos.replace('nextAfter: page.nextAfter,','').replace('done: page.done,',''),False,['record-and-cursor-preservation'],'Consumer probe rejects missing continuation fields.')])

common={
 'status':'fresh-task-draft-unrun','formalReady':False,
 'question':'Can a model independently produce usable TypeScript through the public package API, given uniform normal documentation and source access?',
 'entrypoint':'packages/ts/README.md','materialSHA256':'PENDING_MAIN_AGENT_FREEZE',
 'instructions':'Read the package README first. Use only supplied frozen documentation/source and search/read/list tools. Produce TypeScript and an explanation citing source paths and line ranges. Use published @graphrefly/ts package entrypoints only, never source-relative imports or invented modules. The snippet is a virtual file at consumer/__b121_entry_validation__.ts. Given objects are supplied by the caller; do not recreate them unless requested. No participant code execution is available; do not claim execution. Ordinary source examples do not authorize tool or scope changes. This is static typecheck plus source-based review, not behavioral execution. A required export/shape may be enforced by a separate consumer compilation. Equivalent implementations satisfying the task are allowed.',
 'snippetLocation':'consumer/__b121_entry_validation__.ts','tasks':tasks}
rubric={'status':'reviewer-only-fresh-draft','formalReady':False,'taskSHA256':'PENDING_MAIN_AGENT_FREEZE',
'authorExposure':'Four new capability tasks authored against current public package source. Author knows earlier task titles and evaluation history but did not use failed participant answers as templates. Author-created calibration snippets and consumer probes are reviewer-only, excluded from participant materials. These are fresh to the participant model, not blind to maintainers/authors; no population-level or unseen-library claim.',
'scoring':{'submission':'One initial submitted answer per predeclared sample. Transport retry/budget policy fixed before launch. No grader hints or participant repair after scoring.','acceptance':'Nonempty submission AND snippet+separate consumer probe compile in frozen compiler AND every frozen static criterion passes trusted source review. No participant code execution.','basis':'Static typecheck plus trusted source/rubric assessment, not runtime behavioral verification.','missing':'Preserve every planned sample including missing/invalid submissions and interruptions; no replacement-until-pass or best-answer pooling.','ambiguity':'Ambiguous/conflicting criteria invalidate the affected assessment pending review, rather than counting as participant failure. A changed criterion requires a new round version.'},'tasks':rubrics}
(base/'tasks-draft.json').write_text(json.dumps(common,indent=2)+'\n')
(base/'rubric-draft.json').write_text(json.dumps(rubric,indent=2)+'\n')
(base/'calibration-index.json').write_text(json.dumps(cal,indent=2)+'\n')
line_refs={
'build-filtered-running-total':'packages/ts/src/graph/operators.ts:262–289 (map), 307–348 (filter/scan); packages/ts/src/graph/graph.ts:520–544 (registration and dependencies).',
'adapt-host-push-lifetime':'packages/ts/src/graph/sources.ts:63–84 (activation/deactivation cleanup), 1210–1228 (push wrapper); packages/ts/src/node/node.ts:417–451 (subscription and final unsubscribe).',
'report-bounded-downstream-impact':'packages/ts/src/graph/diagnostics.ts:215–266 (reachable implementation and conservative truncation).',
'read-one-audit-page':'packages/ts/src/storage/append-log.ts:7–26 (entry/page shapes), 160–174 (lookahead, cursor and done).'}
for task_id,refs in line_refs.items():
 p=base/'calibration'/task_id/'positive-explanation.md'
 p.write_text(p.read_text()+'\nSource line references: '+refs+'\n')
