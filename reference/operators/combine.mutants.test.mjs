// Mutants of combine.mjs against the canonical traces; mutants.mjs says what a mutant must do.

import { mutantSuite } from "./mutants.mjs";

const SEND = `const sendArrays = (ctx, d) => { for (const w of d.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v])); };`;
const MERGE = `  for (const d of ctx.deps) sendArrays(ctx, d);`;
const M_NODE = `return g.node(id, [...inputIds], mergeFn, recipe("merge"));`;
const W_NODE = `{ terminal: { complete: "manual" }, ...recipe("withLatestFrom") }`;
const Z_NODE = `{ terminal: { complete: "manual", error: "manual" }, ...recipe("zip") }`;
const C_NODE = `{ terminal: { complete: "manual" }, ...recipe("concat", { sources }) }`;
const R_NODE = `{ terminal: { complete: "manual", error: "manual" }, invalidate: "manual", ...recipe("race") }`;
const READY = `  if (secondaries.every((d) => d.has)) {`;
const PAIRS = `    for (const w of primary.waves) if (w.length) ctx.down(w.map((v) => ["DATA", [v, ...secondaries.map((d) => d.value)]]));`;
const W_END = `  if (completed(primary)) ctx.down([["COMPLETE"]]);`;
const Z_HEAD = `  const state = ctx.state.get() ?? { queues: ctx.deps.map(() => []), done: ctx.deps.map(() => false) };`;
const QUEUE = `  const queues = state.queues.map((queue, i) => [...queue, ...occurrences(ctx.deps[i])]);`;
const TUPLE = `  while (queues.every((queue) => queue.length)) out.push(["DATA", queues.map((queue) => queue.shift())]);`;
const ENDS = `  const ends = done.some((ended, i) => ended && !queues[i].length); // no tuple can form after that`;
const Z_ERR = `  if (error && !(ends && out.length)) { ctx.down([error]); return; }`;
const Z_SET = `  ctx.state.set({ queues, done });`;
const Z_SEND = `  if (out.length) ctx.down(out);\n}`;
const NEXT = `      if (index < sources.length) ctx.rewire([sources[index]]);\n      else ctx.down([["COMPLETE"]]);`;
const C_INDEX = `    let index = ctx.state.get()?.index ?? 0;`;
const FIRST = `    const first = ctx.deps.find((d) => occurrences(d).length || d.terminal);`;
const R_HEAD = `function raceFn(ctx) {\n  let winner = ctx.state.get()?.winner ?? null;`;
const R_INV = `  if (selected.invalidated) ctx.down([["INVALIDATE"]]); // the selected input's alone`;
const R_ERR = `  if (errored(selected)) { ctx.down([selected.terminal]); return; } // without that wave's DATA, as the auto policy`;
const R_FOLLOW = `  sendArrays(ctx, selected);\n  if (completed(selected)) ctx.down([["COMPLETE"]]);`;

