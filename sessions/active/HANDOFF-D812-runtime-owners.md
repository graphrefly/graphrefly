# Handoff to the runtime owners: recovery and invalidation after the DS-20 review (D812)

Written by Claude on 2026-11-18 for [graphrefly:B145](../../plan/backlog.jsonl), at the user's
request. This is a brief, not a rule, a decision or a work item. Each runtime owner (graphrefly-ts,
graphrefly-rs, graphrefly-py) admits its own slice in its own `plan/work.jsonl`, when the user
decides, and writes its own work body there. Nothing here dispatches implementation.

Revised 2026-11-19 after an independent QA of the root work, before this brief reached anyone: the
rule rows, D812 and the scenarios were corrected in place, and items 1, 3 and 6 below changed with them.
Revised again that day after a second QA: items 4, 5 and 6 and one table row said what the rules do not.
And once more with the wording the user confirmed for that QA's open points: items 1, 3, 5 and 7.
And a last time that day, on the user's audit of what the branch added or kept without need: capture's
one order (item 1), latestAsync's one form (item 4), and, taken out, a sentence of R-node@3 on a
build of several nodes and a revision 3 of R-bridge (item 3).
And after a third QA, with wording the user confirmed: the bridge sentence is conditional (items 1
and 3), a restored graph's creation order (item 1), what an unhandled refusal is where a request
returns its failure (item 3), and where latestAsync stands (item 4).

## What changed at the root

[graphrefly:D812](../../decisions/decisions.jsonl) records six choices the user made on the independent
review of DS-20. Read the rules themselves with `npm run rules:current -- module --drafts` and
`npm run rules:current -- kernel`; this table only names what moved.

| Rule | State | Change |
|---|---|---|
| R-checkpoint@2 | active (was @1) | capture refuses a local-only node, and a recipe without a reference, naming the first node in creation order that cannot be saved; pending work a node recorded in private state is reopened by its setup; restore names the reference of a missing recipe; a graph that holds nodes a module built without recipes cannot be captured |
| R-node@3 | active (was @2) | a graph may be created to require a recipe on every computed instance |
| R-history@1 | draft, rewritten in place | the auto INVALIDATE policy: an INVALIDATE removes the value and keeps the list |
| R-restart@1 | draft, rewritten in place | a restored pending retry waits its delay in full, for the same attempt |
| R-request-order@3, R-failure | unchanged by D812 (R-failure is at revision 4 since graphrefly:D814, below) | R-node@3 alone says that the refusal is made when the request is made and what a refused replace leaves; R-failure says what an unhandled failure in a function is, and R-request-order does not say when replace's refusals are made |

## What a runtime now does differently

1. **Capture refuses a local-only node.** A computed node built or replaced without a recipe makes
   capture fail with the shared `localOnly` reason, naming the node. Until now capture wrote
   `local: true` and restore failed. One order: go through the nodes in creation order and refuse
   the first that cannot be saved, naming it. Within one node check its values, private state,
   received values, payloads and recipe configuration first, so a local-only node that also holds
   what is not JSON is refused for that (D808 (5)), and then its recipe. A local-only node made
   before a node that holds what is not JSON is therefore the one named. (For some hours of
   2026-11-19 this said every JSON refusal comes first for the whole graph; the user dropped that
   the same day, before anyone followed it.) A recipe that was given but has no reference (`{}`,
   `false`, `{ ref: "" }`: a reference is a non-empty string) is refused in the same place with the
   existing `missingRecipe` reason alone,
   no reference after it; restore refuses a checkpoint that holds one and names the node (the reference gives the same reason there; no rule or scenario fixes it). A checkpoint that already holds a local-only node still fails at
   restore. A graph that holds nodes a module built without recipes cannot be captured. The
   reference's wire bridge group is one. Whether your bridge's nodes carry recipes is yours:
   R-bridge@2 leaves checkpoints of bridge nodes not covered, so whether a bridged graph can be
   captured is not a cross-runtime guarantee. Restore builds each node after its declared
   dependencies, so a node replaced onto a dependency made after it comes later in the restored
   graph than in its original; a capture names the first node in the order of the graph it is
   asked of, and the two can name different nodes.
2. **Restore names the reference of a missing recipe.** The refusal is
   `not restorable: <id>: missing recipe <ref>`. This changes a text the shared probe compares exactly:
   `probeExpected.checkpointMissingRecipe` in
   [spec/fixtures/d797-rereview.v1.json](../../spec/fixtures/d797-rereview.v1.json) is now
   `not restorable: n: missing recipe absent`. **Your probe against that fixture will differ until you
   follow.** `checkpointReasons.missingRecipe` and every other reason are unchanged.
3. **The recipe requirement.** A graph creation option, off by default (`requireRecipe` in the
   reference). With it, creating a computed node or replacing one without a recipe is refused when it
   is asked for; a refused replace leaves the current instance, its values and its subscribers.
   Inside a running function the refusal is the failure of that request, given to the function.
   A function that lets the failure end its run fails with it, so its node ends with ERROR: it
   does not catch it where a request throws, or it returns it as its own failure where a request
   returns one. A function that goes on has handled it. The kernel checks only that a recipe was given, whatever it is (in the
   reference, anything but null or undefined), and never reads it. A checkpoint does not hold the
   option: a host that wants it on the restored graph asks for it again at the restore (the
   reference's `restore(checkpoint, registry, { requireRecipe: true })`). A requiring graph cannot
   hold nodes a module builds without recipes; the reference's wire bridge group is one (D812 (5);
   no rule names the bridge, and R-bridge@2 leaves checkpoints of its nodes not covered). What a module's builder leaves when one of its nodes is
   refused is yours: no rule statement or scenario compares it. In the reference each request
   stands on its own, so its restart and demand builders leave their control state behind. The text of the requirement's refusal and
   which refusal a request gets when several apply are yours, as for the kernel's other refusals.
