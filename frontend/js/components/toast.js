import { createElement } from '../utils/dom.js';

export class Toast {
  static container = null;

  static init() {
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      this.container = createElement('div', { id: 'toast-container' });
      document.body.appendChild(this.container);
    }
  }

  static show(message, type = 'info', duration = 3500) {
    if (!this.container) this.init();

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    const toast = createElement('div', { className: `toast toast-${type}` }, [
      createElement('span', { className: 'toast-icon', textContent: icons[type] || 'ℹ' }),
      createElement('span', { className: 'toast-message', textContent: message }),
      createElement('button', {
        className: 'toast-close-btn',
        innerHTML: '&times;',
        onclick: () => this.dismiss(toast)
      })
    ]);

    this.container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(toast);
      }, duration);
    }

    return toast;
  }

  static success(msg, duration) { return this.show(msg, 'success', duration); }
  static error(msg, duration) { return this.show(msg, 'error', duration); }
  static warning(msg, duration) { return this.show(msg, 'warning', duration); }
  static info(msg, duration) { return this.show(msg, 'info', duration); }

  static dismiss(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('toast-hiding');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 200);
  }
}

