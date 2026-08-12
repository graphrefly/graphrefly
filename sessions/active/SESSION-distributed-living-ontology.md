# SESSION - Distributed Living Ontology and Graph-Defined Verbs

**Status:** active research / discussion note, non-locking
**Opened:** 2026-08-11
**Trigger:** Research and discussion comparing Palantir AIP/Ontology and its FDE
delivery model with GraphReFly and GraphReFly Canvas.
**Scope:** Product and architecture possibility only. This session records a
working thesis, vocabulary, boundaries, examples, and open questions. It does
not create D# decisions, protocol rules, conformance scenarios, package APIs,
Canvas authority, implementation approval, or a Palantir-equivalence claim.

---

## Research Conclusion

Palantir demonstrates that an ontology produces operational value when domain
objects and relations are connected to actions, functions, permissions,
applications, writeback, and a field-delivery loop. The ontology is valuable
not merely because it describes the enterprise, but because it participates in
changing the enterprise.

GraphReFly has a plausible but different path to that outcome. It does not need
to own or centralize every enterprise noun. A more GraphReFly-native direction
is an on-demand, distributed living ontology:

> Existing systems continue to own the nouns. A GraphReFly graph binds exact
> noun interfaces and revisions, then defines the reactive, inspectable, and
> governed business verbs over those nouns.

Nouns may remain in files, data lakes, object storage, warehouses, ERP/CRM
systems, APIs, or another ontology/knowledge graph. GraphReFly consumes bounded
facts or source references through explicit readers/capabilities rather than
requiring all objects to be copied into one central ontology store.

The graph is therefore not the ontology's noun database. It is the ontology's
kinetic or executable layer: the causal structure that gathers facts, reduces
them into decisions, admits actions, invokes controlled effects, and folds
outcomes back into later decisions.

---

## Noun Bindings and Business Verbs

To define verbs safely, a graph must understand the relevant noun interfaces.
A conceptual noun binding includes:

- noun contract and schema revision;
- stable identity and relationship semantics;
- source reference and authoritative system/field ownership;
- reader or capability revision and exact read semantics;
- freshness, compatibility, redaction, and access metadata.

This binding locks how the graph interprets a noun without freezing the noun's
live business data. A business verb such as `approveRefund`,
`quarantineListing`, `approveVendor`, or `rollbackDeployment` is not a new
substrate verb. It is a solution-owned graph or bounded subgraph composed from
the closed GraphReFly primitive vocabulary:

```text
business verb = noun inputs
              + required evidence
              + derived rules
              + admission policy
              + governed effect
              + result/evidence feedback
```

One graph may contain several related business verbs; the exact packaging
boundary remains an open product/solution question.

This suggests a possible position for GraphReFly as an ontology-agnostic
kinetic layer, or an executable verb layer over existing enterprise nouns.
GraphReFly would not require an organization to replace all noun authorities
before it can build one valuable operational decision/action loop.

---

## Revision and Drift Semantics

The discussion distinguished four independent revision coordinates:

- noun-contract revision: schema, identity, fields, relationships, semantics;
- reader revision: how a file/lake/API/object store is queried and interpreted;
- entity revision: the current version, offset, ETag, or snapshot of a business
  object instance;
- graph revision: the accepted noun bindings and verb definitions.

Compatible entity/value changes under an accepted noun contract should enter
as ordinary reactive DATA and cause downstream decisions to update. Semantic
or interface changes must not masquerade as value updates. Breaking schema,
identity, authority, relation, unit, reader, or permission changes should emit
graph-visible incompatibility/drift material and fail closed for the dependent
verbs/effects until an authorized graph revision is reviewed and accepted.

Fail-closed behavior should be local where possible: a broken Customer binding
may block refund verbs without disabling independent inventory verbs. Missing,
stale, redacted, inaccessible, or incompatible inputs should remain visible as
status/issue/evidence rather than silently choosing fallback semantics.

This is directionally consistent with D718's stable accepted topology versus
dynamic workload-as-DATA boundary. An LLM may explain drift and propose a new
binding or graph revision, but it cannot accept topology, grant capability, or
execute the resulting effect autonomously.

---

## Self-Describing Graph for Humans and LLMs

The graph could become a serializable executable semantic contract. Its
inspection surface would need more than anonymous topology: it should expose
bounded semantic metadata describing noun schemas/relations, accepted binding
and reader revisions, source authority, verb inputs/outputs, evidence and
admission requirements, effects, and current compatibility status.

An LLM could inspect that graph description to understand which nouns and verbs
exist without first ingesting every object instance. Understanding the
ontology, reading sensitive noun instances, and executing business verbs remain
separate authorities:

