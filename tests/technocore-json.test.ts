import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTechnocoreJson } from '../lib/technocore-json.ts';

test('preserves a 19-digit Technocore nonce as an exact string', () => {
  const parsed = parseTechnocoreJson('{"messages":[{"seq":836453,"nonce":178781456866529651}]}');
  const messages = parsed.messages as Array<{ seq: number; nonce: string }>;

  assert.equal(messages[0].seq, 836453);
  assert.equal(messages[0].nonce, '178781456866529651');
});

test('leaves null and already-string nonces intact', () => {
  const parsed = parseTechnocoreJson('{"messages":[{"nonce":null},{"nonce":"42"}]}');
  const messages = parsed.messages as Array<{ nonce: string | null }>;

  assert.deepEqual(messages.map((message) => message.nonce), [null, '42']);
});
