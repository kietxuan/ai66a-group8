import { api } from './api.js';
import { store } from './store.js';

export class ThemeManager {
  static init() {
    const savedTheme = this.getSavedTheme();
    this.apply(savedTheme, false);

    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.toggle();
      });
    }
  }

  static getSavedTheme() {
    const t = localStorage.getItem('planify_theme') || localStorage.getItem('theme') || 'light';
    return t === 'dark' ? 'dark' : 'light';
  }

  static apply(themePreference, persistToServer = true) {
    const effectiveTheme = themePreference === 'dark' ? 'dark' : 'light';

    localStorage.setItem('planify_theme', effectiveTheme);
    localStorage.setItem('theme', effectiveTheme);

    document.documentElement.setAttribute('data-theme', effectiveTheme);
    store.set('theme', effectiveTheme);

    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', String(effectiveTheme === 'dark'));
      toggleBtn.title = effectiveTheme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
      const label = toggleBtn.querySelector('.header-theme-label');
      if (label) label.textContent = effectiveTheme === 'dark' ? 'Tối' : 'Sáng';
    }

    if (persistToServer && api.getToken()) {
      const token = api.getToken();
      this.saveQueue = (this.saveQueue || Promise.resolve()).then(() => {
        if (api.getToken() === token) return api.put('/users/me', { theme_preference: effectiveTheme });
      }).catch(() => {});
    }
  }

  static toggle() {
    const currentAttr = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentAttr === 'dark' ? 'light' : 'dark';
    this.apply(nextTheme, true);
  }
}
