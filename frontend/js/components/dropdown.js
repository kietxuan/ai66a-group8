import { createElement } from '../utils/dom.js';

export class Dropdown {
  static activeMenu = null;
  static outsideHandler = null;

  static show({ triggerEl, anchorEl, items = [] }) {
    this.close();
    const targetEl = triggerEl || anchorEl;
    if (!targetEl) return;

    const rect = targetEl.getBoundingClientRect();
    const menu = createElement('div', {
      className: 'dropdown-menu',
      style: {
        top: `${rect.bottom + window.scrollY + 4}px`,
        left: `${Math.min(rect.left + window.scrollX, window.innerWidth - 200)}px`
      }
    });

    items.forEach(item => {
      if (item.divider) {
        menu.appendChild(createElement('div', { className: 'dropdown-divider' }));
        return;
      }

      const itemEl = createElement('div', {
        className: `dropdown-item ${item.danger ? 'danger' : ''}`,
        onclick: (e) => {
          e.stopPropagation();
          Dropdown.close();
          const callback = item.onClick || item.action;
          if (typeof callback === 'function') callback();
        }
      }, [
        item.icon ? createElement('span', { className: 'dropdown-icon', textContent: item.icon }) : null,
        createElement('span', { textContent: item.label })
      ]);

      menu.appendChild(itemEl);
    });

    document.body.appendChild(menu);
    this.activeMenu = menu;

    this.outsideHandler = (e) => {
      if (!menu.contains(e.target) && !targetEl.contains(e.target)) {
        Dropdown.close();
      }
    };
    setTimeout(() => {
      if (this.activeMenu === menu && this.outsideHandler) {
        document.addEventListener('click', this.outsideHandler);
      }
    }, 0);
  }

  static close() {
    if (this.outsideHandler) {
      document.removeEventListener('click', this.outsideHandler);
      this.outsideHandler = null;
    }
    if (this.activeMenu && this.activeMenu.parentNode) {
      this.activeMenu.parentNode.removeChild(this.activeMenu);
      this.activeMenu = null;
    }
  }
}

