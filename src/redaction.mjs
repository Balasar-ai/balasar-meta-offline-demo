function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
export function redactIntegrationSecrets(value, secrets = []) {
  const replacer = (v) => {
    if (typeof v === 'string') {
      let out = v.replace(/(Bearer|OAuth)\s+[^\s"']+/gi,'$1 [REDACTED]').replace(/([?&](?:key|token|access_token|api_key)=)[^&\s]+/gi,'$1[REDACTED]');
      for (const secret of secrets) if (typeof secret === 'string' && secret.length) out = out.split(secret).join('[REDACTED]');
      return out;
    }
    if (Array.isArray(v)) return v.map(replacer);
    if (object(v)) return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,/^(authorization|access.?token|refresh.?token|api.?key|client.?secret|password|cookie)$/i.test(k) ? '[REDACTED]' : replacer(x)]));
    return v;
  };
  return replacer(value);
}

