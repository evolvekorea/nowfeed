(() => {
  const menu = document.querySelector('#main-nav');
  const menuButton = document.querySelector('#menu-toggle');
  const toast = document.querySelector('#toast');

  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2200);
  };

  window.nowfeedToast = showToast;

  menuButton?.addEventListener('click', () => {
    const isOpen = menu?.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(Boolean(isOpen)));
  });

  document.querySelectorAll('[data-scroll-comments]').forEach((button) => {
    button.addEventListener('click', () => document.querySelector('#comments')?.scrollIntoView());
  });

  document.querySelector('#share-button')?.addEventListener('click', async () => {
    const shareData = { title: document.title, text: '이 사연에 당신의 선택을 남겨보세요.', url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        showToast('링크를 복사했어요.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') showToast('링크를 복사하지 못했어요.');
    }
  });
})();
