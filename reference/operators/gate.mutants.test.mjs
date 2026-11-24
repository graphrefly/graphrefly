// Mutants of gate.mjs against the canonical traces; mutants.mjs says what a mutant must do.

import { mutantSuite } from "./mutants.mjs";

const V_INV = `  if (source.invalidated) ctx.down([["INVALIDATE"]]);\n  const error = ctx.deps.find(errored)?.terminal;`;
const V_ERR = `  const error = ctx.deps.find(errored)?.terminal;\n  if (error) { ctx.down([error]); return; }\n  const open`;
const V_FAIL = `  if (error) { ctx.down([error]); return; }\n  const open`;
const OPEN = `  const open = control.has && control.value === true;`;
const V_SEND = `  if (open) for (const w of source.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));`;
const V_END = `  if (completed(source)) ctx.down([["COMPLETE"]]);`;
const V_POLICY = `valveFn, { ...gatePolicies, recipe: { ref: "operators.valve", config: null } }`;
const PAUSED = `export const isPaused = (control) => control.has && control.value.length > 0;`;
const P_HEAD = `  let held = ctx.state.get() ?? [];`;
const P_INV = `  if (input.invalidated) {\n    held = [];\n    ctx.down([["INVALIDATE"]]);\n  }`;
const P_SEEDED = `  if (ctx.seed !== undefined && !input.has) held = [];`;
const P_LOCK_ERR = `  if (errored(control) && !errored(input)) { ctx.state.set([]); ctx.down([control.terminal]); return; }`;
const P_HOLD = `  held = [...held, ...input.waves.filter((w) => w.length)];`;
const P_PAUSED = `    ctx.state.set(end ? [] : held);\n    if (end) ctx.down([end]);\n    return;`;
const P_CLEAR = `  ctx.state.set([]);\n  held.forEach(`;
const P_RELEASE = `  held.forEach((w, i) => ctx.down([...w.map((v) => ["DATA", v]), ...(end && i === held.length - 1 ? [end] : [])]));`;
const P_POLICY = `pausableFn, { ...gatePolicies, recipe: { ref: "operators.pause", config: null } }`;

