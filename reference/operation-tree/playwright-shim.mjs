// Stands in for `@playwright/test` so the vendored photo-scenes spec runs unchanged under
// node:test. Only the matchers that spec uses exist; any other is an error, never a silent
// pass. Equality follows Playwright's toEqual: recursive, and a property whose value is
// undefined counts as absent.

import nodeTest from "node:test";
import assert from "node:assert/strict";

export const test = (name, fn) => nodeTest(name, fn);

function equals(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => equals(x, b[i]));
  if (a instanceof Error || b instanceof Error) return a.name === b.name && a.message === b.message;
  const keys = (o) => Object.keys(o).filter((k) => o[k] !== undefined);
  const ka = keys(a);
  const kb = keys(b);
  return ka.length === kb.length && ka.every((k) => kb.includes(k) && equals(a[k], b[k]));
}

const show = (v) => {
  try { return JSON.stringify(v); } catch { return String(v); }
};

export function expect(actual, label) {
  const make = (negated) => {
    const check = (pass, what, expected) => {
      if (pass !== negated) return;
      throw new assert.AssertionError({
        message: `${label ? `${label}: ` : ""}expected ${show(actual)} ${negated ? "not " : ""}${what} ${show(expected)}`,
        actual,
        expected,
        operator: what,
      });
    };
    return {
      toBe: (expected) => check(Object.is(actual, expected), "toBe", expected),
      toEqual: (expected) => check(equals(actual, expected), "toEqual", expected),
      toContain: (expected) => check(actual?.includes?.(expected) === true, "toContain", expected),
      toHaveLength: (expected) => check(actual?.length === expected, "toHaveLength", expected),
      toBeInstanceOf: (expected) => check(actual instanceof expected, "toBeInstanceOf", expected?.name),
      toBeUndefined: () => check(actual === undefined, "toBeUndefined", undefined),
      toThrow: (expected) => {
        let thrown = null;
        try { actual(); } catch (e) { thrown = e; }
        check(thrown !== null && String(thrown?.message).includes(expected), "toThrow", expected);
      },
    };
  };
  return Object.assign(make(false), { not: make(true) });
}
