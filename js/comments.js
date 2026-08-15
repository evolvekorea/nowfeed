(() => {
  const storyId = document.body.dataset.storyId || 'husband-001';
  const voteKey = `nowfeed-vote-${storyId}`;
  const actions = document.querySelector('#vote-actions');
  const results = document.querySelector('#vote-results');
  const voteButtons = [...document.querySelectorAll('[data-vote]')];

  const voteOptions = voteButtons.map((button) => ({
    id: button.dataset.vote,
    label: button.dataset.label || button.querySelector('strong')?.textContent?.trim() || button.dataset.vote,
    base: Number(button.dataset.base || 0)
  }));

  const renderVote = (choice) => {
    if (!actions || !results || !voteOptions.length) return;
    if (!choice || !voteOptions.some((option) => option.id === choice)) {
      actions.hidden = false;
      results.hidden = true;
      return;
    }

    const votes = Object.fromEntries(voteOptions.map((option) => [option.id, option.base + (option.id === choice ? 1 : 0)]));
    const total = Object.values(votes).reduce((sum, value) => sum + value, 0);
    let allocated = 0;

    voteOptions.forEach((option, index) => {
      const isLast = index === voteOptions.length - 1;
      const percent = isLast ? 100 - allocated : Math.round((votes[option.id] / total) * 100);
      allocated += percent;
      const percentNode = document.querySelector(`[data-vote-percent="${option.id}"]`);
      const barNode = document.querySelector(`[data-vote-bar="${option.id}"]`);
      if (percentNode) percentNode.textContent = `${percent}%`;
      if (barNode) window.requestAnimationFrame(() => { barNode.style.width = `${percent}%`; });
    });

    actions.hidden = true;
    results.hidden = false;
    const totalNode = document.querySelector('#total-votes');
    const myVoteNode = document.querySelector('#my-vote');
    if (totalNode) totalNode.textContent = total.toLocaleString('ko-KR');
    if (myVoteNode) myVoteNode.textContent = `나의 선택: ${voteOptions.find((option) => option.id === choice).label}`;
  };

  voteButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const choice = button.dataset.vote;
      localStorage.setItem(voteKey, choice);
      renderVote(choice);
      window.nowfeedToast?.('투표가 반영됐어요.');
    });
  });

  document.querySelector('#change-vote')?.addEventListener('click', () => {
    localStorage.removeItem(voteKey);
    renderVote(null);
  });

  renderVote(localStorage.getItem(voteKey));

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

    const prompt = document.createElement('div');
    prompt.className = 'comment-auth-prompt';
    const promptCopy = document.createElement('div');
    const promptTitle = document.createElement('strong');
    promptTitle.textContent = 'Google 로그인 후 댓글을 남길 수 있어요.';
    const promptText = document.createElement('span');
    promptText.textContent = '처음 로그인하면 댓글에 사용할 닉네임을 설정합니다. 만 14세 이상만 이용할 수 있습니다.';
    promptCopy.append(promptTitle, promptText);
    const consentLabel = document.createElement('label');
    consentLabel.className = 'comment-auth-consent';
    const privacyConsent = document.createElement('input');
    privacyConsent.type = 'checkbox';
    privacyConsent.required = true;
    privacyConsent.setAttribute('aria-label', '개인정보 처리 및 댓글 공개 안내 동의');
    const consentText = document.createElement('span');
    consentText.append('만 14세 이상이며, Google 로그인 정보 처리와 닉네임·식별자·댓글의 공개에 관한 ');
    const privacyLink = document.createElement('a');
    privacyLink.href = '/privacy/';
    privacyLink.target = '_blank';
    privacyLink.rel = 'noopener noreferrer';
    privacyLink.textContent = '개인정보처리방침';
    consentText.append(privacyLink, '을 확인했으며 동의합니다.');
    consentLabel.append(privacyConsent, consentText);
    const loginButton = document.createElement('button');
    loginButton.type = 'button';
    loginButton.className = 'google-login-button';
    loginButton.disabled = true;
    const googleMark = document.createElement('b');
    googleMark.textContent = 'G';
    loginButton.append(googleMark, ' Google로 로그인');
    prompt.append(promptCopy, consentLabel, loginButton);

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
      loginButton,
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

  const visibleAuthorId = (uid) => `#${String(uid || '------').slice(0, 6).toUpperCase()}`;

  const createCommentNode = ({ text, createdAt, authorUid, authorNickname }) => {
    const article = document.createElement('article');
    article.className = 'comment';
    article.dataset.dynamic = 'true';

    const avatar = document.createElement('div');
    avatar.className = 'avatar user';
    avatar.textContent = 'G';

    const body = document.createElement('div');
    const head = document.createElement('div');
    head.className = 'comment-head';
    const author = document.createElement('strong');
    author.textContent = `${authorNickname || 'Google 사용자'} ${visibleAuthorId(authorUid)}`;
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
      setStorageStatus('Google 로그인 필요', 'login');
    }
  };

  const connectFirebase = async () => {
    const config = window.NOWFEED_FIREBASE_CONFIG;
    if (!config) throw new Error('Firebase configuration is missing.');

    const version = '12.17.1';
    const [{ initializeApp, getApp, getApps }, authModule, firestore] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
    ]);

    const app = getApps().length ? getApp() : initializeApp(config);
    const auth = authModule.getAuth(app);
    await authModule.setPersistence(auth, authModule.browserLocalPersistence);
    const provider = new authModule.GoogleAuthProvider();
    const db = firestore.getFirestore(app);
    const commentsRef = firestore.collection(db, 'stories', storyId, 'comments');
    const commentsQuery = firestore.query(commentsRef, firestore.orderBy('createdAt', 'desc'), firestore.limit(100));

    authApi = {
      login: () => authModule.signInWithPopup(auth, provider),
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
    if (authUi.loginButton) authUi.loginButton.disabled = !authUi.privacyConsent?.checked;
    authModule.onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      currentProfile = null;
      if (!user) {
        updateAuthUi(null, null);
        return;
      }
      updateAuthUi(user, null);
      try {
        currentProfile = await profileApi.load(user.uid);
        updateAuthUi(user, currentProfile);
      } catch {
        setStorageStatus('프로필을 불러오지 못했습니다', 'offline');
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

  authUi.privacyConsent?.addEventListener('change', () => {
    if (authUi.loginButton && authApi) authUi.loginButton.disabled = !authUi.privacyConsent.checked;
  });

  authUi.loginButton?.addEventListener('click', async () => {
    if (!authApi) return;
    authUi.loginButton.disabled = true;
    try {
      await authApi.login();
      window.nowfeedToast?.('Google 로그인이 완료됐어요.');
    } catch (error) {
      if (error?.code === 'auth/unauthorized-domain') {
        window.nowfeedToast?.('Firebase 승인된 도메인에 nowfeed.co.kr를 추가해주세요.');
      } else if (error?.code !== 'auth/popup-closed-by-user') {
        window.nowfeedToast?.('Google 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      authUi.loginButton.disabled = false;
    }
  });

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
    authUi.profileSaveButton.disabled = true;
    try {
      currentProfile = await profileApi.save(currentUser.uid, nickname);
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
    if (authUi.loginButton) authUi.loginButton.disabled = true;
    setStorageStatus('댓글 서비스 연결 오류', 'offline');
  });
})();
