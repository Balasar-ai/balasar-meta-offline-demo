import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import dgram from 'node:dgram';
import { syncBuiltinESMExports } from 'node:module';

// Defense in depth for this reviewed program, not a sandbox for arbitrary code.
export function installOfflineGuard() {
  let attempts = 0;
  const restore = [];
  const denied = () => { attempts++; throw new Error('OFFLINE_NETWORK_FORBIDDEN'); };
  const replace = (target, key) => {
    const original = target[key];
    target[key] = denied;
    restore.push(() => { target[key] = original; });
  };
  for (const key of ['fetch', 'WebSocket']) if (key in globalThis) replace(globalThis, key);
  for (const [target, keys] of [
    [net, ['connect', 'createConnection', 'createServer']],
    [net.Socket.prototype, ['connect']], [tls, ['connect', 'createServer']],
    [http, ['request', 'get', 'createServer']], [https, ['request', 'get', 'createServer']],
    [dgram, ['createSocket']],
  ]) for (const key of keys) replace(target, key);
  for (const target of [dns, dns.promises]) {
    for (const key of Object.keys(target)) {
      if (/^(lookup|resolve|reverse)/.test(key) && typeof target[key] === 'function') replace(target, key);
    }
  }
  syncBuiltinESMExports();
  return Object.freeze({
    get attempts() { return attempts; },
    restore() { for (const fn of restore.reverse()) fn(); syncBuiltinESMExports(); },
  });
}
