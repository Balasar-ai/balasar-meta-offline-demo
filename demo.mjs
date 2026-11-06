import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { installOfflineGuard } from './scripts/offline-guard.mjs';
import { createSessionContext } from './src/contracts.mjs';
import { EvidenceStore } from './src/local-evidence.mjs';
import { redactIntegrationSecrets } from './src/redaction.mjs';
import {
  SYNTHETIC_SCENARIO, snapshotBinding, createMetaModelClient,
  createMetaProviderTransport, createMetaCredentialBroker, prepareMetaOneCall,
  validateProposal, attemptStatus, decideProposal, readApprovedProposal,
} from './src/model-api.mjs';

export async function runDemo({ emit = () => {} } = {}) {
  const guard = installOfflineGuard();
  const events = [];
  const record = (id, message, details) => {
    const event = { id, message, details };
    events.push(event); emit(event);
  };
  let directory, store;
  const fakeKey = 'DEMO-FICTIONAL-NOT-A-CREDENTIAL-2026';
  try {
    const now = Date.now();
    const { product, sourceText } = structuredClone(SYNTHETIC_SCENARIO);
    const snapshot = { tenantId: 'demo-tenant', sourceVersion: 1, product, sourceText };
    const context = createSessionContext({ tenantId: 'demo-tenant', actorId: 'demo-operator', sessionId: 'demo-session', capabilities: ['evidence:write', 'evidence:read', 'audit:write', 'audit:read'] });
    const reviewer = createSessionContext({ tenantId: 'demo-tenant', actorId: 'demo-reviewer', sessionId: 'demo-review', capabilities: ['evidence:write', 'evidence:read'], humanReviewer: true });
    const grant = { ...snapshotBinding(snapshot), grantId: 'demo-grant-0001', scope: 'META_MODEL_ONE_CALL', approvedBy: 'synthetic-demo-owner', expiresAt: now + 60000 };
    const sourceAuthority = {
      async readGrant(ctx, id) { return ctx.tenantId === grant.tenantId && id === grant.grantId ? structuredClone(grant) : null; },
      async readSnapshot(ctx, sku) { return ctx.tenantId === snapshot.tenantId && sku === product.sku ? structuredClone(snapshot) : null; },
    };
    let resolutions = 0;
    const credentialBroker = createMetaCredentialBroker({ tenantId: context.tenantId, grantId: grant.grantId, secretRef: 'demo-only-reference', expiresAt: grant.expiresAt, resolveSecret: async () => { resolutions++; return fakeKey; } });
    directory = await mkdtemp(join(tmpdir(), 'balasar-meta-demo-'));
    const filePath = join(directory, 'evidence.json');
    store = await new EvidenceStore({ filePath }).init();
    record('synthetic', 'GESIMULEERD - geen Meta-aanroep, geen klantdata.', { scenario: SYNTHETIC_SCENARIO.label });

    const prepared = await prepareMetaOneCall({ context, product, sourceText, grant, sourceAuthority });
    assert.equal(prepared.executionAllowed, false);
    assert.equal(resolutions, 0);
    assert.equal((await store.list(context)).length, 0);
    record('prepare', 'Voorbereiding voert niets uit en leest geen sleutel.', { state: prepared.state, credentialResolutions: resolutions });

    const candidate = (field, value, unknown, source_span = null) => ({ field, value, unknown, source_span });
    const content = { candidates: [candidate('name', product.confirmed.name, false, product.confirmed.name), candidate('price', null, true), candidate('stock', null, true), candidate('material', null, true)] };
    const fixture = { status: 200, body: JSON.stringify({ model: 'muse-spark-1.3', choices: [{ message: { role: 'assistant', content: JSON.stringify(content) }, finish_reason: 'stop' }], usage: { prompt_tokens: 600, completion_tokens: 80 } }) };
    const makeClient = () => createMetaModelClient({ enabled: true, simulated: true, transport: createMetaProviderTransport({ simulated: true, fixture }), credentialBroker, store, auditContext: context, sourceAuthority });
    const client = makeClient();
    const input = { product, sourceText, grant };
    const proposal = await client.run(context, input);
    assert.equal(client.stats.transportCalls, 1);
    assert.equal(proposal.label, 'SIMULATED');
    assert.equal(proposal.status, 'REVIEW_REQUIRED');
    assert(proposal.unknownFields.includes('price'));
    assert(proposal.unknownFields.includes('stock'));
    assert.equal(proposal.publicationApproval, 'NONE');
    record('proposal', 'Onbekende prijs en voorraad blijven onbekend.', { status: proposal.status, unknown: proposal.unknownFields, simulatedCalls: 1 });

    const invented = validateProposal({ candidates: [candidate('price', '49', false)] }, product, sourceText);
    assert.equal(invented.accepted.length, 0);
    assert.equal(invented.rejected[0].reason, 'UNSUPPORTED_BY_SOURCE');
    record('source', 'Een verzonnen prijs wordt afgewezen.', { reason: invented.rejected[0].reason });

    await assert.rejects(client.run(context, input), /ATTEMPT_ALREADY_CONSUMED/);
    assert.equal(client.stats.transportCalls, 1);
    record('replay', 'Een tweede poging met dezelfde grant is geblokkeerd.', { code: 'ATTEMPT_ALREADY_CONSUMED', simulatedCalls: 1 });

    await store.close();
    store = await new EvidenceStore({ filePath }).init();
    const reopened = makeClient();
    await assert.rejects(reopened.run(context, input), /ATTEMPT_ALREADY_CONSUMED/);
    assert.equal(reopened.stats.transportCalls, 0);
    assert.equal((await attemptStatus(store, context, grant.grantId)).state, 'COMPLETED');
    record('reopen', 'Na afsluiten en heropenen blijft de reservering bestaan.', { replayBlocked: true, extraSimulatedCalls: 0 });

    await assert.rejects(store.list({ ...context }), /UNTRUSTED_SESSION_CONTEXT/);
    const other = createSessionContext({ tenantId: 'other-demo-tenant', actorId: 'other-actor', sessionId: 'other-session', capabilities: ['evidence:read'] });
    assert.deepEqual(await store.list(other), []);
    record('session', 'Vervalste sessie geweigerd; andere tenant ziet geen records.', { forgedSession: 'BLOCKED', otherTenantRecords: 0 });

    const approved = await decideProposal(store, reviewer, grant.grantId, { decision: 'APPROVE_FOR_REVIEW_DRAFT', reason: 'Controle op uitsluitend synthetische brondata.', sourceAuthority });
    assert.equal(approved.payload.status, 'REVIEW_DRAFT_ONLY');
    assert.equal(approved.payload.rights, 'NONE');
    assert.equal(approved.payload.publicationApproval, 'NONE');
    snapshot.sourceVersion++;
    await assert.rejects(readApprovedProposal(store, context, grant.grantId, { sourceAuthority }), /GRANT_INVALID/);
    record('review', 'Review geeft geen publicatierecht; gewijzigde bron blokkeert gebruik.', { status: 'REVIEW_DRAFT_ONLY', publication: 'NONE', changedSource: 'BLOCKED' });

    const redacted = redactIntegrationSecrets({ nested: [fakeKey], Authorization: 'Bearer ' + fakeKey }, [fakeKey]);
    assert(!JSON.stringify(redacted).includes(fakeKey));
    assert(!(await readFile(filePath, 'utf8')).includes(fakeKey));
    assert.equal(guard.attempts, 0);
    record('redaction', 'Fictief geheim ontbreekt in resultaat en bewijsbestand.', { secretPresent: false });
    record('complete', 'Offline demonstratie geslaagd. Live uitvoering blijft geblokkeerd.', { assertions: 'PASS', simulatedCalls: 1, externalNetworkAttempts: guard.attempts, realMetaCalls: 0 });
    return { status: 'PASS', label: 'SIMULATED', events, simulatedCalls: 1, externalNetworkAttempts: guard.attempts, realMetaCalls: 0 };
  } finally {
    try { await store?.close(); } finally { if (directory) await rm(directory, { recursive: true, force: true }); guard.restore(); }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--json') || args.length > 1) {
    console.error('Gebruik: node demo.mjs [--json]. Er is geen live-optie.'); process.exitCode = 2;
  } else {
    try {
      const result = await runDemo({ emit: args.includes('--json') ? undefined : event => console.log(`PASS | ${event.message}\n       ${JSON.stringify(event.details)}`) });
      if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
    } catch { console.error('FAIL | Offline demonstratie gestopt; geen automatische herhaling.'); process.exitCode = 1; }
  }
}
