import test from 'node:test';
import assert from 'node:assert/strict';
import { castVote, postComment } from '../index.js';

test('vote and comment endpoints reject unauthenticated requests before storage', async () => {
  await assert.rejects(castVote.run({ auth: null, data: { storyId: 'secret-carpool-20260815', choice: 'positive' } }), { code: 'unauthenticated' });
  await assert.rejects(postComment.run({ auth: null, data: { storyId: 'secret-carpool-20260815', body: 'hello' } }), { code: 'unauthenticated' });
});

test('authenticated requests cannot create unknown polls or inject vote choices', async () => {
  const auth = { uid: 'test-user', token: { firebase: { sign_in_provider: 'google.com' } } };
  for (const data of [null, { storyId: '../users/test', choice: 'positive' }, { storyId: 'secret-carpool-20260815', choice: 'other' }]) {
    await assert.rejects(castVote.run({ auth, data }), { code: 'invalid-argument' });
  }
});

test('comments reject malformed input before accessing storage', async () => {
  const auth = { uid: 'guest', token: { firebase: { sign_in_provider: 'anonymous' } } };
  for (const data of [null, { storyId: '../users/test', body: 'hello' }, { storyId: 'secret-carpool-20260815', body: ' '.repeat(4) }, { storyId: 'secret-carpool-20260815', body: 'x'.repeat(301) }]) {
    await assert.rejects(postComment.run({ auth, data }), { code: 'invalid-argument' });
  }
});
