import test from "node:test";
import assert from "node:assert/strict";
import { internalSurfaceText } from "./public-copy.mjs";
const rejected = (text) => internalSurfaceText.some((pattern) => pattern.test(text));

test("public copy accepts protocol sessions and sequence gaps", () => {
  for (const text of ["A session is one lifetime of the outbound node.", "The gate reports a sequence gap.", "Exactly-once delivery across sessions is not covered."]) {
    assert.equal(rejected(text), false, text);
  }
});
test("public copy continues to reject internal work surfaces", () => {
  for (const text of ["design session", "review sessions", "session notes", "sessions/active/design.md", "sessions/archive/old.md", "coverage gaps", "verification gap", "implementation gaps", "dashboard.html", "raw rules", "backlog", "localhost"]) {
    assert.equal(rejected(text), true, text);
  }
});
