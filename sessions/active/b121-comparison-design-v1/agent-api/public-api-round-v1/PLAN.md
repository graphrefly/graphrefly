# Fixed public TS API observation round v1

## Question and fixed design

Can DeepSeek V4.1 Flash independently find public TypeScript entrypoints, compose them, explain results and own cleanup correctly, given the package README and bounded retrieval of frozen production source?

Four predeclared tasks, in `tasks.json` order, one fresh participant session per task: accepted running totals; host push subscription lifetime; bounded downstream snapshot query; one audit-log page. No previous participant answer or context is carried over. Denominator is four including failures, interruptions and not-run samples. No replacement, answer repair, added hint or resampling after exposure.

The root controller is Graph-led under the existing D795 design: campaign, session and transport dependency nodes control readiness and progression; host code performs asynchronous I/O and durable writes. This round does not compare Graph against plain code.

## Materials and qualification

288 frozen files: all production package TypeScript and source READMEs, package README/package.json and two exported resource files. All 71 TypeScript entrypoints, including `@graphrefly/ts`, mirror the package export map uniformly. No per-task import shim. The sole harness change permits the scoped root package alias as well as subpaths, retaining malformed/escaping-path rejection.

The package README is the starting document. Two linked sibling example READMEs and the website are outside this package-scoped material. Public import aliases resolve to frozen source; this does not verify npm installation, built artifacts or a bundler. Retrieval exposes only this explicit map, never calibration, rubric, consumer probes, previous runs or private decision/history files. Existing source examples and JSDoc remain normal material.

Root tests: 233/233 passed. All 71 public imports compile. Author controls: four positive, four compiling semantic-negative and four consumer-type-negative cases matched all 12 expected compilation outcomes. Root independently checked task/source alignment and the four positive caller probes in isolated compiler processes. Semantic controls require trusted review; compilation alone cannot reject them. The first offline wrapper attempt omitted a receipt parent directory and failed before compilation; preserved as `offline/qualification.json`. `offline/qualification-completed.json` records the corrected wrapper and passing compilation; frozen task/material/rubric bytes were unchanged.

## Frozen execution and scoring

Route: `deepseek/deepseek-v4.1-flash`, Together only, no fallback, temperature 0, reasoning disabled, nonstreaming tools. Live manifest pins all artifacts, compiler environment, implementation bytes, prompts, tool schema and retry policy. Provider alias can change upstream; preserve returned model metadata without claiming immutable weights.

Per-session cumulative limits: 1,000,000 input tokens including cached/repeated history, 8,000 output tokens, 80 broker operations, 75 minutes. Existing reserved submission stage and request-output caps remain unchanged. Four qualification generations precede the four sessions. Fixed bounded transport retries are included in the captured contract; no model-session or compiler retry. Infrastructure/material/compiler failure stops the remainder. An ordinary participant failure stays in the record and the next planned task proceeds.

Acceptance: submitted code plus separate consumer probe compiles, and all three frozen source-based criteria pass for that task. Never execute participant code. Review independently checks original bytes against the pinned source; no post-hoc criterion changes. Contradictions invalidate the affected assessment pending review. Report raw submission/compile/static-review outcomes separately.

Record generations, turns, read/search/argument errors, tokens, costs, budget stops and relevant interpretation mistakes. These are descriptive observations of four tasks, not population success rates or a controlled measurement of human ease.

## Authorization and money

Owning work remains graphrefly:B121; this is attempt/evidence and execution authorization, not a new product decision. User explicitly approved these steps and required budget, also previously approving budget increases up to 100%. Eval-only OpenRouter key cap increased from $1.97 to $3.94, monthly guardrail from $2 to $4, verified in UI and key metadata. Internal cumulative cap stays $11. No credential/model/provider/access-scope change or recharge.

Retain prior unresolved reservations of $3.8202276000000013. Use the maximum of fresh key usage plus the prior-key offset and previous reported cumulative receipts. With no transport failures, four sessions' maximum successful-token cost is $1.2384 plus small qualification calls; failures remain conservatively reserved and all external/internal limits continue to apply. A budget ceiling is not an expected charge.

## Exposure and interpretation

The task author knows previous task titles and project history, authored against source, and has not supplied these tasks to the participant before this round. Root reviewed source and authored the harness; root is separate from the task author and participant but is not blind. An additional reviewer agent could not be started because the agent thread limit was reached. Do not claim three independent QA reviews, independently authored holdout, runtime correctness, cross-language coverage, whole-library usability or Graph superiority.

After all planned outcomes are retained, identify source/doc friction and library improvement hypotheses in a report. Any subsequent library change or task/rubric revision belongs to a new version, with old observations preserved. Completion of this round does not mark all of B121 complete.
