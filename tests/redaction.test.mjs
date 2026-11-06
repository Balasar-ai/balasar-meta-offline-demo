import { it, expect } from 'vitest';
import { redactIntegrationSecrets } from '../src/redaction.mjs';
  it('redacts sensitive keys, bearer strings and query key values',()=>{
    const value=redactIntegrationSecrets({Authorization:'Bearer secret',nested:{apiKey:'secret'},url:'https://example.com/?key=secret&x=1'});
    expect(JSON.stringify(value)).not.toContain('secret');
  });

it('redacts nested secrets, repeated literals, credentials and query values', () => {
  const secret = 'FICTIONAL-SENSITIVE-VALUE';
  const result = redactIntegrationSecrets({
    nested: [secret + ':' + secret, { Client_Secret: secret, refreshToken: secret }],
    message: 'OAuth abc.def Bearer xyz',
    url: 'https://example.test/?access_token=aaa&api_key=bbb&keep=yes',
    harmless: 'public text', n: 12, nil: null,
  }, [secret, '']);
  const json = JSON.stringify(result);
  expect(json).not.toContain(secret);
  expect(json).not.toContain('abc.def');
  expect(json).not.toContain('xyz');
  expect(json).not.toContain('aaa');
  expect(json).not.toContain('bbb');
  expect(result).toMatchObject({ harmless: 'public text', n: 12, nil: null });
  expect(result.url).toContain('keep=yes');
});

it('preserves harmless JSON data without changing the source', () => {
  const value = { text: 'lamp', list: [false, 0, null, 'wit'] };
  expect(redactIntegrationSecrets(value)).toEqual(value);
  expect(value.list).toEqual([false, 0, null, 'wit']);
});

