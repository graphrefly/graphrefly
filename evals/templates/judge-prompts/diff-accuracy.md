# Judge Prompt: Diff Accuracy

You are evaluating whether an LLM-generated GraphSpec modification correctly matches a requested change.

## Input
- **Base spec:** {{BASE_SPEC}}
- **Modification request:** {{NL_MODIFICATION}}
- **Generated new spec:** {{OUTPUT}}
- **Expected changes:** {{EXPECTED_CHANGES}}

## Evaluation criteria

1. **Requested change present:** Does the new spec implement the requested modification?
2. **No unrelated changes:** Are nodes that should be unchanged actually unchanged?
3. **Correct additions:** Are newly added nodes properly connected (deps reference existing nodes)?
4. **Correct removals:** Are removed nodes gone, and are no dangling references left?
5. **Structural integrity:** Is the modified spec still valid GraphSpec?

## Response format

Respond with a JSON object:
```json
{
  "pass": true/false,
  "requested_change_present": true/false,
  "unrelated_changes": ["list of unexpected changes, empty if clean"],
  "dangling_references": ["list of broken deps, empty if clean"],
  "reasoning": "brief explanation"
}
```
