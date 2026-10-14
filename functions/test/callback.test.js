import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../js/auth-callback.js', import.meta.url), 'utf8');
async function invalidCallback(saved, hash) {
  let requests = 0;
  const nodes = { '#auth-status': {}, '#auth-return': { href: '/' } };
  await vm.runInNewContext(source, {
    URLSearchParams, Date, Number, JSON,
    location: { hash, pathname: '/auth/callback/' }, history: { replaceState() {} },
    document: { querySelector: key => nodes[key] },
    sessionStorage: { getItem: () => JSON.stringify(saved), removeItem() {} },
    fetch: () => { requests++; throw new Error('Must not exchange invalid session'); }
  });
  assert.equal(requests, 0);
  assert.match(nodes['#auth-status'].textContent, /완료하지 못했습니다/);
  return nodes;
}

test('missing, expired and mismatched callback sessions cannot exchange a token', async () => {
  await invalidCallback(null, '#code=code&state=state');
  await invalidCallback({ state: 'state', createdAt: Date.now() - 610000 }, '#code=code&state=state');
  await invalidCallback({ state: 'other', createdAt: Date.now() }, '#code=code&state=state');
});

test('cancelled login returns to the original article; external return URLs are rejected', async () => {
  const base = { state: 'state', createdAt: Date.now() };
  const cancelled = await invalidCallback({ ...base, returnTo: '/articles/2026/08/secret-carpool-debate/' }, '#error=cancelled&state=state');
  assert.equal(cancelled['#auth-return'].href, '/articles/2026/08/secret-carpool-debate/');
  const external = await invalidCallback({ ...base, returnTo: '//example.com/' }, '#error=cancelled&state=state');
  assert.equal(external['#auth-return'].href, '/');
});
