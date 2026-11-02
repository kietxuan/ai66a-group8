# 🎨 KIẾN TRÚC FRONTEND (HTML/CSS/JS thuần)

> Cập nhật implementation 2026-11-03: `app.js` đăng ký cả `#login`/`#register` với `pages/auth-page.js`. Controller này dựng khung chung, giữ hai form từ factory `createLoginForm()`/`createRegisterForm()` trong `login.js`/`register.js` để chuyển mode bằng CSS mà không mất bước OTP. Form không hoạt động có `inert`/`aria-hidden`; rời auth xóa DOM và listener theme. Giao diện dùng token theme hiện tại, breakpoint 680px, reduced motion; API đăng nhập/OTP/khôi phục vẫn qua `AuthManager`. Xem `PROGRESS.md` cho checks và giới hạn; các ví dụ thiết kế bên dưới không thay thế source runtime.

---

## 1. Tổng quan

Frontend được xây dựng 100% bằng **HTML, CSS, JavaScript thuần** (Vanilla), không sử dụng bất kỳ framework hay thư viện nào. Cấu trúc theo mô hình SPA (Single Page Application) thủ công với hash-based routing.

> **Lưu ý**: Thay thế hoàn toàn cấu trúc React + TypeScript hiện tại.

---

## 2. Cấu trúc thư mục Frontend mới

```
frontend/
├── index.html                    # Entry point duy nhất
├── css/
│   ├── variables.css             # CSS variables (colors, spacing, fonts)
│   ├── reset.css                 # CSS reset / normalize
│   ├── base.css                  # Base styles (body, typography, utilities)
│   ├── themes/
│   │   ├── light.css             # Light theme variables
│   │   └── dark.css              # Dark theme variables
│   ├── layout/
│   │   ├── sidebar.css           # Sidebar navigation
│   │   ├── header.css            # Top header bar
│   │   └── main.css              # Main content area
│   ├── components/
│   │   ├── modal.css             # Modal / Dialog
│   │   ├── dropdown.css          # Dropdown menus
│   │   ├── datepicker.css        # Date picker
│   │   ├── timepicker.css        # Time picker
│   │   ├── toast.css             # Toast notifications
│   │   ├── tooltip.css           # Tooltips
│   │   └── loading.css           # Loading spinners
│   ├── pages/
│   │   ├── auth.css              # Login / Register
│   │   ├── calendar.css          # Calendar views
│   │   ├── todo.css              # To Do views
│   │   ├── ai-chat.css           # AI Chat panel
│   │   └── settings.css          # Settings page
│   └── animations.css            # Keyframe animations
├── js/
│   ├── app.js                    # Main app initialization
│   ├── router.js                 # SPA hash router
│   ├── api.js                    # API client (fetch wrapper)
│   ├── auth.js                   # Auth management (JWT)
│   ├── store.js                  # Simple state management
│   ├── theme.js                  # Theme switcher (light/dark)
│   ├── utils/
│   │   ├── dom.js                # DOM helper functions
│   │   ├── date.js               # Date formatting utilities
│   │   ├── rrule.js              # RRULE parser
│   │   ├── debounce.js           # Debounce / throttle
│   │   └── validator.js          # Input validation
│   ├── components/
│   │   ├── modal.js              # Modal component
│   │   ├── dropdown.js           # Dropdown component
│   │   ├── datepicker.js         # Date picker component
│   │   ├── timepicker.js         # Time picker component
│   │   ├── toast.js              # Toast notification system
│   │   ├── sidebar.js            # Sidebar component
│   │   └── contextmenu.js        # Right-click context menu
│   ├── pages/
│   │   ├── login.js              # Login page
│   │   ├── register.js           # Register page
│   │   ├── calendar.js           # Calendar page controller
│   │   ├── todo.js               # To Do page controller
│   │   └── settings.js           # Settings page
│   ├── calendar/
│   │   ├── day-view.js           # Day view renderer
│   │   ├── week-view.js          # Week view renderer
│   │   ├── month-view.js         # Month view renderer
│   │   ├── event-form.js         # Event create/edit form
│   │   ├── event-card.js         # Event card on calendar
│   │   ├── mini-calendar.js      # Mini calendar sidebar
│   │   ├── drag-drop.js          # Drag & drop for events
│   │   └── time-indicator.js     # Current time indicator
│   ├── todo/
│   │   ├── task-list-view.js     # Task list main view
│   │   ├── task-item.js          # Task item component
│   │   ├── task-detail.js        # Task detail panel
│   │   ├── task-form.js          # Task create form
│   │   ├── smart-lists.js        # Smart lists logic
│   │   ├── suggestions.js        # My Day suggestions
│   │   └── drag-reorder.js       # Drag to reorder tasks
│   └── ai/
│       ├── chat-panel.js         # AI Chat panel
│       ├── message.js            # Chat message component
│       └── chat-input.js         # Chat input with actions
└── assets/
    ├── icons/                    # SVG icons
    │   ├── calendar.svg
    │   ├── todo.svg
    │   ├── ai.svg
    │   ├── settings.svg
    │   ├── sun.svg
    │   ├── moon.svg
    │   ├── star.svg
    │   ├── star-filled.svg
    │   ├── check.svg
    │   ├── plus.svg
    │   ├── trash.svg
    │   ├── edit.svg
    │   ├── close.svg
    │   ├── chevron-left.svg
    │   ├── chevron-right.svg
    │   ├── bell.svg
    │   ├── repeat.svg
    │   ├── lightbulb.svg
    │   └── ... (more)
    └── favicon.ico
```

