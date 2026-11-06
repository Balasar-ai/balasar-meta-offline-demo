import { createHash } from "node:crypto";
const contexts = new WeakSet();
const fail = (code) => { throw new Error(code); };
export function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && Object.getPrototypeOf(value) === Object.prototype) return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
  return fail("JSON_VALUE_REQUIRED");
}
export const contentHash = (value) => createHash("sha256").update(canonicalJson(value)).digest("hex");
const identifier = (value) => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,199}$/.test(value);

/** Server-side only: call AFTER authenticating and authorizing a session. Never spread a request body here. */
export function createSessionContext({ tenantId, actorId, sessionId, capabilities = [], humanReviewer = false }) {
  if (![tenantId, actorId, sessionId].every(identifier) || !Array.isArray(capabilities) || capabilities.some(x => typeof x !== "string")) fail("INVALID_SERVER_SESSION");
  const context = Object.freeze({ tenantId, actorId, sessionId, capabilities: Object.freeze([...capabilities]), humanReviewer: humanReviewer === true });
  contexts.add(context);
  return context;
}
export function requireContext(context, capability) {
  if (!contexts.has(context)) fail("UNTRUSTED_SESSION_CONTEXT");
  if (!context.capabilities.includes(capability) && !context.capabilities.includes("*")) fail("CAPABILITY_DENIED");
  return context;
}

