// Mutants of recover.mjs against the canonical traces; mutants.mjs says what a mutant must do.
// retry and repeat share the owner, so a mutant of it names, in its fifth place, each of the two
// that must notice it in its own right.

import { mutantSuite } from "./mutants.mjs";

const CE_INV = `    if (followed.invalidated) ctx.down([["INVALIDATE"]]);`;
const CE_R_ERR = `      if (errored(followed)) { ctx.down([followed.terminal]); return; }`;
const CE_R_SEND = `      for (const values of followed.waves) if (values.length) ctx.down(data(values));\n      if (completed(followed)) ctx.down([["COMPLETE"]]);\n      return;`;
const CE_S_SEND = `    for (const values of followed.waves) if (values.length) ctx.down(data(values));\n    if (completed(followed)) { ctx.down([["COMPLETE"]]); return; }`;
const CE_S_ERR = `    if (!errored(followed)) return;\n    place(definitionOf(handler(followed.terminal[1])));`;
const CE_SWITCH = `    ctx.state.set({ switched: true });\n    ctx.rewire([innerId]);`;
const CE_SWITCHED = `    if (switched) {\n`;
const OW_INV = `    if (inner.invalidated === true || (ended && ctx.deps.some((d) => deps.includes(d.id) && d.invalidated === true))) ctx.down([["INVALIDATE"]]);`;
const OW_FWD = `    for (const w of inner.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));\n\n    const end = inner.terminal;`;
const ENDS = `    return (e.length > 0 && e.every(Boolean)) || e.some((t) => t?.[0] === "ERROR");`;
const OW_ROUND = `    if (restartable && !again && end?.[0] === "COMPLETE" && st.round < rounds) { st.round += 1; st.failures = 0; again = true; }`;
const OW_ERR = `    if (restartable && !again && end?.[0] === "ERROR") {`;
const OW_RETRY = `      const wait = retryDelayMs(retry, st.failures + 1);`;
const OW_END = `    if (!again) { if (end) ctx.down([end]); return; }`;
const OW_DELAYED = `    if (delay > 0) {`;
const OW_TIMER = `      const timer = timers.set(replace, delay);`;
const OW_STATE = `    ctx.state.set({ ...(ctx.state.get() ?? { round: 1, failures: 0, attempt: 0, waiting: false }), seen: request.value ?? 0 });`;
const OW_WAITING = `    if (st.waiting) schedule(ctx, st, retryDelayMs(retry, st.failures), kernel.get(innerId).ended);`;
const D_GUARD = `failedAttempt >= policy.maxAttempts) return undefined;`;
const D_GROW = `  const delay = policy.initialMs * policy.factor ** (failedAttempt - 1);`;
const D_MAX = `  return policy.maxMs === undefined ? delay : Math.min(delay, policy.maxMs);`;

const CE = "O-catchError use: follows its source; on the source's ERROR it calls handler(error) once and follows the Node the handler returns, which gives its ordinary snapshot and terminal";
const RT = "O-retry use: starts its inner again when it ends with an ERROR the policy retries, after the policy's delay; maxAttempts counts every attempt, the first included";
const RP = "O-repeat use: starts its inner again when it completes normally, until the rounds are used; rounds counts every round, the first included";
const BOTH = ["retry", "repeat"];

