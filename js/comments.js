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
  const seedCount = list?.querySelectorAll('[data-seed="true"]').length || 0;

  const readComments = () => {
    try { return JSON.parse(localStorage.getItem(commentKey)) || []; }
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
    if (totalNode) totalNode.textContent = String(seedCount + comments.length);
  };

  input?.addEventListener('input', () => { if (count) count.textContent = String(input.value.length); });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const comments = readComments();
    comments.push({ text, time: '방금 전' });
    localStorage.setItem(commentKey, JSON.stringify(comments));
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