const MUTANTS = [
  // what merge, concat and race share
  ["the shared sender drops DATA that is falsy", "O-merge use: sends every input's arrays as they came; O-concat, O-race use: follows the source", SEND,
    `const sendArrays = (ctx, d) => { for (const w of d.waves) { const kept = w.filter(Boolean); if (kept.length) ctx.down(kept.map((v) => ["DATA", v])); } };`, ["merge", "concat", "race"]],
  ["the shared sender keeps only the last DATA of an array", "O-merge use: sends every input's arrays as they came; O-concat, O-race use: follows the source", SEND,
    `const sendArrays = (ctx, d) => { for (const w of d.waves) if (w.length) ctx.down([["DATA", w[w.length - 1]]]); };`, ["merge", "concat", "race"]],
  ["the shared sender skips an array equal to the one before", "O-merge use: sends every input's arrays as they came; O-concat, O-race use: follows the source", SEND,
    `let before;\nconst sendArrays = (ctx, d) => { for (const w of d.waves) if (w.length && JSON.stringify([ctx.signal === undefined, d.id, w]) !== before) { before = JSON.stringify([ctx.signal === undefined, d.id, w]); ctx.down(w.map((v) => ["DATA", v])); } };`, ["merge", "concat", "race"]],
  // merge
  ["merge takes its inputs in reverse order", "O-merge use: within one wave, inputs go in declared order", MERGE, `  for (const d of [...ctx.deps].reverse()) sendArrays(ctx, d);`],
  ["merge takes its inputs in the order of their names", "O-merge use: within one wave, inputs go in declared order", MERGE, `  for (const d of [...ctx.deps].sort((x, y) => (x.id < y.id ? -1 : 1))) sendArrays(ctx, d);`],
  ["merge reads only its first two inputs", "O-merge use: sends every input's arrays", MERGE, `  for (const d of ctx.deps.slice(0, 2)) sendArrays(ctx, d);`],
  ["merge sends a wave's arrays as one", "O-merge use: sends every input's arrays as they came", MERGE, `  { const all = ctx.deps.flatMap(occurrences); if (all.length) ctx.down(all.map((v) => ["DATA", v])); }`],
  ["merge completes when its first input does", "O-merge use: it completes when every input has completed",
    [[M_NODE, `return g.node(id, [...inputIds], mergeFn, { terminal: { complete: "manual" }, ...recipe("merge") });`], [MERGE, `${MERGE}\n  if (ctx.deps.some(completed)) ctx.down([["COMPLETE"]]);`]]],
  ["merge completes when its last declared input does", "O-merge use: it completes when every input has completed",
    [[M_NODE, `return g.node(id, [...inputIds], mergeFn, { terminal: { complete: "manual" }, ...recipe("merge") });`], [MERGE, `${MERGE}\n  if (completed(ctx.deps[ctx.deps.length - 1])) ctx.down([["COMPLETE"]]);`]]],
  ["merge keeps its output at an input's INVALIDATE", "O-merge invalidation: any input's effective INVALIDATE retracts the output", M_NODE, `return g.node(id, [...inputIds], mergeFn, { invalidate: "manual", ...recipe("merge") });`],
  ["merge sends an input's INVALIDATE after the wave's DATA", "O-common: the retraction goes out first and the DATA after it",
    [[M_NODE, `return g.node(id, [...inputIds], mergeFn, { invalidate: "manual", ...recipe("merge") });`], [MERGE, `${MERGE}\n  if (ctx.deps.some((d) => d.invalidated)) ctx.down([["INVALIDATE"]]);`]]],
  ["merge ignores an input's ERROR", "O-merge use: any input's ERROR ends it", M_NODE, `return g.node(id, [...inputIds], mergeFn, { terminal: { error: "manual" }, ...recipe("merge") });`],
  ["merge ignores its first input's ERROR", "O-merge use: any input's ERROR ends it",
    [[M_NODE, `return g.node(id, [...inputIds], mergeFn, { terminal: { error: "manual" }, ...recipe("merge") });`], [MERGE, `${MERGE}\n  const failed = ctx.deps.slice(1).find(errored);\n  if (failed) ctx.down([failed.terminal]);`]]],
  // withLatestFrom
  ["withLatestFrom puts the secondaries first", "O-withLatestFrom use: the list of that value followed by the latest value of each secondary", PAIRS, PAIRS.replace(`[v, ...secondaries.map((d) => d.value)]`, `[...secondaries.map((d) => d.value), v]`)],
  ["withLatestFrom flattens a secondary's value that is a list", "O-withLatestFrom use: the list of that value followed by the latest value of each secondary", PAIRS, PAIRS.replace(`[v, ...secondaries.map((d) => d.value)]`, `[v].concat(...secondaries.map((d) => d.value))`)],
  ["withLatestFrom sends while a secondary has no value", "O-withLatestFrom use: a primary occurrence is dropped while any secondary has no value", READY, `  if (true) {`],
  ["withLatestFrom takes a secondary that holds a falsy value for one without a value", "O-withLatestFrom use: dropped while any secondary has no value", READY, `  if (secondaries.every((d) => d.value)) {`],
  ["withLatestFrom sends when a secondary delivers", "O-withLatestFrom use: a secondary's occurrence alone sends nothing",
    W_END, `  if (primary.has && !occurrences(primary).length && secondaries.some((d) => occurrences(d).length)) ctx.down([["DATA", [primary.value, ...secondaries.map((d) => d.value)]]]);\n${W_END}`],
  ["withLatestFrom sends a wave's primary arrays as one", "O-withLatestFrom use: one output array for each primary array",
    PAIRS, `    { const all = occurrences(primary); if (all.length) ctx.down(all.map((v) => ["DATA", [v, ...secondaries.map((d) => d.value)]])); }`],
  ["withLatestFrom sends a primary value only once it has run before", "O-common: an operator runs on its inputs' snapshots at activation",
    [[READY, `  if (ctx.state.get() && secondaries.every((d) => d.has)) {`], [W_END, `  ctx.state.set({ ran: true });\n${W_END}`]]],
  ["withLatestFrom ends at a secondary's COMPLETE", "O-withLatestFrom completion: a secondary that completed keeps its latest value", W_END, `  if (ctx.deps.some(completed)) ctx.down([["COMPLETE"]]);`],
  ["withLatestFrom does not end at its primary's COMPLETE", "O-withLatestFrom completion: the primary's COMPLETE ends the branch", W_END, ``],
  ["withLatestFrom reads its primary's COMPLETE only while every secondary has a value", "O-withLatestFrom completion: the primary's COMPLETE ends the branch",
    `  }\n${W_END}`, `  ${W_END.trim()}\n  }`],
  ["withLatestFrom puts its COMPLETE in its last DATA array", "O-common: after DATA it would have sent anyway the COMPLETE is an array of its own",
    [[PAIRS, `    for (const w of primary.waves) if (w.length) sent.push(w.map((v) => ["DATA", [v, ...secondaries.map((d) => d.value)]]));`],
      [READY, `  const sent = [];\n${READY}`], [W_END, `  if (completed(primary)) { if (sent.length) sent[sent.length - 1].push(["COMPLETE"]); else sent.push([["COMPLETE"]]); }\n  for (const array of sent) ctx.down(array);`]]],
  ["withLatestFrom keeps its output at an INVALIDATE", "O-withLatestFrom invalidation: an INVALIDATE of either kind of input retracts the output", W_NODE, `{ terminal: { complete: "manual" }, invalidate: "manual", ...recipe("withLatestFrom") }`],
  ["withLatestFrom ignores an input's ERROR", "O-withLatestFrom completion: any input's ERROR ends the branch", W_NODE, `{ terminal: { complete: "manual", error: "manual" }, ...recipe("withLatestFrom") }`],
  ["withLatestFrom completes when its primary's COMPLETE and a secondary's ERROR share a wave", "O-common: an input's ERROR ends the operator, also when another input completes in that wave",
    [[W_NODE, `{ terminal: { complete: "manual", error: "manual" }, ...recipe("withLatestFrom") }`], [W_END, `${W_END}\n  else { const failed = ctx.deps.find(errored); if (failed) ctx.down([failed.terminal]); }`]]],
  // zip
  ["zip pairs the newest items", "O-zip use: queues each input's DATA by position", TUPLE, TUPLE.replace(`queue.shift()`, `queue.pop()`)],
  ["zip builds its tuple in reverse order", "O-zip use: one item from every input in declared order", TUPLE, TUPLE.replace(`queues.map((queue) => queue.shift())`, `queues.map((queue) => queue.shift()).reverse()`)],
  ["zip flattens an item that is a list into its tuple", "O-zip use: each the list of one item from every input", TUPLE, TUPLE.replace(`queues.map((queue) => queue.shift())`, `[].concat(...queues.map((queue) => queue.shift()))`)],
  ["zip builds its tuple from its first two inputs", "O-zip use: one item from every input", TUPLE, TUPLE.replace(`queues.map((queue) => queue.shift())`, `queues.map((queue) => queue.shift()).slice(0, 2)`)],
  ["zip waits for a truthy item at the head of every queue", "O-zip use: queues each input's DATA by position", TUPLE, TUPLE.replace(`queues.every((queue) => queue.length)`, `queues.every((queue) => queue[0])`)],
  ["zip queues the DATA of one input a run", "O-zip same-wave: what several inputs deliver in one wave is queued together",
    QUEUE, `  const only = ctx.deps.findIndex((d) => occurrences(d).length);\n  const queues = state.queues.map((queue, i) => [...queue, ...(i === only ? occurrences(ctx.deps[i]) : [])]);`],
  ["zip does not queue DATA that comes with its input's COMPLETE", "O-zip completion: DATA that comes with an input's COMPLETE is queued first",
    QUEUE, `  const queues = state.queues.map((queue, i) => [...queue, ...(completed(ctx.deps[i]) ? [] : occurrences(ctx.deps[i]))]);`],
  ["zip sends each tuple, and its COMPLETE, as an array of its own", "O-zip use: sends, in one array, every tuple that can be formed in a run … its COMPLETE goes in the array of that run's tuples", Z_SEND, `  for (const message of out) ctx.down([message]);\n}`],
  ["zip ends as soon as an input has ended", "O-zip use: it ends when an input that has ended has no queued item left", ENDS, `  const ends = done.some(Boolean);`],
  ["zip ends only when its first input has ended", "O-zip completion: it ends when any input has completed with nothing queued", ENDS, `  const ends = done[0] && !queues[0].length;`],
  ["zip ends only when every queue is empty", "O-zip completion: also while another still has items", ENDS, `  const ends = done.some(Boolean) && queues.every((queue) => !queue.length);`],
  ["zip never ends", "O-zip use: it ends when an input that has ended has no queued item left", `  if (ends) out.push(["COMPLETE"]);\n`, ``],
  ["zip drops what it queued at the end of the run", "O-zip use: it has no capacity and drops nothing", Z_SET, `  ctx.state.set({ queues: queues.map(() => []), done });`],
  ["zip drops its queues at an input's INVALIDATE", "O-zip invalidation: keeps the unmatched queues",
    [[Z_NODE, `{ terminal: { complete: "manual", error: "manual" }, invalidate: "manual", ...recipe("zip") }`],
      [Z_HEAD, `  const cleared = ctx.deps.some((d) => d.invalidated);\n  if (cleared) ctx.down([["INVALIDATE"]]);\n  const state = (cleared ? undefined : ctx.state.get()) ?? { queues: ctx.deps.map(() => []), done: ctx.deps.map(() => false) };`]]],
  ["zip keeps its output at an input's INVALIDATE", "O-zip invalidation: retracts the output", Z_NODE, `{ terminal: { complete: "manual", error: "manual" }, invalidate: "manual", ...recipe("zip") }`],
  ["zip ignores an input's ERROR", "O-common: an input's ERROR ends the operator", `${Z_ERR}\n`, ``],
  ["an ERROR after the tuple that ended zip ends it with that ERROR", "O-zip same-wave: an ERROR that follows that DATA in the same wave is not sent", Z_ERR, `  if (error) { ctx.down([error]); return; }`],
  ["zip sends a wave's tuples before an ERROR that ends it", "O-zip completion: an ERROR ends zip without that wave's tuples unless one of them ended it", Z_ERR, `  if (error && !(ends && out.length)) { ctx.down(out.length ? [...out, error] : [error]); return; }`],
  ["zip keeps its queues across activations, outside private state", "O-common: an operator that deactivates without having ended forgets it",
    [[`function zipFn(ctx) {\n${Z_HEAD}`, `let memo;\nfunction zipFn(ctx) {\n  const state = ctx.state.get() ?? memo ?? { queues: ctx.deps.map(() => []), done: ctx.deps.map(() => false) };`], [Z_SET, `${Z_SET}\n  memo = { queues: queues.map((queue) => [...queue]), done };`]]],
  ["every zip shares one set of queues", "O-common: progress is private state",
    [[`function zipFn(ctx) {\n${Z_HEAD}`, `let shared;\nfunction zipFn(ctx) {\n  const state = (ctx.state.get() ? shared : undefined) ?? { queues: ctx.deps.map(() => []), done: ctx.deps.map(() => false) };`], [Z_SET, `${Z_SET}\n  shared = { queues: queues.map((queue) => [...queue]), done };`]]],
  // concat
  ["concat depends on all its sources at once", "O-concat use: subscribes to the next only when the current one completes", `return g.node(id, [sources[0]], concatFn({ sources }),`, `return g.node(id, sources, concatFn({ sources }),`],
  ["concat moves on at the current source's first DATA", "O-concat invalidation: only the current source's COMPLETE subscribes the next", `    if (completed(current)) {`, `    if (completed(current) || occurrences(current).length) {`],
  ["concat never moves on", "O-concat use: subscribes to the next when the current one completes", `    if (completed(current)) {`, `    if (false) {`],
  ["concat completes when its first source does", "O-concat use: when the last one completes, concat completes", NEXT, `      ctx.down([["COMPLETE"]]);`],
  ["concat skips a source", "O-concat use: in the order given", `      index += 1;`, `      index += 2;`],
  ["concat forgets which source it is at", "O-concat use: follows one source at a time, in the order given", `    ctx.state.set({ index });`, `    ctx.state.set({ index: 0 });`],
  ["concat does not send what a source delivers with its COMPLETE once it has moved on", "O-concat use: one that has already completed is passed in turn, giving its ordinary snapshot",
    `    sendArrays(ctx, current);`, `    if (!completed(current) || index === 0) sendArrays(ctx, current);`],
  ["every concat shares one position", "O-common: progress is private state",
    [[`const concatFn = (config) => {`, `let sharedIndex = 0;\nconst concatFn = (config) => {`], [C_INDEX, `    let index = ctx.state.get() ? sharedIndex : 0;`], [`    ctx.state.set({ index });`, `    ctx.state.set({ index });\n    sharedIndex = index;`]]],
  ["concat keeps its output at the current source's INVALIDATE", "O-concat invalidation: the current source's INVALIDATE retracts the output", C_NODE, `{ terminal: { complete: "manual" }, invalidate: "manual", ...recipe("concat", { sources }) }`],
  ["concat ignores the current source's ERROR", "O-concat completion: the current source's ERROR ends concat", C_NODE, `{ terminal: { complete: "manual", error: "manual" }, ...recipe("concat", { sources }) }`],
  ["a restored concat knows only its first two sources", "R-checkpoint: a restored node is built from its recipe", `"operators.concat": (config) => concatFn(config ?? {}),`, `"operators.concat": (config) => concatFn({ sources: [config.sources[0], config.sources[1]] }),`],
  // race
  ["race selects the last eligible input of a wave", "O-race same-wave: the first in declared order is selected", FIRST, FIRST.replace(`ctx.deps.find(`, `ctx.deps.findLast(`)],
  ["race selects by the order of its inputs' names", "O-race same-wave: the first in declared order is selected", FIRST, `    const first = [...ctx.deps].sort((x, y) => (x.id < y.id ? -1 : 1)).find((d) => occurrences(d).length || d.terminal);`],
  ["race takes an input whose DATA is falsy for one that has not delivered", "O-race use: the first input to deliver DATA or a terminal", FIRST, `    const first = ctx.deps.find((d) => occurrences(d).some(Boolean) || d.terminal);`],
  ["race does not release the inputs that lost", "O-race use: then releases the others", `    if (ctx.deps.length > 1) ctx.rewire([winner]);\n`, ``],
  ["a terminal does not select its input", "O-race use: the first input to deliver DATA or a terminal", FIRST, `    const first = ctx.deps.find((d) => occurrences(d).length);`],
  ["a loser's ERROR in the selecting wave ends race", "O-race same-wave: what the others deliver in that wave, an ERROR included, is not sent", FIRST, `    const first = ctx.deps.find(errored) ?? ctx.deps.find((d) => occurrences(d).length || d.terminal);`],
  ["a loser's COMPLETE in the selecting wave ends race", "O-race completion: an input that lost does not end race, whatever it ends with", R_FOLLOW, `  sendArrays(ctx, selected);\n  if (ctx.deps.some(completed)) ctx.down([["COMPLETE"]]);`],
  ["race sends the selected input's DATA before its ERROR of the same wave", "O-race use: follows the one selected, and its terminal; O-common: an input's ERROR ends the operator without that wave's DATA", `${R_ERR}\n  sendArrays(ctx, selected);`, `  sendArrays(ctx, selected);\n  if (errored(selected)) { ctx.down([selected.terminal]); return; }`],
  ["race ignores the selected input's ERROR", "O-race use: follows the one selected, and its terminal", `${R_ERR}\n`, ``],
  ["race does not end with the input it follows", "O-race use: follows the one selected: its arrays, and its terminal", R_FOLLOW, `  sendArrays(ctx, selected);`],
  ["race puts the selected input's COMPLETE in its last DATA array", "O-race use: follows the one selected, and its terminal; O-common: after DATA it would have sent anyway the COMPLETE is an array of its own",
    R_FOLLOW, `  const sent = selected.waves.filter((w) => w.length).map((w) => w.map((v) => ["DATA", v]));\n  if (completed(selected)) { if (sent.length) sent[sent.length - 1].push(["COMPLETE"]); else sent.push([["COMPLETE"]]); }\n  for (const array of sent) ctx.down(array);`],
  ["race keeps its output at the selected input's INVALIDATE", "O-race invalidation: only the selected input's INVALIDATE retracts the output", `${R_INV}\n`, ``],
  ["race retracts for the INVALIDATE of an input that lost, before it is released", "O-race invalidation: also while the others are still being released", R_INV, `  if (ctx.deps.some((d) => d.invalidated)) ctx.down([["INVALIDATE"]]);`],
  ["race keeps its selection across activations, outside private state", "O-common: an operator that deactivates without having ended forgets it",
    [[R_HEAD, `let memo = null;\nfunction raceFn(ctx) {\n  let winner = ctx.state.get()?.winner ?? memo;`], [`    ctx.state.set({ winner });`, `    ctx.state.set({ winner });\n    memo = winner;`]]],
  // found by the whole-branch review (2026-11-21); OT-110, OT-111 and OT-103 hold them
  ["race selects an input for an INVALIDATE that removed its DATA of the wave", "O-common: an operator is given of a wave what R-invalidation leaves; O-race use: the first input to deliver DATA or a terminal",
    `    const first = ctx.deps.find((d) => occurrences(d).length || d.terminal);`, `    const first = ctx.deps.find((d) => occurrences(d).length || d.terminal || d.invalidated);`],
  ["zip activated on inputs that have ended sends the ERROR one ended with", "O-zip same-wave: an ERROR that follows that DATA, in the same wave or in the snapshot zip activates on, is not sent",
    [[`function zipFn(ctx) {\n`, `function zipFn(ctx) {\n  const fresh = ctx.state.get() === undefined;\n`], [`  if (error && !(ends && out.length)) { ctx.down([error]); return; }`, `  if (error && !(ends && out.length && !fresh)) { ctx.down([error]); return; }`]]],
  ["withLatestFrom sends nothing for a value the primary holds at activation", "O-withLatestFrom use: a value the primary holds when withLatestFrom activates is an occurrence as any other",
    [[`function withLatestFromFn(ctx) {\n`, `function withLatestFromFn(ctx) {\n  const fresh = ctx.state.get() === undefined;\n  ctx.state.set(true);\n`], [`  if (secondaries.every((d) => d.has)) {`, `  if (!fresh && secondaries.every((d) => d.has)) {`]]],
  // the review of 2026-11-21: a restored operator whose input changed while saved, activation on an input that has ended, two terminals in one wave
  ["zip completes when one input's COMPLETE and another's ERROR share a wave that forms no tuple", "O-common: an input's ERROR ends the operator, also when another input completes in that wave; O-zip completion: its ERROR ends zip unless a tuple of that run ended zip first",
    [["  if (error && !(ends && out.length)) { ctx.down([error]); return; }", "  if (error && !ends) { ctx.down([error]); return; }"]]],
  ["zip ends with the later-declared input's ERROR when two inputs error in one wave", "O-common: where a contract says nothing, the inputs of one wave are taken in declared order",
    [["  const error = ctx.deps.find(errored)?.terminal;", "  const error = ctx.deps.findLast(errored)?.terminal;"]]],
  ["a restored zip whose input changed while saved forgets what it queued", "O-common: a checkpoint saves an operator's progress",
    [["  const state = ctx.state.get() ?? {", "  const state = (ctx.seed !== undefined ? undefined : ctx.state.get()) ?? {"]]],
  ["a restored withLatestFrom whose primary changed while saved sends nothing for the new value", "O-withLatestFrom use: sends, for each DATA of the primary; R-checkpoint: a restored node is given a changed dependency as changed",
    [["  if (secondaries.every((d) => d.has)) {", "  if (ctx.seed === undefined && secondaries.every((d) => d.has)) {"]]],
  ["a restored withLatestFrom whose secondary changed while saved sends its primary's unchanged value again", "O-withLatestFrom use: a secondary's occurrence alone sends nothing, and at a restored one's first activation a primary value it had already received is not an occurrence again",
    [["    for (const w of primary.waves) if (w.length) ctx.down(", "    for (const w of (ctx.seed !== undefined && !primary.waves.length && primary.has ? [[primary.value]] : primary.waves)) if (w.length) ctx.down("]]],
  ["a restored concat whose current source changed while saved forgets its position", "O-common: a checkpoint saves an operator's progress",
    [["    let index = ctx.state.get()?.index ?? 0;", "    let index = ctx.seed !== undefined ? 0 : ctx.state.get()?.index ?? 0;"]]],
  ["a restored concat whose current source completed while saved does not move on", "O-concat use: subscribes to the next only when the current one completes; R-checkpoint: a restored node is given a changed dependency as changed",
    [["    if (completed(current)) {\n      index += 1;", "    if (completed(current) && ctx.seed === undefined) {\n      index += 1;"]]],
  ["withLatestFrom activated on a primary that has completed does not complete", "O-withLatestFrom completion: the primary's COMPLETE ends the branch; O-common: at activation an operator runs on its inputs' snapshots",
    [["function withLatestFromFn(ctx) {\n", "function withLatestFromFn(ctx) {\n  const fresh = ctx.state.get() === undefined;\n  ctx.state.set(true);\n"], ["  if (completed(primary)) ctx.down([[\"COMPLETE\"]]);", "  if (completed(primary) && !fresh) ctx.down([[\"COMPLETE\"]]);"]]],
];

mutantSuite({ module: "combine", operators: ["merge", "withLatestFrom", "zip", "concat", "race"], mutants: MUTANTS, minTraces: 18 });
