import { createElement } from '../utils/dom.js';

export class Dropdown {
  static activeMenu = null;
  static activeSubmenu = null;
  static outsideHandler = null;

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
        top: `${rect.bottom + window.scrollY + 4}px`,
        left: `${Math.min(rect.left + window.scrollX, window.innerWidth - 225)}px`
      }
    });

    const closeSubmenu = () => {
      if (this.activeSubmenu && this.activeSubmenu.parentNode) {
        this.activeSubmenu.parentNode.removeChild(this.activeSubmenu);
        this.activeSubmenu = null;
      }
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
            if (typeof cb === 'function') cb();
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
            innerHTML: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`
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
        className: `dropdown-item ${item.active ? 'active' : ''} ${item.danger ? 'danger' : ''} ${hasSubmenu ? 'has-submenu' : ''}`,
        onmouseenter: () => {
          if (hasSubmenu) {
            openSubmenu(item.submenu, itemEl);
          } else {
            closeSubmenu();
          }
        },
        onclick: (e) => {
          e.stopPropagation();
          if (hasSubmenu) {
            if (this.activeSubmenu) {
              closeSubmenu();
            } else {
              openSubmenu(item.submenu, itemEl);
            }
            return;
          }
          Dropdown.close();
          const callback = item.onClick || item.action;
          if (typeof callback === 'function') callback();
        }
      }, children);

      menu.appendChild(itemEl);
    });

    document.body.appendChild(menu);
    this.activeMenu = menu;

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
