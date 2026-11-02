/**
 * Central State Store & EventBus with Automatic LocalStorage Persistence
 */

function loadSavedDate() {
  try {
    const raw = localStorage.getItem('planify_calendar_date');
    if (raw) {
      const parsed = new Date(raw);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  } catch (_) {}
  return new Date();
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
    this.state[key] = value;

    // Persist key state selections across page refreshes (F5)
    try {
      if (key === 'calendarView' && value) {
        localStorage.setItem('planify_calendar_view', String(value));
      } else if (key === 'selectedDate' && value instanceof Date && !isNaN(value.getTime())) {
        localStorage.setItem('planify_calendar_date', value.toISOString());
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
