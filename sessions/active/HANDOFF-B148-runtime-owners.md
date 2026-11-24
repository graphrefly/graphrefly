# Handoff to the runtime owners: the kernel questions of B148 and the pause and restart rules (D818 to D828)

Written by Claude on 2026-11-23 for [graphrefly:B148](../../plan/backlog.jsonl) and graphrefly:B149,
at the user's request. This is a brief, not a rule, a decision or a work item. Each runtime owner
(graphrefly-ts, graphrefly-rs, graphrefly-py) admits its own slice in its own `plan/work.jsonl`, when
the user decides, and writes its own work body there. Nothing here dispatches implementation.

Read it with [HANDOFF-B140-runtime-owners.md](HANDOFF-B140-runtime-owners.md) and
[HANDOFF-D812-runtime-owners.md](HANDOFF-D812-runtime-owners.md). graphrefly-ts and graphrefly-rs
re-port their kernels from `reference/kernel` (graphrefly:D817); the root's proposed order, which is
each owner's to admit, is to do that now that B148 is complete, so that a kernel is ported once.
What each runtime does today at these points was not looked at.

## What changed at the root

Eleven decisions of 2026-11-22 and 2026-11-23. Read the rules with `npm run rules:current`; this
table only names what moved.

| Rule | State | By | Change |
|---|---|---|---|
| R-request-order@7 | active (was @3) | D818, D821, D822, D826 | the order of requests that functions make in one wave; a dependency given more than once; the cycle check over a seed's dependencies, and at a node's creation |
| R-subscription@5 | active (was @3) | D819, D827 | a dependency replaced while its dependent stays active; a seed that names a node which does not exist |
| R-invocation@4 | active (was @3) | D819 | `ctx.deps[i]` says whether the dependency was replaced since the function's last run |
| R-checkpoint@3 | active (was @2) | D819 | a replacement the function has not been told of is saved |
| R-node@4 | active (was @3) | D823 | the dependency list and the recipe stay as they were given |
| R-failure@5 | active (was @4) | D824 | what a throw drops, and its ERROR's payload |
| R-terminals@2 | active (was @1) | D824 | where the kernel's COMPLETE goes; an INVALIDATE beside a dependency's ERROR |
| R-invalidation@2 | active (was @1) | D824 | an INVALIDATE beside another input's DATA |
| R-pause@1, R-restart@1 | active (were drafts) | D828 | activated as written |
| O-zip@2 | active (was @1) | D820 | an operator contract, not a rule: zip over an input that is replaced |

graphrefly:D825 changes no rule: a restore's comparison by held value stands.

## What a runtime now does differently

1. **Requests that functions make in one wave run in creation order (D818).** Requests that node
   functions make during one wave run in the order their nodes were created, each node's own in the
   order it made them; among the wave's other requests they keep the places such requests were made
   at. A batch a function opened commits as that function's request. Until now they ran in the
   order they were made, which follows the order sinks subscribed and a batch's writes were made,
   and which a restored graph does not keep. Reference: `functionsInCreationOrder` in
   `reference/kernel/kernel.mjs`.
2. **A function is told once that a dependency was replaced (D819).** When a dependency gets a new
   instance while its dependent stays active, the dependent's input is a new one, and nothing the
   kernel held of the old instance remains, its terminal included. The function reads
   `ctx.deps[i].replaced` in its next run and in no later one; what it recorded in private state is
   its own to drop. A checkpoint saves a telling not yet made, through a read made for it
   (`replacedInputs` in the reference), and the restored node's first activation runs the function
   for it, as for a changed input, with nothing new from that dependency. Not told: a replace made
   after a restore and before the restored node's first activation.
3. **A dependency may be given more than once (D821).** At a rewire and a replace as at creation.
   Each place is a connection of its own; at a rewire the k-th place a dependency has in the new
   list keeps the k-th connection held to it. One array reaches every place and the node runs once.
   A checkpoint takes a saved lifetime list that repeats a node. The reference matched connections
   by id alone and refused. The reference operators still refuse an input given twice when they
   are built, which is their contracts'.
4. **The cycle check reads a seed's dependencies (D822, D826, D827).** A replace or a rewire is
   refused for a dependency that depends on the node through the dependencies a seed gives a first
   lifetime, as through current and declared ones: a restored graph then refuses what the live one
   refuses. Creating a node is refused in the same way when a dependency it is given, or one its
   own seed names, depends on it, which only a seed that named it before it existed can bring
   about. A request that would activate a node while a dependency its seed names does not exist,
   a subscription or a replace or rewire onto such a node, is refused before anything changes.
   Without these the reference was left with two nodes over each other, or overflowed the stack,
   or left nodes marked active and half connected. A checkpoint cannot bring the last two about:
   restore already refuses such a list.
