# SESSION - LLM Post-Training and GraphReFly Training-Control Research

**Status:** active research / feasibility discussion, non-locking  
**Opened:** 2026-08-11  
**Trigger:** The user read NVIDIA's report on lessons from more than 5,000
Kaggle participants in the Nemotron Model Reasoning Challenge and asked whether
those lessons help GraphReFly, whether GraphReFly can help model training, and
how far a traditional full-stack engineer and GraphReFly maintainer is from
training a model that writes better GraphReFly code.  
**Scope:** Research and feasibility discussion only. This session records
external signals, current GraphReFly fit, a possible runtime boundary, and a
non-canonical experimental direction. It does not approve training, create a D#,
change the protocol, add a package API, modify the backlog or sequencer, spend
money, select a model/provider, or make an efficacy claim.

---

## 1. Trigger and External Signals

The NVIDIA article describes post-training under constrained conditions, not
frontier-model pretraining from scratch. Participants started from the same open
30B model, infrastructure, inference implementation, evaluation constraints,
and token budget, and submitted bounded LoRA adapters.

The main lessons were workflow and evidence lessons:

1. Generate reasoning traces that can be replayed and verified rather than
   accepting plausible-looking chain-of-thought.
2. Treat token budget and representation compression as part of reasoning-system
   design.
3. Separate reusable stable structure from case-specific live solving.
4. Use tools upstream to create, audit, reject, and repair training material,
   not only to produce final answers.
5. Measure improvements and regressions per task family rather than relying on
   one aggregate score.

External sources:

- NVIDIA competition lessons:
  <https://developer.nvidia.com/blog/lessons-from-the-leaderboard-what-5000-kagglers-taught-us-about-improving-ai-reasoning/>
- NVIDIA single-GPU reasoning-LoRA walkthrough:
  <https://developer.nvidia.com/blog/train-a-reasoning-capable-llm-in-one-weekend-with-nvidia-nemo/>
- QLoRA:
  <https://arxiv.org/abs/2305.14314>
- RAFT domain-specific retrieval-augmented fine-tuning:
  <https://arxiv.org/abs/2403.10131>
- Industrial code completion comparison of retrieval and fine-tuning:
  <https://www.cse.cuhk.edu.hk/lyu/_media/conference/cwang_fse2025_rag.pdf>
- ACL survey of LLM-driven synthetic-data generation, curation, and evaluation:
  <https://aclanthology.org/2024.findings-acl.658/>

## 2. What the Lessons Mean for GraphReFly

The article's strongest lessons align with GraphReFly's current architecture,
but they do not prove that GraphReFly improves training.

- Verifiable traces map naturally to Graph-visible facts, exact provenance,
  WorkItem / EffectRun / AgentRequest lineage, independent verifiers, and
  conformance scenarios. A final answer or passing aggregate score is not a
  substitute for admitted intermediate evidence.
- Token-budget pressure strengthens the case for graph-derived bounded context,
  reduced evidence capsules, and explicit separation between current state and
  repeated scaffolding.
- Stable-versus-live separation maps to a useful model-adaptation boundary:
  stable GraphReFly work habits may be learned by an adapter, while current D#,
  rules, code, plan state, and task-local facts should remain retrieved live.
- Tool-generated training data maps to deterministic solvers, tests,
  conformance, formal checks, diff policies, and independent verifier output.
- Per-task measurement maps to capability families such as protocol, graph
  inspection, operators, orchestration, storage/restore, cross-runtime
  conformance, and decision/spec consistency.

GraphReFly therefore has a credible role in constructing and validating
training trajectories. This remains a hypothesis until tested against a simpler
non-Graph control pipeline.

## 3. What GraphReFly Can and Cannot Do for Training

GraphReFly should not replace a numerical training engine. Tensor execution,
autograd, loss calculation, optimizer steps, mixed precision, sharding,
distributed collectives, checkpoint tensors, and high-throughput rollout belong
to PyTorch, TRL, Axolotl, verl, NeMo, or equivalent systems.

GraphReFly can plausibly be the training control and evidence plane:

```text
GraphReFly Graph
  dataset/config/evaluation facts
  -> dependency, admission, budget, retry, and stopping reductions
  -> admitted TrainRun / EffectRun request

async execution boundary
  -> Python process, container, local GPU runtime, or remote worker
  -> PyTorch / TRL / Axolotl / verl

new GraphReFly waves
  <- started / metric / checkpoint / evaluation / failure / completion facts
  <- exact usage and provenance reconciliation
  -> next admitted experiment or terminal evidence
```

This follows the existing runtime taxonomy:

