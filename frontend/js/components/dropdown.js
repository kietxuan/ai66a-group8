import { iconMarkup } from "../utils/icons.js";
import { createElement } from '../utils/dom.js';
import { Toast } from './toast.js';

export class Dropdown {
  static activeMenu = null;
  static activeSubmenu = null;
  static outsideHandler = null;
  static keyHandler = null;
  static submenuParent = null;

  static invoke(callback) {
    if (typeof callback !== 'function') return;
    Promise.resolve().then(callback).catch(error => {
      if (!['SCHEDULE_CANCEL', 'SCHEDULE_CHANGE'].includes(error?.code)) Toast.error(error?.message || 'Không thể thực hiện thao tác.');
    });
  }

  static fit(menu, left, top) {
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(left, window.innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(top, window.innerHeight - rect.height - 8))}px`;
    menu.style.maxHeight = `${Math.max(80, window.innerHeight - 16)}px`;
    menu.style.overflowY = 'auto';
    menu.style.maxWidth = 'calc(100vw - 16px)';
  }

  static show(optionsOrTrigger, maybeItems = []) {
    this.close();
    let targetEl, items;
    if (optionsOrTrigger instanceof Element) {
      targetEl = optionsOrTrigger;
      items = maybeItems;
    } else if (optionsOrTrigger && typeof optionsOrTrigger === 'object') {
      targetEl = optionsOrTrigger.triggerEl || optionsOrTrigger.anchorEl;
      items = optionsOrTrigger.items || [];
    }
    if (!targetEl) return;

    const rect = targetEl.getBoundingClientRect();
    const menu = createElement('div', {
      className: 'dropdown-menu',
      style: {
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`
      }
    });

    const closeSubmenu = () => {
      if (this.activeSubmenu && this.activeSubmenu.parentNode) {
        this.activeSubmenu.parentNode.removeChild(this.activeSubmenu);
        this.activeSubmenu = null;
      }
      this.submenuParent = null;
    };

    const openSubmenu = (submenuItems, parentEl) => {
      closeSubmenu();
      if (!submenuItems || !submenuItems.length) return;

      const pRect = parentEl.getBoundingClientRect();
      const sub = createElement('div', {
        className: 'dropdown-menu dropdown-submenu',
        style: {
          position: 'fixed',
          top: `${Math.max(10, Math.min(pRect.top, window.innerHeight - 240))}px`,
          left: `${pRect.right + 4 + 210 > window.innerWidth ? Math.max(10, pRect.left - 215) : pRect.right + 4}px`,
          zIndex: '100000'
        }
      });

      submenuItems.forEach(subItem => {
        if (subItem.divider) {
          sub.appendChild(createElement('div', { className: 'dropdown-divider' }));
          return;
        }

        const isDis = Boolean(subItem.disabled);
        const subEl = createElement('div', {
          className: `dropdown-item ${subItem.active ? 'active' : ''} ${subItem.danger ? 'danger' : ''} ${isDis ? 'disabled' : ''}`,
          style: isDis ? { opacity: '0.5', cursor: 'default' } : {},
          onclick: (e) => {
            e.stopPropagation();
            if (isDis) return;
            Dropdown.close();
            const cb = subItem.onClick || subItem.action;
            Dropdown.invoke(cb);
          }
        }, [
          subItem.icon ? createElement('span', {
            className: 'dropdown-icon',
            style: subItem.color ? { color: subItem.color } : {},
            textContent: subItem.icon
          }) : null,
          createElement('span', { textContent: subItem.label })
        ]);

        sub.appendChild(subEl);
      });

      document.body.appendChild(sub);
      this.activeSubmenu = sub;
      this.submenuParent = parentEl;
      const width = sub.getBoundingClientRect().width;
      this.fit(sub, pRect.right + width + 8 > window.innerWidth ? pRect.left - width - 4 : pRect.right + 4, pRect.top);
    };

    items.forEach(item => {
      if (item.divider) {
        menu.appendChild(createElement('div', { className: 'dropdown-divider' }));
        return;
      }

      const hasSubmenu = Boolean(item.submenu && item.submenu.length);

      let children;
      if (item.tagBadge) {
        const tag = item.tagBadge;
        const badge = createElement('span', {
          className: 'task-tag-badge',
          style: {
            backgroundColor: `${tag.color}20`,
            color: tag.color,
            border: `1px solid ${tag.color}60`,
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }
        }, [
          createElement('span', {
            style: { display: 'inline-flex', alignItems: 'center' },
            innerHTML: iconMarkup("tag", 12)
          }),
          createElement('span', { textContent: tag.name })
        ]);
        children = [badge];
      } else {
        children = [
          item.icon ? createElement('span', {
            className: 'dropdown-icon',
            style: item.color ? { color: item.color } : {},
            textContent: item.icon
          }) : null,
          createElement('span', { className: 'flex-1', textContent: item.label })
        ];
      }

      if (hasSubmenu) {
        children.push(createElement('span', {
          style: { marginLeft: 'auto', fontSize: '13px', opacity: '0.6', paddingLeft: '8px' },
          textContent: '›'
        }));
      }

      const itemEl = createElement('div', {
        className: `dropdown-item ${item.active ? 'active' : ''} ${item.danger ? 'danger' : ''} ${hasSubmenu ? 'has-submenu' : ''} ${item.disabled ? 'disabled' : ''}`,
        'aria-disabled': item.disabled ? 'true' : 'false',
        onmouseenter: () => {
          if (item.disabled) return;
          if (hasSubmenu) {
            openSubmenu(item.submenu, itemEl);
          } else {
            closeSubmenu();
          }
        },
        onclick: (e) => {
          e.stopPropagation();
          if (item.disabled) return;
          if (hasSubmenu) {
            if (this.submenuParent !== itemEl) {
              openSubmenu(item.submenu, itemEl);
            }
            return;
          }
          Dropdown.close();
          const callback = item.onClick || item.action;
          Dropdown.invoke(callback);
        }
      }, children);

      menu.appendChild(itemEl);
    });

    document.body.appendChild(menu);
    this.activeMenu = menu;
    this.fit(menu, rect.left, rect.bottom + 4);
    this.keyHandler = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); this.close(); }
    };
    document.addEventListener('keydown', this.keyHandler, true);

    this.outsideHandler = (e) => {
      const inMenu = menu && menu.contains(e.target);
      const inSub = this.activeSubmenu && this.activeSubmenu.contains(e.target);
      const inTarget = targetEl && targetEl.contains(e.target);
      if (!inMenu && !inSub && !inTarget) {
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
    if (this.keyHandler) document.removeEventListener('keydown', this.keyHandler, true);
    this.keyHandler = null;
    this.submenuParent = null;
    if (this.outsideHandler) {
      document.removeEventListener('click', this.outsideHandler);
      this.outsideHandler = null;
    }
    if (this.activeSubmenu && this.activeSubmenu.parentNode) {
      this.activeSubmenu.parentNode.removeChild(this.activeSubmenu);
      this.activeSubmenu = null;
    }
    if (this.activeMenu && this.activeMenu.parentNode) {
      this.activeMenu.parentNode.removeChild(this.activeMenu);
      this.activeMenu = null;
    }
  }
}
