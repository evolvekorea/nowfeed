(() => {
  const VOTE_KEY = 'nowfeed-vote-husband-001';
  const COMMENT_KEY = 'nowfeed-comments-husband-001';
  const baseVotes = { leave: 1842, stay: 1136 };
  const actions = document.querySelector('#vote-actions');
  const results = document.querySelector('#vote-results');

  const renderVote = (choice) => {
    if (!actions || !results) return;
    if (!choice) {
      actions.hidden = false;
      results.hidden = true;
      return;
    }

    const votes = { ...baseVotes, [choice]: baseVotes[choice] + 1 };
    const total = votes.leave + votes.stay;
    const leavePercent = Math.round((votes.leave / total) * 100);
    const stayPercent = 100 - leavePercent;

    actions.hidden = true;
    results.hidden = false;
    document.querySelector('#leave-percent').textContent = `${leavePercent}%`;
    document.querySelector('#stay-percent').textContent = `${stayPercent}%`;
    document.querySelector('#total-votes').textContent = total.toLocaleString('ko-KR');
    document.querySelector('#my-vote').textContent = choice === 'leave' ? '나의 선택: 이혼을 고민한다' : '나의 선택: 한 번 더 노력한다';
    window.requestAnimationFrame(() => {
      document.querySelector('#leave-bar').style.width = `${leavePercent}%`;
      document.querySelector('#stay-bar').style.width = `${stayPercent}%`;
    });
  };

  document.querySelectorAll('[data-vote]').forEach((button) => {
    button.addEventListener('click', () => {
      const choice = button.dataset.vote;
      localStorage.setItem(VOTE_KEY, choice);
      renderVote(choice);
      window.nowfeedToast?.('투표가 반영됐어요.');
    });
  });

  document.querySelector('#change-vote')?.addEventListener('click', () => {
    localStorage.removeItem(VOTE_KEY);
    renderVote(null);
  });

  renderVote(localStorage.getItem(VOTE_KEY));

  const form = document.querySelector('#comment-form');
  const input = document.querySelector('#comment-input');
  const count = document.querySelector('#comment-count');
  const list = document.querySelector('#comment-list');
  const totalNode = document.querySelector('#comments-total');

  const readComments = () => {
    try { return JSON.parse(localStorage.getItem(COMMENT_KEY)) || []; }
    catch { return []; }
  };

  const escapeText = (value) => value.replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[char]);

  const renderComments = () => {
    if (!list) return;
    list.querySelectorAll('[data-local="true"]').forEach((node) => node.remove());
    const comments = readComments();
    comments.forEach((comment) => {
      const article = document.createElement('article');
      article.className = 'comment';
      article.dataset.local = 'true';
      article.innerHTML = `<div class="avatar user">나</div><div><div class="comment-head"><strong>익명의 독자</strong><time>${escapeText(comment.time)}</time></div><p>${escapeText(comment.text)}</p><button class="like-button" type="button">공감 <span>0</span></button></div>`;
      list.prepend(article);
    });
    if (totalNode) totalNode.textContent = String(3 + comments.length);
  };

  input?.addEventListener('input', () => { if (count) count.textContent = String(input.value.length); });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const comments = readComments();
    comments.push({ text, time: '방금 전' });
    localStorage.setItem(COMMENT_KEY, JSON.stringify(comments));
    input.value = '';
    if (count) count.textContent = '0';
    renderComments();
    window.nowfeedToast?.('댓글을 등록했어요.');
  });

  list?.addEventListener('click', (event) => {
    const button = event.target.closest('.like-button');
    if (!button) return;
    const number = button.querySelector('span');
    const liked = button.classList.toggle('liked');
    number.textContent = String(Number(number.textContent) + (liked ? 1 : -1));
  });

  renderComments();
})();
