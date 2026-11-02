/**
 * Planify Pro SPA Main Application Entry
 */

import { ThemeManager } from './theme.js';
import { Toast } from './components/toast.js';
import { AuthManager } from './auth.js';
import { Sidebar } from './components/sidebar.js';
import { ReminderNotifier } from './components/reminder-notifier.js';
import { CommandPalette } from './components/command-palette.js';
import { EventForm } from './calendar/event-form.js';
import { router } from './router.js';
import { store } from './store.js';
import { api } from './api.js';
import { keyboardManager } from './utils/keyboard.js';

import { landingPage } from './pages/landing.js';
import { loginPage } from './pages/login.js';
import { registerPage } from './pages/register.js';
import { dashboardPage } from './pages/dashboard.js';
import { calendarPage } from './pages/calendar.js';
import { todoPage } from './pages/todo.js';
import { aiPage } from './pages/ai.js';
import { guidePage } from './pages/guide.js';
import { settingsPage } from './pages/settings.js';
import { ChatPanel } from './ai/chat-panel.js';
import { Modal } from './components/modal.js';
import { ContextMenu } from './components/contextmenu.js';

class App {
  static async init() {
    // 1. Initialize Theme & Toast
    ThemeManager.init();
    Toast.init();
    store.on('session-reset', () => {
      for (const modal of [...Modal.modalStack]) modal.close();
      ContextMenu.close();
    });

    // 2. Register All Routes (Landing + Auth + 5 Core Tabs + Settings)
    router.register('landing', landingPage);
    router.register('login', loginPage);
    router.register('register', registerPage);
    router.register('dashboard', dashboardPage);
    router.register('todo', todoPage);
    router.register('calendar', calendarPage);
    router.register('ai', aiPage);
    router.register('guide', guidePage);
    router.register('settings', settingsPage);

    // 3. Initialize Sidebar & Command Palette (Pomodoro Focus removed per user request)
    Sidebar.init();
    CommandPalette.init();

    // 4. Header Quick Create button — opens Unified Form (default no date/time so it can be permanent or dragged to Calendar)
    const quickCreateBtn = document.getElementById('btn-header-quick-create');
    if (quickCreateBtn) {
      quickCreateBtn.addEventListener('click', () => {
        EventForm.showFullModal({
          hasDate: false,
          onCreated: () => {
            window.dispatchEvent(new CustomEvent('planify:data-changed'));
          }
        });
      });
    }

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
    if (!AuthManager.isAuthenticated()) return;
    try {
      const tasks = await api.get('/tasks', { is_completed: false });
      const badge = document.getElementById('nav-todo-badge');
      if (badge && Array.isArray(tasks)) {
        const count = tasks.length;
        badge.textContent = String(count);
        badge.classList.toggle('hidden', count === 0);
      }
    } catch (_) {}
  }
}

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