const MUTANTS = [
  // catchError: its use
  ["catchError ends with its source's ERROR", CE, CE_S_ERR, `    if (!errored(followed)) return;\n    ctx.down([followed.terminal]);\n    return;`],
  ["catchError drops the values that came with the source's ERROR", "O-catchError use: DATA already sent stays sent, the DATA that came before the ERROR in the same array included", CE_S_SEND, `    if (!errored(followed)) for (const values of followed.waves) if (values.length) ctx.down(data(values));\n    if (completed(followed)) { ctx.down([["COMPLETE"]]); return; }`],
  ["catchError sends a wave's arrays as one", "O-catchError use: follows its source", CE_S_SEND, `    if (followed.waves.flat().length) ctx.down(data(followed.waves.flat()));\n    if (completed(followed)) { ctx.down([["COMPLETE"]]); return; }`],
  ["catchError calls its handler at the source's COMPLETE too", "O-catchError use: a normal COMPLETE passes without the handler", [[CE_S_SEND, `    for (const values of followed.waves) if (values.length) ctx.down(data(values));`], [CE_S_ERR, `    if (!followed.terminal) return;\n    place(definitionOf(handler(followed.terminal[1])));`]]],
  ["catchError gives its handler the terminal, not the error", "O-catchError use: it calls handler(error)", CE_S_ERR, `    if (!errored(followed)) return;\n    place(definitionOf(handler(followed.terminal)));`],
  ["catchError does not follow what its handler returns", CE, CE_SWITCH, `    ctx.state.set({ switched: true });`],
  ["catchError forgets that it switched", "O-catchError use: it switches at most once", CE_SWITCH, `    ctx.rewire([innerId]);`],
  ["catchError sends the replacement's last value only", "O-catchError use: the Node the handler returns gives its ordinary snapshot", CE_R_SEND, `      for (const values of followed.waves) if (values.length) ctx.down(data(values.slice(-1)));\n      if (completed(followed)) ctx.down([["COMPLETE"]]);\n      return;`],
  // catchError: completion
  ["catchError keeps what its run had sent when its handler throws", "O-catchError completion: a throw from the handler ends the branch with that new ERROR; R-failure: everything the function sent in that run is dropped", CE_S_ERR, `    if (!errored(followed)) return;\n    try { place(definitionOf(handler(followed.terminal[1]))); } catch (e) { ctx.down([["ERROR", e.message]]); return; }`],
  ["catchError stays open when its handler throws", "O-catchError completion: a throw from the handler ends the branch with that new ERROR", CE_S_ERR, `    if (!errored(followed)) return;\n    try { place(definitionOf(handler(followed.terminal[1]))); } catch { return; }`],
  ["catchError ends with its source's ERROR when its handler throws", "O-catchError completion: with that new ERROR", CE_S_ERR, `    if (!errored(followed)) return;\n    try { place(definitionOf(handler(followed.terminal[1]))); } catch { ctx.down([followed.terminal]); return; }`],
  // A replacement that the handler follows is a relay under the default policies, which ends with
  // its node's ERROR without that wave's DATA, so a catchError that sent such DATA is no mutant here.
  ["catchError calls its handler again at the replacement's ERROR", "O-catchError use: it switches at most once; completion: the replacement's ERROR ends the branch", CE_R_ERR, `      if (errored(followed) && !(globalThis.__catchAgain ??= new WeakSet()).has(ctx.signal)) { globalThis.__catchAgain.add(ctx.signal); place(definitionOf(handler(followed.terminal[1]))); ctx.rewire([innerId]); return; }\n${CE_R_ERR}`],
  ["catchError stays open at the replacement's ERROR", "O-catchError completion: the replacement's ERROR ends the branch with that new ERROR", CE_R_ERR, `      if (errored(followed)) return;`],
  ["catchError stays open at the replacement's COMPLETE", "O-catchError use: the Node the handler returns gives its ordinary snapshot and terminal", CE_R_SEND, `      for (const values of followed.waves) if (values.length) ctx.down(data(values));\n      return;`],
  ["catchError drops the value that came with the replacement's COMPLETE", "O-common: after DATA it would have sent anyway the COMPLETE is an array of its own", CE_R_SEND, `      if (completed(followed)) { ctx.down([["COMPLETE"]]); return; }\n      for (const values of followed.waves) if (values.length) ctx.down(data(values));\n      return;`],
  // catchError: invalidation
  ["catchError does not retract for its source", "O-catchError invalidation: an INVALIDATE of the branch it follows retracts the output", CE_INV, `    if (followed.invalidated && switched) ctx.down([["INVALIDATE"]]);`],
  ["catchError does not retract for its replacement", "O-catchError invalidation: an INVALIDATE of the branch it follows retracts the output", CE_INV, `    if (followed.invalidated && !switched) ctx.down([["INVALIDATE"]]);`],
  ["an INVALIDATE of the replacement calls the handler again", "O-catchError invalidation: an INVALIDATE never calls or re-arms the handler", CE_INV, `    if (followed.invalidated) { ctx.down([["INVALIDATE"]]); if (switched) handler("again"); }`],
  ["an INVALIDATE of the source uses the one switch", "O-catchError invalidation: the source's ERROR can still switch once after it", [[`    ctx.state.set({ switched });\n`, `    const spent = ctx.state.get()?.spent === true || (followed.invalidated === true && !switched);\n    ctx.state.set({ switched, spent });\n`], [CE_S_ERR, `    if (!errored(followed)) return;\n    if (spent) { ctx.down([followed.terminal]); return; }\n    place(definitionOf(handler(followed.terminal[1])));`]]],
  ["an INVALIDATE that comes with a terminal is not applied", "O-catchError invalidation: in a wave that carries an INVALIDATE and then a terminal, the INVALIDATE is applied first and then the terminal", CE_INV, `    if (followed.invalidated && !followed.terminal) ctx.down([["INVALIDATE"]]);`],
  // catchError: recovery
  ["a restored catchError that had switched calls its handler again", "O-catchError recovery: restored on its replacement, and the handler is not called again", CE_SWITCHED, `    if (switched) {\n      if (ctx.seed !== undefined) handler("again");\n`],
  ["a restored catchError whose source was invalidated retracts its output", "O-catchError recovery; R-checkpoint: a restored node's own value is not removed", CE_INV, `    if (followed.invalidated || (ctx.seed !== undefined && !followed.has && !followed.terminal)) ctx.down([["INVALIDATE"]]);`],
  ["a restored catchError does not switch for an ERROR that came while the graph was saved", "O-catchError recovery; R-checkpoint: an end is given as an end", CE_S_ERR, `    if (!errored(followed) || ctx.seed !== undefined) return;\n    place(definitionOf(handler(followed.terminal[1])));`],

  // retry: its use
  ["maxAttempts counts the retries, not the attempts", RT, D_GUARD, `failedAttempt > policy.maxAttempts) return undefined;`, BOTH],
  ["retry makes one attempt fewer", RT, D_GUARD, `failedAttempt >= policy.maxAttempts - 1) return undefined;`, BOTH],
  ["the delay does not grow", "O-retry use: after the policy's delay", D_GROW, `  const delay = policy.initialMs;`, ["retry"]],
  ["the delay grows from the first failure on", "O-retry use: after the policy's delay", D_GROW, `  const delay = policy.initialMs * policy.factor ** failedAttempt;`, ["retry"]],
  ["maxMs does not cap the delay", "O-retry use: after the policy's delay", D_MAX, `  return delay;`, ["retry"]],
  ["maxMs is the least delay", "O-retry use: after the policy's delay", D_MAX, `  return policy.maxMs === undefined ? delay : Math.max(delay, policy.maxMs);`, ["retry"]],
  ["retry does not wait", "O-retry use: after the policy's delay", OW_DELAYED, `    if (false) {`, BOTH],
  ["retry waits one ms less", "O-retry use: after the policy's delay", OW_TIMER, `      const timer = timers.set(replace, delay - 1);`, ["retry"]],
  ["retry waits one ms more", "O-retry use: after the policy's delay", OW_TIMER, `      const timer = timers.set(replace, delay + 1);`, BOTH],
  ["a value gives the attempts back", "O-retry use: maxAttempts counts every attempt, the first included; R-restart: counted afresh in each round", OW_FWD, `    for (const w of inner.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));\n    if (inner.waves.some((w) => w.length)) st.failures = 0;\n\n    const end = inner.terminal;`, ["retry"]],
  ["the first ERROR ends retry", RT, OW_RETRY, `      const wait = undefined;`, BOTH],
  ["a COMPLETE is retried as an ERROR is", "O-retry invalidation: only an ERROR schedules a retry", OW_ERR, `    if (restartable && !again && end) {`, ["retry"]],
  ["retry stays open when no attempt is left", "R-restart: the policy either starts a new attempt or ends the owner with that terminal for good", OW_END, `    if (!again) { if (end?.[0] === "COMPLETE") ctx.down([end]); return; }`, BOTH],
  ["the owner does not send its inner's values", "R-restart: the owner forwards the inner's values", OW_FWD, `\n    const end = inner.terminal;`, BOTH],
  ["the owner sends the last value of each of its inner's arrays", "R-restart: the owner forwards the inner's values", OW_FWD, `    for (const w of inner.waves) if (w.length) ctx.down([["DATA", w[w.length - 1]]]);\n\n    const end = inner.terminal;`, BOTH],
  ["an attempt is made though every dependency has ended", "R-restart: no attempt is made when a fresh inner would end at once: when every dependency has ended", ENDS, `    return e.some((t) => t?.[0] === "ERROR");`, BOTH],
  ["an attempt is made though a dependency has ended with ERROR", "R-restart: no attempt is made when a fresh inner would end at once: when one has ended with ERROR", ENDS, `    return e.length > 0 && e.every(Boolean);`, ["retry"]],
  // retry and repeat: invalidation
  ["the owner retracts for any dependency's INVALIDATE", "O-retry invalidation: an effective INVALIDATE of the active inner retracts the output", OW_INV, `    if (ctx.deps.some((d) => d.invalidated === true)) ctx.down([["INVALIDATE"]]);`, BOTH],
  ["the owner does not retract while a retry waits", "O-retry invalidation: while a retry waits, an INVALIDATE of a dependency the owner holds retracts the output", OW_INV, `    if (inner.invalidated === true) ctx.down([["INVALIDATE"]]);`, ["retry"]],
  ["the owner does not retract for its inner's INVALIDATE", "O-retry invalidation, O-repeat invalidation: an effective INVALIDATE of the active inner retracts the output", OW_INV, `    if (ended && ctx.deps.some((d) => deps.includes(d.id) && d.invalidated === true)) ctx.down([["INVALIDATE"]]);`, BOTH],
  ["an INVALIDATE uses an attempt", "O-retry invalidation: keeps the attempt and the budget", OW_INV, `${OW_INV}\n    if (inner.invalidated === true) st.failures += 1;`, ["retry"]],
  ["an INVALIDATE drops the retry that waits", "O-retry invalidation: keeps the pending attempt, its deadline and the budget", OW_INV, `${OW_INV}\n    if (ended && ctx.deps.some((d) => d.invalidated === true)) st.attempt += 1;`, ["retry"]],
  ["an INVALIDATE starts the round's count again", "O-repeat invalidation: keeps the round", OW_INV, `${OW_INV}\n    if (inner.invalidated === true) st.round = 1;`, ["repeat"]],
  ["an INVALIDATE ends the round", "O-repeat invalidation: only a normal COMPLETE advances the round", OW_INV, `${OW_INV}\n    if (inner.invalidated === true) st.round += 1;`, ["repeat"]],
  // repeat: its use
  ["rounds counts the repeats, not the rounds", RP, OW_ROUND, OW_ROUND.replace("st.round < rounds", "st.round <= rounds"), ["repeat"]],
  ["repeat plays one round fewer", RP, OW_ROUND, OW_ROUND.replace("st.round < rounds", "st.round < rounds - 1"), ["repeat"]],
  ["a new round keeps the failures of the one before", "O-repeat use: each round with a fresh attempt budget", OW_ROUND, OW_ROUND.replace(" st.failures = 0;", ""), ["repeat"]],
  ["an ERROR starts the next round", "O-repeat use: starts its inner again when it completes normally", OW_ROUND, OW_ROUND.replace(`end?.[0] === "COMPLETE"`, "end"), ["repeat"]],
  // retry and repeat: recovery
  ["a restored owner forgets its rounds and attempts", "O-retry recovery: a checkpoint keeps the attempts used; O-repeat recovery: the rounds completed and the attempts used in the current round", OW_STATE, `    ctx.state.set({ ...((ctx.seed === undefined && ctx.state.get()) || { round: 1, failures: 0, attempt: 0, waiting: false }), seen: request.value ?? 0 });`, BOTH],
  ["a restored retry that was waiting retries at once", "O-retry recovery: a retry that was waiting waits its delay again in full", OW_WAITING, `    if (st.waiting) schedule(ctx, st, 0, kernel.get(innerId).ended);`, ["retry"]],
  ["a restored retry that was waiting never retries", "O-retry recovery: a retry that was waiting waits its delay again in full, for the same attempt", OW_WAITING, `    void 0;`, ["retry"]],
  ["a restored retry that was waiting counts another failure", "O-retry recovery: for the same attempt", OW_WAITING, `    if (st.waiting) { st.failures += 1; schedule(ctx, st, retryDelayMs(retry, st.failures - 1), kernel.get(innerId).ended); }`, ["retry"]],
  ["a restored retry waits the delay of its first failure", "O-retry recovery: waits its delay again in full", OW_WAITING, `    if (st.waiting) schedule(ctx, st, retryDelayMs(retry, 1), kernel.get(innerId).ended);`, ["retry"]],

  // what the first blind round found unheld (2026-11-24), as its writer worded them
  ["catchError: the source's INVALIDATE goes out after the DATA that followed it in the wave", "O-common: the retraction goes out first and the DATA after it, whatever their order in the wave", [["if (followed.invalidated) ctx","if (followed.invalidated && switched) ctx"],["    }\n    for (const values of followed.waves) if (values.length) ctx.down(data(values));","    }\n    for (const values of followed.waves) if (values.length) ctx.down(data(values));\n    if (followed.invalidated) ctx.down([[\"INVALIDATE\"]]);"]]],
  ["retry and repeat: the backoff grows by a sum, not a power: right for two retries, wrong from the third", "O-retry use: starts its inner again when it ends with an ERROR the policy retries, after the policy's delay", "const delay = policy.initialMs * policy.factor ** (failedAttempt - 1);", "const delay = policy.initialMs * (1 + (policy.factor - 1) * (failedAttempt - 1));"],
  ["retry and repeat: a maxMs of 0 is taken for none", "O-retry use: starts its inner again when it ends with an ERROR the policy retries, after the policy's delay", "policy.maxMs === undefined ? delay", "!policy.maxMs ? delay"],
  ["retry and repeat: of the inner's arrays in one wave only the last is forwarded", "R-restart: The owner forwards the inner's values", "for (const w of inner.waves) if", "for (const w of inner.waves.slice(-1)) if"],
  ["retry and repeat: the inner's arrays of one wave are merged into one array", "O-common: It runs at most once per wave, on each input's arrays in order (R-wave: the kernel never merges, drops or reorders DATA; arrays keep their boundaries)", "for (const w of inner.waves) if", "for (const w of [inner.waves.flat()]) if"],
  ["retry: while a retry waits only the first dependency's INVALIDATE retracts", "O-retry invalidation: While a retry waits ... an INVALIDATE of a dependency the owner holds then retracts the output and keeps the pending attempt, its deadline and the budget", "deps.includes(d.id) && d.invalidated === true", "deps[0] === d.id && d.invalidated === true"],
  ["retry: an INVALIDATE while a retry waits gives the attempts back", "O-retry invalidation: While a retry waits ... an INVALIDATE of a dependency the owner holds then retracts the output and keeps the pending attempt, its deadline and the budget", "d.invalidated === true))) ctx.down([[\"INVALIDATE\"]]);", "d.invalidated === true))) { ctx.down([[\"INVALIDATE\"]]); if (st.waiting) st.failures = 0; }"],
  ["retry: an INVALIDATE while a retry waits unrecords the wait: a checkpoint taken then restores no retry", "O-retry invalidation: While a retry waits ... an INVALIDATE of a dependency the owner holds then retracts the output and keeps the pending attempt, its deadline and the budget", "d.invalidated === true))) ctx.down([[\"INVALIDATE\"]]);", "d.invalidated === true))) { ctx.down([[\"INVALIDATE\"]]); st.waiting = false; }"],
  ["retry and repeat: the inner's INVALIDATE goes out after the DATA that followed it in the wave", "O-common: the retraction goes out first and the DATA after it, whatever their order in the wave", [["d.invalidated === true))) ctx.down([[\"INVALIDATE\"]]);","d.invalidated === true))) var retract = true;"],["ctx.down(w.map((v) => [\"DATA\", v]));","ctx.down(w.map((v) => [\"DATA\", v]));\n    if (retract) ctx.down([[\"INVALIDATE\"]]);"]]],
  ["retry and repeat: the inner's INVALIDATE is dropped when DATA follows it in the wave", "O-retry invalidation / O-repeat invalidation: An effective INVALIDATE of the active inner retracts the output", "if (inner.invalidated === true || (ended", "if ((inner.invalidated === true && !inner.waves.some((w) => w.length)) || (ended"],
  ["retry and repeat: an INVALIDATE is dropped in the wave in which the inner ends", "R-terminals: an INVALIDATE that reached the node in that wave takes effect first / O-retry invalidation: retracts the output", [["if (inner.invalidated === true || (ended","if (inner.terminal === null && (inner.invalidated === true || (ended"],["d.invalidated === true))) ctx.down([[\"INVALIDATE\"]]);","d.invalidated === true)))) ctx.down([[\"INVALIDATE\"]]);"]]],
  ["retry and repeat: a wave with an INVALIDATE gives only the retraction: its DATA is lost and its terminal starts or ends nothing", "O-retry invalidation / O-repeat invalidation: An effective INVALIDATE of the active inner retracts the output", "d.invalidated === true))) ctx.down([[\"INVALIDATE\"]]);", "d.invalidated === true))) { ctx.down([[\"INVALIDATE\"]]); return; }"],
  ["retry and repeat: one ended dependency among open ones stops every restart", "R-restart: one ended dependency among open ones does not stop a restart", "e.every(Boolean)", "e.some(Boolean)"],
  ["retry and repeat: a new attempt's inner has no setup: an inner that needs one, as a delay or a timeout, works only in the first attempt", "R-restart: A new attempt is a new instance of the inner's own definition", "{ setup: d.setup, recipe: d.recipe }", "{ recipe: d.recipe }"],
  ["retry and repeat: an ended inner is not renewed when the owner deactivates: the next activation finds the old terminal and values", "R-restart: When the owner deactivates without having ended, an ended inner is renewed, and a pending retry's timer is cleared", "return () => { if (!kernel.get(id).ended && kernel.get(innerId).ended) renew(); };", "return () => {};"],
  ["retry and repeat: a running inner is renewed when the owner deactivates: an inner kept active by its own sink starts over", "R-restart: When the owner deactivates without having ended, an ended inner is renewed, and a pending retry's timer is cleared", "if (!kernel.get(id).ended && kernel.get(innerId).ended) renew();", "if (!kernel.get(id).ended) renew();"],
  ["retry: a delayed retry is not dropped when the owner's lifetime closed: its timer still renews the inner after a later activation", "R-restart: A delayed retry belongs to the attempt that failed: it is dropped if the owner's lifetime closed, or another attempt started, meanwhile", [["if (signal.aborted || st.attempt !== attempt) return;","if (st.attempt !== attempt) return;"],["signal.addEventListener(\"abort\", () => timers.clear(timer), { once: true });",""]]],
  ["retry: the record of a waiting retry is never cleared: a later restore makes a retry nothing asked for", "R-restart: A restored owner without that record starts no retry there: a failure of its inner at that activation is counted and retried as any other", "st.waiting = false;", ""],
  ["retry: a restored waiting retry whose dependency has ended when the delay ends leaves the owner open", "R-restart: when the delay ends the retry is made or dropped as any delayed retry is", "retryDelayMs(retry, st.failures), kernel.get(innerId).ended);", "retryDelayMs(retry, st.failures), null);"],
  ["repeat: the next round waits the policy's initialMs", "O-repeat use: starts its inner again when it completes normally, until the rounds are used", "st.round += 1; st.failures = 0; again = true;", "st.round += 1; st.failures = 0; again = true; delay = retry.initialMs;"],

  // what the second blind round found unheld (2026-11-24), as its writer worded them
  ["catchError: an ERROR whose payload is the empty string or 0 is not seen: neither handler nor end", "O-catchError use: catchError(handler) follows its source; on the source's ERROR it calls handler(error) once and follows the Node the handler returns, which gives its ordinary snapshot and terminal", "d.terminal?.[0] === \"ERROR\"", "Boolean(d.terminal?.[1])"],
  ["catchError: the handler is given undefined for an error that is the empty string or 0", "O-catchError use: catchError(handler) follows its source; on the source's ERROR it calls handler(error) once and follows the Node the handler returns, which gives its ordinary snapshot and terminal", "handler(followed.terminal[1])", "handler(followed.terminal[1] || undefined)"],
  ["catchError: a value equal to the one before it in its array is dropped (source, replacement and relay)", "O-common use: It runs at most once per wave, on each input's arrays in order (R-wave, R-invocation)", "values.map((v) => [\"DATA\", v])", "values.filter((v, i) => i === 0 || !Object.is(v, values[i - 1])).map((v) => [\"DATA\", v])"],
  ["retry and repeat: a value of the inner equal to the one before it in its array is dropped", "R-restart: The owner forwards the inner's values", "    for (const w of inner.waves) if (w.length) ctx.down(w.map((v) => [\"DATA\", v]));", "    for (const w of inner.waves) if (w.length) ctx.down(w.filter((v, i) => i === 0 || !Object.is(v, w[i - 1])).map((v) => [\"DATA\", v]));"],
  ["repeat: a COMPLETE in a wave that also carried the inner's INVALIDATE starts no round: the repeat completes early", "O-repeat invalidation: Only a normal COMPLETE advances the round", "end?.[0] === \"COMPLETE\" && st.round < rounds", "end?.[0] === \"COMPLETE\" && inner.invalidated !== true && st.round < rounds"],
  ["retry: an ERROR in a wave that also carried the inner's INVALIDATE is not retried", "O-retry invalidation: An effective INVALIDATE of the active inner retracts the output and keeps the attempt and the budget", "if (restartable && !again && end?.[0] === \"ERROR\") {", "if (restartable && !again && end?.[0] === \"ERROR\" && inner.invalidated !== true) {"],
  ["repeat: a later round's retry waits as if the earlier rounds' attempts had failed too", "O-repeat use: With a retry policy an ERROR is retried as retry does, each round with a fresh attempt budget, counted apart from the rounds", "{ st.failures += 1; delay = wait; again = true; }", "{ st.failures += 1; delay = retryDelayMs({ ...retry, maxAttempts: Infinity }, st.attempt + 1); again = true; }"],
  ["repeat: a round in which the inner sent no value starts no further round: the repeat completes early", "O-repeat use: repeat(rounds, policy?) starts its inner again when it completes normally, until the rounds are used", [["    for (const w of inner.waves) if (w.length) ctx.down(w.map((v) => [\"DATA\", v]));","    for (const w of inner.waves) if (w.length) { ctx.down(w.map((v) => [\"DATA\", v])); st.sent = true; }"],["st.round < rounds) { st.round += 1; st.failures = 0; again = true; }","st.round < rounds && st.sent === true) { st.round += 1; st.failures = 0; st.sent = false; again = true; }"]]],
  ["retry: an ERROR that comes when every dependency has ended still waits the delay before the owner ends", "R-restart: No attempt is made when a fresh inner would end at once on its dependencies' snapshots (R-terminals): under its auto policies, when every dependency has ended or one has ended with ERROR; one ended dependency among open ones does not stop a restart", "if (restartable && !again && end?.[0] === \"ERROR\") {", "if (!again && end?.[0] === \"ERROR\") {"],

  // what the third blind round found unheld (2026-11-24), as its writer worded them
  ["catchError calls the handler a second time when it threw", "O-catchError use: on the source's ERROR it calls handler(error) once and follows the Node the handler returns, which gives its ordinary snapshot and terminal", "place(definitionOf(handler(followed.terminal[1])));", "let def;\n    try { def = handler(followed.terminal[1]); } catch { def = handler(followed.terminal[1]); }\n    place(def);"],
  ["repeat: the delay grows with the starts of the whole activation, so a later round's first retry waits longer", "O-repeat use: With a retry policy an ERROR is retried as retry does, each round with a fresh attempt budget, counted apart from the rounds", "if (wait !== undefined) { st.failures += 1; delay = wait; again = true; }", "if (wait !== undefined) { st.failures += 1; delay = retryDelayMs(retry, st.attempt + 1) ?? wait; again = true; }"],

  // a result that is not a node (2026-11-24)
  ["catchError builds a handler result that is not a node", "O-common: a callback's result that must be a Node and is not one is the operator's ERROR", "place(definitionOf(handler(followed.terminal[1])));", "place(handler(followed.terminal[1]));"],
  ["catchError: a definition without its function passes for a node", "O-common: a callback's result that must be a Node and is not one is the operator's ERROR", `typeof result.fn !== "function"`, `false`],
];

mutantSuite({ module: "recover", operators: ["catchError", "retry", "repeat"], mutants: MUTANTS, minTraces: 92 });