---

## 3. Core Modules

### 3.1. SPA Router (`router.js`)

```javascript
// Hash-based SPA Router
class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    window.addEventListener('hashchange', () => this.handleRoute());
  }
  
  /**
   * Đăng ký route
   * @param {string} path - Hash path (ví dụ: 'calendar', 'todo', 'settings')
   * @param {Function} handler - Hàm render trang
   */
  register(path, handler) {
    this.routes[path] = handler;
  }
  
  /**
   * Xử lý route change
   */
  handleRoute() {
    const hash = window.location.hash.slice(1) || 'calendar';
    const [path, ...params] = hash.split('/');
    
    if (this.routes[path]) {
      // Cleanup current page
      if (this.currentRoute && this.currentRoute.destroy) {
        this.currentRoute.destroy();
      }
      
      // Render new page
      this.currentRoute = this.routes[path];
      this.currentRoute.render(params);
      
      // Update sidebar active state
      this.updateActiveNav(path);
    }
  }
  
  navigate(path) {
    window.location.hash = path;
  }
  
  updateActiveNav(path) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === path);
    });
  }
}

const router = new Router();
```

### 3.2. API Client (`api.js`)

```javascript
// Fetch-based API client với auto JWT handling
class ApiClient {
  constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl;
  }
  
  /**
   * Lấy JWT token từ localStorage
   */
  getToken() {
    return localStorage.getItem('access_token');
  }
  
  /**
   * Base fetch method
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
      },
      ...options
    };
    
    try {
      const response = await fetch(url, config);
      
      // Token expired → redirect to login
      if (response.status === 401) {
        this.handleUnauthorized();
        return null;
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Request failed');
      }
      
      // 204 No Content
      if (response.status === 204) return null;
      
      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }
  
  get(endpoint) { return this.request(endpoint); }
  
  post(endpoint, data) {
    return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) });
  }
  
  put(endpoint, data) {
    return this.request(endpoint, { method: 'PUT', body: JSON.stringify(data) });
  }
  
  patch(endpoint, data) {
    return this.request(endpoint, { method: 'PATCH', body: JSON.stringify(data) });
  }
  
  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
  
  handleUnauthorized() {
    localStorage.removeItem('access_token');
    window.location.hash = 'login';
  }
}

const api = new ApiClient();
```

### 3.3. State Management (`store.js`)

```javascript
// Simple event-based state management
class Store {
  constructor() {
    this.state = {
      user: null,
      calendars: [],
      events: [],
      taskLists: [],
      tasks: [],
      currentView: 'calendar',
      calendarView: 'week', // day, week, month
      currentDate: new Date(),
      selectedTask: null,
      theme: 'light'
    };
    this.listeners = {};
  }
  
  /**
   * Lấy state value
   */
  get(key) {
    return this.state[key];
  }
  
  /**
   * Cập nhật state và notify listeners
   */
  set(key, value) {
    const oldValue = this.state[key];
    this.state[key] = value;
    this.emit(key, value, oldValue);
  }
  
  /**
   * Lắng nghe state change
   */
  on(key, callback) {
    if (!this.listeners[key]) this.listeners[key] = [];
    this.listeners[key].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
    };
  }
  
  /**
   * Emit change event
   */
  emit(key, newValue, oldValue) {
    if (this.listeners[key]) {
      this.listeners[key].forEach(cb => cb(newValue, oldValue));
    }
  }
}

const store = new Store();
```

### 3.4. Theme Switcher (`theme.js`)

