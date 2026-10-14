import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const ORIGIN = 'https://nowfeed.co.kr';
export const AUTH_BASE = 'https://asia-northeast3-nowfeed-2c504.cloudfunctions.net/communityAuth';
export const sha256 = value => createHash('sha256').update(value).digest('base64url');
export const randomToken = () => randomBytes(32).toString('base64url');
export const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
export const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export const allowedUser = auth => Boolean(auth && (auth.token?.firebase?.sign_in_provider === 'google.com' || (auth.token?.firebase?.sign_in_provider === 'custom' && ['naver', 'kakao'].includes(auth.token?.loginProvider))));

export function providerUid(provider, id) {
  if (!['naver', 'kakao'].includes(provider) || !id) throw new Error('Invalid identity');
  return `${provider}_${sha256(String(id))}`;
}

// The transaction layer persists this transition atomically with the user's ballot.
export function nextVote(counts, oldChoice, choice, options) {
  if (!options.includes(choice)) throw new Error('Invalid choice');
  const next = Object.fromEntries(options.map(option => [option, Number(counts?.[option] || 0)]));
  if (Object.values(next).some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error('Invalid totals');
  if (oldChoice === choice) return next;
  if (oldChoice) {
    if (!options.includes(oldChoice) || next[oldChoice] < 1) throw new Error('Invalid previous ballot');
    next[oldChoice] -= 1;
  }
  next[choice] += 1;
  return next;
}
