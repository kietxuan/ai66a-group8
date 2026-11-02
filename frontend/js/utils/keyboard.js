/**
 * Global Keyboard Shortcuts Manager
 * Enables fast single-key navigation (like Google Calendar & Outlook)
 * Safely ignores keydown events when typing inside inputs/textareas
 */

import { store } from '../store.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { createElement } from './dom.js';

class KeyboardManager {
  constructor() {
    this.isEnabled = true;
    this.init();
  }

  init() {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
  }

  handleKeyDown(e) {
    if (!this.isEnabled) return;

    // 1. Ignore if typing inside input, textarea, or contenteditable
    const activeEl = document.activeElement;
    if (activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.tagName === 'SELECT' ||
      activeEl.isContentEditable
    )) {
      return;
    }

    // Ignore if Ctrl, Alt, or Meta (Cmd) is pressed to avoid interfering with browser shortcuts
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const key = e.key.toUpperCase();

    // 2. Navigation shortcuts
    switch (key) {
      case 'T': // Today
        e.preventDefault();
        store.set('selectedDate', new Date());
        Toast.info('📅 Đã chuyển về ngày hôm nay');
        break;

      case 'M': // Month view
        e.preventDefault();
        window.location.hash = 'calendar';
        store.set('calendarView', 'month');
        break;

      case 'W': // Week view
        e.preventDefault();
        window.location.hash = 'calendar';
        store.set('calendarView', 'week');
        break;

      case 'D': // Day view
        e.preventDefault();
        window.location.hash = 'calendar';
        store.set('calendarView', 'day');
        break;

      case 'A': // Agenda view
        e.preventDefault();
        window.location.hash = 'calendar';
        store.set('calendarView', 'agenda');
        break;

      case 'C': // Create event
        e.preventDefault();
        window.location.hash = 'calendar';
        // Will be picked up or open full modal
        document.dispatchEvent(new CustomEvent('shortcut-create-event'));
        break;

      case 'N': // New task
        e.preventDefault();
        window.location.hash = 'todo';
        setTimeout(() => {
          const todoInput = document.querySelector('.todo-input');
          if (todoInput) todoInput.focus();
        }, 150);
        break;

      case '?': // Help dialog
        e.preventDefault();
        this.showShortcutsHelp();
        break;
    }
  }

  showShortcutsHelp() {
    const shortcuts = [
      { key: 'T', desc: 'Nhảy về ngày Hôm nay' },
      { key: 'M', desc: 'Chuyển sang chế độ xem Tháng (Month View)' },
      { key: 'W', desc: 'Chuyển sang chế độ xem Tuần (Week View)' },
      { key: 'D', desc: 'Chuyển sang chế độ xem Ngày (Day View)' },
      { key: 'A', desc: 'Chuyển sang chế độ xem Lịch trình (Agenda View)' },
      { key: 'C', desc: 'Mở cửa sổ tạo Sự kiện mới' },
      { key: 'N', desc: 'Chuyển sang Việc cần làm và nhập công việc mới' },
      { key: '?', desc: 'Mở bảng trợ giúp phím tắt này' }
    ];

    const content = createElement('div', { className: 'flex flex-col gap-sm' }, [
      createElement('p', {
        style: { fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px' },
        textContent: 'Sử dụng các phím tắt sau để thao tác cực nhanh tương tự Google Calendar và Outlook:'
      }),
      createElement('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: '80px 1fr',
          gap: '8px 16px',
          alignItems: 'center',
          fontSize: '13px'
        }
      }, shortcuts.flatMap(s => [
        createElement('kbd', {
          style: {
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            padding: '2px 8px',
            fontWeight: '700',
            textAlign: 'center',
            color: 'var(--color-accent)'
          },
          textContent: s.key
        }),
        createElement('span', { textContent: s.desc })
      ]))
    ]);

    Modal.open({
      title: '⌨️ Phím tắt nhanh (Keyboard Shortcuts)',
      content,
      confirmText: 'Đã hiểu',
      width: '460px'
    });
  }
}

export const keyboardManager = new KeyboardManager();