```javascript
// Theme management (Light / Dark)
class ThemeManager {
  constructor() {
    this.currentTheme = localStorage.getItem('theme') || 'light';
    this.apply(this.currentTheme);
  }
  
  /**
   * Áp dụng theme
   */
  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.currentTheme = theme;
    localStorage.setItem('theme', theme);
    store.set('theme', theme);
  }
  
  /**
   * Toggle giữa light và dark
   */
  toggle() {
    this.apply(this.currentTheme === 'light' ? 'dark' : 'light');
  }
  
  /**
   * Theo system preference
   */
  useSystem() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.apply(prefersDark ? 'dark' : 'light');
    
    // Listen for system change
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      this.apply(e.matches ? 'dark' : 'light');
    });
  }
}

const themeManager = new ThemeManager();
```

---

## 4. CSS Architecture

### 4.1. CSS Variables (`variables.css`)

```css
:root {
  /* ===== SPACING ===== */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;

  /* ===== TYPOGRAPHY ===== */
  --font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', sans-serif;
  --font-size-xs: 11px;
  --font-size-sm: 13px;
  --font-size-md: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  
  /* ===== BORDER RADIUS ===== */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 50%;
  
  /* ===== SHADOWS ===== */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.12);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.15);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.2);
  
  /* ===== TRANSITIONS ===== */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 350ms ease;
  
  /* ===== LAYOUT ===== */
  --sidebar-width: 280px;
  --sidebar-collapsed-width: 64px;
  --header-height: 48px;
  --detail-panel-width: 360px;
}
```

### 4.2. Light Theme (`themes/light.css`)

```css
[data-theme="light"] {
  /* ===== COLORS ===== */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f5f5f5;
  --color-bg-tertiary: #eeeeee;
  --color-bg-hover: #f0f0f0;
  --color-bg-active: #e8e8e8;
  --color-bg-sidebar: #fafafa;
  
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #666666;
  --color-text-tertiary: #999999;
  --color-text-inverse: #ffffff;
  
  --color-border: #e0e0e0;
  --color-border-light: #f0f0f0;
  
  --color-accent: #4285F4;       /* Google Blue */
  --color-accent-hover: #3367D6;
  --color-accent-light: #E8F0FE;
  
  --color-success: #0B8043;
  --color-warning: #F9AB00;
  --color-danger: #D93025;
  --color-info: #1A73E8;
  
  --color-star: #F4B400;
  --color-today: #4285F4;
  
  /* Calendar specific */
  --color-grid-line: #e0e0e0;
  --color-grid-line-half: #f0f0f0;
  --color-time-indicator: #D93025;
  --color-event-default: #4285F4;
  
  /* Scrollbar */
  --color-scrollbar: #c1c1c1;
  --color-scrollbar-hover: #a8a8a8;
}
```

### 4.3. Dark Theme (`themes/dark.css`)

```css
[data-theme="dark"] {
  --color-bg-primary: #1e1e1e;
  --color-bg-secondary: #252525;
  --color-bg-tertiary: #2d2d2d;
  --color-bg-hover: #333333;
  --color-bg-active: #3a3a3a;
  --color-bg-sidebar: #1a1a1a;
  
  --color-text-primary: #e0e0e0;
  --color-text-secondary: #a0a0a0;
  --color-text-tertiary: #707070;
  --color-text-inverse: #1a1a1a;
  
  --color-border: #3a3a3a;
  --color-border-light: #2d2d2d;
  
  --color-accent: #8AB4F8;
  --color-accent-hover: #669DF6;
  --color-accent-light: #1e3a5f;
  
  --color-success: #81C995;
  --color-warning: #FDD663;
  --color-danger: #F28B82;
  --color-info: #8AB4F8;
  
  --color-star: #FDD663;
  --color-today: #8AB4F8;
  
  --color-grid-line: #3a3a3a;
  --color-grid-line-half: #2d2d2d;
  --color-time-indicator: #F28B82;
  --color-event-default: #8AB4F8;
  
  --color-scrollbar: #555;
  --color-scrollbar-hover: #777;
}
```

---

## 5. Layout Structure

### 5.1. Main Layout (`index.html`)

