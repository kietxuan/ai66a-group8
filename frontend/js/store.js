import { businessNow, parseLocalDate } from './utils/date.js';
/**
 * Central State Store & EventBus with Automatic LocalStorage Persistence
 */

function loadSavedDate() {
  try {
    const raw = localStorage.getItem('planify_calendar_date');
    if (raw) {
      const parsed = parseLocalDate(raw);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  } catch (_) {}
  return businessNow();
}

function loadSavedView() {
  try {
    const saved = localStorage.getItem('planify_calendar_view');
    if (saved && ['month', 'week', 'day', 'agenda'].includes(saved)) {
      return saved;
    }
  } catch (_) {}
  // Mặc định khi vào Calendar là Lịch Tháng ('month')
  return 'month';
}

function loadSavedTheme() {
  try {
    const saved = localStorage.getItem('planify_theme') || localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch (_) {}
  return 'light';
}

class Store {
  constructor() {
    this.state = {
      user: null,
      calendars: [],
      events: [],
      taskLists: [],
      tasks: [],
      currentRoute: localStorage.getItem('planify_last_route') || 'dashboard',
      calendarView: loadSavedView(), // Mặc định 'month' (Lịch Tháng)
      selectedDate: loadSavedDate(),
      selectedTask: null,
      activeTodoList: localStorage.getItem('planify_todo_active_list') || 'board',
      theme: loadSavedTheme(),
      isAiPanelOpen: localStorage.getItem('planify_ai_drawer_open') === 'true'
    };
    this.listeners = {};
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    const oldValue = this.state[key];
    if (key === 'user' && oldValue?.id !== value?.id) {
      const sameSavedUser = value?.id != null && localStorage.getItem('planify_user_id') === String(value.id);
      for (const name of ['calendars', 'events', 'taskLists', 'tasks']) this.state[name] = [];
      this.state.selectedTask = null;
      this.set('isAiPanelOpen', false);
      if (!sameSavedUser) {
        this.state.activeTodoList = 'board';
        localStorage.removeItem('planify_todo_active_list');
      }
      if (value?.id != null) localStorage.setItem('planify_user_id', String(value.id));
      else localStorage.removeItem('planify_user_id');
      for (const name of ['planify_notify_enabled', 'planify_notify_minutes_before']) localStorage.removeItem(name);
      for (const name of ['planify_notified_reminders', 'planify_ai_pending_prompt']) sessionStorage.removeItem(name);
      this.emit('session-reset');
    }
    this.state[key] = value;

    // Persist key state selections across page refreshes (F5)
    try {
      if (key === 'calendarView' && value) {
        localStorage.setItem('planify_calendar_view', String(value));
      } else if (key === 'selectedDate' && value instanceof Date && !isNaN(value.getTime())) {
        localStorage.setItem('planify_calendar_date', `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`);
      } else if (key === 'activeTodoList' && value !== undefined) {
        localStorage.setItem('planify_todo_active_list', String(value));
      } else if (key === 'theme' && (value === 'light' || value === 'dark')) {
        localStorage.setItem('planify_theme', value);
        localStorage.setItem('theme', value);
      } else if (key === 'isAiPanelOpen') {
        localStorage.setItem('planify_ai_drawer_open', value ? 'true' : 'false');
      } else if (key === 'currentRoute' && ['dashboard', 'todo', 'calendar', 'ai', 'guide', 'settings'].includes(value)) {
        localStorage.setItem('planify_last_route', value);
      }
    } catch (_) {}

    this.emit(key, value, oldValue);
  }

  update(partialState) {
    Object.entries(partialState).forEach(([key, value]) => {
      this.set(key, value);
    });
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  emit(event, ...args) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try {
          cb(...args);
        } catch (err) {
          console.error(`Error in event listener for [${event}]:`, err);
        }
      });
    }
  }
}

export const store = new Store();
