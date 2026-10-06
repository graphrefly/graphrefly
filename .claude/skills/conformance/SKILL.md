---
name: conformance
description: "Behavioral conformance check across GraphReFly language runtimes (ts/rust/py) for the clean-slate redesign. Replaces the old structural 'parity' diff. Parity = does each runtime satisfy the wave-protocol behavior (conformance scenarios) + dispatcher contract — NOT 'do the symbol sets match'. Use after implementing/changing substrate behavior in any runtime, or when adding a new protocol rule. Authors/runs language-agnostic scenarios and reports exact source-bound evidence. Triggers: 'conformance', 'cross-lang check', 'does rust match', 'parity', 'run the conformance suite', 'is the substrate behavior consistent'."
---

Read and follow [the maintained conformance workflow](../../../.agents/skills/conformance/SKILL.md).
Resolve the path relative to this file. Pass the user request and arguments through unchanged.
This entrypoint has no separate protocol, decision, work, or review policy.