- D20/D22: dispatcher invocation remains synchronous; asynchronous completion
  re-enters the owning single-thread graph as a later wave.
- D137/D138: dispatcher WorkerPool is for bounded graph-internal compute over
  owned data; long-lived process/network/runtime work belongs to an
  EnvironmentDriver or effect executor; remote graph execution belongs to the
  wire-bridge line.
- D719-D721: Graph may own admission, ordering, budget, retry, stopping, and
  canonical evidence while a caller-owned adapter executes exactly admitted
  asynchronous effects and returns bounded immutable facts.

The likely granularity boundary is important:

- GraphReFly may coordinate experiment, run, dataset revision, checkpoint,
  evaluation, curriculum, and failure-family decisions.
- The training engine should retain the token, microbatch, backward pass,
  gradient accumulation, and optimizer-step inner loop.

Turning every numerical step into a graph wave would likely add cost without
improving the authority model. The useful hypothesis is that GraphReFly directs
and explains training workflows, not that it simulates a tensor runtime.

## 4. Maintainer Accessibility

The discussion distinguishes four very different distances:

1. Improving a frontier coding agent with retrieval, skills, and stronger
   GraphReFly-specific evaluation is close and does not require model training.
2. LoRA/QLoRA post-training of an existing 3B-8B open code model is accessible
   to an experienced full-stack engineer after learning a bounded set of ML
   concepts and using an existing trainer.
3. RL with verifiable rewards is a later step that needs a stable supervised
   baseline, hidden verifier discipline, anti-tamper checks, and reliable
   per-family evaluation first.
4. Frontier foundation-model pretraining is organization-scale work and is not
   required to improve GraphReFly coding behavior.

The user's preferred possible target, if this ever becomes an experiment, is:

> Make Codex/Claude-class coding workflows better at maintaining GraphReFly,
> while using a small locally runnable 3B-8B GraphReFly specialist as the first
> training-scale probe rather than trying to create a general foundation model.

The specialist should learn stable behavior rather than memorize current
authority:

- consult the correct authority before editing;
- distinguish protocol amendment, design decision, implementation bug, and
  documentation drift;
- preserve graph-first and sync-core boundaries;
- produce verifier-backed modifications;
- avoid retired architecture and test-only reward shortcuts.

Current repository state, D# records, rules, APIs, and task evidence should still
be supplied through retrieval and tools at inference time.

## 5. Non-Canonical Experimental Posture

No training is currently requested or approved. If curiosity later becomes an
experiment, the preferred posture is a fully non-canonical sandbox with no
production dependency and no automatic backlog/phase promotion.

A useful evidence order would be:

```text
frozen held-out GraphReFly task families
  -> base model
  -> base model + current GraphReFly retrieval/tools
  -> base model + retrieval/tools + LoRA
  -> only if justified: verifiable-reward post-training
```

The experiment should compare final correctness, authority selection, verifier
pass rate, protocol/decision violations, tool and token cost, failure families,
and hidden-task generalization. It should keep expected patches and hidden
verifier material outside the actor information set and reject test tampering,
reward shortcuts, and train/eval leakage.

Only evidence that LoRA adds repeatable held-out value beyond retrieval alone
would justify discussing canonical sequencing. A negative result would still be
useful: it would show that better retrieval, context construction, or deterministic
verification is the more economical path.

## 6. Non-Goals and Guardrails

- No decision says GraphReFly is now a training framework.
- No `TrainingRuntime`, trainer adapter, public API, package export, provider,
  dataset, model, GPU, budget, or implementation is selected or approved.
- No protocol message, tier, verb, ctx surface, dispatcher async behavior, or
  cross-runtime conformance obligation is changed.
- Do not place tensor or optimizer semantics inside the synchronous graph core.
- Do not train current decisions or volatile repository state into weights when
  retrieval is the appropriate source of truth.
- Do not infer model understanding from a plausible trace or a single aggregate
  score.
- Do not promote this session into roadmap or backlog work without separate
  evidence and explicit approval.

## 7. Open Questions

1. Does Graph-native experiment/evidence coordination materially reduce harness
   defects compared with a simpler Python control pipeline?
2. Which GraphReFly maintenance behaviors remain consistently weak after strong
   retrieval and tool use, and are therefore plausible post-training targets?
3. Would a 3B-8B specialist be most useful as an independent coding actor, a
   GraphReFly-specific reviewer, a failure classifier, or a context/recommendation
   component for a frontier agent?
4. What is the coarsest event granularity that preserves useful training
   observability without turning GraphReFly into a high-volume metric bus?
5. What held-out task families and anti-cheating verifiers would make a
   retrieval-versus-LoRA comparison genuinely decision-relevant?
