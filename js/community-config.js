// Public configuration only. Naver remains restricted to its registered testers until review.
// This switch exposes the test button only; Naver itself enforces app membership.
const naverReviewPreview = new URLSearchParams(location.search).get('login-test') === 'naver';
window.NOWFEED_COMMUNITY_CONFIG = Object.freeze({
  region: 'asia-northeast3',
  authBase: 'https://asia-northeast3-nowfeed-2c504.cloudfunctions.net/communityAuth',
  providers: { google: true, naver: naverReviewPreview, kakao: true }
});
