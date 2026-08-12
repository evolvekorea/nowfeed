(() => {
  const dateNode = document.querySelector('#current-date');
  const timeNode = document.querySelector('#current-time');
  const menuButton = document.querySelector('#menu-toggle');
  const nav = document.querySelector('#main-nav');
  const themeButton = document.querySelector('#theme-toggle');

  const updateClock = () => {
    const now = new Date();
    if (dateNode) {
      dateNode.textContent = new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
      }).format(now);
    }
    if (timeNode) {
      timeNode.textContent = new Intl.DateTimeFormat('ko-KR', {
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(now);
    }
  };

  updateClock();
  window.setInterval(updateClock, 60000);

  menuButton?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });

  const storedTheme = localStorage.getItem('nowfeed-theme');
  if (storedTheme === 'dark') document.body.classList.add('dark');

  themeButton?.addEventListener('click', () => {
    const dark = document.body.classList.toggle('dark');
    localStorage.setItem('nowfeed-theme', dark ? 'dark' : 'light');
    themeButton.setAttribute('aria-label', dark ? '밝은 화면으로 전환' : '어두운 화면으로 전환');
  });
})();

