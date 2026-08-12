(() => {
  const modal = document.querySelector('#search-modal');
  const openButton = document.querySelector('#search-open');
  const closeButton = document.querySelector('#search-close');
  const input = document.querySelector('#search-input');
  const results = document.querySelector('#search-results');
  let posts = [];

  const open = async () => {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    input.focus();
    if (!posts.length) {
      try {
        const response = await fetch('data/posts.json');
        posts = await response.json();
      } catch {
        results.innerHTML = '<p>로컬 서버에서 열면 샘플 검색을 사용할 수 있습니다.</p>';
      }
    }
  };

  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
    input.value = '';
    results.innerHTML = '<p>제목과 요약을 검색합니다.</p>';
    openButton?.focus();
  };

  const search = () => {
    const query = input.value.trim().toLowerCase();
    if (!query) {
      results.innerHTML = '<p>제목과 요약을 검색합니다.</p>';
      return;
    }
    const matches = posts.filter(post => `${post.title} ${post.summary} ${post.category}`.toLowerCase().includes(query));
    results.innerHTML = matches.length
      ? matches.map(post => `<a class="search-result" href="${post.url}"><strong>${post.title}</strong><span>${post.category} · ${post.summary}</span></a>`).join('')
      : '<p>일치하는 샘플 콘텐츠가 없습니다.</p>';
  };

  openButton?.addEventListener('click', open);
  closeButton?.addEventListener('click', close);
  input?.addEventListener('input', search);
  modal?.addEventListener('click', event => { if (event.target === modal) close(); });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && modal.hidden && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      event.preventDefault(); open();
    }
    if (event.key === 'Escape' && !modal.hidden) close();
  });
})();

