// Mutants of time.mjs against the canonical traces; mutants.mjs says what a mutant must do.
//
// The six operators repeat one another's lines, and a mutant's text must occur once in the file,
// so a mutant of one operator is written as an edit within that operator's factory: of(block,
// from, to) gives the factory's whole text and the same text with `from`, which it holds once,
// replaced.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { mutantSuite } from "./mutants.mjs";

const source = readFileSync(fileURLToPath(new URL("./time.mjs", import.meta.url)), "utf8");
const block = (name) => {
  const from = source.indexOf(`function ${name}Of(`);
  assert.ok(from >= 0, name);
  return source.slice(from, source.indexOf("\n}\n", from) + 3);
};
const of = (text, ...pairs) => {
  let edited = text;
  for (let i = 0; i < pairs.length; i += 2) {
    assert.equal(text.split(pairs[i]).length - 1, 1, `occurs once in its factory: ${pairs[i]}`);
    edited = edited.replace(pairs[i], () => pairs[i + 1]);
  }
  return [text, edited];
};
const DB = block("debounce"), TH = block("throttle"), AU = block("auditTime"), DL = block("delay"), BT = block("bufferTime"), TO = block("timeout");

const RETRACT = `    if (source.invalidated) ctx.down([["INVALIDATE"]]);`;
const LATEST = `    if (values.length) candidate = [values[values.length - 1]];`;
const FLUSH = `ctx.down([...data(candidate), ["COMPLETE"]]); return; }`;
const CAND_ERR = `    if (errored(source)) { ctx.state.set({ candidate: [] }); ctx.down([source.terminal]); return; }`;
const CLEANUP = `    return cleanup(ctx, timers);`;
const DB_WAIT = `    stopAll(ctx, timers);\n    start(ctx, timers, ms, () => {`;
const DB_FIRE = `      ctx.state.set({ candidate: [] });\n      ctx.down(data(candidate));`;
const DB_DROP = `    if (source.invalidated || lostItsValue(ctx, source)) { candidate = []; stopAll(ctx, timers); }`;
const DB_ARM = `    if (values.length) wait(ctx);`;
const DB_SETUP = `    if (ctx.state.get()?.candidate.length) wait(ctx);`;
const TH_OPEN = `    if (values.length && running(ctx).size === 0) {`;
const TH_SEND = `      ctx.down([["DATA", values[0]]]);`;
const TH_START = `      start(ctx, timers, ms, () => {});`;
const TH_ERR = `    if (errored(source)) { ctx.down([source.terminal]); return; }`;
const TH_END = `    if (completed(source)) ctx.down([["COMPLETE"]]);`;
const TH_SETUP = `setup: (ctx) => cleanup(ctx, timers) };`;
const AU_OPEN = `  const open = (ctx) => start(ctx, timers, ms, () => {`;
const AU_FIRE = `    ctx.state.set({ candidate: [] });\n    ctx.down(data(candidate));\n  });`;
const AU_DROP = `    if (source.invalidated || lostItsValue(ctx, source)) candidate = [];`;
const AU_ARM = `    if (values.length && running(ctx).size === 0) open(ctx);`;
const AU_SETUP = `    if (ctx.state.get()?.candidate.length) open(ctx);`;
const DL_LATER = `  const later = (ctx) => start(ctx, timers, ms, () => {`;
const DL_HEAD = `    const [item, ...queue] = ctx.state.get().queue;`;
const DL_INV = `    if (item.invalidate) ctx.down([["INVALIDATE"]]);\n`;
const DL_ARRAYS = `    for (const values of item.arrays) ctx.down(data(values));`;
const DL_END = `    if (item.complete) ctx.down([["COMPLETE"]]);`;
const DL_QUEUE = `    const queue = ctx.state.get()?.queue ?? [];`;
const DL_ERR = `    if (errored(source)) { stopAll(ctx, timers); ctx.state.set({ queue: [] }); ctx.down([source.terminal]); return; }`;
const DL_ITEM = `    const item = { invalidate: source.invalidated === true, arrays: source.waves.filter((values) => values.length), complete: completed(source) };`;
const DL_PUSH = `    ctx.state.set({ queue: [...queue, item] });\n    later(ctx);`;
const DL_SETUP = `    for (const _ of ctx.state.get()?.queue ?? []) later(ctx);`;
const BT_ITEMS = `    const items = [...(ctx.state.get()?.items ?? []), ...occurrences(source)];`;
const BT_ERR = `    if (errored(source)) { ctx.state.set({ items: [] }); ctx.down([source.terminal]); return; }`;
const BT_TAIL = `ctx.down(items.length ? [["DATA", items], ["COMPLETE"]] : [["COMPLETE"]]); return; }`;
const BT_KEEP = `    ctx.state.set({ items });\n  };`;
const BT_WINDOW = `    const window = () => start(ctx, timers, ms, () => {\n      window();\n`;
const BT_EMPTY = `      if (!items.length) return;`;
const BT_SEND = `      ctx.state.set({ items: [] });\n      ctx.down([["DATA", items]]);`;
const BT_START = `    window();\n    return cleanup(ctx, timers);`;
const TO_FIRE = `    start(ctx, timers, ms, () => ctx.down([["ERROR", "timeout"]]));`;
const TO_ERR = `    if (errored(source)) { ctx.down([source.terminal]); return; }`;
const TO_SEND = `    for (const values of source.waves) if (values.length) ctx.down(data(values));`;
const TO_RESET = `    if (occurrences(source).length) watch(ctx);`;
const TO_SETUP = `    watch(ctx);\n    return cleanup(ctx, timers);`;

