import { it, expect } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { EvidenceStore } from '../src/local-evidence.mjs';
import { createSessionContext } from '../src/contracts.mjs';
import { attemptStatus, snapshotBinding, SYNTHETIC_SCENARIO, createMetaProviderTransport, createMetaModelClient } from '../src/model-api.mjs';
import { runDemo } from '../demo.mjs';
import { installOfflineGuard } from '../scripts/offline-guard.mjs';

const ctx = () => createSessionContext({ tenantId: 'synthetic-tenant', actorId: 'operator', sessionId: 'session', capabilities: ['evidence:read', 'evidence:write', 'audit:write'] });
const record = { id: 'one', analysisId: 'demo', type: 'finding', dataKind: 'synthetic', payload: { text: 'synthetic' } };

it('executes the actual terminal demonstration with one simulated call and no network', async () => {
  const result = await runDemo();
  expect(result).toMatchObject({ status: 'PASS', label: 'SIMULATED', simulatedCalls: 1, externalNetworkAttempts: 0, realMetaCalls: 0 });
  expect(result.events.map(e => e.id)).toEqual(['synthetic', 'prepare', 'proposal', 'source', 'replay', 'reopen', 'session', 'review', 'redaction', 'complete']);
});

it('fails closed on an existing stale lock without deleting or adopting it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'meta-stale-'));
  const filePath = join(directory, 'evidence.json');
  try {
    await writeFile(filePath + '.lock', 'synthetic stale lock');
    await expect(new EvidenceStore({ filePath }).init()).rejects.toThrow('STORE_ALREADY_OWNED');
    expect(await readFile(filePath + '.lock', 'utf8')).toBe('synthetic stale lock');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it('does not add in-memory evidence when atomic replacement fails', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'meta-write-'));
  const filePath = join(directory, 'evidence.json');
  const store = await new EvidenceStore({ filePath }).init();
  try {
    await mkdir(filePath);
    await expect(store.put(ctx(), record)).rejects.toThrow();
    expect(await store.list(ctx())).toEqual([]);
  } finally { await store.close(); await rm(directory, { recursive: true, force: true }); }
});

it('leaves a durable reservation after audit failure without calling transport', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'meta-audit-'));
  const filePath = join(directory, 'evidence.json');
  let store = await new EvidenceStore({ filePath }).init();
  try {
    const context = ctx();
    const { product, sourceText } = structuredClone(SYNTHETIC_SCENARIO);
    const snapshot = { tenantId: context.tenantId, sourceVersion: 1, product, sourceText };
    const grant = { ...snapshotBinding(snapshot), grantId: 'grant-audit-failure', scope: 'META_MODEL_ONE_CALL', approvedBy: 'fictional-owner', expiresAt: Date.now() + 60000 };
    const sourceAuthority = { readGrant: async () => grant, readSnapshot: async () => snapshot };
    const brokenAuditStore = { put: (...args) => store.put(...args), appendAudit: async () => { throw Error('AUDIT_DISK_FAILURE'); } };
    const client = createMetaModelClient({ enabled: true, simulated: true, store: brokenAuditStore, auditContext: context, sourceAuthority, credentialBroker: async () => ({ apiKey: 'FICTIONAL-ONLY-KEY', tenantId: context.tenantId, grantId: grant.grantId, expiresAt: Date.now() + 60000 }), transport: createMetaProviderTransport({ simulated: true, fixture: { status: 200, body: '{}' } }) });
    await expect(client.run(context, { product, sourceText, grant })).rejects.toThrow('AUDIT_DISK_FAILURE');
    expect(client.stats.transportCalls).toBe(0);
    await store.close(); store = await new EvidenceStore({ filePath }).init();
    expect(await attemptStatus(store, context, grant.grantId)).toMatchObject({ state: 'OUTCOME_UNKNOWN' });
    await expect(client.run(context, { product, sourceText, grant })).rejects.toThrow('ATTEMPT_ALREADY_CONSUMED');
    expect(client.stats.transportCalls).toBe(0);
  } finally { await store.close(); await rm(directory, { recursive: true, force: true }); }
});

it('the network guard rejects fetch and socket attempts before a connection', () => {
  const guard = installOfflineGuard();
  try {
    expect(() => globalThis.fetch('https://example.invalid')).toThrow('OFFLINE_NETWORK_FORBIDDEN');
    expect(() => net.connect(443, 'example.invalid')).toThrow('OFFLINE_NETWORK_FORBIDDEN');
    expect(guard.attempts).toBe(2);
  } finally { guard.restore(); }
});
