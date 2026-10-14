import test from 'node:test';
import assert from 'node:assert/strict';
import { castVote } from '../index.js';

test('vote endpoint rejects direct unauthenticated and anonymous requests before storage', async () => {
  for (const auth of [null, { uid: 'anonymous', token: { firebase: { sign_in_provider: 'anonymous' } } }]) {
    await assert.rejects(castVote.run({ auth, data: { storyId: 'secret-carpool-20260815', choice: 'positive' } }), { code: 'unauthenticated' });
  }
});

test('authenticated requests cannot create unknown polls or inject vote choices', async () => {
  const auth = { uid: 'test-user', token: { firebase: { sign_in_provider: 'google.com' } } };
  for (const data of [null, { storyId: '../users/test', choice: 'positive' }, { storyId: 'secret-carpool-20260815', choice: 'other' }]) {
    await assert.rejects(castVote.run({ auth, data }), { code: 'invalid-argument' });
  }
});
