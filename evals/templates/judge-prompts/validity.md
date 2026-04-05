# Judge Prompt: GraphSpec Validity

You are evaluating whether an LLM-generated GraphSpec is structurally valid.

## Input
- **Generated output:** {{OUTPUT}}
- **GraphSpec schema reference:** A valid GraphSpec has a top-level `nodes` object. Each node must have `type` (producer|state|derived|effect). `derived` and `effect` must have `deps` (array of node name strings) and `fn` (string). `producer` must have `source` (string). No `edges` array.

## Evaluation criteria

1. Is the output valid JSON?
2. Does it have a top-level `nodes` object (and nothing else at the top level except optionally `name`)?
3. Does every node have a valid `type`?
4. Do all `derived` and `effect` nodes have `deps` and `fn`?
5. Do all `producer` nodes have `source`?
6. Do all `deps` reference node names that exist in the spec?
7. Are there no circular dependencies?

## Response format

Respond with a JSON object:
```json
{
  "pass": true/false,
  "issues": ["list of specific issues found, empty if pass"],
  "reasoning": "brief explanation"
}
```
