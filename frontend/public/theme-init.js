// Run before the application stylesheet to avoid flashing the wrong theme.
(() => {
  let saved;
  try { saved = localStorage.getItem('nhip-theme'); } catch { /* Storage may be blocked. */ }
  const theme = saved === 'light' || saved === 'dark' ? saved
    : window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121815' : '#f7f8f4');
})();
