import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

export const THEME_KEY = 'nhip-theme';
const validTheme = value => value === 'light' || value === 'dark';
const systemTheme = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
function storedTheme() {
  let saved;
  try { saved = localStorage.getItem(THEME_KEY); } catch { /* Keep theme usable without storage. */ }
  return validTheme(saved) ? saved : document.documentElement.dataset.themeChoice;
}
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121815' : '#f7f8f4');
}

// Theme is a browser preference only. It never enters task/auth/chat requests.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    const saved = storedTheme();
    return validTheme(saved) ? saved : systemTheme();
  });
  const manual = useRef(validTheme(storedTheme()));
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const systemChanged = event => { if (!manual.current) setTheme(event.matches ? 'dark' : 'light'); };
    const sync = event => { manual.current = true; setTheme(event.detail); };
    const storageChanged = event => {
      if (event.key !== THEME_KEY && event.key !== null) return;
      manual.current = validTheme(event.newValue);
      if (manual.current) document.documentElement.dataset.themeChoice = event.newValue;
      else delete document.documentElement.dataset.themeChoice;
      setTheme(manual.current ? event.newValue : systemTheme());
    };
    media?.addEventListener?.('change', systemChanged);
    window.addEventListener('nhip-theme-change', sync);
    window.addEventListener('storage', storageChanged);
    return () => {
      media?.removeEventListener?.('change', systemChanged);
      window.removeEventListener('nhip-theme-change', sync);
      window.removeEventListener('storage', storageChanged);
    };
  }, []);
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    manual.current = true;
    document.documentElement.dataset.themeChoice = next;
    applyTheme(next);
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* Keep the choice for this mounted session. */ }
    window.dispatchEvent(new CustomEvent('nhip-theme-change', { detail: next }));
  }
  return <button type="button" className="icon-button theme-toggle" onClick={toggle}
    aria-label="Chế độ tối" aria-pressed={theme === 'dark'} title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}>
    <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20}/>
  </button>;
}
