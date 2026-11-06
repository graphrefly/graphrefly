/** Synthetic mechanism trace only. No network, real credentials, or model/score evidence. */
import { writeFileSync } from 'node:fs';
const root = new URL('../../../../../', import.meta.url);
const runtime = new URL('../graphrefly-ts/packages/ts/evals/b121/', root);
const { createGraphContext } = await import(new URL('graph-runtime.mjs', runtime));
const { runCampaignGraph } = await import(new URL('campaign-control.mjs', runtime));
const { runSession } = await import(new URL('scripts/b121-comparison/api-runner.mjs', root));
const { prepareBundle } = await import(new URL('scripts/b121-comparison/api-prepare.mjs', root));
const { createOpenRouterTransport, qualifyProvider, QUALIFICATION_READS, QUALIFICATION_SUBMISSIONS } = await import(new URL('scripts/b121-comparison/api-transport.mjs', root));
const { ROUTE, CEILING_USD, MAX_GENERATION_CALLS, maximumCost } = await import(new URL('scripts/b121-comparison/api-provider.mjs', root));
const events = [];
const journal = event => { events.push(event); };
const graphContext = createGraphContext({ name: 'offline-mechanism-trace' });
let syntheticCalls = 0;
const transport = createOpenRouterTransport({
 graphContext, journal, apiKey: 'OFFLINE-FAKE', manifestSHA: 'offline-fixture',
 approval: { manifestSHA: 'offline-fixture', action: 'B121-agent-api-one-shot', acceptAliasLimitation: true, acceptInputEstimateLimitation: true, expiresAt: '2099-01-01', maxGenerationCalls: MAX_GENERATION_CALLS, maxUSD: CEILING_USD, retries: 0, model: ROUTE.model, providerTag: ROUTE.tag },
 fetchImpl: async () => {
  const requests = [QUALIFICATION_READS[0], QUALIFICATION_SUBMISSIONS[0], QUALIFICATION_READS[1], QUALIFICATION_SUBMISSIONS[1], [{ op: 'submit', snippet: 'export const fixture = true;', explanation: 'Synthetic mechanism fixture; not graded.', concepts: { read: [], required: [], firstExpansion: null } }]][syntheticCalls++];
  if (!requests) throw Error('unexpected extra synthetic request');
  const response = new Response(JSON.stringify({ id: `synthetic-${syntheticCalls}`, model: ROUTE.model, provider: ROUTE.provider, usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, cost: maximumCost(100,20) }, choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ type: 'function', id: `synthetic-tool-${syntheticCalls}`, function: { name: 'broker', arguments: JSON.stringify({ requests }) } }] } }] }), {status: 200});
  Object.defineProperty(response, 'url', { value: ROUTE.endpoint });
  return response;
 }
});
try {
 const result = await runCampaignGraph({ graphContext, name: 'offline-fixture', samples: [{sampleId: 'synthetic-entry'}], journal,
  effects: {
   qualification: () => qualifyProvider({ transport, journal, graphContext }),
   session: () => runSession({ ...prepareBundle().entrySlots[0], slot: { id: 'synthetic-entry', arm: 'G', role: 'ordinary' }, mode: 'entry', transport, journal, graphContext }),
   'result-persistence': () => ({ fixtureSink: 'memory-only' }),
   'final-persistence': () => ({ fixtureSink: 'memory-only' })
  },
  classify: result => ({ row: {status: result.entryStatus}, failure: result.fatal })
 });
 if (result.failure || syntheticCalls !== 5) throw Error(`synthetic trace failed: ${result.failure}`);
 const trace = { kind: 'synthetic-mechanism-trace-not-model-evidence', realProviderCalls: 0, actualSpendUSD: 0, syntheticCalls, gradingPerformed: false, persistence: 'in-memory fixture sinks; durable persistence validated by campaign integration tests', result, topology: graphContext.graph.topology(), observations: events.filter(e => e.type === 'graph-observation') };
 writeFileSync(new URL('offline-trace.json', import.meta.url), JSON.stringify(trace, null, 2) + '\n');
 console.log(JSON.stringify({syntheticCalls, realProviderCalls: 0, nodes: trace.topology.nodes.length, observations: trace.observations.length, rows: result.rows}));
} finally { await transport.dispose(); graphContext.dispose(); }