- semantic graph inspection may be bounded and redacted;
- noun retrieval requires the appropriate reader/source capability;
- action execution requires graph admission plus host/executor capability.

This makes a GraphReFly graph a possible context and capability map for agents,
while preserving the rule that an agent cannot infer authority merely from
descriptive metadata.

---

## Canvas, Executors, and the FDE Loop

GraphReFly Canvas could become an IDE for domain experts to define, simulate,
review, and observe business verbs over existing nouns. This could reduce the
translation distance between domain knowledge and an executable system, letting
customer-side experts become co-builders rather than handing all semantic work
to an external implementation team.

Canvas intent may ultimately affect external systems, but the UI callback
should not bypass graph and authority boundaries. The expected conceptual path
is:

```text
Canvas intent
  -> graph-visible proposal/request
  -> evidence and policy evaluation
  -> admission/approval
  -> executor calls ERP/CRM/API/tool
  -> bounded result/evidence fact
  -> graph reconciliation and downstream updates
```

The experience may feel direct to the user, while internally keeping Canvas,
Graph admission, host/IAM enforcement, executor side effects, and result facts
as distinct roles.

The founder is likely the first GraphReFly FDE. The product learning loop is to
turn repeated field translation, noun binding, review, and debugging work into
reusable Canvas and solution capabilities without moving customer-specific
nouns into the substrate. Customer domain experts could increasingly become
co-authors or customer-side deployed builders; this reduces but does not
immediately eliminate the integration, security, reliability, and change-
management responsibilities of an FDE.

---

## Concrete Candidate Workflows

The discussion used four example workflows to make the thesis concrete:

1. **B2B SaaS refund and credit approval.** Customer, Contract, Invoice,
   SupportCase, Refund, and Approver nouns feed verbs such as propose, approve,
   reject, request evidence, issue credit, and escalate to finance. An executor
   writes an admitted refund to Stripe/ERP and returns evidence.
2. **Commerce catalog data-quality handling.** SKU, Supplier, CatalogListing,
   Price, Inventory, ValidationRule, and DataIncident nouns feed quarantine,
   request correction, accept correction, republish, and escalation verbs.
3. **Vendor compliance onboarding.** Vendor, Control, Evidence, Policy,
   RiskFinding, Reviewer, and Approval nouns feed evidence request/accept/reject,
   waiver, approval, and suspension verbs.
4. **Production incident response.** Incident, Service, Deployment, Customer,
   SLA, OnCallTeam, and Runbook nouns feed page, rollback, notify, status-page,
   and severity-escalation verbs.

These examples are illustrative only. No design-partner workflow has been
selected. The first useful field proof should provide end-to-end access to real
operators, recurring decisions, actual side effects, measurable baseline and
outcome, and a reversible risk boundary.

---

## Product Positioning Implication

GraphReFly's plausible differentiated position is not a claim to replace the
full Palantir data, identity, application, deployment, and delivery platform
today. It is an open, embeddable causal/verb layer for living ontologies,
including organizations that do not want to migrate every noun into a central
enterprise operating system.

The strongest exploratory wording from this discussion is:

> Build an on-demand distributed ontology: keep nouns in their authoritative
> systems, bind their exact interfaces and revisions, and use inspectable
> GraphReFly graphs to define governed verbs over them.

"Palantir AIP alternative" may be useful as a scoped comparison or awareness
hook only after a bounded workflow is proven. It should not imply present
equivalence to Palantir's complete platform and FDE organization.

---

## Open Questions

1. What is the minimum semantic noun-binding descriptor, and which parts belong
   in generic graph metadata versus a vertical solution?
2. How should compatible version ranges differ from exact fail-closed binding?
3. What inspection projection lets humans and LLMs understand noun/verb
   semantics without turning descriptive metadata into permission authority?
4. How should Canvas package draft, simulation, review, accepted revision,
   deployment, and runtime drift without becoming the runtime or security
   authority?
5. Which real design-partner workflow can prove measurable value from this
   distributed-ontology model?
6. Which capabilities are genuinely reusable across at least two domains before
   any public primitive or product contract is proposed?

---

## Non-Goals Captured By This Session

- No ontology database or centralized noun migration is proposed.
- No new GraphReFly substrate verb, message, tier, or protocol behavior is
  proposed.
- No public noun-binding descriptor, business-verb API, Canvas compiler, or
  executor contract is approved.
- Descriptive graph metadata does not grant data access or execution authority.
- An LLM may inspect and propose, but it cannot accept graph revisions, grant
  capabilities, or execute effects autonomously.
- No implementation work, product commitment, design-partner selection, or
  Palantir-equivalence claim is authorized by this session.
