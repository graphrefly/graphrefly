# Judge Prompt: Bug Localization

You are evaluating whether an LLM correctly identified and located a seeded bug.

## Input
- **Buggy code/spec:** {{BUGGY_INPUT}}
- **Treatment:** {{TREATMENT}} (graphspec or functions)
- **LLM's diagnosis:** {{LLM_DIAGNOSIS}}
- **Actual bug location:** {{ACTUAL_BUG_LOCATION}}
- **Actual fix:** {{ACTUAL_FIX}}

## Evaluation criteria

1. **Bug identified:** Did the LLM identify that there IS a bug?
2. **Location correct:** Did the LLM point to the correct component/line/node?
3. **Root cause correct:** Did the LLM explain WHY it's a bug (not just that something looks wrong)?
4. **Fix correct:** Did the LLM suggest a fix that would actually resolve the issue?

## Response format

Respond with a JSON object:
```json
{
  "bug_identified": true/false,
  "location_correct": true/false,
  "root_cause_correct": true/false,
  "fix_correct": true/false,
  "pass": true/false,
  "reasoning": "brief explanation"
}
```
