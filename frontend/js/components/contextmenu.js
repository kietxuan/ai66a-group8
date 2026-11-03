import { createElement } from '../utils/dom.js';

export class ContextMenu {
  static activeMenu = null;
  static cleanupFn = null;

  static show({ x, y, title = '', items = [] }) {
    this.close();

    const menu = createElement('div', {
      className: 'dropdown-menu',
      style: {
        position: 'fixed',
        top: '0px',
        left: '0px',
        backgroundColor: 'var(--color-surface, #ffffff)',
        border: '1.5px solid var(--color-border, #cbd5e1)',
        borderRadius: '12px',
        boxShadow: '0 14px 36px rgba(15, 23, 42, 0.28)',
        padding: '6px',
        minWidth: '235px',
        zIndex: '99999'
      }
    });

    if (title) {
      menu.appendChild(createElement('div', {
        className: 'dropdown-header',
        textContent: `⚡ Thao tác nhanh: ${title}`
      }));
    }

    items.forEach(item => {
      if (!item) return;
      if (item.divider) {
        menu.appendChild(createElement('div', { className: 'dropdown-divider' }));
        return;
      }

      const itemEl = createElement('div', {
        className: `dropdown-item ${item.danger ? 'danger' : ''}`,
        onclick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          ContextMenu.close();
          if (typeof item.onClick === 'function') Promise.resolve().then(() => item.onClick()).catch(err => {
            if (err.code === 'SCHEDULE_CANCEL' || err.code === 'SCHEDULE_CHANGE') return;
            import('./toast.js').then(({ Toast }) => Toast.error(err.message || 'Không thể thực hiện thao tác.'));
          });
        }
      }, [
        item.icon ? createElement('span', { className: 'dropdown-icon', textContent: item.icon }) : null,
        createElement('span', { textContent: item.label })
      ]);

      menu.appendChild(itemEl);
    });

    document.body.appendChild(menu);
    this.activeMenu = menu;

    // Position inside viewport boundaries
    const rect = menu.getBoundingClientRect();
    const clampedX = Math.max(8, Math.min(x, window.innerWidth - rect.width - 12));
    const clampedY = Math.max(8, Math.min(y, window.innerHeight - rect.height - 12));
    menu.style.left = `${clampedX}px`;
    menu.style.top = `${clampedY}px`;

    const handleOutsideClick = (e) => {
      if (menu && !menu.contains(e.target)) {
        ContextMenu.close();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        ContextMenu.close();
      }
    };

    this.cleanupFn = () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };

    setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick, true);
      document.addEventListener('keydown', handleKeyDown, true);
    }, 15);
  }

  static close() {
    if (this.cleanupFn) {
      this.cleanupFn();
      this.cleanupFn = null;
    }
    if (this.activeMenu && this.activeMenu.parentNode) {
      this.activeMenu.parentNode.removeChild(this.activeMenu);
      this.activeMenu = null;
    }
  }
}
