(() => {
  const storageKey = 'nowfeed-oauth-session';
  const encode = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const random = () => encode(crypto.getRandomValues(new Uint8Array(32)));
  window.nowfeedSocialLogin = async provider => {
    const config = window.NOWFEED_COMMUNITY_CONFIG;
    if (!['naver', 'kakao'].includes(provider) || !config?.providers[provider]) throw new Error('Provider unavailable');
    // The callback and its session storage must share the canonical site's origin.
    if (location.hostname === 'www.nowfeed.co.kr') {
      location.assign(`https://nowfeed.co.kr${location.pathname}#comments`);
      return;
    }
    const verifier = random();
    const state = random();
    const challenge = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    sessionStorage.setItem(storageKey, JSON.stringify({ verifier, state, returnTo: location.pathname, createdAt: Date.now() }));
    const url = new URL(`${config.authBase}/start`);
    url.search = new URLSearchParams({ provider, challenge, state }).toString();
    location.assign(url.href);
  };
})();
