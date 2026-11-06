import { randomUUID } from "node:crypto";
import { open, readFile, mkdir, rename, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { canonicalJson, contentHash, requireContext } from "./contracts.mjs";
const fail = (code) => { throw new Error(code); };
const clone = (value) => JSON.parse(JSON.stringify(value));
const identifier = (value) => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,199}$/.test(value);
function inputRecord(context, input) {
  requireContext(context, "evidence:write");
  if (!input || ["tenantId", "actorId", "sessionId", "hash", "createdAt"].some(k => Object.hasOwn(input, k))) fail("SERVER_METADATA_ONLY");
  if (![input.id, input.analysisId, input.type].every(identifier) || !["observed", "synthetic", "mock"].includes(input.dataKind)) fail("INVALID_EVIDENCE");
  const version = input.version ?? 1;
  if (!Number.isSafeInteger(version) || version < 1) fail("INVALID_VERSION");
  const logical = { id: input.id, analysisId: input.analysisId, type: input.type, version, dataKind: input.dataKind, payload: clone(JSON.parse(canonicalJson(input.payload))) };
  return { ...logical, contentHash: contentHash(logical) };
}
function verifyJournal(journal) {
  if (journal?.schema !== "balasar.visibility.evidence/v1" || !Array.isArray(journal.entries)) fail("INVALID_JOURNAL");
  let previousHash = "0".repeat(64);
  const versions = new Map();
  journal.entries.forEach((entry, index) => {
    const { hash, ...unsigned } = entry;
    if (entry.sequence !== index + 1 || entry.previousHash !== previousHash || contentHash(unsigned) !== hash) fail("EVIDENCE_INTEGRITY_FAILED");
    if (entry.kind === "record") {
      const record = entry.record;
      const key = record.tenantId + "\0" + record.id;
      const { tenantId, actorId, sessionId, createdAt, contentHash: recordedHash, ...logical } = record;
      if (![tenantId, actorId, sessionId].every(identifier) || !Number.isFinite(Date.parse(createdAt)) || contentHash(logical) !== recordedHash || record.version !== (versions.get(key) ?? 0) + 1) fail("EVIDENCE_INTEGRITY_FAILED");
      versions.set(key, record.version);
    } else if (entry.kind !== "audit") fail("INVALID_JOURNAL_ENTRY");
    previousHash = hash;
  });
  return journal;
}

/** Durable atomic local store. One owning process per path; not a distributed database. */
export class EvidenceStore {
  #entries = [];
  #lock;
  #queue = Promise.resolve();
  #ready = false;
  constructor({ filePath, clock = () => new Date() } = {}) {
    if (!filePath) fail("STORE_PATH_REQUIRED");
    this.filePath = resolve(filePath);
    this.clock = clock;
  }
  async init() {
    if (this.#ready) return this;
    await mkdir(dirname(this.filePath), { recursive: true });
    this.#lock = await open(this.filePath + ".lock", "wx", 0o600).catch(() => fail("STORE_ALREADY_OWNED"));
    await this.#lock.writeFile(JSON.stringify({ pid: process.pid, owner: randomUUID() }));
    try {
      let saved;
      try { saved = JSON.parse(await readFile(this.filePath, "utf8")); }
      catch (error) { if (error.code !== "ENOENT") throw error; saved = { schema: "balasar.visibility.evidence/v1", entries: [] }; }
      this.#entries = verifyJournal(saved).entries;
      this.#ready = true;
      return this;
    } catch (error) { await this.#lock.close(); await unlink(this.filePath + ".lock"); this.#lock = undefined; throw error; }
  }
  #assertReady() { if (!this.#ready) fail("STORE_NOT_INITIALIZED"); }
  #exclusive(operation) {
    const pending = this.#queue.then(() => { this.#assertReady(); return operation(); });
    this.#queue = pending.catch(() => {});
    return pending;
  }
  async #append(entry) {
    const unsigned = { ...entry, sequence: this.#entries.length + 1, previousHash: this.#entries.at(-1)?.hash ?? "0".repeat(64) };
    const sealed = { ...unsigned, hash: contentHash(unsigned) };
    const next = [...this.#entries, sealed];
    const temporary = this.filePath + "." + randomUUID() + ".tmp";
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(JSON.stringify({ schema: "balasar.visibility.evidence/v1", entries: next }));
      await handle.sync();
      await handle.close();
      await rename(temporary, this.filePath);
    } catch (error) { await handle.close().catch(() => {}); await unlink(temporary).catch(() => {}); throw error; }
    this.#entries = next;
    return sealed;
  }
  async put(context, input) {
    const logical = inputRecord(context, input);
    return this.#exclusive(async () => {
      const records = this.#entries.filter(e => e.kind === "record" && e.record.tenantId === context.tenantId && e.record.id === logical.id).map(e => e.record);
      const existing = records.find(r => r.version === logical.version);
      if (existing) { if (existing.contentHash !== logical.contentHash) fail("VERSION_CONFLICT"); return clone(existing); }
      if (logical.version !== (records.at(-1)?.version ?? 0) + 1) fail("VERSION_SEQUENCE_REQUIRED");
      const record = { ...logical, tenantId: context.tenantId, actorId: context.actorId, sessionId: context.sessionId, createdAt: this.clock().toISOString() };
      await this.#append({ kind: "record", record });
      return clone(record);
    });
  }
  async get(context, id, { version } = {}) {
    requireContext(context, "evidence:read");
    return this.#exclusive(() => {
      const matches = this.#entries.filter(e => e.kind === "record" && e.record.tenantId === context.tenantId && e.record.id === id && (version === undefined || e.record.version === version));
      return matches.length ? clone(matches.at(-1).record) : null;
    });
  }
  async list(context, { analysisId, type, history = false } = {}) {
    requireContext(context, "evidence:read");
    return this.#exclusive(() => {
      const records = this.#entries.filter(e => e.kind === "record" && e.record.tenantId === context.tenantId).map(e => e.record);
      const selected = history ? records : [...new Map(records.map(r => [r.id, r])).values()];
      return clone(selected.filter(r => (!analysisId || r.analysisId === analysisId) && (!type || r.type === type)));
    });
  }
  async appendAudit(context, { action, targetId, details = {} }) {
    requireContext(context, "audit:write");
    if (!identifier(action) || !identifier(targetId)) fail("INVALID_AUDIT");
    canonicalJson(details);
    return this.#exclusive(async () => clone(await this.#append({ kind: "audit", tenantId: context.tenantId, actorId: context.actorId, sessionId: context.sessionId, action, targetId, details: clone(details), createdAt: this.clock().toISOString() })));
  }
  async audit(context) {
    requireContext(context, "audit:read");
    return this.#exclusive(() => clone(this.#entries.filter(e => e.kind === "audit" && e.tenantId === context.tenantId)));
  }
  async close() {
    await this.#queue;
    this.#ready = false;
    if (this.#lock) { await this.#lock.close(); this.#lock = undefined; await unlink(this.filePath + ".lock"); }
  }
}

