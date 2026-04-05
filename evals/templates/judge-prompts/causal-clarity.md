# Judge Prompt: Causal Explanation Clarity

You are evaluating whether a causal explanation (from `explainPath()`) is understandable by a non-technical user.

## Input
- **Action taken by the system:** {{ACTION}}
- **Causal explanation:** {{EXPLANATION}}
- **Expected cause chain:** {{EXPECTED_CHAIN}}

## Evaluation criteria

1. **No jargon:** Does the explanation avoid technical terms (node, dependency, graph, propagation)?
2. **Cause-effect clear:** Can a reader understand WHY the action was taken?
3. **Complete chain:** Does the explanation cover all relevant causes, not just the immediate trigger?
4. **Concise:** Is it short enough to read in <10 seconds?
5. **Accurate:** Does it match the expected cause chain?

Rate each criterion 1-5 (1=fail, 5=excellent).

## Response format

Respond with a JSON object:
```json
{
  "no_jargon": 4,
  "cause_effect_clear": 5,
  "complete_chain": 3,
  "concise": 4,
  "accurate": 5,
  "average": 4.2,
  "pass": true,
  "reasoning": "brief explanation"
}
```

Pass threshold: average >= 3.5
