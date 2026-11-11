# Bridge module proposal: cross-graph consistency under the D797 kernel

2026-11-11, graphrefly:B140 (stage 6 of each runtime's kernel migration). Status: **the user decided
Q1-Q7 on 2026-11-11, every one as recommended, and approved this text with its section 9 the same
day; applied by graphrefly:D803.** This is a non-normative
document: it changes no rule, scenario or model and authorizes no work in a runtime repository. After
the user approves it, the root writes the decision, changes `spec/rules.jsonl`, `spec/conformance.jsonl`,
`spec/protocol.proto` and its fixtures, `formal/` and `reference/modules`, as D798, D801 and D802 did.
Each runtime admits its stage 6 in its own `plan/work.jsonl`.

Inputs: [R-graph-domain@2](../../spec/rules.jsonl), [C-1, C-1a, C-1b, C-1c](../../spec/conformance.jsonl),
[spec/protocol.proto](../../spec/protocol.proto) and `spec/fixtures/protobuf/`, decisions D134, D496,
D497, D501, D506, D558, D560, D561, D562, D797 (the 2026-11-09 sentence on cross-graph consistency),
D798, [formal/README.md](../../formal/README.md) (retired `wave_xgraph.tla`),
[HANDOFF-B140-runtime-owners.md](HANDOFF-B140-runtime-owners.md), graphrefly-rs:D8, graphrefly-ts
`packages/ts/src/adapters/bridge-wire-edge-group.ts` and `batch/` at `ee2595ec`, graphrefly-py
`src/graphrefly/_kernel/graph.py` at `fb583d0`, and `reference/kernel/kernel.mjs`.

## 1. Where things stand (checked 2026-11-11)

- **Rule.** R-graph-domain@2 (kernel, activated by D798) says a graph is one single-thread
  concurrency domain and that the bridge releases every edge of one cause together, as one batch in
  the peer graph. Its rationale calls the announce frame part of the bridge protocol.
- **No model.** `wave_xgraph.tla` was retired at D798 because its two-phase wire gate (DIRTY crossing
  ahead of DATA) does not hold under D797; nothing models R-graph-domain@2.
- **Scenarios.** C-1 (cross-graph diamond) is a kernel scenario and C-1b (WireEdgeGroup) covers no
  rule; both are `todo` everywhere. C-1a (protobuf bytes) and C-1c (ack-timeout) are `pass` for ts
  and rust and `todo` for py since graphrefly-py:D5.
- **Wire.** `WireEdgeFrame` is one frame per edge, kind PENDING (ex-DIRTY, same number) or DATA,
  with a string `cause_id`.
- **The bridge as built (D496-D562).** One static group, one cause in flight, every edge must carry
  PENDING and DATA in every cause, a new cause only from a fresh full cohort (D560, D561), recent
  causes remembered as bounded tombstones (D506), the release cohort drained by the inbound
  projectors before the tombstone (D562). In TS the held stage-6 code reaches the release through an
  internal `_down` and attaches to `bridge.command` with an internal `_rewire`; Rust made the bridge's
  command and inbound computed nodes that rewire themselves from a kept ctx (graphrefly-rs:D8).
- **Graphs on one thread.** The reference kernel and Python keep the wave, the request queue and the
  batch per graph. TS keeps the batch and boundary queue in module variables and Rust in
  `thread_local!`, so two graphs on one thread share them: a request to graph B made during graph A's
  wave waits for A's wave, requests to both share one FIFO, and one batch body commits writes to both
  together (graphrefly-rs:D8 records this as a deviation pending this discussion).

## 2. The model in one paragraph

A cause is one wave of the sender graph. The group's outbound node depends on the group's edges, so
by R-wave it runs at most once per wave, on a consistent set of inputs, and each run in which some
edge brought input forms one cause carrying exactly those edges' arrays. A cause travels as one
frame. In the receiver, each frame arrives as the late output of a node with no dependencies, so it
is one wave; the group's gate checks it, and every inbound node depends on the gate, so all edges of
the cause settle in that one wave and a fan-in over them runs once. Nothing waits across graphs,
nothing is drained by hand, and the kernel's own wave rule gives the grouped release. In C-1: a write
of A is one g1 wave and one cause; its frame is one g2 wave in which B and C run; that wave is one
cause carrying b and c; its frame is one g1 wave in which D runs once.

## 3. Decisions

Each item gives the user's choice, then the alternative that was offered.

**Q1. Kernel rule or module: split.** R-graph-domain@3 stays in the kernel and says only what a
graph is as a domain (section 4). The cause-grouped release moves to a new module rule, R-bridge@1,
which cites only kernel rules, as R-checkpoint does. C-1 and C-1b become module scenarios covering
R-bridge. Reason: the bridge is built entirely from the kernel's public surface, and a runtime
without a bridge should still be able to claim the kernel. Alternative: keep the release in
R-graph-domain and add a model for it.

**Q2. Release semantics.**

- *2a. A cause is one sender wave.* The outbound node's first run in a lifetime brings every edge's
  snapshot and is the session's first cause, which gives D561's "bootstrap" a definition. D560's
  fresh full cohort (send only when every edge updated) is dropped. Alternative: keep the cohort rule.
- *2b. One frame per cause.* `WireEdgeCause` replaces `WireEdgeFrame` and `WireEdgeKind`; there is no
  PENDING frame. An incomplete cause, a duplicate PENDING, DATA before PENDING and competing causes
  can no longer occur. The bytes change, so C-1a's fixtures are rewritten. Alternative: keep one frame
  per edge with PENDING, keeping the bytes and the gate's state machine.
- *2c. An edge carries its arrays.* DATA, INVALIDATE, COMPLETE and ERROR, in written order, as an
  edge inside a graph does, one wave later. Alternative: DATA only, as before, leaving a stale value
  after the sender's INVALIDATE.
- *2d. Numbering.* Causes are numbered from 1 within a session. A cause numbered at or below the last
  one taken (a duplicate, a replay, a retry) is dropped as an issue; this replaces D506's tombstones
  with one number. A cause past the next one is released and the gap is reported. A new session
  starts the count again. Alternative for gaps: fail the group closed until the next session.
- *2e. Refusal and release.* A frame naming an undeclared edge or carrying arrays an inbound node
  could not send is refused whole as an issue. Releasing a group is ending its lifetimes
  (unsubscribing); there is no detach and no drain, since R-wave already delivers the release to
  every inbound node in the one wave (D562's guarantee).

**Q3. Model.** A new `formal/module_bridge.tla`: one-hop configurations with duplicating, losing and
restarting transports, and a round-trip diamond configuration for C-1. Invariants:

| Invariant | Holds that |
|---|---|
| ViewIsSenderState | without a gap, the receiver's inbound values are always the sender's edge values after one sender wave |
| OneWavePerCause | every edge of a released cause settles in one receiver wave |
| AtMostOnce | no cause of a session is released twice |
| InOrder | a session's causes are released in increasing order |
| EventsMatch | each inbound edge receives exactly the arrays its sender edge sent in released causes; an unchanged edge is never sent again |
| QuiescentAgreement | with the channel empty and nothing lost, the receiver's view equals the sender's, also after a restart |
| GapReported | every loss that is followed by a release is reported |
| SameVersion (round trip) | D's two inputs always derive from the same version of A |

Mutations, each expected to trip the invariant named: release each edge as its own wave
(OneWavePerCause, ViewIsSenderState); form a cause per edge occurrence instead of per wave
(ViewIsSenderState, SameVersion); no duplicate check (AtMostOnce, EventsMatch); accept any number
other than the last (InOrder); resend an unchanged edge (EventsMatch); a new session not restarting
the count (QuiescentAgreement); no first cause at activation (QuiescentAgreement); a gap not reported
(GapReported).

**Q4. Not decided now.** These go into the rule as not covered: the transport, its ordering and
delivery, including the envelope layer's acknowledgements, retries and ack-timeout ingress (C-1c);
recovery after a crash, beyond a new session's first cause; exactly-once delivery across sessions
(within one session, the envelope's retries plus the numbering give it); flow control; several
receivers of one group; authentication; value encoding; atomicity across two groups (including two
directions); transactions across graphs; remote calls (D147); edge sets that change; checkpoints of
bridge nodes.

**Q5. Scenarios, and when stage 6 resumes.** C-1 and C-1b are rewritten (section 5). C-1a gets new
fixtures, so its ts and rust arms go back to `todo`. C-1c is unchanged. A new kernel scenario C-47
covers graphs on one thread. Stage 6 resumes in all three runtimes when the decision activating
R-bridge@1 and R-graph-domain@3 has landed with the rules, scenarios, proto, fixtures, model and
reference module, and the root's checks pass; the alignment session then tells the three owners.

**Q6. Graphs on one thread share no wave.** Each graph has its own wave, request queue and batch. A
request to graph B made during graph A's wave runs at once if B is idle; a write to B inside A's
batch body is B's own request, not part of A's commit. Graphs may share a thread, a dispatcher's
function table and worker pools. Consistency across graphs goes only through the bridge. Reason: if
the thread were the domain, the same two graphs would behave differently depending on whether they
share a thread, which "a graph is one domain" exists to exclude. The reference kernel and Python
already do this; TS and Rust change. Alternatives offered: make the thread the domain; refuse a write
to another graph inside a batch body.

**Q7. Shape in the new kernel, and the held internal code.**

- Receiving: a node with no dependencies whose setup opens the receiving end of the transport and
  whose late `ctx.down` sends each received frame, as a timer source does.
- Sending: the group's outbound node sends each cause as one DATA value; a sink subscribed to it
  hands the frames to the transport.
- No command fan-in for edge groups. TS's `_rewire` of `bridge.command` and the inbound, TS's
  `_down` into `releaseCohorts` with its drain check, and Rust's `FanInSources` for the bridge's
  command and inbound are removed in stage 6, with no shim. The envelope layer's remote-call and
  ack-timeout lanes take the same shape: received envelopes from a source node, facts as state
  writes, and outbound nodes with a transport sink.
- The reference module fixes the public names and shapes, and the three runtimes follow them.
  Whether Rust's `FanInSources` stays for the process command input and the message bus is Rust's,
  outside this proposal.

## 4. Rule drafts

**R-graph-domain@3** (kernel, area runtime; revises @2):

> A graph is one single-thread concurrency domain: the unit of concurrency, not the bound of causal
> influence. Inside it, propagation is one synchronous wave at a time (R-wave), so a fan-in, a diamond
> included, runs once on a consistent set of its inputs. Each graph has its own wave, request queue and
> batch, and graphs share none of them: a request to one graph is never held by another graph's wave
> or batch, and a write to another graph inside a batch body is that graph's own request, not part of
> the batch's commit. Graphs may share a thread, a dispatcher's function table and worker pools.
> Disjoint waves in one graph do not run in parallel; compute parallelism is by pool callbacks whose
> results come back as later waves (R-wave), and true parallelism is by several graphs. A graph
> affects another only as a host of it, through host inputs or a node's late output in that graph;
> consistency across graphs is the bridge module's (R-bridge).

Rationale: R-graph-domain@2 put the bridge's grouped release in the kernel; it moves to R-bridge@1.
Per-graph wave state is stated because TS and Rust shared it across the graphs of one thread, so one
graph's wave or batch held another's requests (graphrefly-rs:D8), and the user chose that graphs on
one thread are as independent as graphs on different threads (2026-11-11).

**R-bridge@1** (module):

> A wire bridge carries edges from one graph, the sender, to another, the receiver, in edge groups. A
> group has a name and a fixed set of edge ids, declared on both sides; each names one node in the
> sender and one inbound node in the receiver. The group's outbound node in the sender depends on the
> group's edges, under manual COMPLETE, ERROR and INVALIDATE policies, and sends each cause as one
> DATA value, a frame; carrying frames to the receiver is the transport's. A run of the outbound node
> in which some edge brought input forms one cause, so a cause is one sender wave. It carries, for each
> edge that brought input, the arrays it brought, in order, holding only DATA, INVALIDATE, COMPLETE
> and ERROR: PENDING, RESOLVED and START are each kernel's own and do not cross. A session is one
> lifetime of the outbound node, named by an id its setup makes. Its causes are numbered from 1, and
> its first cause, from the first run, carries every edge's snapshot and an INVALIDATE for an edge
> without one. DATA values and ERROR payloads cross as bytes, which the application encodes; any other
> value is a throw of the outbound node. In the receiver, frames arrive as the late output of a node
> with no dependencies whose setup opens the receiving end, so each frame is one wave, and the group's
> gate takes the frames that bear its name. Releasing a cause, the inbound node of each edge it
> carries sends that edge's arrays in that wave and every other inbound node sends nothing, so a
> fan-in over a group's inbound nodes, including a diamond split across graphs, runs once on the
> values of one sender wave. An inbound node's snapshot is what its edge last brought: the last
> released array of the edge that carried DATA, then its terminal, whichever frames carried them. The
> gate releases a session's causes in order and each at most once. A cause numbered at or below the
> last one taken is dropped; a cause past the next one is released, and the gap is reported; a frame
> of a new session starts the count again. A frame that names an undeclared edge, or carries arrays its
> inbound node could not send as its own output (a kernel-only message, or an array after the edge's
> terminal), is refused whole, and its number is taken. Drops, gaps and refusals are issues: values of
> the group's issues node in the receiver, never a terminal of an inbound node. The bridge sets no
> timer, keeps no wave open across graphs and sends nothing up either graph. Not covered: the
> transport and its ordering and delivery, including the envelope layer's acknowledgements and
> retries; recovery after a crash beyond a new session's first cause; exactly-once delivery across
> sessions; flow control; several receivers of one group; authentication; atomicity across two
> groups; transactions across graphs; remote calls; edge sets that change; checkpoints of bridge nodes.

Rationale: module rule (D797) over R-wave, R-lifetime and R-invocation. A cause is a sender wave
because the outbound node, a fan-in, runs once per wave on a consistent set (the user, 2026-11-11);
one frame per cause removes the per-edge announce frames that D798 renamed PENDING, and with them
every incomplete or interleaved cause. Replaces D496's per-edge frames and one cause in flight,
D560's and D561's cohort rules, D506's tombstones and D562's drain; keeps D134 (no remote ordinary
dependency, no wave open across graphs), D501's static single-direction groups and D558's
graph-visible issues without terminals.

## 5. Scenario drafts

**C-1** (rewritten; covers R-bridge, R-graph-domain, R-wave):

- Topology: A and D in g1; B and C in g2. Group `ga` carries edge a (A) from g1 to g2; B and C depend
  on its inbound a. Group `gbc` carries edges b (B) and c (C) from g2 to g1; D depends on its inbound b
  and c. This is a diamond split across two single-threaded graphs. The test carries each group's
  frames by hand.
- Input: subscribe D, which opens both sessions, and deliver the first causes. Write A and deliver
  each frame. Write A twice more, holding `gbc`'s frames back, then deliver the two together.
- Expect: the first causes carry the values at subscription, so D starts on B's and C's values over A.
  Each write of A is one g1 wave and one `ga` cause. Its delivery is one g2 wave in which B and C each
  run once, and `gbc` sends one cause carrying both b and c. That cause's delivery is one g1 wave in
  which D runs once, on B's and C's values from the same A, and its sinks get one array; D never runs
  on one new and one old leg. The two held causes are delivered as two g1 waves, in order.

**C-1b** (rewritten; covers R-bridge):

- Topology: a sender graph with an outbound group over edges x and y (state nodes); a receiver graph
  with the inbound group for x and y, a fan-in F over inbound x and y, and the issues node. The test
  carries frames by hand and can hand the receiver frames it builds.
- Input:
  - Open the session and deliver the first cause.
  - Write x. Write x, then y, in separate waves. Write x and y in one batch. Let x's node send two
    arrays in one wave. Invalidate x and complete y.
  - End the outbound node's lifetime and open a new one while x has no value.
  - Hand the receiver: a duplicate of a released cause; an older cause; a cause two past the last; a
    frame with an undeclared edge; one with PENDING or RESOLVED in an array; one with an array after an
    edge's terminal; one bearing another group's name.
  - After a cause that carried only x, subscribe a new sink to inbound y.
- Expect:
  - The first cause carries x's and y's snapshots.
  - Each sender wave in which an edge sent is one cause, carrying only the edges that sent, with
    their arrays in order; two arrays stay two.
  - Each delivery is one receiver wave: the carried edges send their arrays from their inbound nodes,
    the others send nothing, and F runs once. The INVALIDATE and the COMPLETE arrive as the inbound
    nodes' own.
  - The new session starts the count at 1, and its first cause carries an INVALIDATE for x.
  - The duplicate and the older cause are dropped. The cause two past the last is released, and the
    gap is reported. The three bad frames are refused whole and their numbers are taken. The frame
    bearing another group's name is ignored by this group.
  - Each drop, gap and refusal is a value of the issues node; no inbound node ends or fails because
    of one.
  - The new sink on inbound y gets y's last released value.
  - No timer is set, and nothing goes up either graph.

**C-1a** (inputs and fixtures change; ts and rust back to `todo`): the canonical bridge envelope and
`WireEdgeCause` fixtures round-trip to the same bytes, and malformed bytes fail closed as issues.
`wire_edge_frame.v1.jsonl` is replaced by `wire_edge_cause.v1.jsonl`, and the envelope fixtures with a
wire-edge payload are regenerated.

**C-47** (new, kernel; covers R-graph-domain, R-request-order, R-checkpoint):

- Topology: graphs g1 and g2 on one thread. In g1, state a with sink s1, and state c. In g2, state b
  with sink s2.
- Input:
  - Write a. During a's wave, s1 writes b. After that write returns, s1 captures checkpoints of g1 and
    of g2.
  - During b's wave, s2 writes c.
  - In one g1 batch body, write a, then b, and read b before the body returns.
- Expect:
  - The write of b is not held by g1's wave: b's wave runs at once, inside s1's callback, and s2 sees
    b's new value before a's wave ends.
  - The capture of g1, which is in its wave, is refused. The capture of g2, which is idle, succeeds.
  - The write of c waits for g1's wave to end and then runs as g1's next request.
  - In the batch, the write of b is g2's own request: it runs at once and the read sees b's new
    value. Only the write of a commits, when the body returns.

## 6. Wire changes (`spec/protocol.proto`)

```proto
message WireEdgeCause {
  string group = 1;
  string session = 2;
  uint64 cause = 3;
  repeated WireEdgeArrays edges = 4;
}
message WireEdgeArrays {
  string edge_id = 1;
  repeated Wave arrays = 2;   // each Wave holds only DATA, INVALIDATE, COMPLETE, ERROR
}
```

`WireBridgeDataPayload` gets `WireEdgeCause edge_cause = 3`, reserving field 2 and the name
`wire_edge`. `WireEdgeKind` and `WireEdgeFrame` are deleted. The existing `Message` and `Wave`
messages are reused.

## 7. What the root changes after approval

1. A decision D803: activate R-bridge@1, revise R-graph-domain@2 to @3, record the choices above,
   and name D496, D506 (tombstones), D560, D561 and D562 as superseded in part.
2. `spec/rules.jsonl`, `spec/conformance.jsonl` (C-1, C-1a, C-1b, C-47), `spec/protocol.proto` and
   `spec/fixtures/protobuf/`.
3. `formal/module_bridge.tla` with its configs, invariants and mutations (Q3), and the formal README
   rows.
4. `reference/modules/bridge.mjs` and its tests (`wireEdgeGroupOut`, `wireEdgeGroupIn`, and an
   in-memory channel test double), plus a reference-kernel test for C-47.
5. The handoff gains a "Bridge after D803" section listing each runtime's stage-6 deltas (section
   8), and the root's checks are run.

## 8. Each runtime's stage 6 (contract level)

- **All:** implement R-bridge@1 with the reference shapes; delete the per-edge frame, the PENDING
  frame kind, tombstones, the cohort rules, the drain and the status node; qualify C-1, C-1a, C-1b
  and C-47.
- **TS:** remove `_rewire` of `bridge.command` and the inbound, and `_down` into `releaseCohorts`;
  move the batch and boundary queue from module variables to the graph.
- **Rust:** remove the bridge's `FanInSources` command and inbound; move the wave scope, request
  queue and batch frame from `thread_local!` to the graph, which retires graphrefly-rs:D8's recorded
  deviation.
- **Python:** the kernel already keeps its state per graph; it brings back the wire facades it
  withdrew at graphrefly-py:D5, in the new shape, and then requalifies C-1a and C-1c.

## 9. Added while writing, not discussed: for the user's review

Each item below survived a check for whether it could be dropped.

1. **The frame names its group.** Without the name, two groups on one channel would each see the
   other's frames as a new session. Alternative: a channel carries one group, and the transport
   demultiplexes.
2. **The session is the outbound node's lifetime, not the receiving node's.** The Q7 question said
   "session = the inbound source's lifetime". The numbering has to restart where the counter lives,
   which is the sender. The receiving node's lifetime is only the connection.
3. **A session's first cause carries an INVALIDATE for an edge without a value.** Without it, a value
   from the previous session would stay on the receiver after a restart, and QuiescentAgreement would
   fail.
4. **An inbound node's snapshot comes from what the gate has released so far,** not only from the
   last frame. Otherwise a sink subscribed after a frame that did not carry its edge would get
   nothing.
5. **A value or ERROR payload that is not bytes is a throw of the outbound node.** That is the
   sender's ERROR, which ends the session. Typed runtimes cannot reach this. Alternative: report it
   as a sender-side issue, which would need a second output on the sender.
6. **A refused frame's number counts as taken,** so the next frame is not reported as a gap.
7. **The group's status node is removed;** issues remain. Status held the active cause and its
   PENDING and DATA counts, none of which exists any more.
8. **A frame bearing another group's name is ignored silently.** It is not this group's issue.

## 10. After activation: ended inbound edges (D804)

Added 2026-11-11. graphrefly-py's stage 6 found that R-bridge@1 refused a new session's first cause
whole when an edge had ended on the receiver: the cause repeats that edge's snapshot and terminal,
which @1 called an array after the edge's terminal, so the INVALIDATE the same cause carried for an
edge without a value (item 3 of section 9) was lost. The user chose:

- **Skip, in any frame, the arrays of an inbound edge that has ended, and release the rest.** The skip
  is an issue only when those arrays do not end with a terminal (the sender's edge goes on while the
  receiver's has ended). Refusal whole stays for frames no node could send. Alternatives offered:
  refuse whole as @1 did; skip only in a new session and report every skip.
- **Model terminals.** `module_bridge.tla` gains COMPLETE. Writing it found that @1 gave the
  INVALIDATE only to an edge without any snapshot, against item 3's wording (an edge without a
  value): an edge that had lost its value and ended came back ended with the old value. R-bridge@2
  fixes that too.

