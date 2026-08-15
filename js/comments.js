(() => {
  const storyId = document.body.dataset.storyId || 'husband-001';
  const voteKey = `nowfeed-vote-${storyId}`;
  const commentKey = `nowfeed-comments-${storyId}`;
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

  const readLocalComments = () => {
    try {
      const comments = JSON.parse(localStorage.getItem(commentKey));
      return Array.isArray(comments) ? comments : [];
    } catch {
      return [];
    }
  };

  const writeLocalComment = (text) => {
    const comments = readLocalComments();
    comments.push({ text, time: new Date().toISOString() });
    localStorage.setItem(commentKey, JSON.stringify(comments));
  };

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

  const createCommentNode = ({ text, createdAt, localOnly = false }) => {
    const article = document.createElement('article');
    article.className = 'comment';
    article.dataset.dynamic = 'true';

    const avatar = document.createElement('div');
    avatar.className = 'avatar user';
    avatar.textContent = '익';

    const body = document.createElement('div');
    const head = document.createElement('div');
    head.className = 'comment-head';
    const author = document.createElement('strong');
    author.textContent = localOnly ? '익명의 독자 · 기기 저장' : '익명의 독자';
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
    const comments = [
      ...remoteComments.map((comment) => ({ ...comment, localOnly: false })),
      ...readLocalComments().map((comment) => ({ text: comment.text, createdAt: comment.time, localOnly: true })).reverse()
    ];
    const firstSeed = list.querySelector('[data-seed="true"]');
    comments.forEach((comment) => list.insertBefore(createCommentNode(comment), firstSeed));
    if (totalNode) totalNode.textContent = String(seedCount + comments.length);
  };

  const setStorageStatus = (message, state) => {
    if (!storageStatus) return;
    storageStatus.textContent = message;
    storageStatus.dataset.state = state;
  };

  const connectFirebase = async () => {
    const config = window.NOWFEED_FIREBASE_CONFIG;
    if (!config) throw new Error('Firebase configuration is missing.');

    const version = '12.17.1';
    const [{ initializeApp, getApp, getApps }, { getAuth, signInAnonymously }, firestore] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
    ]);

    const app = getApps().length ? getApp() : initializeApp(config);
    const auth = getAuth(app);
    const credential = auth.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth);
    const db = firestore.getFirestore(app);
    const commentsRef = firestore.collection(db, 'stories', storyId, 'comments');
    const commentsQuery = firestore.query(commentsRef, firestore.orderBy('createdAt', 'desc'), firestore.limit(100));

    firestore.onSnapshot(commentsQuery, (snapshot) => {
      remoteComments = snapshot.docs.map((document) => {
        const data = document.data();
        return { id: document.id, text: data.body, createdAt: data.createdAt };
      });
      renderComments();
      setStorageStatus('공용 댓글 연결됨', 'connected');
    }, () => {
      setStorageStatus('연결 오류 · 이 기기에 임시 저장', 'offline');
    });

    firestoreApi = {
      add: (text) => firestore.addDoc(commentsRef, {
        body: text,
        authorUid: credential.user.uid,
        createdAt: firestore.serverTimestamp()
      })
    };
  };

  input?.addEventListener('input', () => {
    if (count) count.textContent = String(input.value.length);
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    if (submitButton) submitButton.disabled = true;

    try {
      if (firestoreApi) {
        await firestoreApi.add(text);
        window.nowfeedToast?.('댓글이 등록됐어요.');
      } else {
        writeLocalComment(text);
        renderComments();
        window.nowfeedToast?.('서버 연결 전이라 이 기기에 임시 저장했어요.');
      }
      input.value = '';
      if (count) count.textContent = '0';
    } catch {
      writeLocalComment(text);
      renderComments();
      setStorageStatus('연결 오류 · 이 기기에 임시 저장', 'offline');
      input.value = '';
      if (count) count.textContent = '0';
      window.nowfeedToast?.('연결 오류로 이 기기에 임시 저장했어요.');
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
  setStorageStatus('댓글 서버 연결 중', 'connecting');
  connectFirebase().catch(() => {
    setStorageStatus('설정 필요 · 이 기기에 임시 저장', 'offline');
  });
})();
