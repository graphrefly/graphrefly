// A small command-line demo of the flagship's graph arm: one flagged evaluation, verified,
// granted and written to a local inbox in a temporary directory. This file is outside the
// executing closure (runner.mjs OUTSIDE): S8 edits its title and checks that nothing that
// runs changed.
//
//   node reference/flagship/cli.mjs

import { complete, occurrence, open } from "./harness.mjs";

const TITLE = "spending-alerts flagship (reference kernel)";

const run = await open({ arm: "graph" });
const occs = [occurrence({ revision: 1, amounts: [100], zThreshold: 0.7 }), occurrence({ revision: 2, amounts: [100, 200], zThreshold: 0.7 })];
await complete(run, occs);
console.log(TITLE);
console.log(`inbox: ${run.inboxPath}`);
process.stdout.write(await run.inbox());
console.log(JSON.stringify(run.app.ledger().totals));
