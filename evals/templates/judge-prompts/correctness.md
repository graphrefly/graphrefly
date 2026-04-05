# Judge Prompt: Task Correctness

You are evaluating whether an LLM-generated output (GraphSpec or plain functions) correctly accomplishes a given task.

## Input
- **Task description:** {{NL_DESCRIPTION}}
- **Generated output:** {{OUTPUT}}
- **Treatment:** {{TREATMENT}} (graphspec or functions)
- **Key behaviors that must be present:** {{KEY_BEHAVIORS}}

## Evaluation criteria

1. Does the output address the core task described in the NL description?
2. Are all key behaviors present? (Check each one individually)
3. Is the data flow logical? (inputs lead to correct outputs)
4. Are there any obvious bugs that would prevent correct execution?
5. Does the output handle the described scenario completely, or is it partial?

## Response format

Respond with a JSON object:
```json
{
  "pass": true/false,
  "behaviors_present": ["list of key behaviors that ARE present"],
  "behaviors_missing": ["list of key behaviors that are MISSING"],
  "bugs_found": ["list of bugs, empty if none"],
  "reasoning": "brief explanation"
}
```
