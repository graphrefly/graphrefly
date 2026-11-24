// A clock a test owns, for the trace runner's `advance` step (operators/README.md, "A trace";
// graphrefly:D813). Non-normative.
//
// An operator that needs time is given `timers`, { set(fn, ms) -> handle, clear(handle) }, and
// never reads the time: it starts a timer and cancels it. On a host the two are the host's own
// (setTimeout and clearTimeout); here they are this clock's, and no time passes but by
// advance(ms). The user took this over putting the clock in place of the host's global timers
// (2026-11-24: "传一个timers对象，这样比较flexible吧？", then "可以").
//
// A timer fires when the clock reaches its due time, and a timer started by a firing is due from
// that firing's time, so one advance over several periods fires each. node:test's mock timers
// count such a timer from the end of the tick instead (Node 24), which is why the runner has a
// clock of its own.
//
// Two timers due at the same instant fire in the order they were set, or, with `reverse`, the
// later one first: no rule and no contract gives that order, so the traces are run both ways
// (traces.test.mjs) and an operator must not rest on it.

const LIMIT = 10_000; // firings in one advance; past it a timer is starting itself without end

export function createClock({ reverse = false } = {}) {
  let now = 0;
  let last = 0;
  let advancing = false;
  const running = new Map(); // handle -> { at, fn }, in the order they were set

  const timers = Object.freeze({
    set(fn, ms) {
      if (typeof fn !== "function") throw new TypeError("a timer is given a function");
      if (!Number.isFinite(ms) || ms < 0) throw new RangeError(`a timer's time is a number that is not negative, not ${ms}`);
      last += 1;
      running.set(last, { at: now + ms, fn });
      return last;
    },
    clear(handle) {
      running.delete(handle);
    },
  });

  // The next timer due by `end`: the earliest, and of those due together the first set, or with
  // `reverse` the last.
  const next = (end) => {
    let found = null;
    for (const [handle, timer] of running) {
      if (timer.at > end) continue;
      if (!found || timer.at < found.at || (reverse && timer.at === found.at)) found = { handle, ...timer };
    }
    return found;
  };

  return {
    timers,
    // Moves the clock forward by ms and fires what comes due on the way, each at its own time.
    advance(ms) {
      if (!Number.isInteger(ms) || ms < 1) throw new RangeError(`a clock advances by a positive integer, not ${ms}`);
      if (advancing) throw new Error("the clock is advanced from outside a timer, not from one");
      advancing = true;
      try {
        const end = now + ms;
        let fired = 0;
        for (let timer = next(end); timer; timer = next(end)) {
          if ((fired += 1) > LIMIT) throw new Error(`more than ${LIMIT} timers fired in one advance`);
          running.delete(timer.handle);
          now = timer.at;
          timer.fn();
        }
        now = end;
      } finally {
        advancing = false;
      }
    },
    // Leaves every running timer behind: none fires afterwards. A restore step does this for the
    // graph that was captured.
    drop() {
      running.clear();
    },
    get running() {
      return running.size;
    },
  };
}
