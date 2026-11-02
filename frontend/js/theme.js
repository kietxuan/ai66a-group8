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

    if (persistToServer && api.getToken()) {
      api.put('/users/me', { theme_preference: effectiveTheme }).catch(() => {});
    }
  }

  static toggle() {
    const currentAttr = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentAttr === 'dark' ? 'light' : 'dark';
    this.apply(nextTheme, true);
  }
}