```html
<!DOCTYPE html>
<html lang="vi" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Planify - Quản lý thời gian</title>
  
  <!-- CSS -->
  <link rel="stylesheet" href="css/variables.css">
  <link rel="stylesheet" href="css/reset.css">
  <link rel="stylesheet" href="css/themes/light.css">
  <link rel="stylesheet" href="css/themes/dark.css">
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/animations.css">
  <link rel="stylesheet" href="css/layout/sidebar.css">
  <link rel="stylesheet" href="css/layout/header.css">
  <link rel="stylesheet" href="css/layout/main.css">
  <link rel="stylesheet" href="css/components/modal.css">
  <link rel="stylesheet" href="css/components/dropdown.css">
  <link rel="stylesheet" href="css/components/datepicker.css">
  <link rel="stylesheet" href="css/components/timepicker.css">
  <link rel="stylesheet" href="css/components/toast.css">
  <link rel="stylesheet" href="css/components/tooltip.css">
  <link rel="stylesheet" href="css/components/loading.css">
  <link rel="stylesheet" href="css/pages/auth.css">
  <link rel="stylesheet" href="css/pages/calendar.css">
  <link rel="stylesheet" href="css/pages/todo.css">
  <link rel="stylesheet" href="css/pages/ai-chat.css">
  <link rel="stylesheet" href="css/pages/settings.css">
</head>
<body>
  <!-- ===== AUTH PAGES (Login/Register) ===== -->
  <div id="auth-container" class="hidden">
    <div id="auth-page"></div>
  </div>

  <!-- ===== MAIN APP ===== -->
  <div id="app-container" class="hidden">
    
    <!-- SIDEBAR -->
    <aside id="sidebar" class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <span class="logo-icon">📋</span>
          <span class="logo-text">Planify</span>
        </div>
      </div>
      
      <nav class="sidebar-nav">
        <a class="nav-item active" data-page="calendar" href="#calendar">
          <span class="nav-icon">📅</span>
          <span class="nav-text">Calendar</span>
        </a>
        <a class="nav-item" data-page="todo" href="#todo">
          <span class="nav-icon">✅</span>
          <span class="nav-text">To Do</span>
        </a>
        <a class="nav-item" data-page="ai" href="#ai">
          <span class="nav-icon">🤖</span>
          <span class="nav-text">AI Assistant</span>
        </a>
      </nav>
      
      <div class="sidebar-footer">
        <button id="theme-toggle" class="theme-btn" title="Đổi giao diện">
          <span class="theme-icon-light">☀️</span>
          <span class="theme-icon-dark">🌙</span>
        </button>
        <a class="nav-item" data-page="settings" href="#settings">
          <span class="nav-icon">⚙️</span>
          <span class="nav-text">Settings</span>
        </a>
      </div>
    </aside>

    <!-- MAIN CONTENT -->
    <main id="main-content" class="main-content">
      <div id="page-container"></div>
    </main>
    
    <!-- AI CHAT PANEL (slide from right) -->
    <aside id="ai-chat-panel" class="ai-chat-panel hidden">
      <div id="ai-chat-content"></div>
    </aside>
    
  </div>
  
  <!-- MODALS CONTAINER -->
  <div id="modal-container"></div>
  
  <!-- TOAST CONTAINER -->
  <div id="toast-container"></div>

  <!-- ===== JAVASCRIPT ===== -->
  <script src="js/utils/dom.js"></script>
  <script src="js/utils/date.js"></script>
  <script src="js/utils/rrule.js"></script>
  <script src="js/utils/debounce.js"></script>
  <script src="js/utils/validator.js"></script>
  <script src="js/store.js"></script>
  <script src="js/api.js"></script>
  <script src="js/auth.js"></script>
  <script src="js/theme.js"></script>
  <script src="js/router.js"></script>
  <script src="js/components/modal.js"></script>
  <script src="js/components/dropdown.js"></script>
  <script src="js/components/datepicker.js"></script>
  <script src="js/components/timepicker.js"></script>
  <script src="js/components/toast.js"></script>
  <script src="js/components/sidebar.js"></script>
  <script src="js/components/contextmenu.js"></script>
  <script src="js/calendar/mini-calendar.js"></script>
  <script src="js/calendar/time-indicator.js"></script>
  <script src="js/calendar/event-card.js"></script>
  <script src="js/calendar/event-form.js"></script>
  <script src="js/calendar/drag-drop.js"></script>
  <script src="js/calendar/day-view.js"></script>
  <script src="js/calendar/week-view.js"></script>
  <script src="js/calendar/month-view.js"></script>
  <script src="js/todo/task-item.js"></script>
  <script src="js/todo/task-detail.js"></script>
  <script src="js/todo/task-form.js"></script>
  <script src="js/todo/smart-lists.js"></script>
  <script src="js/todo/suggestions.js"></script>
  <script src="js/todo/drag-reorder.js"></script>
  <script src="js/todo/task-list-view.js"></script>
  <script src="js/ai/message.js"></script>
  <script src="js/ai/chat-input.js"></script>
  <script src="js/ai/chat-panel.js"></script>
  <script src="js/pages/login.js"></script>
  <script src="js/pages/register.js"></script>
  <script src="js/pages/calendar.js"></script>
  <script src="js/pages/todo.js"></script>
  <script src="js/pages/settings.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

---

## 6. Component Pattern

Mỗi component JS tuân theo pattern thống nhất:

```javascript
/**
 * Component Pattern chuẩn cho dự án
 */
