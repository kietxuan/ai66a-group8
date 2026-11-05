/**
 * Planify Pro SPA Main Application Entry
 */

import { ThemeManager } from './theme.js';
import { initUiIcons } from './utils/icons.js';
import { Toast } from './components/toast.js';
import { AuthManager } from './auth.js';
import { Sidebar } from './components/sidebar.js';
import { ReminderNotifier } from './components/reminder-notifier.js';
import { CommandPalette } from './components/command-palette.js';
import { router } from './router.js';
import { store } from './store.js';
import { api } from './api.js';
import { keyboardManager } from './utils/keyboard.js';
import { initPasswordVisibility } from './utils/password-visibility.js?v=6.0.2';

import { landingPage } from './pages/landing.js';
import { authPage } from './pages/auth-page.js';
import { dashboardPage } from './pages/dashboard.js';
import { calendarPage } from './pages/calendar.js';
import { todoPage } from './pages/todo.js';
import { aiPage } from './pages/ai.js';
import { guidePage } from './pages/guide.js';
import { settingsPage } from './pages/settings.js';
import { ChatPanel } from './ai/chat-panel.js';
import { AiDemoAccess } from './ai/demo-access.js';
import { Modal } from './components/modal.js';
import { ContextMenu } from './components/contextmenu.js';

class App {
  static async init() {
    initUiIcons();
    // 1. Initialize Theme & Toast
    ThemeManager.init();
    Toast.init();
    initPasswordVisibility();
    store.on('session-reset', () => {
      for (const modal of [...Modal.modalStack]) modal.close(true);
      ContextMenu.close();
    });

    // 2. Register All Routes (Landing + Auth + 5 Core Tabs + Settings)
    router.register('landing', landingPage);
    router.register('login', authPage);
    router.register('register', authPage);
    router.register('dashboard', dashboardPage);
    router.register('todo', todoPage);
    router.register('calendar', calendarPage);
    router.register('ai', aiPage);
    router.register('guide', guidePage);
    router.register('settings', settingsPage);

    // 3. Initialize Sidebar & Command Palette (Pomodoro Focus removed per user request)
    Sidebar.init();
    CommandPalette.init();

    // 5. Update user badge in header & Reminder service
    store.on('user', (user) => {
      const nameEl = document.getElementById('user-display-name');
      const avatarEl = document.getElementById('user-avatar-initial');
      if (user) {
        if (nameEl) nameEl.textContent = user.nickname || user.email;
        if (avatarEl) avatarEl.textContent = (user.nickname || user.email || 'U')[0].toUpperCase();
        ReminderNotifier.start();
        this.refreshNavBadge();
      } else {
        if (nameEl) nameEl.textContent = 'Người dùng';
        if (avatarEl) avatarEl.textContent = 'U';
        ReminderNotifier.stop();
      }
    });

    window.addEventListener('planify:data-changed', () => this.refreshNavBadge());
    const refreshVisible = () => {
      if (!AuthManager.isAuthenticated() || document.hidden) return;
      const route = store.get('currentRoute');
      if (route === 'dashboard') dashboardPage.loadAndRender(document.getElementById('dashboard-root'));
      if (route === 'todo') todoPage.fetchTasks({ preserveDetail: true, refreshLists: true });
      if (route === 'calendar') calendarPage.updateView();
      this.refreshNavBadge();
    };
    document.addEventListener('visibilitychange', refreshVisible);
    window.addEventListener('focus', refreshVisible);
    window.addEventListener('storage', event => {
      if (event.key === 'planify_data_revision') refreshVisible();
    });
    window.addEventListener('planify:data-changed', () => {
      try { localStorage.setItem('planify_data_revision', `${Date.now()}:${Math.random()}`); } catch (_) {}
    });
    window.addEventListener('beforeunload', event => {
      if (Modal.activeModal?.isDirty?.() || document.querySelector('.todo-input')?.value.trim()) {
        event.preventDefault();
        event.returnValue = '';
      }
    });

    const profileBadge = document.getElementById('user-profile-badge');
    if (profileBadge) {
      profileBadge.addEventListener('click', () => {
        window.location.hash = '#settings';
      });
    }

    // 6. Restore active user session if authenticated
    if (AuthManager.isAuthenticated()) {
      await AuthManager.fetchCurrentUser();
    }

    // 7. Initialize Slide-Over AI Chat Panel
    if (!AiDemoAccess.isAccepted()) store.set('isAiPanelOpen', false);
    ChatPanel.init();

    const aiPanel = document.getElementById('ai-chat-panel');
    const closeAiBtn = document.getElementById('btn-close-ai');
    if (closeAiBtn) {
      closeAiBtn.addEventListener('click', () => {
        store.set('isAiPanelOpen', false);
      });
    }

    store.on('isAiPanelOpen', (isOpen) => {
      if (aiPanel) {
        aiPanel.classList.toggle('hidden', !isOpen);
      }
    });

    if (store.get('isAiPanelOpen') && aiPanel) {
      aiPanel.classList.remove('hidden');
    }

    // 8. Start SPA Router
    router.start();
  }

  static async refreshNavBadge() {
    // Badge on To Do nav item has been removed as requested
    const badge = document.getElementById('nav-todo-badge');
    if (badge) badge.classList.add('hidden');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
