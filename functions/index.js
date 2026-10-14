import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { ORIGIN, AUTH_BASE, sha256, randomToken, tokenPattern, equal, allowedUser, providerUid, nextVote } from './security.js';
import polls from './polls.json' with { type: 'json' };

initializeApp();
const db = getFirestore();
const kakaoId = defineSecret('KAKAO_CLIENT_ID');
const kakaoSecret = defineSecret('KAKAO_CLIENT_SECRET');
const naverId = defineSecret('NAVER_CLIENT_ID');
const naverSecret = defineSecret('NAVER_CLIENT_SECRET');
const region = 'asia-northeast3';
const cookieName = '__Secure-nowfeed-oauth';
const expiresAt = seconds => Timestamp.fromMillis(Date.now() + seconds * 1000);

export const castVote = onCall({ region, maxInstances: 3, cors: [ORIGIN, 'https://www.nowfeed.co.kr'] }, async request => {
  if (!allowedUser(request.auth)) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const { storyId, choice } = request.data || {};
  if (typeof storyId !== 'string' || !Object.hasOwn(polls, storyId) || !polls[storyId].includes(choice)) throw new HttpsError('invalid-argument', '투표 항목을 확인해 주세요.');
  const ballotRef = db.doc(`stories/${storyId}/votes/${request.auth.uid}`);
  const totalsRef = db.doc(`polls/${storyId}`);
  return db.runTransaction(async transaction => {
    const [ballot, totals] = await transaction.getAll(ballotRef, totalsRef);
    const old = ballot.data();
    if (old?.choice !== choice && old?.updatedAt?.toMillis() > Date.now() - 2000) throw new HttpsError('resource-exhausted', '잠시 후 다시 선택해 주세요.');
    const counts = nextVote(totals.data()?.counts, old?.choice, choice, polls[storyId]);
    if (old?.choice !== choice) {
      transaction.set(ballotRef, { choice, updatedAt: FieldValue.serverTimestamp() });
      transaction.set(totalsRef, { counts, total: Object.values(counts).reduce((a, b) => a + b, 0), updatedAt: FieldValue.serverTimestamp() });
    }
    return { choice, counts };
  });
});

async function getJson(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Provider request failed');
  return response.json();
}

async function verifiedIdentity(provider, code, state) {
  const kakao = provider === 'kakao';
  const body = new URLSearchParams({
    grant_type: 'authorization_code', code, state,
    client_id: kakao ? kakaoId.value() : naverId.value(),
    client_secret: kakao ? kakaoSecret.value() : naverSecret.value(),
    redirect_uri: `${AUTH_BASE}/callback`
  });
  const tokens = await getJson(kakao ? 'https://kauth.kakao.com/oauth/token' : 'https://nid.naver.com/oauth2.0/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
  });
  if (!tokens.access_token) throw new Error('Missing provider token');
  const data = await getJson(kakao ? 'https://kapi.kakao.com/v2/user/me' : 'https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  // Only retain the provider-scoped identifier, never names, email or access tokens.
  const id = kakao ? data.id : data.resultcode === '00' ? data.response?.id : null;
  if (!id) throw new Error('Invalid provider profile');
  return providerUid(provider, id);
}

export const communityAuth = onRequest({ region, maxInstances: 3, secrets: [kakaoId, kakaoSecret, naverId, naverSecret] }, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Content-Type-Options', 'nosniff');
  const path = req.path.replace(/\/$/, '');
  try {
    if (path === '/exchange') {
      if (req.get('origin') !== ORIGIN) return res.status(403).json({ error: 'Origin rejected' });
      res.set('Access-Control-Allow-Origin', ORIGIN);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') return res.status(204).end();
      if (req.method !== 'POST' || !req.is('application/json')) return res.status(405).end();
      const { code, verifier } = req.body || {};
      if (typeof code !== 'string' || typeof verifier !== 'string' || !tokenPattern.test(code) || !tokenPattern.test(verifier)) return res.status(400).json({ error: 'Invalid request' });
      const ref = db.doc(`oauthExchanges/${sha256(code)}`);
      const session = await db.runTransaction(async transaction => {
        const doc = await transaction.get(ref);
        const data = doc.data();
        if (!data || data.expiresAt.toMillis() < Date.now() || !equal(data.challenge, sha256(verifier))) throw new Error('Invalid exchange');
        transaction.delete(ref);
        return data;
      });
      const token = await getAuth().createCustomToken(session.uid, { loginProvider: session.provider });
      return res.json({ token });
    }
    if (req.method !== 'GET') return res.status(405).end();
    if (path === '/start') {
      const { provider, challenge, state: clientState } = req.query;
      if (!['naver', 'kakao'].includes(provider) || typeof challenge !== 'string' || !tokenPattern.test(challenge) || typeof clientState !== 'string' || !tokenPattern.test(clientState)) return res.status(400).send('잘못된 로그인 요청입니다.');
      const state = randomToken();
      await db.doc(`oauthRequests/${sha256(state)}`).set({ provider, challenge, clientState, expiresAt: expiresAt(600) });
      res.cookie(cookieName, state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600000, path: '/' });
      const url = new URL(provider === 'kakao' ? 'https://kauth.kakao.com/oauth/authorize' : 'https://nid.naver.com/oauth2.0/authorize');
      url.search = new URLSearchParams({ response_type: 'code', client_id: provider === 'kakao' ? kakaoId.value() : naverId.value(), redirect_uri: `${AUTH_BASE}/callback`, state }).toString();
      return res.redirect(302, url.href);
    }
    if (path === '/callback') {
      const { state, code, error } = req.query;
      const cookie = (req.get('cookie') || '').split(';').map(item => item.trim()).find(item => item.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
      if (typeof state !== 'string' || !tokenPattern.test(state) || !equal(state, cookie)) throw new Error('Invalid state');
      res.clearCookie(cookieName, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
      const ref = db.doc(`oauthRequests/${sha256(state)}`);
      const session = await db.runTransaction(async transaction => {
        const doc = await transaction.get(ref);
        const data = doc.data();
        if (!data || data.expiresAt.toMillis() < Date.now()) throw new Error('Expired state');
        transaction.delete(ref);
        return data;
      });
      if (error || typeof code !== 'string' || !code || code.length > 4096) return res.redirect(302, `${ORIGIN}/auth/callback/#error=cancelled&state=${session.clientState}`);
      const uid = await verifiedIdentity(session.provider, code, state);
      const handoff = randomToken();
      await db.doc(`oauthExchanges/${sha256(handoff)}`).set({ uid, provider: session.provider, challenge: session.challenge, expiresAt: expiresAt(120) });
      return res.redirect(302, `${ORIGIN}/auth/callback/#code=${handoff}&state=${session.clientState}`);
    }
    return res.status(404).send('Not found');
  } catch {
    // Never return provider tokens or raw upstream errors to the browser or logs.
    return res.status(400).send('로그인을 완료하지 못했습니다. 나우피드로 돌아가 다시 시도해 주세요.');
  }
});
