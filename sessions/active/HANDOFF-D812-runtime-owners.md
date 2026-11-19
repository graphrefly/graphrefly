# Handoff to the runtime owners: recovery and invalidation after the DS-20 review (D812)

Written by Claude on 2026-11-18 for [graphrefly:B145](../../plan/backlog.jsonl), at the user's
request. This is a brief, not a rule, a decision or a work item. Each runtime owner (graphrefly-ts,
graphrefly-rs, graphrefly-py) admits its own slice in its own `plan/work.jsonl`, when the user
decides, and writes its own work body there. Nothing here dispatches implementation.

Revised 2026-11-19 after an independent QA of the root work, before this brief reached anyone: the
rule rows, D812 and the scenarios were corrected in place, and items 1, 3 and 6 below changed with them.

## What changed at the root

[graphrefly:D812](../../decisions/decisions.jsonl) records six choices the user made on the independent
review of DS-20. Read the rules themselves with `npm run rules:current -- module --drafts` and
`npm run rules:current -- kernel`; this table only names what moved.

| Rule | State | Change |
|---|---|---|
| R-checkpoint@2 | active (was @1) | capture refuses a local-only node, and a recipe without a reference, after every JSON refusal in the graph; pending work a node recorded in private state is reopened by its setup; restore names the reference of a missing recipe; a bridged graph cannot be captured |
| R-node@3 | active (was @2) | a graph may be created to require a recipe on every computed instance |
| R-history@1 | draft, rewritten in place | the auto INVALIDATE policy: an INVALIDATE removes the value and keeps the list |
| R-restart@1 | draft, rewritten in place | a restored pending retry waits its delay in full, for the same attempt |
| R-request-order@3, R-failure@3 | unchanged | R-node@3 alone says the refusal is made when the request is made; R-request-order says what a refused replace leaves, and R-failure what an unhandled failure in a function is |

## What a runtime now does differently

1. **Capture refuses a local-only node.** A computed node built or replaced without a recipe makes
   capture fail with the shared `localOnly` reason, naming the node. Until now capture wrote
   `local: true` and restore failed. The JSON refusals come first for the whole graph: check every
   node's values, private state, received values, payloads and recipe configuration, naming the first
   node in creation order that holds what is not JSON, and only then look for a missing recipe,
   again naming the first such node. So no capture that was refused before changes its reason. A
   recipe that was given but has no reference (`{}`, `false`) is refused in that second pass with the
   existing `missingRecipe` reason. A checkpoint that already holds a local-only node still fails at
   restore. A graph that holds a wire bridge group cannot be captured, since the bridge's nodes
   carry no recipes.
2. **Restore names the reference of a missing recipe.** The refusal is
   `not restorable: <id>: missing recipe <ref>`. This changes a text the shared probe compares exactly:
   `probeExpected.checkpointMissingRecipe` in
   [spec/fixtures/d797-rereview.v1.json](../../spec/fixtures/d797-rereview.v1.json) is now
   `not restorable: n: missing recipe absent`. **Your probe against that fixture will differ until you
   follow.** `checkpointReasons.missingRecipe` and every other reason are unchanged.
3. **The recipe requirement.** A graph creation option, off by default (`requireRecipe` in the
   reference). With it, creating a computed node or replacing one without a recipe is refused when it
   is asked for; a refused replace leaves the current instance, its values and its subscribers.
   Inside a running function the refusal is the failure of that request, given to the function:
   left unhandled it is the function's throw, so its node ends with ERROR, and a function that
   handles it goes on. The kernel checks only that a recipe was given, whatever it is (in the
   reference, anything but null or undefined), and never reads it. A checkpoint does not hold the
   option: a host that wants it on the restored graph asks for it again at the restore (the
   reference's `restore(checkpoint, registry, { requireRecipe: true })`). A requiring graph cannot
   hold a bridge group.
4. **Pending work is state.** Checkpoint still neither resumes nor re-issues late output in flight.
   A node that must not lose its pending work records it in private state, as JSON, and its setup
   opens it again at the restored node's first activation, without its function running on an
   unchanged input; a reopened timer runs its full duration. In the reference, `latestAsync` records
   `{ pending: [value] }` and keeps its AbortController beside the lifetime, so a graph with a job in
   flight can be captured (it was refused before, as not JSON).
5. **History, where a runtime ships it.** The auto INVALIDATE policy: the kernel removes the node's
   value without running its function, and the list in private state stays. Arrays before an
   INVALIDATE in the same wave are not part of that wave's entry.
6. **Restart, where a runtime ships it.** While a retry waits, the owner's private state says so.
   A restored owner whose state says so starts that retry's delay again at its first activation,
   with the saved attempt number and failure count, instead of renewing the inner at once. When the
   delay ends the retry is made, or dropped if another attempt started or an upstream ended. Do not
   infer a waiting retry from the inner being ended: the inner is activated before the owner's
   setup, so one that fails only at that activation is ended there too, and its failure is counted
   once, by the owner's function. The reference made that mistake first.

## What to check against

| Scenario | Covers |
|---|---|
| C-38 | capture-time local-only refusal and its order after every JSON refusal; a recipe without a reference; pending work reopened by a setup; restore failures |
| C-43, C-46 | the restored pending retry, and a restored live inner that fails at the first activation |
| C-45 | history across an INVALIDATE, live and after a round trip |
| C-50 (new) | the recipe requirement, a handled refusal, a bridge group, and the requirement at a restore |

Every runtime result for these is `todo`. The reference is in `reference/kernel` and
`reference/modules` (`npm run test:reference`, 511 tests); the models are `module_checkpoint`,
`module_history` and `module_restart` in `formal/`, with their runs in `formal/README.md`.

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
