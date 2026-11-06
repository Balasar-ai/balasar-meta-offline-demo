import { describe, it, expect } from 'vitest';
import { canonicalJson, contentHash, createSessionContext, requireContext } from '../src/contracts.mjs';

describe('standalone contract preservation', () => {
  it('preserves exact canonical bytes and a fixed SHA-256 vector', () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(contentHash({ b: 2, a: 1 })).toBe('43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777');
    expect(canonicalJson({ z: [3, { b: 'é\n"', a: -0 }], a: null })).toBe('{"a":null,"z":[3,{"a":0,"b":"é\\n\\\""}]}');
    expect(contentHash([1, 2])).not.toBe(contentHash([2, 1]));
  });
  it.each([undefined, NaN, Infinity, -Infinity, 1n, new Date(), Object.create(null), () => 1])('rejects unsupported value %#', value => {
    expect(() => canonicalJson(value)).toThrow('JSON_VALUE_REQUIRED');
  });
  it('freezes a copy of capabilities and requires the exact registered identity', () => {
    const capabilities = ['evidence:read'];
    const context = createSessionContext({ tenantId: 'tenant-a', actorId: 'actor-a', sessionId: 'session-a', capabilities });
    capabilities.push('evidence:write');
    expect(requireContext(context, 'evidence:read')).toBe(context);
    expect(() => requireContext(context, 'evidence:write')).toThrow('CAPABILITY_DENIED');
    for (const clone of [{ ...context }, JSON.parse(JSON.stringify(context)), structuredClone(context)]) {
      expect(() => requireContext(clone, 'evidence:read')).toThrow('UNTRUSTED_SESSION_CONTEXT');
    }
    expect(() => { context.tenantId = 'tenant-b'; }).toThrow();
    expect(() => context.capabilities.push('*')).toThrow();
  });
  it.each(['true', 1, {}, null])('does not treat truthy values as a human reviewer %#', humanReviewer => {
    const context = createSessionContext({ tenantId: 'a', actorId: 'b', sessionId: 'c', humanReviewer });
    expect(context.humanReviewer).toBe(false);
  });
  it('rejects invalid session identity before registration', () => {
    expect(() => createSessionContext({ tenantId: '../invalid', actorId: 'b', sessionId: 'c' })).toThrow('INVALID_SERVER_SESSION');
  });
});