4. **Pending work is state.** Checkpoint still neither resumes nor re-issues late output in flight.
   A node that must not lose its pending work records it in private state, as JSON, and its setup
   opens it again at the restored node's first activation, without its function running on an
   unchanged input; a reopened timer runs its full duration. In the reference, `latestAsync(f)` is
   a function with its setup: it records `{ pending: [value] }`, its setup starts a job again for a
   pending input, and it keeps its AbortController beside the lifetime, so a graph with a job in
   flight can be captured (it was refused before, as not JSON). A restored node's function does
   not run on an unchanged input, so an operator given to the graph as a function alone cannot do
   this: whatever shape your package gives latestAsync, its setup comes with it. (The reference
   also had the function alone for a day; it recorded nothing and lost the job, which is not what
   D812 (1) says of an ordinary latestAsync.) That sentence of D812 (1) is all there is: no rule
   statement or scenario names latestAsync, and its contract comes with the operator contracts
   graphrefly:D813 gives the root, which are not written yet.
5. **History, where a runtime ships it.** The auto INVALIDATE policy: the kernel removes the node's
   value without running its function, and the list in private state stays. Arrays before an
   INVALIDATE in the same wave are not part of that wave's entry, and a wave left with no array is
   not an entry and sends no list. A restored history is not always as the original: it cannot see
   an INVALIDATE made before its first subscription, so after one followed by a write of the value
   it had already received it does not run, where the original has a new entry, and after one alone
   it still holds its saved list, where the original holds no value (R-checkpoint; C-45). A wave
   that carries DATA and the source's ERROR ends the node with no list for it.
6. **Restart, where a runtime ships it.** While a retry waits, the owner's private state says so.
   A restored owner whose state says so starts that retry's delay again at its first activation,
   with the saved attempt number and failure count, instead of renewing the inner at once. When the
   delay ends the retry is made, or dropped if the owner's lifetime closed or another attempt
   started; if by then a fresh inner would end at once on its upstreams (every one ended, or one
   ended with ERROR), no attempt is made and the owner ends with the inner's ERROR. One ended
   upstream among open ones does not stop the retry. Do not
   infer a waiting retry from the inner being ended: the inner is activated before the owner's
   setup, so one that fails only at that activation is ended there too, and its failure is counted
   once, by the owner's function. The reference made that mistake first.

7. **An INVALIDATE a restored node could not see.** R-checkpoint@2 now says each case: followed by
   a write of another value it is seen as the write; followed by a write of the value the node had
   received it is not seen, and the node does not run; alone, the node is told its dependency holds
   no value, its function runs once, and its own value is not removed. No reference code changed
   for this.

## What to check against

| Scenario | Covers |
|---|---|
| C-38 | capture-time local-only refusal; the first node in creation order that cannot be saved is named, with what is not JSON first within one node; a recipe without a reference; pending work reopened by a setup; restore failures |
| C-43, C-46 | the restored pending retry, and a restored live inner that fails at the first activation |
| C-45 | history across an INVALIDATE, live and after a round trip, with the two cases where the restored node differs; a wave left with no array |
| C-50 (new) | the recipe requirement, a handled refusal, and the requirement at a restore |
| C-42 (D814) | a DATA or ERROR without the payload R-messages requires; a throw that cannot be a payload |

Every runtime result for these is `todo`. The reference is in `reference/kernel` and
`reference/modules` (`npm run test:reference`, 527 tests); the models are `module_checkpoint`,
`module_history` and `module_restart` in `formal/`, with their runs in `formal/README.md`.

## Beside D812: message payloads (graphrefly:D814)

Made on 2026-11-19 from a finding of the third QA; not part of D812. R-failure is at revision 4.

- A DATA without a payload and an ERROR whose payload is absent or a boolean are refused where
  they are given: `ctx.down` throws before anything is applied, and a host write of one is refused
  to its caller. graphrefly-ts and graphrefly-py already do this, and graphrefly-rs's ERROR holds
  an error value, so nothing changes there. The reference kernel had accepted them.
- A function's throw whose value cannot be an ERROR payload, nothing or a boolean, gives the
  payload `{}`, an empty JSON object. Only JavaScript lets a function throw one. **graphrefly-ts
  changes here:** it gives an Error with the text "node function threw without a valid error
  payload" (`errorPayload` in `node-input-runtime.ts`). What your operators and sources send when
  they catch a failure themselves stays yours; the reference uses `{}` there too.
- C-42 covers both. Its results were `todo` in every runtime already.

## What is not here

- The operator choices the review revised (time operators keep what is pending and restart how long;
  switchMap's new selection wins; merge's snapshot and the merge, race and concat invalidation rows)
  are recorded in DS-20 only. [graphrefly:D813](../../decisions/decisions.jsonl) gives the root one
  set of operator contracts for them; that set does not exist yet, so there is nothing to implement
  against.
- The history, restart, pause, demand and revision module rules are still drafts.
- Your skills and comments may still cite the seven drafts graphrefly:D810 gave transitions
  (R-no-raw-async, R-clock, R-no-polling, R-data-not-peek, R-edges-derived, R-inspection-set,
  R-meta-presentation). They are yours to re-home; R-no-raw-async in particular is a TypeScript lint.
