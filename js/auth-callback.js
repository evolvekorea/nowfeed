(async () => {
  const status = document.querySelector('#auth-status');
  const params = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname);
  let returnTo = '/';
  try {
    const saved = JSON.parse(sessionStorage.getItem('nowfeed-oauth-session') || 'null');
    sessionStorage.removeItem('nowfeed-oauth-session');
    if (typeof saved?.returnTo === 'string' && /^\/articles\/[a-zA-Z0-9/_-]+\/$/.test(saved.returnTo)) returnTo = saved.returnTo;
    document.querySelector('#auth-return').href = returnTo;
    if (!saved || !Number.isFinite(saved.createdAt) || Date.now() - saved.createdAt < 0 || Date.now() - saved.createdAt > 600000 || params.get('state') !== saved.state || !params.get('code')) throw new Error('Invalid session');
    const response = await fetch(`${window.NOWFEED_COMMUNITY_CONFIG.authBase}/exchange`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: params.get('code'), verifier: saved.verifier }), cache: 'no-store'
    });
    if (!response.ok) throw new Error('Login exchange failed');
    const { token } = await response.json();
    const version = '12.17.1';
    const [{ initializeApp }, { getAuth, setPersistence, browserLocalPersistence, signInWithCustomToken }] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`)
    ]);
    const auth = getAuth(initializeApp(window.NOWFEED_FIREBASE_CONFIG));
    await setPersistence(auth, browserLocalPersistence);
    await signInWithCustomToken(auth, token);
    location.replace(`${returnTo}#comments`);
  } catch {
    status.textContent = '로그인을 완료하지 못했습니다. 원래 사연으로 돌아가 다시 로그인해 주세요.';
  }
})();