const USE = { db: "O-debounce use: sends the latest DATA once a full quiet interval has passed since the last occurrence", th: "O-throttle use: sends a DATA and then drops DATA for the interval; there is no trailing emission", au: "O-auditTime use: opens a fixed window at an input and sends the latest candidate at that window's deadline; later inputs in the window do not move it", dl: "O-delay use: sends its source's DATA, in the arrays they came in, and its normal COMPLETE the given time later, in source order", bt: "O-bufferTime use: collects the source's DATA payloads in fixed windows that start at activation and sends each window's payloads as one DATA; an empty window sends nothing", to: "O-timeout use: sends its source's arrays and ends with an ERROR whose payload is \"timeout\" when the source stays silent for the given time, measured from activation and from each DATA; only DATA resets it" };
const SENT_NOW = `{ const { candidate } = ctx.state.get(); ctx.state.set({ candidate: [] }); ctx.down(data(candidate)); }`;

const MUTANTS = [
  // debounce: its use
  ["debounce does not start the interval again at a later value", USE.db, ...of(DB, DB_WAIT, `    if (running(ctx).size) return;\n    start(ctx, timers, ms, () => {`)],
  ["debounce keeps the first value of an interval", USE.db, ...of(DB, LATEST, `    if (values.length && !candidate.length) candidate = [values[0]];`)],
  ["debounce keeps the first value of a wave", USE.db, ...of(DB, LATEST, `    if (values.length) candidate = [values[0]];`)],
  ["debounce sends the value that starts an interval at once", USE.db, ...of(DB, DB_ARM, `    if (values.length && !running(ctx).size) ctx.down(data(candidate));\n${DB_ARM}`)],
  ["debounce waits one ms less", USE.db, ...of(DB, DB_WAIT, `    stopAll(ctx, timers);\n    start(ctx, timers, ms - 1, () => {`)],
  ["debounce waits one ms more", USE.db, ...of(DB, DB_WAIT, `    stopAll(ctx, timers);\n    start(ctx, timers, ms + 1, () => {`)],
  ["debounce sends its value again after every interval", USE.db, ...of(DB, DB_FIRE, `      ctx.down(data(candidate));\n      wait(ctx);`)],
  ["debounce sends every value of the wave when the interval ends", USE.db, ...of(DB, LATEST, `    if (values.length) candidate = values;`)],
  // debounce: completion
  ["debounce's COMPLETE does not send the candidate", "O-debounce completion: the source's normal COMPLETE sends a pending candidate at once, with the terminal", ...of(DB, FLUSH, `ctx.down([["COMPLETE"]]); return; }`)],
  ["debounce's COMPLETE waits for the interval", "O-debounce completion: at once", ...of(DB, FLUSH, `if (candidate.length) { stopAll(ctx, timers); start(ctx, timers, ms, () => ctx.down([...data(candidate), ["COMPLETE"]])); } else ctx.down([["COMPLETE"]]); return; }`)],
  ["debounce sends the candidate in an array before the COMPLETE's", "O-debounce completion: with the terminal", ...of(DB, FLUSH, `if (candidate.length) ctx.down(data(candidate)); ctx.down([["COMPLETE"]]); return; }`)],
  ["debounce's COMPLETE sends the candidate that waited, not the value that came with it", "O-debounce completion: sends a pending candidate; use: the latest DATA", ...of(DB, LATEST, `    if (values.length && !(completed(source) && candidate.length)) candidate = [values[values.length - 1]];`)],
  ["debounce's ERROR sends the candidate first", "O-debounce completion: a source ERROR discards it", ...of(DB, CAND_ERR, `    if (errored(source)) { ctx.state.set({ candidate: [] }); if (candidate.length) ctx.down(data(candidate)); ctx.down([source.terminal]); return; }`)],
  ["debounce takes the value that came with the ERROR for its candidate and sends it", "O-common: an input's ERROR ends the operator without that wave's DATA", ...of(DB, CAND_ERR, `    if (errored(source) && occurrences(source).length) { ctx.down([["DATA", occurrences(source)[0]], source.terminal]); return; }\n${CAND_ERR}`)],
  // debounce: invalidation
  ["debounce keeps its candidate through an INVALIDATE", "O-debounce invalidation: drops the candidate and its timer", ...of(DB, DB_DROP, `    if (lostItsValue(ctx, source)) { candidate = []; stopAll(ctx, timers); }`)],
  ["debounce does not retract", "O-debounce invalidation: a source INVALIDATE retracts the output", ...of(DB, RETRACT, `    void 0;`)],
  ["debounce drops the candidate that came after the INVALIDATE in its wave", "O-debounce invalidation; O-common: what came after the INVALIDATE is ordinary input", ...of(DB, LATEST, `    if (values.length && !source.invalidated) candidate = [values[values.length - 1]];`)],
  // debounce: recovery
  ["a restored debounce does not wait again", "O-debounce recovery: at a restored operator's first activation its quiet interval starts again in full", ...of(DB, DB_SETUP, `    void 0;`)],
  ["a restored debounce sends its candidate at once", "O-debounce recovery: its quiet interval starts again in full", ...of(DB, DB_SETUP, `    if (ctx.state.get()?.candidate.length) ${SENT_NOW}`)],
  ["a restored debounce forgets its candidate", "O-debounce recovery: the candidate is private state", ...of(DB, DB_SETUP, `    if (ctx.seed !== undefined) ctx.state.set({ candidate: [] });`)],
  ["a restored debounce takes what its source holds for a new candidate", "O-common: a restored operator does not take an unchanged input for a new occurrence", ...of(DB, DB_SETUP, `    if (ctx.seed !== undefined && ctx.deps[0].has) ctx.state.set({ candidate: [ctx.deps[0].value] });\n${DB_SETUP}`)],
  ["a restored debounce whose source was invalidated keeps its candidate", "O-debounce recovery: a restored debounce whose source no longer holds a value drops its candidate", ...of(DB, DB_DROP, `    if (source.invalidated) { candidate = []; stopAll(ctx, timers); }`)],
  ["a restored debounce whose source was invalidated retracts its output", "O-debounce recovery: the output is kept", ...of(DB, RETRACT, `    if (source.invalidated || lostItsValue(ctx, source)) ctx.down([["INVALIDATE"]]);`)],

  // throttle: its use
  ["throttle sends the last value of a wave", USE.th, ...of(TH, TH_SEND, `      ctx.down([["DATA", values[values.length - 1]]]);`)],
  ["throttle sends every value of the wave that starts an interval", USE.th, ...of(TH, TH_SEND, `      ctx.down(data(values));`)],
  ["throttle never drops", USE.th, ...of(TH, TH_OPEN, `    if (values.length) {`)],
  ["throttle sends the latest dropped value when the interval ends", "O-throttle use: there is no trailing emission", ...of(TH, `${TH_START}\n    }`, `      start(ctx, timers, ms, () => { const kept = ctx.state.get() ?? []; ctx.state.set([]); if (kept.length) ctx.down(data(kept)); });\n    } else if (values.length) ctx.state.set([values[values.length - 1]]);`)],
  ["a dropped value starts the interval again", USE.th, ...of(TH, `${TH_START}\n    }`, `${TH_START}\n    } else if (values.length) { stopAll(ctx, timers); start(ctx, timers, ms, () => {}); }`)],
  ["throttle's interval is one ms short", USE.th, ...of(TH, TH_START, `      start(ctx, timers, ms - 1, () => {});`)],
  ["throttle's interval is one ms long", USE.th, ...of(TH, TH_START, `      start(ctx, timers, ms + 1, () => {});`)],
  ["throttle drops a value that comes with the COMPLETE", "O-common: after DATA it would have sent anyway the COMPLETE is an array of its own", ...of(TH, TH_OPEN, `    if (values.length && running(ctx).size === 0 && !completed(source)) {`)],
  ["throttle does not complete while an interval runs", "O-common: it completes once every input has ended", ...of(TH, TH_END, `    if (completed(source) && running(ctx).size === 0) ctx.down([["COMPLETE"]]);`)],
  ["throttle sends the value that came with the ERROR", "O-common: an input's ERROR ends the operator without that wave's DATA", ...of(TH, TH_ERR, `    if (errored(source)) { if (occurrences(source).length) ctx.down([["DATA", occurrences(source)[0]]]); ctx.down([source.terminal]); return; }`)],
  // throttle: invalidation
  ["an INVALIDATE ends throttle's interval", "O-throttle invalidation: keeps the running suppression deadline", ...of(TH, RETRACT, `    if (source.invalidated) { stopAll(ctx, timers); ctx.down([["INVALIDATE"]]); }`)],
  ["throttle does not retract", "O-throttle invalidation: a source INVALIDATE retracts the output", ...of(TH, RETRACT, `    void 0;`)],
  ["an INVALIDATE starts an interval", "O-throttle invalidation: keeps the running suppression deadline", ...of(TH, RETRACT, `    if (source.invalidated) { ctx.down([["INVALIDATE"]]); if (!running(ctx).size) start(ctx, timers, ms, () => {}); }`)],
  // throttle: recovery. A restored throttle or timeout that sent what its source holds again at its
  // first activation would show nothing: the value is the one its dependents had received, and the
  // kernel compares values there (R-checkpoint), so that is no mutant.
  ["a restored throttle starts an interval at its first activation", "O-throttle recovery: the suppression deadline is not kept: a restored throttle admits the next occurrence", ...of(TH, TH_SETUP, `setup: (ctx) => { if (ctx.seed !== undefined) start(ctx, timers, ms, () => {}); return cleanup(ctx, timers); } };`)],
  ["a restored throttle whose source was invalidated retracts its output", "O-throttle recovery; R-checkpoint: a restored node's own value is not removed", ...of(TH, RETRACT, `    if (source.invalidated || lostItsValue(ctx, source)) ctx.down([["INVALIDATE"]]);`)],

  // auditTime: its use
  ["a later value moves auditTime's window", USE.au, ...of(AU, AU_ARM, `    if (values.length) { stopAll(ctx, timers); open(ctx); }`)],
  ["auditTime keeps the first value of a window", USE.au, ...of(AU, LATEST, `    if (values.length && !candidate.length) candidate = [values[0]];`)],
  ["auditTime keeps the first value of a wave", USE.au, ...of(AU, LATEST, `    if (values.length) candidate = [values[0]];`)],
  ["auditTime sends the value that opens a window at once", USE.au, ...of(AU, AU_ARM, `    if (values.length && running(ctx).size === 0) { ctx.down(data(candidate)); open(ctx); }`)],
  ["auditTime's window is one ms short", USE.au, ...of(AU, AU_OPEN, `  const open = (ctx) => start(ctx, timers, ms - 1, () => {`)],
  ["auditTime's window is one ms long", USE.au, ...of(AU, AU_OPEN, `  const open = (ctx) => start(ctx, timers, ms + 1, () => {`)],
  ["auditTime's windows follow one another once one was opened", USE.au, ...of(AU, AU_FIRE, `    ctx.state.set({ candidate: [] });\n    ctx.down(data(candidate));\n    open(ctx);\n  });`)],
  ["auditTime sends its value again at the end of every later window", USE.au, ...of(AU, AU_FIRE, `    ctx.down(data(candidate));\n  });`)],
  // auditTime: completion
  ["auditTime's COMPLETE does not send the candidate", "O-auditTime completion: the source's normal COMPLETE sends a pending candidate at once, with the terminal", ...of(AU, FLUSH, `ctx.down([["COMPLETE"]]); return; }`)],
  ["auditTime's COMPLETE waits for the window's end", "O-auditTime completion: at once", ...of(AU, FLUSH, `if (candidate.length) { stopAll(ctx, timers); start(ctx, timers, ms, () => ctx.down([...data(candidate), ["COMPLETE"]])); } else ctx.down([["COMPLETE"]]); return; }`)],
  ["auditTime sends the candidate in an array before the COMPLETE's", "O-auditTime completion: with the terminal", ...of(AU, FLUSH, `if (candidate.length) ctx.down(data(candidate)); ctx.down([["COMPLETE"]]); return; }`)],
  ["auditTime's COMPLETE sends the candidate that waited, not the value that came with it", "O-auditTime completion: sends a pending candidate; use: the latest candidate", ...of(AU, LATEST, `    if (values.length && !(completed(source) && candidate.length)) candidate = [values[values.length - 1]];`)],
  ["auditTime's ERROR sends the candidate first", "O-auditTime completion: a source ERROR discards it", ...of(AU, CAND_ERR, `    if (errored(source)) { ctx.state.set({ candidate: [] }); if (candidate.length) ctx.down(data(candidate)); ctx.down([source.terminal]); return; }`)],
  // auditTime: invalidation
  ["auditTime keeps its candidate through an INVALIDATE", "O-auditTime invalidation: drops the candidate", ...of(AU, AU_DROP, `    if (lostItsValue(ctx, source)) candidate = [];`)],
  ["an INVALIDATE closes auditTime's window", "O-auditTime invalidation: keeps the window's end", ...of(AU, AU_DROP, `    if (source.invalidated || lostItsValue(ctx, source)) candidate = [];\n    if (source.invalidated) stopAll(ctx, timers);`)],
  ["auditTime does not retract", "O-auditTime invalidation: a source INVALIDATE retracts the output", ...of(AU, RETRACT, `    void 0;`)],
  ["auditTime drops the candidate that came after the INVALIDATE in its wave", "O-auditTime invalidation; O-common: what came after the INVALIDATE is ordinary input", ...of(AU, LATEST, `    if (values.length && !source.invalidated) candidate = [values[values.length - 1]];`)],
  // auditTime: recovery
  ["a restored auditTime opens no window for its candidate", "O-auditTime recovery: at a restored operator's first activation its window starts again in full", ...of(AU, AU_SETUP, `    void 0;`)],
  ["a restored auditTime sends its candidate at once", "O-auditTime recovery: its window starts again in full", ...of(AU, AU_SETUP, `    if (ctx.state.get()?.candidate.length) ${SENT_NOW}`)],
  ["a restored auditTime forgets its candidate", "O-auditTime recovery: the candidate is private state", ...of(AU, AU_SETUP, `    if (ctx.seed !== undefined) ctx.state.set({ candidate: [] });`)],
  ["a restored auditTime opens a window without a candidate", "O-auditTime recovery: the candidate is private state", ...of(AU, AU_SETUP, `    if (ctx.seed !== undefined) open(ctx);`)],
  ["a restored auditTime whose source was invalidated keeps its candidate", "O-auditTime recovery: a restored auditTime whose source no longer holds a value drops its candidate", ...of(AU, AU_DROP, `    if (source.invalidated) candidate = [];`)],
  ["a restored auditTime whose source was invalidated retracts its output", "O-auditTime recovery: the output is kept", ...of(AU, RETRACT, `    if (source.invalidated || lostItsValue(ctx, source)) ctx.down([["INVALIDATE"]]);`)],

  // delay: its use
  ["delay sends a wave's arrays as one", USE.dl, ...of(DL, DL_ARRAYS, `    if (item.arrays.length) ctx.down(data(item.arrays.flat()));`)],
  ["delay sends only the last value of a wave", USE.dl, ...of(DL, DL_ARRAYS, `    if (item.arrays.length) ctx.down(data(item.arrays.flat().slice(-1)));`)],
  ["delay sends the newest item first", "O-delay use: in source order", ...of(DL, DL_HEAD, `    const all = ctx.state.get().queue;\n    const item = all[all.length - 1], queue = all.slice(0, -1);`)],
  ["delay waits one ms less", USE.dl, ...of(DL, DL_LATER, `  const later = (ctx) => start(ctx, timers, ms - 1, () => {`)],
  ["delay waits one ms more", USE.dl, ...of(DL, DL_LATER, `  const later = (ctx) => start(ctx, timers, ms + 1, () => {`)],
  ["a later value starts every delay again", USE.dl, ...of(DL, DL_PUSH, `    ctx.state.set({ queue: [...queue, item] });\n    stopAll(ctx, timers);\n    for (const _ of [...queue, item]) later(ctx);`)],
  ["delay sends its source's COMPLETE at once, without what is queued", "O-delay use: its normal COMPLETE the given time later, in source order", ...of(DL, DL_ITEM, `    if (completed(source)) { stopAll(ctx, timers); ctx.state.set({ queue: [] }); ctx.down([["COMPLETE"]]); return; }\n${DL_ITEM}`)],
  ["delay sends what is queued at once when its source completes", "O-delay use: its normal COMPLETE the given time later", ...of(DL, DL_ITEM, `${DL_ITEM}\n    if (item.complete) { stopAll(ctx, timers); for (const q of [...queue, item]) for (const values of q.arrays) ctx.down(data(values)); ctx.state.set({ queue: [] }); ctx.down([["COMPLETE"]]); return; }`)],
  ["delay sends the COMPLETE in the array of the wave's last DATA", "O-common: after DATA it would have sent anyway the COMPLETE is an array of its own", ...of(DL, `${DL_ARRAYS}\n${DL_END}`, `    item.arrays.forEach((values, i) => ctx.down([...data(values), ...(item.complete && i === item.arrays.length - 1 ? [["COMPLETE"]] : [])]));\n    if (item.complete && !item.arrays.length) ctx.down([["COMPLETE"]]);`)],
  ["delay does not send the COMPLETE that came with a value", USE.dl, ...of(DL, DL_END, `    if (item.complete && !item.arrays.length) ctx.down([["COMPLETE"]]);`)],
  // delay: completion
  ["delay sends what is queued before its source's ERROR", "O-delay completion: a source ERROR ends delay at once and what is queued is not sent", ...of(DL, DL_ERR, `    if (errored(source)) { stopAll(ctx, timers); for (const q of queue) for (const values of q.arrays) ctx.down(data(values)); ctx.state.set({ queue: [] }); ctx.down([source.terminal]); return; }`)],
  ["delay sends its source's ERROR the given time later", "O-delay completion: a source ERROR ends delay at once", ...of(DL, DL_ERR, `    if (errored(source)) { const end = source.terminal; stopAll(ctx, timers); ctx.state.set({ queue: [] }); start(ctx, timers, ms, () => ctx.down([end])); return; }`)],
  ["delay sends the value that came with the ERROR", "O-common: an input's ERROR ends the operator without that wave's DATA", ...of(DL, DL_ERR, `    if (errored(source)) { stopAll(ctx, timers); ctx.state.set({ queue: [] }); ctx.down([...data(occurrences(source)), source.terminal]); return; }`)],
  // delay: invalidation
  ["delay retracts at once", "O-delay invalidation: the output is retracted when the delayed INVALIDATE arrives", ...of(DL, DL_ITEM, `    if (source.invalidated) ctx.down([["INVALIDATE"]]);\n    const item = { invalidate: false, arrays: source.waves.filter((values) => values.length), complete: completed(source) };`)],
  ["delay never retracts", "O-delay invalidation: a source INVALIDATE is delayed beside DATA", ...of(DL, DL_INV, ``)],
  ["an INVALIDATE drops what delay had queued", "O-delay invalidation: delayed beside DATA, in source order", ...of(DL, DL_QUEUE, `    const queue = source.invalidated ? (stopAll(ctx, timers), []) : ctx.state.get()?.queue ?? [];`)],
  ["delay sends a wave's INVALIDATE after its values", "O-delay invalidation: in source order; O-common: the retraction goes out first and the DATA after it", ...of(DL, DL_INV, ``, DL_END, `${DL_END}\n    if (item.invalidate) ctx.down([["INVALIDATE"]]);`)],
  ["delay drops the values that came after the INVALIDATE in its wave", "O-delay invalidation; O-common: what came after the INVALIDATE is ordinary input", ...of(DL, DL_ITEM, `    const item = { invalidate: source.invalidated === true, arrays: source.invalidated ? [] : source.waves.filter((values) => values.length), complete: completed(source) };`)],
  // delay: recovery
  ["a restored delay starts no timer for what it holds", "O-delay recovery: at a restored operator's first activation every queued item's timer starts again in full", ...of(DL, DL_SETUP, `    void 0;`)],
  ["a restored delay starts a timer for its first item only", "O-delay recovery: every queued item's timer", ...of(DL, DL_SETUP, `    if (ctx.state.get()?.queue.length) later(ctx);`)],
  ["a restored delay sends what it holds at once", "O-delay recovery: starts again in full", ...of(DL, DL_SETUP, `    for (const item of ctx.state.get()?.queue ?? []) { for (const values of item.arrays) ctx.down(data(values)); }\n    if (ctx.state.get()?.queue.length) ctx.state.set({ queue: [] });`)],
  ["a restored delay forgets its queue", "O-delay recovery: the queue is private state", ...of(DL, DL_SETUP, `    if (ctx.seed !== undefined) ctx.state.set({ queue: [] });`)],
  ["a restored delay queues what its source holds again", "O-delay recovery: a saved source value is not queued again", ...of(DL, DL_SETUP, `    if (ctx.seed !== undefined && ctx.deps[0].has) ctx.state.set({ queue: [...(ctx.state.get()?.queue ?? []), { invalidate: false, arrays: [[ctx.deps[0].value]], complete: false }] });\n${DL_SETUP}`)],
  ["a restored delay forgets its queued INVALIDATE and COMPLETE", "O-delay recovery: the queue, with its queued INVALIDATE and normal COMPLETE, is private state", ...of(DL, DL_SETUP, `    if (ctx.seed !== undefined) ctx.state.set({ queue: (ctx.state.get()?.queue ?? []).filter((item) => item.arrays.length).map((item) => ({ ...item, invalidate: false, complete: false })) });\n${DL_SETUP}`)],
  ["a restored delay whose source was invalidated queues an INVALIDATE", "O-delay recovery; R-checkpoint: a restored node's own value is not removed", ...of(DL, DL_ITEM, `    const item = { invalidate: source.invalidated === true || lostItsValue(ctx, source), arrays: source.waves.filter((values) => values.length), complete: completed(source) };`)],

  // bufferTime: its use
  ["an empty window sends an empty list", "O-bufferTime use: an empty window sends nothing", ...of(BT, BT_EMPTY, `      void 0;`)],
  ["bufferTime sends each payload as a DATA of its own", USE.bt, ...of(BT, BT_SEND, `      ctx.state.set({ items: [] });\n      ctx.down(data(items));`)],
  ["bufferTime's window starts at its first value", "O-bufferTime use: fixed windows that start at activation", ...of(BT, BT_WINDOW, `    const window = () => start(ctx, timers, ms, () => {\n`, BT_START, `    running(ctx).open = window;\n    return cleanup(ctx, timers);`, BT_KEEP, `    ctx.state.set({ items });\n    if (items.length && running(ctx).size === 0) running(ctx).open();\n  };`)],
  ["bufferTime has one window only", "O-bufferTime use: fixed windows", ...of(BT, BT_WINDOW, `    const window = () => start(ctx, timers, ms, () => {\n`)],
  ["bufferTime's window is one ms short", USE.bt, ...of(BT, BT_WINDOW, `    const window = () => start(ctx, timers, ms - 1, () => {\n      window();\n`)],
  ["bufferTime's window is one ms long", USE.bt, ...of(BT, BT_WINDOW, `    const window = () => start(ctx, timers, ms + 1, () => {\n      window();\n`)],
  ["bufferTime keeps what it sent in the next window's list", USE.bt, ...of(BT, BT_SEND, `      ctx.down([["DATA", items]]);`)],
  ["bufferTime sends the latest payload of a window", USE.bt, ...of(BT, BT_SEND, `      ctx.state.set({ items: [] });\n      ctx.down([["DATA", items[items.length - 1]]]);`)],
  ["bufferTime collects the last value of a wave only", USE.bt, ...of(BT, BT_ITEMS, `    const items = [...(ctx.state.get()?.items ?? []), ...occurrences(source).slice(-1)];`)],
  // bufferTime: completion
  ["bufferTime's COMPLETE does not send the tail", "O-bufferTime completion: the source's normal COMPLETE sends a nonempty tail with the terminal", ...of(BT, BT_TAIL, `ctx.down([["COMPLETE"]]); return; }`)],
  ["bufferTime's COMPLETE sends an empty tail", "O-bufferTime completion: a nonempty tail", ...of(BT, BT_TAIL, `ctx.down([["DATA", items], ["COMPLETE"]]); return; }`)],
  ["bufferTime sends the tail in an array before the COMPLETE's", "O-bufferTime completion: with the terminal", ...of(BT, BT_TAIL, `if (items.length) ctx.down([["DATA", items]]); ctx.down([["COMPLETE"]]); return; }`)],
  ["bufferTime's tail leaves out the value that came with the COMPLETE", "O-bufferTime completion: a nonempty tail", ...of(BT, BT_ITEMS, `    const items = [...(ctx.state.get()?.items ?? []), ...(completed(source) ? [] : occurrences(source))];`)],
  ["bufferTime's ERROR sends the tail first", "O-common: an input's ERROR ends the operator, and what it had pending is not sent", ...of(BT, BT_ERR, `    if (errored(source)) { ctx.state.set({ items: [] }); if (items.length) ctx.down([["DATA", items]]); ctx.down([source.terminal]); return; }`)],
  // bufferTime: invalidation
  ["an INVALIDATE drops what bufferTime collected", "O-bufferTime invalidation: keeps the collected payloads", ...of(BT, BT_ITEMS, `    const items = [...(source.invalidated ? [] : ctx.state.get()?.items ?? []), ...occurrences(source)];`)],
  ["an INVALIDATE starts bufferTime's window again", "O-bufferTime invalidation: keeps the window's end", ...of(BT, BT_START, `    running(ctx).open = window;\n    window();\n    return cleanup(ctx, timers);`, RETRACT, `    if (source.invalidated) { const { open } = running(ctx); stopAll(ctx, timers); open(); ctx.down([["INVALIDATE"]]); }`)],
  ["bufferTime does not retract", "O-bufferTime invalidation: a source INVALIDATE retracts the output", ...of(BT, RETRACT, `    void 0;`)],
  // bufferTime: recovery
  ["a restored bufferTime sends what it collected at once", "O-bufferTime recovery: its window starts again from that activation", ...of(BT, BT_START, `    if (ctx.seed !== undefined && ctx.state.get()?.items.length) { const { items } = ctx.state.get(); ctx.state.set({ items: [] }); ctx.down([["DATA", items]]); }\n${BT_START}`)],
  ["a restored bufferTime forgets what it collected", "O-bufferTime recovery: the collected payloads are private state", ...of(BT, BT_START, `    if (ctx.seed !== undefined) ctx.state.set({ items: [] });\n${BT_START}`)],
  ["a restored bufferTime collects what its source holds again", "O-common: a restored operator does not take an unchanged input for a new occurrence", ...of(BT, BT_START, `    if (ctx.seed !== undefined && ctx.deps[0].has) ctx.state.set({ items: [...(ctx.state.get()?.items ?? []), ctx.deps[0].value] });\n${BT_START}`)],
  ["a restored bufferTime whose source was invalidated drops what it collected", "O-bufferTime recovery; invalidation: keeps the collected payloads", ...of(BT, BT_ITEMS, `    const items = [...(lostItsValue(ctx, source) ? [] : ctx.state.get()?.items ?? []), ...occurrences(source)];`)],

  // timeout: its use
  ["timeout completes when its time has passed", USE.to, ...of(TO, TO_FIRE, `    start(ctx, timers, ms, () => ctx.down([["COMPLETE"]]));`)],
  ["timeout's ERROR has another payload", USE.to, ...of(TO, TO_FIRE, `    start(ctx, timers, ms, () => ctx.down([["ERROR", \`timeout: no value within \${ms}ms\`]]));`)],
  ["a value does not start timeout's time again", USE.to, ...of(TO, TO_RESET, `    void 0;`)],
  ["timeout's time does not run from its activation", USE.to, ...of(TO, TO_SETUP, CLEANUP)],
  ["timeout waits one ms less", USE.to, ...of(TO, TO_FIRE, `    start(ctx, timers, ms - 1, () => ctx.down([["ERROR", "timeout"]]));`)],
  ["timeout waits one ms more", USE.to, ...of(TO, TO_FIRE, `    start(ctx, timers, ms + 1, () => ctx.down([["ERROR", "timeout"]]));`)],
  ["timeout sends a wave's arrays as one", "O-timeout use: sends its source's arrays", ...of(TO, TO_SEND, `    if (occurrences(source).length) ctx.down(data(occurrences(source)));`)],
  ["timeout sends the last value of a wave", "O-timeout use: sends its source's arrays", ...of(TO, TO_SEND, `    if (occurrences(source).length) ctx.down(data(occurrences(source).slice(-1)));`)],
  ["timeout sends the value that came with the ERROR", "O-common: an input's ERROR ends the operator without that wave's DATA", ...of(TO, TO_ERR, `    if (errored(source)) { ctx.down([...data(occurrences(source)), source.terminal]); return; }`)],
  // timeout: invalidation
  ["an INVALIDATE starts timeout's time again", "O-timeout invalidation: keeps the running deadline; use: only DATA resets it", ...of(TO, RETRACT, `    if (source.invalidated) { watch(ctx); ctx.down([["INVALIDATE"]]); }`)],
  ["an INVALIDATE stops timeout's deadline", "O-timeout invalidation: keeps the running deadline", ...of(TO, RETRACT, `    if (source.invalidated) { stopAll(ctx, timers); ctx.down([["INVALIDATE"]]); }`)],
  ["timeout does not retract", "O-timeout invalidation: a source INVALIDATE retracts the output", ...of(TO, RETRACT, `    void 0;`)],
  // timeout: recovery
  ["a restored timeout does not measure", "O-timeout recovery: a restored timeout measures again from its first activation", ...of(TO, TO_SETUP, `    if (ctx.seed === undefined) watch(ctx);\n    return cleanup(ctx, timers);`)],
  ["a restored timeout ends at once", "O-timeout recovery: the deadline is not kept", ...of(TO, TO_SETUP, `    if (ctx.seed !== undefined) ctx.down([["ERROR", "timeout"]]); else watch(ctx);\n    return cleanup(ctx, timers);`)],
  ["a restored timeout whose source was invalidated retracts its output", "O-timeout recovery; R-checkpoint: a restored node's own value is not removed", ...of(TO, RETRACT, `    if (source.invalidated || lostItsValue(ctx, source)) ctx.down([["INVALIDATE"]]);`)],

  // what the six share
  ["a timer that fired still counts as running", "O-throttle use: drops DATA for the interval; O-auditTime use: opens a fixed window at an input", `  const handle = timers.set(() => { set.delete(handle); fn(); }, ms);`, `  const handle = timers.set(() => { fn(); }, ms);`, ["throttle", "auditTime"]],
  ["a timer that is stopped still fires", "O-debounce use: a full quiet interval since the last occurrence; O-timeout use: measured from each DATA", `  for (const handle of set) timers.clear(handle);\n`, ``, ["debounce", "timeout"]],
  ["a restored operator's first run drops its candidate whatever its source holds", "O-debounce recovery, O-auditTime recovery: a restored operator whose source no longer holds a value", `const lostItsValue = (ctx, source) => ctx.seed !== undefined && !source.has;`, `const lostItsValue = (ctx, source) => ctx.seed !== undefined;`, ["debounce", "auditTime"]],
  ["the six leave their source's INVALIDATE to the kernel", "R-invalidation: under the manual policy an INVALIDATE is the function's input", `invalidate: "manual" });`, `invalidate: "auto" });`, ["debounce", "auditTime", "delay"]],
  ["the six leave their source's COMPLETE to the kernel", "O-delay use: its normal COMPLETE the given time later", `terminal: Object.freeze({ complete: "manual", error: "manual" })`, `terminal: Object.freeze({ complete: "auto", error: "manual" })`, ["delay"]],

  // what the first blind round found unheld (2026-11-24), as its writer worded them
  ["debounce does not retract in a wave that ends with an ERROR", "O-debounce invalidation: A source INVALIDATE retracts the output (also in the ERROR's wave)", ...of(DB, "    if (source.invalidated) ctx.down([[\"INVALIDATE\"]]);\n    if (errored(source)) { ctx.state.set({ candidate: [] }); ctx.down([source.terminal]); return; }", "    if (errored(source)) { ctx.state.set({ candidate: [] }); ctx.down([source.terminal]); return; }\n    if (source.invalidated) ctx.down([[\"INVALIDATE\"]]);")],
  ["debounce stops the timer at an INVALIDATE and keeps the candidate", "O-debounce invalidation: drops the candidate (a later COMPLETE must not send it)", ...of(DB, "    if (source.invalidated || lostItsValue(ctx, source)) { candidate = []; stopAll(ctx, timers); }", "    if (source.invalidated || lostItsValue(ctx, source)) { stopAll(ctx, timers); }")],
  ["debounce retracts only when a candidate was pending", "O-debounce invalidation: A source INVALIDATE retracts the output", ...of(DB, "    if (source.invalidated) ctx.down([[\"INVALIDATE\"]]);", "    if (source.invalidated && ctx.state.get()?.candidate.length) ctx.down([[\"INVALIDATE\"]]);")],
  ["debounce starts its interval again at a run without DATA", "O-debounce use: since the last occurrence; R-invocation: a function must not take each run for new input", ...of(DB, "    if (values.length) wait(ctx);", "    if (candidate.length) wait(ctx);")],
  ["debounce keeps its candidate across a deactivation", "O-common: progress is private state, an operator that deactivates forgets it (R-lifetime)", ...of(DB, "  checked(\"debounce\", ms);", "  checked(\"debounce\", ms);\n  let kept = [];", "    let candidate = ctx.state.get()?.candidate ?? [];", "    let candidate = ctx.state.get()?.candidate ?? kept;", "    ctx.state.set({ candidate });", "    ctx.state.set({ candidate });\n    kept = candidate;")],
  ["throttle does not retract in a wave that ends with an ERROR", "O-throttle invalidation: A source INVALIDATE retracts the output (also in the ERROR's wave)", ...of(TH, "    if (source.invalidated) ctx.down([[\"INVALIDATE\"]]);\n    if (errored(source)) { ctx.down([source.terminal]); return; }", "    if (errored(source)) { ctx.down([source.terminal]); return; }\n    if (source.invalidated) ctx.down([[\"INVALIDATE\"]]);")],
  ["throttle sends the last DATA of the completing wave with the COMPLETE", "O-throttle use: There is no trailing emission", ...of(TH, "    if (completed(source)) ctx.down([[\"COMPLETE\"]]);", "    if (completed(source)) ctx.down(values.length > 1 ? [[\"DATA\", values[values.length - 1]], [\"COMPLETE\"]] : [[\"COMPLETE\"]]);")],
  ["every input wave opens an auditTime window of its own", "O-auditTime use: opens a fixed window at an input and sends at that window's deadline", ...of(AU, "    if (values.length && running(ctx).size === 0) open(ctx);", "    if (values.length) open(ctx);")],
  ["an auditTime window that ends empty opens another", "O-auditTime use: opens a fixed window at an input; O-auditTime invalidation: keeps the window's end", ...of(AU, "    if (!candidate.length) return;", "    if (!candidate.length) { open(ctx); return; }")],
  ["auditTime opens a second window for the input after an INVALIDATE", "O-auditTime invalidation: drops the candidate and keeps the window's end", ...of(AU, "    if (values.length) candidate = [values[values.length - 1]];", "    const idle = !candidate.length;\n    if (values.length) candidate = [values[values.length - 1]];", "    if (values.length && running(ctx).size === 0) open(ctx);", "    if (values.length && idle) open(ctx);")],
  ["auditTime keeps its candidate across a deactivation", "O-common: an operator that deactivates without having ended forgets its progress (R-lifetime)", ...of(AU, "  checked(\"auditTime\", ms);", "  checked(\"auditTime\", ms);\n  let kept = [];", "    let candidate = ctx.state.get()?.candidate ?? [];", "    let candidate = ctx.state.get()?.candidate ?? kept;", "    ctx.state.set({ candidate });", "    ctx.state.set({ candidate });\n    kept = candidate;")],
  ["delay keeps its queue across a deactivation", "O-common: an operator that deactivates without having ended forgets its progress (R-lifetime)", ...of(DL, "  checked(\"delay\", ms);", "  checked(\"delay\", ms);\n  let kept = [];", "    const queue = ctx.state.get()?.queue ?? [];", "    const queue = ctx.state.get()?.queue ?? kept;", "    ctx.state.set({ queue: [...queue, item] });\n    later(ctx);", "    kept = [...queue, item];\n    ctx.state.set({ queue: kept });\n    later(ctx);")],
  ["bufferTime does not retract in a wave that ends with a COMPLETE", "O-bufferTime invalidation: A source INVALIDATE retracts the output", ...of(BT, "    if (source.invalidated) ctx.down([[\"INVALIDATE\"]]);", "    if (source.invalidated && !completed(source)) ctx.down([[\"INVALIDATE\"]]);")],
  ["bufferTime does not retract in a wave that ends with an ERROR", "O-bufferTime invalidation: A source INVALIDATE retracts the output (also in the ERROR's wave)", ...of(BT, "    if (source.invalidated) ctx.down([[\"INVALIDATE\"]]);\n    if (errored(source)) { ctx.state.set({ items: [] }); ctx.down([source.terminal]); return; }", "    if (errored(source)) { ctx.state.set({ items: [] }); ctx.down([source.terminal]); return; }\n    if (source.invalidated) ctx.down([[\"INVALIDATE\"]]);")],
  ["timeout does not retract in a wave that ends with an ERROR", "O-timeout invalidation: A source INVALIDATE retracts the output (also in the ERROR's wave)", ...of(TO, "    if (source.invalidated) ctx.down([[\"INVALIDATE\"]]);\n    if (errored(source)) { ctx.down([source.terminal]); return; }", "    if (errored(source)) { ctx.down([source.terminal]); return; }\n    if (source.invalidated) ctx.down([[\"INVALIDATE\"]]);")],
  ["the operators have the auto ERROR policy", "O-delay completion: what is queued is not sent, its wave's INVALIDATE included (R-terminals: under auto an INVALIDATE of that wave takes effect first)", "complete: \"manual\", error: \"manual\"", "complete: \"manual\", error: \"auto\"", ["delay"]],

  // what the second blind round found unheld (2026-11-24), as its writer worded them
  ["debounce at COMPLETE sends every DATA of the completing wave", "O-debounce use: sends the latest DATA", ...of(DB, "ctx.down([...data(candidate), [\"COMPLETE\"]]); return; }", "ctx.down([...data(values.length ? values : candidate), [\"COMPLETE\"]]); return; }")],
  ["throttle takes the source's held value for an occurrence in a run that brought none", "R-invocation: a function must not take each run for new input", ...of(TH, "const values = occurrences(source);", "const values = occurrences(source).length ? occurrences(source) : source.has ? [source.value] : [];")],
  ["a restored delay whose source lost its value drops its queue", "O-delay recovery: the queue ... is private state (README: a restored delay whose source was invalidated while saved drops nothing)", ...of(DL, "const queue = ctx.state.get()?.queue ?? [];", "if (lostItsValue(ctx, source)) stopAll(ctx, timers);\n    const queue = lostItsValue(ctx, source) ? [] : ctx.state.get()?.queue ?? [];")],
];

mutantSuite({ module: "time", operators: ["debounce", "throttle", "auditTime", "delay", "bufferTime", "timeout"], mutants: MUTANTS, minTraces: 118 });