const MUTANTS = [
  // valve: its use
  ["valve opens for any control value that holds", "O-valve use: it starts closed and opens only on an explicit true", OPEN, `  const open = control.has && Boolean(control.value);`],
  ["valve is open until its control has a value", "O-valve use: it starts closed and opens only on an explicit true", OPEN, `  const open = !control.has || control.value === true;`],
  ["valve stays open once it was opened", "O-valve use: sends the source's DATA while the control's value is true, and drops it otherwise", OPEN, `  const open = (control.has && control.value === true) || ctx.state.get() === true;\n  if (open) ctx.state.set(true);`],
  ["valve sends its source's latest value when it opens", "O-valve use: reopening replays nothing", V_SEND, `${V_SEND}\n  if (open && !source.waves.some((w) => w.length) && control.waves.some((w) => w.length) && source.has) ctx.down([["DATA", source.value]]);`],
  ["valve sends only the last DATA of an array", "O-valve use: sends the source's DATA", V_SEND, `  if (open) for (const w of source.waves) if (w.length) ctx.down([["DATA", w[w.length - 1]]]);`],
  ["valve sends a wave's arrays as one", "O-valve use: sends the source's DATA; O-common: on each input's arrays in order", V_SEND, `  if (open && source.waves.flat().length) ctx.down(source.waves.flat().map((v) => ["DATA", v]));`],
  ["valve drops DATA that is falsy", "O-valve use: sends the source's DATA", V_SEND, `  if (open) for (const w of source.waves) if (w.filter(Boolean).length) ctx.down(w.filter(Boolean).map((v) => ["DATA", v]));`],
  // valve: same-wave
  ["valve decides by the control's first value of the wave", "O-valve same-wave: the control's final value of the wave decides for that wave's source DATA", OPEN, `  const seen = control.waves.flat();\n  const open = seen.length ? seen[0] === true : control.has && control.value === true;`],
  ["valve decides by the control's value before the wave", "O-valve same-wave: the control's final value of the wave decides for that wave's source DATA", OPEN, `  const was = ctx.state.get() === true;\n  ctx.state.set(control.has && control.value === true);\n  const open = control.waves.flat().length ? was : control.has && control.value === true;`],
  ["valve is open for a wave in which its control was true at any time", "O-valve same-wave: the control's final value of the wave decides for that wave's source DATA", OPEN, `  const open = (control.has && control.value === true) || control.waves.flat().includes(true);`],
  // valve: completion
  ["valve ends when its control completes", "O-valve completion: the control's COMPLETE alone does not end it", V_END, `  if (completed(source) || completed(control)) ctx.down([["COMPLETE"]]);`],
  ["valve waits for its control to complete too", "O-valve completion: the source's COMPLETE ends the valve", V_END, `  const ended = ctx.state.get() === "ended" || completed(source);\n  if (ended) ctx.state.set("ended");\n  if (ended && control.terminal) ctx.down([["COMPLETE"]]);`],
  ["valve does not end when its source completes while it is closed", "O-valve completion: the source's COMPLETE ends the valve", V_END, `  if (completed(source) && open) ctx.down([["COMPLETE"]]);`],
  ["valve closes when its control completes", "O-valve completion: a control that completed keeps its last value", OPEN, `  const open = control.has && control.value === true && !(ctx.state.get() === "done" || completed(control));\n  if (completed(control)) ctx.state.set("done");`],
  ["valve opens when its control completes", "O-valve completion: a control that completed keeps its last value", OPEN, `  const open = (control.has && control.value === true) || ctx.state.get() === "done" || completed(control);\n  if (completed(control)) ctx.state.set("done");`],
  ["valve sends the source's COMPLETE in the array of the wave's last DATA", "O-common: after DATA it would have sent anyway the COMPLETE is an array of its own",
    [[V_SEND, `  const arrays = open ? source.waves.filter((w) => w.length) : [];\n  arrays.forEach((w, i) => ctx.down([...w.map((v) => ["DATA", v]), ...(completed(source) && i === arrays.length - 1 ? [["COMPLETE"]] : [])]));`], [V_END, `  if (completed(source) && !arrays.length) ctx.down([["COMPLETE"]]);`]]],
  // valve: invalidation
  ["valve does not retract for a source INVALIDATE while it is closed", "O-valve invalidation: a source INVALIDATE retracts the retained output, also while the valve is closed", V_INV, `  if (source.invalidated && control.has && control.value === true) ctx.down([["INVALIDATE"]]);\n  const error = ctx.deps.find(errored)?.terminal;`],
  ["valve does not retract for a source INVALIDATE", "O-valve invalidation: a source INVALIDATE retracts the retained output", V_INV, `  const error = ctx.deps.find(errored)?.terminal;`],
  ["valve retracts for a control INVALIDATE", "O-valve invalidation: a control INVALIDATE alone: the output sent before stays", V_INV, `  if (source.invalidated || control.invalidated) ctx.down([["INVALIDATE"]]);\n  const error = ctx.deps.find(errored)?.terminal;`],
  ["valve stays open when its control is invalidated", "O-valve invalidation: a control INVALIDATE alone leaves the control without a value, which closes the valve", OPEN, `  if (control.has) ctx.state.set(control.value === true);\n  const open = ctx.state.get() === true;`],
  ["valve sends the retraction after the DATA that followed it", "O-common: the retraction goes out first and the DATA after it", [[V_INV, `  const error = ctx.deps.find(errored)?.terminal;`], [V_END, `  if (source.invalidated) ctx.down([["INVALIDATE"]]);\n${V_END}`]]],
  ["valve retracts for a control INVALIDATE in the wave of an ERROR", "O-valve invalidation: in the wave of an ERROR it retracts nothing either", V_FAIL, `  if (error) { if (control.invalidated) ctx.down([["INVALIDATE"]]); ctx.down([error]); return; }\n  const open`],
  ["valve has the default INVALIDATE policy", "O-valve invalidation: a control INVALIDATE alone: the output sent before stays", V_POLICY, `valveFn, { terminal: gatePolicies.terminal, recipe: { ref: "operators.valve", config: null } }`],
  // valve: errors
  ["valve sends the wave's DATA before an ERROR", "O-common: an input's ERROR ends the operator; it does not process that wave's DATA",
    [[V_ERR, `  const error = ctx.deps.find(errored)?.terminal;\n  const open`], [V_END, `  if (error) { ctx.down([error]); return; }\n${V_END}`]]],
  ["valve passes over its control's ERROR", "O-common: an input's ERROR ends the operator with that ERROR", V_ERR, `  const error = errored(source) ? source.terminal : undefined;\n  if (error) { ctx.down([error]); return; }\n  const open`],
  ["valve passes over its source's ERROR", "O-common: an input's ERROR ends the operator with that ERROR", V_ERR, `  const error = errored(control) ? control.terminal : undefined;\n  if (error) { ctx.down([error]); return; }\n  const open`],
  ["valve sends its control's ERROR when both inputs end with one", "O-common: where a contract says nothing, inputs are taken in declared order", V_ERR, `  const error = [...ctx.deps].reverse().find(errored)?.terminal;\n  if (error) { ctx.down([error]); return; }\n  const open`],
  ["valve completes when its source completes in the wave of its control's ERROR", "O-common: an input's ERROR ends the operator, also when another input completes in that wave", V_ERR, `  const error = completed(source) ? undefined : ctx.deps.find(errored)?.terminal;\n  if (error) { ctx.down([error]); return; }\n  const open`],
  // valve: restore and activation
  ["a restored valve sends the value its source holds again", "O-common: a restored operator does not take an unchanged input for a new occurrence", V_SEND, `${V_SEND}\n  if (ctx.seed !== undefined && open && source.has && !source.waves.some((w) => w.length)) ctx.down([["DATA", source.value]]);`],
  ["a restored valve drops what its source sent while the graph was saved", "O-valve use: sends the source's DATA while the control's value is true; R-checkpoint: a changed dependency is given as changed", V_SEND, `  if (open && ctx.seed === undefined) for (const w of source.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));`],
  ["a restored valve sends what its source sent while the graph was saved though its control was closed meanwhile", "O-valve use: drops it otherwise; R-checkpoint: a changed dependency is given as changed", V_SEND, `  if (open || ctx.seed !== undefined) for (const w of source.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));`],
  ["a restored valve does not end when its source completed while the graph was saved", "O-valve completion: the source's COMPLETE ends the valve; R-checkpoint: an end is given as an end", V_END, `  if (completed(source) && ctx.seed === undefined) ctx.down([["COMPLETE"]]);`],
  ["a valve activated with its control true sends nothing of what its source holds", "O-common: at activation it runs on its inputs' snapshots", V_SEND, `  const first = ctx.state.get() === undefined && ctx.seed === undefined;\n  ctx.state.set(1);\n  if (open && !first) for (const w of source.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));`],

  // pause: its use
  ["pause holds nothing: what arrives while a lock is held is dropped", "O-pause use: holds the arrays that arrive while any lock is held", P_PAUSED, `    ctx.state.set([]);\n    if (end) ctx.down([end]);\n    return;`],
  ["pause releases only the last array it held", "O-pause use: sends them, each as it arrived, when the last lock is released", P_RELEASE, `  held.slice(-1).forEach((w, i) => ctx.down([...w.map((v) => ["DATA", v]), ...(end && i === 0 ? [end] : [])]));`],
  ["pause releases the arrays it held as one array", "O-pause use: sends them, each as it arrived", P_RELEASE, `  if (held.length) ctx.down([...held.flat().map((v) => ["DATA", v]), ...(end ? [end] : [])]);`],
  ["pause releases the arrays it held one value at a time", "O-pause use: sends them, each as it arrived", P_RELEASE, `  held.flat().forEach((v, i, all) => ctx.down([["DATA", v], ...(end && i === all.length - 1 ? [end] : [])]));`],
  ["pause releases the arrays it held in reverse order", "O-pause use: sends them, each as it arrived", P_RELEASE, `  [...held].reverse().forEach((w, i) => ctx.down([...w.map((v) => ["DATA", v]), ...(end && i === held.length - 1 ? [end] : [])]));`],
  ["pause releases when one lock of several is released", "O-pause use: when the last lock is released", `  if (isPaused(control)) {`,
    `  const locks = control.has ? control.value.length : 0;\n  const seenLocks = (globalThis.__pauseLocks ??= new WeakMap());\n  const fewer = (seenLocks.get(ctx.signal) ?? 0) > locks;\n  seenLocks.set(ctx.signal, locks);\n  if (isPaused(control) && !fewer) {`],
  ["pause drops DATA that is falsy", "O-pause use: holds the arrays that arrive and sends them, each as it arrived", P_HOLD, `  held = [...held, ...input.waves.map((w) => w.filter(Boolean)).filter((w) => w.length)];`],
  ["pause takes the arrays of one wave for one array", "O-pause use: sends them, each as it arrived (R-pause: keeping its boundaries)", P_HOLD, `  held = [...held, ...(input.waves.flat().length ? [input.waves.flat()] : [])];`],
  ["pause keeps the arrays it released and sends them again at the next release", "O-pause use: sends them when the last lock is released", P_CLEAR, `  ctx.state.set(held);\n  held.forEach(`],
  ["pause is paused while its lock state has no list", "O-pause invalidation: an INVALIDATE of the lock state leaves it without a list, which holds no lock", PAUSED, `export const isPaused = (control) => !control.has || control.value.length > 0;`],
  ["pause is paused by an empty list", "O-pause use: while any lock is held", PAUSED, `export const isPaused = (control) => control.has;`],
  // pause: invalidation
  ["pause keeps what it held across a source INVALIDATE", "O-pause invalidation: discards the arrays held before it, so a resume cannot send them", P_INV, `  if (input.invalidated) {\n    ctx.down([["INVALIDATE"]]);\n  }`],
  ["pause does not retract for a source INVALIDATE while it is paused", "O-pause invalidation: a source INVALIDATE retracts the retained output, also while paused", P_INV, `  if (input.invalidated) {\n    held = [];\n    if (!isPaused(control)) ctx.down([["INVALIDATE"]]);\n  }`],
  ["pause retracts for an INVALIDATE of its lock state", "O-pause invalidation: with nothing held the output sent before stays", P_INV, `  if (input.invalidated || control.invalidated) {\n    if (input.invalidated) held = [];\n    ctx.down([["INVALIDATE"]]);\n  }`],
  ["pause drops what it held when its lock state is invalidated", "O-pause invalidation: every held array is released in one wave, each as it arrived", P_INV, `${P_INV}\n  if (control.invalidated) held = [];`],
  ["pause sends the retraction after the DATA that followed it", "O-pause invalidation: in a release wave that also carries a source INVALIDATE the held arrays older than it are discarded first; O-common: the retraction goes out first",
    [[P_INV, `  if (input.invalidated) held = [];`], [`  if (end && !held.length) ctx.down([end]);\n}`, `  if (end && !held.length) ctx.down([end]);\n  if (input.invalidated) ctx.down([["INVALIDATE"]]);\n}`]]],
  ["pause has the default INVALIDATE policy", "O-pause invalidation: with nothing held the output sent before stays", P_POLICY, `pausableFn, { terminal: gatePolicies.terminal, recipe: { ref: "operators.pause", config: null } }`],
  // pause: completion
  ["pause sends what it held with the source's terminal while it is paused", "O-pause completion: while a lock is held the terminal goes alone and what was held is not sent", P_PAUSED, `    ctx.state.set(end ? [] : held);\n    if (end) { held.forEach((w) => ctx.down(w.map((v) => ["DATA", v]))); ctx.down([end]); }\n    return;`],
  ["pause holds the source's terminal while it is paused", "O-pause completion: the source's terminal passes at once", P_PAUSED, `    ctx.state.set(held);\n    if (end) ctx.state.set([...held, "ended"]);\n    return;`],
  ["pause sends the source's terminal as an array of its own", "O-pause completion: while no lock is held the array it came in goes on as it came, its DATA with the terminal", P_RELEASE, `  held.forEach((w) => ctx.down(w.map((v) => ["DATA", v])));\n  if (end && held.length) ctx.down([end]);`],
  ["pause drops the DATA that comes with the source's ERROR", "O-pause completion: its DATA with the terminal, an ERROR's too", P_RELEASE, `  if (end?.[0] === "ERROR") { ctx.down([end]); return; }\n${P_RELEASE}`],
  ["pause ends when its lock state completes", "O-pause completion: the lock state's COMPLETE alone does not end it", P_LOCK_ERR, `  if (control.terminal && !errored(input)) { ctx.state.set([]); ctx.down([control.terminal]); return; }`],
  ["pause releases when its lock state completes", "O-pause completion: a lock state that completed keeps its list", PAUSED, `export const isPaused = (control) => control.has && control.value.length > 0 && !completed(control);`],
  ["pause passes over its lock state's ERROR", "O-common: an input's ERROR ends the operator with that ERROR", P_LOCK_ERR, `  // passed over`],
  ["pause sends the wave's DATA before its lock state's ERROR", "O-common: an input's ERROR ends the operator; it does not process that wave's DATA", P_LOCK_ERR, `  if (errored(control) && !errored(input)) { ctx.state.set([]); for (const w of input.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v])); ctx.down([control.terminal]); return; }`],
  ["pause sends its lock state's ERROR when both inputs end with one", "O-common: where a contract says nothing, inputs are taken in declared order", P_LOCK_ERR, `  if (errored(control)) { ctx.state.set([]); ctx.down([control.terminal]); return; }`],
  ["pause completes when its source completes in the wave of its lock state's ERROR", "O-common: an input's ERROR ends the operator, also when another input completes in that wave", P_LOCK_ERR, `  if (errored(control) && !input.terminal) { ctx.state.set([]); ctx.down([control.terminal]); return; }`],
  // pause: restore and activation
  ["a restored pause forgets what it held", "O-common: a checkpoint saves an operator's progress", P_HEAD, `  let held = ctx.seed !== undefined ? [] : ctx.state.get() ?? [];`],
  ["a restored pause holds the value its source holds again", "O-common: a restored operator does not take an unchanged input for a new occurrence", P_HOLD, `${P_HOLD}\n  if (ctx.seed !== undefined && input.has && !input.waves.some((w) => w.length)) held = [...held, [input.value]];`],
  ["a restored pause drops what its source sent while the graph was saved", "O-pause use: holds the arrays that arrive while any lock is held; R-checkpoint: a changed dependency is given as changed", P_HOLD, `  if (ctx.seed === undefined) held = [...held, ...input.waves.filter((w) => w.length)];`],
  ["a restored pause does not end when its source ended while the graph was saved", "O-pause completion: the source's terminal passes at once; R-checkpoint: an end is given as an end", `  const end = input.terminal;`, `  const end = ctx.seed === undefined ? input.terminal : null;`],
  ["a restored pause keeps what it held when its source was invalidated while the graph was saved", "O-pause recovery: a restored pausable whose source no longer holds a value discards what it held", P_SEEDED, `  void 0;`],
  ["a restored pause whose source was invalidated while the graph was saved retracts what it had sent", "O-pause recovery: the output is kept, as R-checkpoint keeps a restored node's own value", P_SEEDED, `  if (ctx.seed !== undefined && !input.has) { held = []; ctx.down([["INVALIDATE"]]); }`],
  ["a restored pause discards what it held when its source brings nothing new", "O-pause recovery: a restored pausable whose source no longer holds a value; O-common: a checkpoint saves an operator's progress", P_SEEDED, `  if (ctx.seed !== undefined && !input.waves.some((w) => w.length)) held = [];`],
  ["a restored pause discards what it held when its source changed while the graph was saved", "O-pause recovery: a restored pausable whose source no longer holds a value; R-checkpoint: an INVALIDATE followed by a write of another value is seen as the write", P_SEEDED, `  if (ctx.seed !== undefined && (!input.has || input.waves.some((w) => w.length))) held = [];`],
  ["a pause activated while a lock is held drops what its source holds", "O-pause use: holds the arrays that arrive while any lock is held; O-common: at activation it runs on its inputs' snapshots", P_HOLD, `  if (!(ctx.state.get() === undefined && ctx.seed === undefined && isPaused(control))) held = [...held, ...input.waves.filter((w) => w.length)];`],
];

mutantSuite({ module: "gate", operators: ["valve", "pause"], mutants: MUTANTS, minTraces: 74 });
