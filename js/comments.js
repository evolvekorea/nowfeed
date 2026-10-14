(() => {
  const storyId = document.body.dataset.storyId || 'husband-001';
  const actions = document.querySelector('#vote-actions');
  const results = document.querySelector('#vote-results');
  const voteButtons = [...document.querySelectorAll('[data-vote]')];
  const voteOptions = voteButtons.map(button => ({ id: button.dataset.vote, label: button.dataset.label || button.textContent.trim() }));
  let voteApi = null;
  let voteCounts = null;
  let myChoice = null;
  let voteBusy = false;
  let authReady = false;
  let ballotReady = false;
  let unsubscribeBallot = null;
  let authGeneration = 0;
  const voteStatus = document.createElement('p');
  voteStatus.className = 'vote-status';
  voteStatus.setAttribute('role', 'status');
  actions?.before(voteStatus);
  const loginForVote = document.createElement('button');
  loginForVote.type = 'button';
  loginForVote.className = 'vote-login-button';
  loginForVote.textContent = '로그인하고 참여하기';
  actions?.after(loginForVote);

  const showLogin = () => {
    authUi.panel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    authUi.privacyConsent?.focus({ preventScroll: true });
  };
  loginForVote.addEventListener('click', showLogin);
  const renderVote = () => {
    if (!actions || !results) return;
    const hasVote = Boolean(currentUser && myChoice);
    actions.hidden = !currentUser || hasVote;
    results.hidden = !voteCounts;
    loginForVote.hidden = Boolean(currentUser);
    loginForVote.disabled = !authReady;
    voteButtons.forEach(button => { button.disabled = !authReady || !currentUser || voteBusy || !ballotReady; });
    const change = document.querySelector('#change-vote');
    if (change) { change.hidden = !hasVote; change.disabled = voteBusy; }
    voteStatus.textContent = !authReady ? '로그인 상태 확인 중…' : !currentUser ? '투표와 댓글은 로그인 후 참여할 수 있어요.' : !ballotReady ? '내 투표를 확인하고 있습니다.' : voteBusy ? '투표를 저장하고 있습니다.' : hasVote ? '투표 완료 · 선택을 바꿀 수 있어요.' : '한 가지 의견을 선택해 주세요.';
    if (!voteCounts) return;
    const total = voteOptions.reduce((sum, option) => sum + (voteCounts[option.id] || 0), 0);
    let allocated = 0;
    voteOptions.forEach((option, index) => {
      const percent = total === 0 ? 0 : index === voteOptions.length - 1 ? 100 - allocated : Math.round((voteCounts[option.id] || 0) / total * 100);
      allocated += percent;
      const label = document.querySelector(`[data-vote-percent="${option.id}"]`);
      const bar = document.querySelector(`[data-vote-bar="${option.id}"]`);
      if (label) label.textContent = `${percent}%`;
      if (bar) bar.style.width = `${percent}%`;
    });
    const totalNode = document.querySelector('#total-votes');
    if (totalNode) totalNode.textContent = total.toLocaleString('ko-KR');
    const mine = document.querySelector('#my-vote');
    if (mine) mine.textContent = hasVote ? `나의 선택: ${voteOptions.find(option => option.id === myChoice)?.label || ''}` : total ? '전체 참여자의 투표 결과입니다.' : '아직 투표가 없습니다. 첫 의견을 남겨주세요.';
  };
  voteButtons.forEach(button => button.addEventListener('click', async () => {
    if (!currentUser) { showLogin(); return; }
    if (!voteApi || !ballotReady || voteBusy) return;
    const uid = currentUser.uid;
    voteBusy = true;
    renderVote();
    try {
      const response = await voteApi.cast(button.dataset.vote);
      if (currentUser?.uid !== uid) return;
      myChoice = response.data.choice;
      voteCounts = response.data.counts;
      window.nowfeedToast?.('투표가 저장됐어요.');
    } catch {
      window.nowfeedToast?.('투표를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally { voteBusy = false; renderVote(); }
  }));
  document.querySelector('#change-vote')?.addEventListener('click', () => {
    if (!currentUser || voteBusy) return;
    actions.hidden = false;
    voteStatus.textContent = '새 의견을 선택하면 기존 투표가 변경됩니다.';
    voteButtons[0]?.focus();
  });

  const form = document.querySelector('#comment-form');
  const input = document.querySelector('#comment-input');
  const count = document.querySelector('#comment-count');
  const list = document.querySelector('#comment-list');
  const totalNode = document.querySelector('#comments-total');
  const storageStatus = document.querySelector('#comment-storage-status');
  const submitButton = form?.querySelector('button[type="submit"]');
  const seedCount = list?.querySelectorAll('[data-seed="true"]').length || 0;
  let remoteComments = [];
  let firestoreApi = null;
  let profileApi = null;
  let authApi = null;
  let currentUser = null;
  let currentProfile = null;
  let commentsConnected = false;

  const createAuthPanel = () => {
    if (!form?.parentNode) return {};
    const panel = document.createElement('div');
    panel.className = 'comment-auth';
    panel.id = 'participation-login';

    const prompt = document.createElement('div');
    prompt.className = 'comment-auth-prompt';
    const promptCopy = document.createElement('div');
    const promptTitle = document.createElement('strong');
    promptTitle.textContent = '로그인하고 투표·토론에 참여하세요.';
    const promptText = document.createElement('span');
    promptText.textContent = '한 번 로그인하면 투표와 댓글을 모두 이용할 수 있어요. 댓글은 닉네임 설정 후 작성합니다.';
    promptCopy.append(promptTitle, promptText);
    const consentLabel = document.createElement('label');
    consentLabel.className = 'comment-auth-consent';
    const privacyConsent = document.createElement('input');
    privacyConsent.type = 'checkbox';
    privacyConsent.required = true;
    privacyConsent.setAttribute('aria-label', '개인정보 처리 및 댓글 공개 안내 동의');
    const consentText = document.createElement('span');
    consentText.append('만 14세 이상이며, 소셜 로그인·투표 정보 처리 및 닉네임·식별자·댓글 공개에 관한 ');
    const privacyLink = document.createElement('a');
    privacyLink.href = '/privacy/';
    privacyLink.target = '_blank';
    privacyLink.rel = 'noopener noreferrer';
    privacyLink.textContent = '개인정보처리방침';
    consentText.append(privacyLink, '을 확인했으며 동의합니다.');
    consentLabel.append(privacyConsent, consentText);
    const loginButtons = [];
    const providers = document.createElement('div');
    providers.className = 'social-login-buttons';
    for (const [id, name, mark] of [['naver', '네이버', 'N'], ['kakao', '카카오', '●'], ['google', 'Google', 'G']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `social-login-button provider-${id}`;
      button.dataset.provider = id;
      button.disabled = true;
      const enabled = window.NOWFEED_COMMUNITY_CONFIG?.providers[id];
      button.setAttribute('aria-label', `${name}로 로그인${enabled ? '' : ' · 준비 중'}`);
      if (id === 'google') {
        const icon = document.createElement('b');
        icon.textContent = mark;
        icon.setAttribute('aria-hidden', 'true');
        button.append(icon, `${name}로 로그인`);
      } else {
        const image = document.createElement('img');
        image.src = `/images/auth/${id}-login.png`;
        image.alt = '';
        button.append(image);
      }
      providers.append(button);
      loginButtons.push(button);
    }
    prompt.append(promptCopy, consentLabel, providers);
    const unavailable = [['naver', '네이버'], ['kakao', '카카오']].filter(([id]) => !window.NOWFEED_COMMUNITY_CONFIG?.providers[id]);
    if (unavailable.length) {
      const notice = document.createElement('p');
      notice.className = 'provider-notice';
      notice.textContent = `${unavailable.map(([, name]) => name).join('·')} 로그인은 준비 중입니다.`;
      prompt.append(notice);
    }

    const account = document.createElement('div');
    account.className = 'comment-auth-account';
    account.hidden = true;
    const accountCopy = document.createElement('div');
    const accountTitle = document.createElement('strong');
    const accountText = document.createElement('span');
    accountText.textContent = '닉네임이 바뀌어도 식별자는 유지됩니다.';
    accountCopy.append(accountTitle, accountText);
    const accountActions = document.createElement('div');
    accountActions.className = 'comment-auth-actions';
    const nicknameButton = document.createElement('button');
    nicknameButton.type = 'button';
    nicknameButton.className = 'google-logout-button';
    nicknameButton.textContent = '닉네임 변경';
    const logoutButton = document.createElement('button');
    logoutButton.type = 'button';
    logoutButton.className = 'google-logout-button';
    logoutButton.textContent = '로그아웃';
    accountActions.append(nicknameButton, logoutButton);
    account.append(accountCopy, accountActions);

    const profileEditor = document.createElement('form');
    profileEditor.className = 'comment-profile-editor';
    profileEditor.hidden = true;
    const profileCopy = document.createElement('div');
    const profileTitle = document.createElement('strong');
    profileTitle.textContent = '댓글 닉네임 설정';
    const profileText = document.createElement('span');
    profileText.textContent = '2~12자의 한글·영문·숫자·밑줄만 사용할 수 있습니다.';
    profileCopy.append(profileTitle, profileText);
    const profileControls = document.createElement('div');
    profileControls.className = 'comment-profile-controls';
    const nicknameInput = document.createElement('input');
    nicknameInput.type = 'text';
    nicknameInput.maxLength = 12;
    nicknameInput.autocomplete = 'off';
    nicknameInput.placeholder = '닉네임 입력';
    nicknameInput.required = true;
    nicknameInput.setAttribute('aria-label', '댓글 닉네임');
    const profileSaveButton = document.createElement('button');
    profileSaveButton.type = 'submit';
    profileSaveButton.textContent = '저장';
    const profileCancelButton = document.createElement('button');
    profileCancelButton.type = 'button';
    profileCancelButton.className = 'profile-cancel-button';
    profileCancelButton.textContent = '취소';
    profileControls.append(nicknameInput, profileSaveButton, profileCancelButton);
    profileEditor.append(profileCopy, profileControls);

    panel.append(prompt, account, profileEditor);
    const publicNotice = document.createElement('p');
    publicNotice.className = 'comment-public-notice';
    publicNotice.append('댓글을 등록하면 닉네임, 작성자 식별자, 내용과 작성 시각이 공개됩니다. 삭제 요청은 ');
    const contactLink = document.createElement('a');
    contactLink.href = '/contact/';
    contactLink.textContent = '문의하기';
    publicNotice.append(contactLink, '에서 접수할 수 있습니다.');
    form.before(panel, publicNotice);
    return {
      prompt,
      panel,
      loginButtons,
      privacyConsent,
      account,
      accountTitle,
      nicknameButton,
      logoutButton,
      profileEditor,
      nicknameInput,
      profileSaveButton,
      profileCancelButton
    };
  };

  const authUi = createAuthPanel();

  const formatTime = (value) => {
    const date = value?.toDate ? value.toDate() : new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return '방금 전';
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return '방금 전';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}일 전`;
    return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(date);
  };

  const visibleAuthorId = (uid) => `#${String(uid || '------').replace(/^(naver|kakao)_/, '').slice(0, 6).toUpperCase()}`;

  const createCommentNode = ({ text, createdAt, authorUid, authorNickname }) => {
    const article = document.createElement('article');
    article.className = 'comment';
    article.dataset.dynamic = 'true';

    const avatar = document.createElement('div');
    avatar.className = 'avatar user';
    avatar.textContent = (authorNickname || '회원').slice(0, 1);

    const body = document.createElement('div');
    const head = document.createElement('div');
    head.className = 'comment-head';
    const author = document.createElement('strong');
    author.textContent = `${authorNickname || '회원'} ${visibleAuthorId(authorUid)}`;
    const time = document.createElement('time');
    time.textContent = formatTime(createdAt);
    head.append(author, time);

    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    const likeButton = document.createElement('button');
    likeButton.className = 'like-button';
    likeButton.type = 'button';
    likeButton.append('공감 ');
    const likes = document.createElement('span');
    likes.textContent = '0';
    likeButton.append(likes);

    body.append(head, paragraph, likeButton);
    article.append(avatar, body);
    return article;
  };

  const renderComments = () => {
    if (!list) return;
    list.querySelectorAll('[data-dynamic="true"]').forEach((node) => node.remove());
    const firstSeed = list.querySelector('[data-seed="true"]');
    remoteComments.forEach((comment) => list.insertBefore(createCommentNode(comment), firstSeed));
    if (totalNode) totalNode.textContent = String(seedCount + remoteComments.length);
  };

  const setStorageStatus = (message, state) => {
    if (!storageStatus) return;
    storageStatus.textContent = message;
    storageStatus.dataset.state = state;
  };

  const updateAuthUi = (user, profile = currentProfile, editing = false) => {
    currentUser = user;
    const hasProfile = Boolean(user && profile?.nickname);
    renderVote();
    if (form) form.hidden = !hasProfile || editing;
    if (authUi.prompt) authUi.prompt.hidden = Boolean(user);
    if (authUi.account) authUi.account.hidden = !hasProfile || editing;
    if (authUi.profileEditor) authUi.profileEditor.hidden = !user || (hasProfile && !editing);
    if (authUi.profileCancelButton) authUi.profileCancelButton.hidden = !hasProfile;
    if (hasProfile) {
      authUi.accountTitle.textContent = `${profile.nickname} ${visibleAuthorId(user.uid)}`;
      authUi.nicknameInput.value = profile.nickname;
      setStorageStatus(commentsConnected ? '공용 댓글 연결됨' : '댓글 서버 연결 중', commentsConnected ? 'connected' : 'connecting');
    } else if (user) {
      setStorageStatus('닉네임 설정 필요', 'login');
    } else {
      setStorageStatus('로그인 후 댓글 작성', 'login');
    }
  };

  const connectFirebase = async () => {
    const config = window.NOWFEED_FIREBASE_CONFIG;
    if (!config) throw new Error('Firebase configuration is missing.');

    const version = '12.17.1';
    const [{ initializeApp, getApp, getApps }, authModule, firestore, functions] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-functions.js`)
    ]);

    const app = getApps().length ? getApp() : initializeApp(config);
    const auth = authModule.getAuth(app);
    await authModule.setPersistence(auth, authModule.browserLocalPersistence);
    const provider = new authModule.GoogleAuthProvider();
    const db = firestore.getFirestore(app);
    const commentsRef = firestore.collection(db, 'stories', storyId, 'comments');
    const commentsQuery = firestore.query(commentsRef, firestore.orderBy('createdAt', 'desc'), firestore.limit(100));

    authApi = {
      login: id => id === 'google' ? authModule.signInWithPopup(auth, provider) : window.nowfeedSocialLogin(id),
      logout: () => authModule.signOut(auth)
    };
    profileApi = {
      load: async (uid) => {
        const profileRef = firestore.doc(db, 'users', uid);
        const snapshot = await firestore.getDoc(profileRef);
        return snapshot.exists() ? snapshot.data() : null;
      },
      save: async (uid, nickname) => {
        const profileRef = firestore.doc(db, 'users', uid);
        const snapshot = await firestore.getDoc(profileRef);
        if (snapshot.exists()) {
          await firestore.updateDoc(profileRef, { nickname, updatedAt: firestore.serverTimestamp() });
        } else {
          await firestore.setDoc(profileRef, {
            nickname,
            createdAt: firestore.serverTimestamp(),
            updatedAt: firestore.serverTimestamp()
          });
        }
        return { nickname };
      }
    };
    const callableVote = functions.httpsCallable(functions.getFunctions(app, window.NOWFEED_COMMUNITY_CONFIG.region), 'castVote');
    voteApi = { cast: choice => callableVote({ storyId, choice }) };
    refreshLoginButtons();
    firestore.onSnapshot(firestore.doc(db, 'polls', storyId), snapshot => {
      voteCounts = snapshot.exists() ? snapshot.data().counts : Object.fromEntries(voteOptions.map(option => [option.id, 0]));
      renderVote();
    }, () => {
      voteCounts = null;
      renderVote();
      voteStatus.textContent = '투표 결과를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.';
    });
    authModule.onAuthStateChanged(auth, async user => {
      const generation = ++authGeneration;
      unsubscribeBallot?.();
      currentUser = user;
      currentProfile = null;
      myChoice = null;
      ballotReady = false;
      authReady = true;
      updateAuthUi(user, null);
      if (!user) return;
      unsubscribeBallot = firestore.onSnapshot(firestore.doc(db, 'stories', storyId, 'votes', user.uid), snapshot => {
        if (generation !== authGeneration) return;
        myChoice = snapshot.data()?.choice || null;
        ballotReady = true;
        renderVote();
      }, () => {
        if (generation !== authGeneration) return;
        ballotReady = false;
        renderVote();
        voteStatus.textContent = '내 투표 확인에 실패했습니다. 새로고침 후 다시 시도해 주세요.';
      });
      try {
        const profile = await profileApi.load(user.uid);
        if (generation !== authGeneration) return;
        currentProfile = profile;
        updateAuthUi(user, currentProfile);
      } catch {
        if (generation === authGeneration) setStorageStatus('프로필을 불러오지 못했습니다', 'offline');
      }
    });

    firestore.onSnapshot(commentsQuery, (snapshot) => {
      remoteComments = snapshot.docs.map((document) => {
        const data = document.data();
        return {
          id: document.id,
          text: data.body,
          createdAt: data.createdAt,
          authorUid: data.authorUid,
          authorNickname: data.authorNickname
        };
      });
      commentsConnected = true;
      renderComments();
      updateAuthUi(currentUser);
    }, () => {
      commentsConnected = false;
      setStorageStatus('댓글 서버 연결 오류', 'offline');
    });

    firestoreApi = {
      add: (text, user, profile) => firestore.addDoc(commentsRef, {
        body: text,
        authorUid: user.uid,
        authorNickname: profile.nickname,
        createdAt: firestore.serverTimestamp()
      })
    };

  };

  let loginBusy = false;
  const refreshLoginButtons = () => {
    authUi.loginButtons?.forEach(button => {
      button.disabled = loginBusy || !authApi || !authUi.privacyConsent?.checked || !window.NOWFEED_COMMUNITY_CONFIG?.providers[button.dataset.provider];
    });
  };
  authUi.privacyConsent?.addEventListener('change', refreshLoginButtons);
  authUi.loginButtons?.forEach(button => button.addEventListener('click', async () => {
    if (!authApi || loginBusy || !authUi.privacyConsent?.checked) return;
    loginBusy = true;
    refreshLoginButtons();
    try {
      await authApi.login(button.dataset.provider);
      if (button.dataset.provider === 'google') window.nowfeedToast?.('로그인이 완료됐어요.');
    } catch (error) {
      if (error?.code !== 'auth/popup-closed-by-user') window.nowfeedToast?.('로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally { loginBusy = false; refreshLoginButtons(); }
  }));

  authUi.logoutButton?.addEventListener('click', async () => {
    try {
      await authApi?.logout();
      window.nowfeedToast?.('로그아웃됐어요.');
    } catch {
      window.nowfeedToast?.('로그아웃에 실패했습니다.');
    }
  });

  authUi.nicknameButton?.addEventListener('click', () => {
    updateAuthUi(currentUser, currentProfile, true);
    authUi.nicknameInput?.focus();
  });

  authUi.profileCancelButton?.addEventListener('click', () => {
    updateAuthUi(currentUser, currentProfile, false);
  });

  authUi.profileEditor?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const nickname = authUi.nicknameInput.value.trim();
    if (!/^[가-힣a-zA-Z0-9_]{2,12}$/u.test(nickname)) {
      window.nowfeedToast?.('닉네임은 2~12자의 한글·영문·숫자·밑줄만 사용할 수 있어요.');
      return;
    }
    if (!currentUser || !profileApi) return;
    const generation = authGeneration;
    const uid = currentUser.uid;
    authUi.profileSaveButton.disabled = true;
    try {
      const savedProfile = await profileApi.save(uid, nickname);
      if (generation !== authGeneration) return;
      currentProfile = savedProfile;
      updateAuthUi(currentUser, currentProfile);
      window.nowfeedToast?.('닉네임이 저장됐어요.');
    } catch {
      window.nowfeedToast?.('닉네임 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      authUi.profileSaveButton.disabled = false;
    }
  });

  input?.addEventListener('input', () => {
    if (count) count.textContent = String(input.value.length);
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !currentUser || !currentProfile || !firestoreApi) return;
    if (submitButton) submitButton.disabled = true;

    try {
      await firestoreApi.add(text, currentUser, currentProfile);
      input.value = '';
      if (count) count.textContent = '0';
      window.nowfeedToast?.('댓글이 등록됐어요.');
    } catch {
      window.nowfeedToast?.('댓글 등록에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  list?.addEventListener('click', (event) => {
    const button = event.target.closest('.like-button');
    if (!button) return;
    const number = button.querySelector('span');
    const liked = button.classList.toggle('liked');
    number.textContent = String(Number(number.textContent) + (liked ? 1 : -1));
  });

  renderComments();
  updateAuthUi(null);
  connectFirebase().catch(() => {
    authUi.loginButtons?.forEach(button => { button.disabled = true; });
    voteStatus.textContent = '참여 서비스를 연결하지 못했습니다. 잠시 후 새로고침해 주세요.';
    setStorageStatus('댓글 서비스 연결 오류', 'offline');
  });
})();