5. **A node's definition stays as it was given (D823).** A change the host makes afterwards to the
   list or the recipe it gave, or to a definition it read, changes neither the node nor what a
   capture writes. The reference takes its own list at a creation, a replace and a rewire, when
   the request is asked for and not when it runs, and copies a recipe's plain data in and out of
   `definition(id)`. The rule says what holds and not how: a language in which the host cannot
   reach the kernel's objects needs no copy. Private state and payloads still pass by reference.
6. **Five points where the rules now say what the reference kernel does (D824).** The kernel did
   not change for them.
   - A throw drops everything its function sent in that run. Under the manual INVALIDATE policy
     that includes an INVALIDATE the function sent, so the node ends holding the value its input
     retracted.
   - A throw's ERROR payload is the message of the error thrown, or the thrown value itself where
     a language can throw one that is not an error. This is fixed now and no longer each
     runtime's; the empty string of graphrefly:D814 (3) stands for a value that cannot be a
     payload. What your operators and sources send when they catch a failure themselves stays yours.
   - The kernel's COMPLETE is an array of its own after the arrays of that run, for every node and
     not only a quiet one; none is added where the function ended its own output.
   - An INVALIDATE that reached a node in the wave of a dependency's ERROR takes effect first, on
     whichever input and in whatever order the two came. R-terminals@1 asked that it came before.
   - Under the auto INVALIDATE policy an input's INVALIDATE goes out before what the function
     sends for another input's DATA of the same wave, whatever their order.
7. **A restore still compares held values (D825).** Nothing changes. A restored node receives no
   waves until its first activation, so an equal value its dependency sent again meanwhile is not
   an occurrence for it, and neither is any array but the last. A host that must not lose one
   subscribes before writing upstream. Comparing a version of each output was not chosen.
8. **R-pause and R-restart are in force as written (D828).** Their statements are the drafts you
   have read. C-2, C-5, C-9, C-10 and C-13, which stated the pause rules that R-pause replaced,
   left the scenario ledger; results you hold against them are history. The reference restart
   module now keeps its own list of the inner's dependencies and replaces the inner onto the
   inner's own definition, as R-restart says; it had followed a list its caller changed afterwards.
9. **zip over a replaced input (D820), for a package that ships zip.** zip keeps the items it queued
   from the old instance and no longer counts the input as completed. A canonical trace may now
   hold a `["replace", node, deps]` step, which gives an operator node a new instance of the same
   operator and args over those dependencies. No other operator of the set records an input's
   terminal; what the others keep of a replaced input is not stated.

## What to check against

| Scenario | Covers |
|---|---|
| C-51 | the order of functions' requests in one wave, live and restored |
| C-52 | the telling of a replaced dependency, also across a capture and restore |
| C-53, and C-35 as corrected | a dependency given more than once; a rewire to a duplicate is no longer refused |
| C-54, C-58, C-59 | the cycle check over a seed's dependencies, at a node's creation, and a seed that names a node which does not exist |
| C-55 | a definition that stays as given |
| C-56 | the five points of D824 |
| C-57 | a restored node behind a dependency that sends an equal value again |
| C-30, C-31, C-43, C-46 | pause and restart, now on current rules |
| OT-138, OT-139, OT-140 | zip over a replaced input, one across a restore |

Every runtime result for these is `todo`. The reference is in `reference/kernel`,
`reference/modules` and `reference/operators` (`npm run test:reference`, 1345 tests). The models
are in `formal/`, with their runs in `formal/README.md`: `kernel_lifetime` (RequestOrder),
`kernel_replaced_input`, `kernel_repeated_dependency`, `kernel_seed_cycle`, and `kernel_wave` with
two invariants added for D824. No text of the shared probe fixture
(`spec/fixtures/d797-rereview.v1.json`) changed.

## What is not here

- The sixteen draft operator contracts (higher-order, time, recover, gate, async) are not in force.
  The gate and recover families no longer wait for a rule; none has been activated.
- R-demand, R-history and R-revision are still drafts.
- How a package runs the canonical traces and reports its results is graphrefly:B150, proposed.
- Private state a host reads and changes, and a payload its owner changes after sending it, are
  not covered by D823.
