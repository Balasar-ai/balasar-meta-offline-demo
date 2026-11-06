// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EvidenceStore } from "../src/local-evidence.mjs";
import { createSessionContext, contentHash } from "../src/contracts.mjs";
const context = (tenantId, capabilities = ["*"]) => createSessionContext({ tenantId, actorId: "reviewer", sessionId: "server-session", capabilities });
const evidence = (overrides = {}) => ({ id: "finding:one", analysisId: "scan-1", type: "finding", payload: { code: "META-TITLE", url: "https://example.test" }, dataKind: "synthetic", ...overrides });
describe("durable tenant evidence", () => {
  let directory, filePath, store;
  const alpha = context("tenant-alpha");
  const beta = context("tenant-beta");
  beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), "visibility-store-")); filePath = join(directory, "evidence.json"); store = await new EvidenceStore({ filePath }).init(); });
  afterEach(async () => { await store?.close(); await rm(directory, { recursive: true, force: true }); });
  it("rejects forged JSON session contexts before revealing records", async () => {
    await store.put(alpha, evidence());
    await expect(store.get({ ...alpha }, "finding:one")).rejects.toThrow("UNTRUSTED_SESSION_CONTEXT");
    await expect(store.list(JSON.parse(JSON.stringify(alpha)))).rejects.toThrow("UNTRUSTED_SESSION_CONTEXT");
  });
  it("does not trust browser tenant metadata and keeps equal ids isolated", async () => {
    await expect(store.put(alpha, evidence({ tenantId: "tenant-beta" }))).rejects.toThrow("SERVER_METADATA_ONLY");
    await store.put(alpha, evidence()); await store.put(beta, evidence({ payload: { independent: true } }));
    expect((await store.get(alpha, "finding:one")).payload.code).toBe("META-TITLE");
    expect((await store.get(beta, "finding:one")).payload).toEqual({ independent: true });
    expect(await store.get(beta, "missing")).toBeNull();
    expect((await store.list(beta)).every(r => r.tenantId === "tenant-beta")).toBe(true);
  });
  it("requires read and write capabilities independently", async () => {
    const readonly = context("tenant-alpha", ["evidence:read"]);
    await expect(store.put(readonly, evidence())).rejects.toThrow("CAPABILITY_DENIED");
    await expect(store.get(context("tenant-alpha", ["evidence:write"]), "one")).rejects.toThrow("CAPABILITY_DENIED");
  });
  it("survives reopening with identical immutable hashes", async () => {
    const record = await store.put(alpha, evidence());
    await store.close(); store = await new EvidenceStore({ filePath }).init();
    expect(await store.get(alpha, "finding:one")).toEqual(record);
    const changed = await store.get(alpha, "finding:one"); changed.payload.code = "tampered";
    expect((await store.get(alpha, "finding:one")).payload.code).toBe("META-TITLE");
  });
  it("idempotently appends monotonic versions with explicit historical read", async () => {
    const first = await store.put(alpha, evidence());
    expect(await store.put(alpha, evidence())).toEqual(first);
    await expect(store.put(alpha, evidence({ payload: { different: true } }))).rejects.toThrow("VERSION_CONFLICT");
    await expect(store.put(alpha, evidence({ version: 3 }))).rejects.toThrow("VERSION_SEQUENCE_REQUIRED");
    await store.put(alpha, evidence({ version: 2, payload: { fixed: true } }));
    expect((await store.get(alpha, "finding:one")).version).toBe(2);
    expect((await store.get(alpha, "finding:one", { version: 1 })).payload).toEqual(first.payload);
    expect((await store.list(alpha)).length).toBe(1);
    expect((await store.list(alpha, { history: true })).length).toBe(2);
  });
  it("serializes simultaneous same-version writes without losing evidence", async () => {
    const results = await Promise.allSettled([store.put(alpha, evidence()), store.put(alpha, evidence({ payload: { different: true } }))]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
    expect((await store.list(alpha, { history: true })).length).toBe(1);
  });
  it("prevents a second process/store owner and permits explicit close handover", async () => {
    await expect(new EvidenceStore({ filePath }).init()).rejects.toThrow("STORE_ALREADY_OWNED");
    await store.close(); store = await new EvidenceStore({ filePath }).init();
    expect(await store.list(alpha)).toEqual([]);
  });
  it("fails closed if persisted evidence is modified", async () => {
    await store.put(alpha, evidence()); await store.close();
    const disk = JSON.parse(await readFile(filePath, "utf8"));
    disk.entries[0].record.payload.code = "changed";
    await writeFile(filePath, JSON.stringify(disk));
    await expect(new EvidenceStore({ filePath }).init()).rejects.toThrow("EVIDENCE_INTEGRITY_FAILED");
  });
  it("retains tenant-scoped audit history", async () => {
    await store.appendAudit(alpha, { action: "READ", targetId: "scan-1", details: { allowed: true } });
    await store.appendAudit(beta, { action: "READ", targetId: "scan-2" });
    expect((await store.audit(alpha)).map(x => x.targetId)).toEqual(["scan-1"]);
    expect((await store.audit(beta)).map(x => x.targetId)).toEqual(["scan-2"]);
  });
  it("canonical content hashes ignore object ordering but reject non-JSON values", () => {
    expect(contentHash({ b: 2, a: 1 })).toBe(contentHash({ a: 1, b: 2 }));
    expect(() => contentHash({ v: Infinity })).toThrow("JSON_VALUE_REQUIRED");
    expect(() => contentHash({ v: undefined })).toThrow("JSON_VALUE_REQUIRED");
  });
});

