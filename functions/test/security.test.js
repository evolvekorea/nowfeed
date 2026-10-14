import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedUser, providerUid, sha256, equal, tokenPattern, randomToken, nextVote } from '../security.js';

test('rejects anonymous sessions and untrusted custom providers', () => {
  assert.equal(allowedUser(null), false);
  assert.equal(allowedUser({ token: { firebase: { sign_in_provider: 'anonymous' } } }), false);
  assert.equal(allowedUser({ token: { firebase: { sign_in_provider: 'custom' }, loginProvider: 'unknown' } }), false);
  for (const provider of ['naver', 'kakao']) assert.equal(allowedUser({ token: { firebase: { sign_in_provider: 'custom' }, loginProvider: provider } }), true);
  assert.equal(allowedUser({ token: { firebase: { sign_in_provider: 'google.com' } } }), true);
});
test('repeated choice cannot increase votes and changing choice keeps total', () => {
  const options = ['positive', 'negative'];
  const first = nextVote({}, null, 'positive', options);
  assert.deepEqual(first, { positive: 1, negative: 0 });
  assert.deepEqual(nextVote(first, 'positive', 'positive', options), first);
  assert.deepEqual(nextVote(first, 'positive', 'negative', options), { positive: 0, negative: 1 });
  assert.throws(() => nextVote(first, 'positive', 'forged', options));
  assert.throws(() => nextVote({}, 'positive', 'negative', options));
});
test('provider identities stay separate and no raw provider ID is exposed', () => {
  assert.notEqual(providerUid('naver', '12345'), providerUid('kakao', '12345'));
  assert.equal(providerUid('naver', '12345'), providerUid('naver', '12345'));
  assert.equal(providerUid('naver', '12345').includes('12345'), false);
  assert.throws(() => providerUid('forged', '12345'));
});
test('proof-of-possession checks and random tokens', () => {
  const verifier = randomToken();
  assert.match(verifier, tokenPattern);
  assert.match(sha256(verifier), tokenPattern);
  assert.equal(equal(sha256(verifier), sha256(randomToken())), false);
  assert.equal(equal(sha256(verifier), sha256(verifier)), true);
  assert.equal(equal(undefined, verifier), false);
});
