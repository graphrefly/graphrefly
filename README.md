# GraphReFly

The language-neutral authority for the clean-slate reactive graph protocol.
Language packages and product repositories own their implementations and local work.

## Where things are

| Path | Contents |
|---|---|
| [Documentation map](docs/README.md) | Rules, drafts, decisions, work, evidence, guides and history |
| [authority/](authority/README.md) | Owner locators, revision contract and generated-view resolver |
| [spec/](spec/) | Protocol revisions, behavioral scenarios and teaching flowcharts |
| [formal/](formal/) | TLA+ models and model-checking configurations |
| [guide/](guide/guide.jsonl) | Structured guides and documentation policy |
| [sessions/](sessions/sessions.jsonl) | Indexed design discussions and historical evidence |
| [website/](website/) | Shared graphrefly.dev developer site |
| [dashboard/](dashboard/README.md) | Internal generated authority and work views |

## Where things stand

- **Current protocol:** [revision contract](authority/README.md#protocol-revision-contract)
  and the generated [public protocol view](https://graphrefly.dev/protocol/).
- **Work and order:** [owner locator](authority/work-ledgers.jsonl),
  [phases](plan/phases.jsonl) and [backlog](plan/backlog.jsonl).
- **Current review:** resolve B141, B140 and B142 in the backlog rather than infer
  their status from a design discussion or an old check.
- **Decisions and evidence:** follow the [documentation map](docs/README.md).
- **Package docs:** [TypeScript](https://ts.graphrefly.dev/),
  [Python](https://py.graphrefly.dev/) and [Rust](https://rs.graphrefly.dev/).

## Start locally

Use Node.js to inspect and build the local views:

```sh
node dashboard/build.mjs
npm run website:build
```

Open `dashboard/dashboard.html` for the internal view. The website build writes
`website/dist/`; it does not publish. Contributor workflow and shell notes live in
[the internal contributor records](guide/contribute.jsonl).

| Command | What it checks or builds |
|---|---|
| `npm run authority:check` | Root authority references and current-rule projection |
| `npm run authority:check:workspace` | Also verify available sibling owner ledgers |
| `npm run work:check` | Work identities, dependencies and evidence |
| `npm run test:authority` | Authority and work resolver regression tests |
| `node dashboard/build.mjs --check` | Structured reference consistency without writing the dashboard |
| `npm run docs:public:check` | Local public-site build and content checks |

Agent routing starts in [AGENTS.md](AGENTS.md).