class ComponentName {
  /**
   * @param {HTMLElement} container - DOM element chứa component
   * @param {Object} options - Cấu hình
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.state = {};
    this.elements = {};
    
    this.init();
  }
  
  /**
   * Khởi tạo component
   */
  init() {
    this.render();
    this.cacheElements();
    this.bindEvents();
  }
  
  /**
   * Render HTML
   */
  render() {
    this.container.innerHTML = `
      <div class="component-name">
        ...
      </div>
    `;
  }
  
  /**
   * Cache DOM elements để tái sử dụng
   */
  cacheElements() {
    this.elements.wrapper = this.container.querySelector('.component-name');
    // ...
  }
  
  /**
   * Bind event listeners
   */
  bindEvents() {
    // Sử dụng event delegation khi có thể
    this.container.addEventListener('click', (e) => {
      if (e.target.matches('.some-button')) {
        this.handleClick(e);
      }
    });
  }
  
  /**
   * Cập nhật khi data thay đổi
   */
  update(newData) {
    this.state = { ...this.state, ...newData };
    this.render();
    this.cacheElements();
    this.bindEvents();
  }
  
  /**
   * Cleanup khi component bị destroy
   */
  destroy() {
    // Remove event listeners
    // Clear intervals/timeouts
    this.container.innerHTML = '';
  }
}
```

---

## 7. DOM Helper Functions (`utils/dom.js`)

```javascript
/**
 * Tạo element với attributes và children
 */
function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') el.className = value;
    else if (key === 'innerHTML') el.innerHTML = value;
    else if (key === 'textContent') el.textContent = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else el.setAttribute(key, value);
  });
  
  children.forEach(child => {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child instanceof Node) el.appendChild(child);
  });
  
  return el;
}

/**
 * Query selector shortcuts
 */
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

/**
 * Show / Hide elements
 */
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function toggle(el) { el.classList.toggle('hidden'); }
```

---

## 8. Responsive Design

```css
/* Mobile first approach */

/* Mobile (< 768px) */
@media (max-width: 767px) {
  .sidebar {
    position: fixed;
    left: -100%;
    z-index: 100;
    transition: left var(--transition-normal);
  }
  .sidebar.open {
    left: 0;
  }
  .main-content {
    margin-left: 0;
  }
  .ai-chat-panel {
    width: 100%;
  }
  .task-detail-panel {
    position: fixed;
    width: 100%;
    bottom: 0;
    height: 70vh;
  }
}

/* Tablet (768px - 1024px) */
@media (min-width: 768px) and (max-width: 1024px) {
  .sidebar {
    width: var(--sidebar-collapsed-width);
  }
  .sidebar .nav-text,
  .sidebar .logo-text {
    display: none;
  }
  .main-content {
    margin-left: var(--sidebar-collapsed-width);
  }
}

/* Desktop (> 1024px) */
@media (min-width: 1025px) {
  .sidebar {
    width: var(--sidebar-width);
  }
  .main-content {
    margin-left: var(--sidebar-width);
  }
}
```

---

## 9. Animations (`animations.css`)

```css
/* ===== Task Completion ===== */
@keyframes checkmark-draw {
  0% { stroke-dashoffset: 24; }
  100% { stroke-dashoffset: 0; }
}

@keyframes task-complete {
  0% { opacity: 1; transform: translateX(0); }
  100% { opacity: 0.5; transform: translateX(0); }
}

/* ===== Modal ===== */
@keyframes modal-in {
  from { opacity: 0; transform: scale(0.95) translateY(-10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

@keyframes modal-out {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(0.95); }
}

/* ===== Slide panel ===== */
@keyframes slide-in-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

/* ===== Toast ===== */
@keyframes toast-in {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes toast-out {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
}

/* ===== Fade ===== */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ===== Typing indicator (AI Chat) ===== */
@keyframes typing-dot {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}
```

---

## 10. Docker Setup mới cho Frontend

Vì không dùng React/Vite nữa, frontend chỉ cần serve static files:

```dockerfile
# frontend/Dockerfile
FROM nginx:alpine

# Copy static files
COPY . /usr/share/nginx/html

# Nginx config cho SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

```nginx
# frontend/nginx.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    
    # SPA: redirect tất cả routes về index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Proxy API calls to backend
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Cache static assets
    location ~* \.(css|js|svg|ico|png|jpg|gif)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

