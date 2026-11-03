import { createElement } from '../utils/dom.js';

export class Modal {
  static activeModal = null;
  static modalStack = [];

  static open({
    title = '',
    content = '',
    footer = null,
    footerButtons = null,
    confirmText = null,
    cancelText = 'Hủy',
    onConfirm = null,
    onCancel = null,
    width = '540px',
    onClose = null,
    allowStack = false,
    guardUnsaved = false
  } = {}) {
    if (!allowStack && Modal.activeModal) {
      if (Modal.activeModal.close() === false) return Modal.activeModal;
    }

    let footerEl = footer;

    // Support footerButtons array: [{ label, className, onClick }]
    if (!footerEl && Array.isArray(footerButtons) && footerButtons.length > 0) {
      footerEl = createElement('div', {
        className: 'flex items-center justify-end gap-sm w-full',
        style: { width: '100%', display: 'flex', justifyContent: 'flex-end', gap: '8px' }
      }, footerButtons.map(btnCfg => createElement('button', {
        type: 'button',
        className: btnCfg.className || 'btn btn-secondary',
        textContent: btnCfg.label || 'OK',
        onclick: async () => {
          if (modal.busy) return;
          modal.busy = true;
          const buttons = modal.backdrop?.querySelectorAll('.modal-footer button') || [];
          buttons.forEach(button => { button.disabled = true; });
          try {
            if (typeof btnCfg.onClick === 'function') await btnCfg.onClick();
          } finally {
            modal.busy = false;
            buttons.forEach(button => { button.disabled = false; });
          }
        }
      })));
    }

    // If confirmText is provided, auto-build standardized footer buttons
    if (confirmText && !footerEl) {
      footerEl = createElement('div', {
        className: 'flex items-center justify-end gap-sm w-full',
        style: { width: '100%' }
      }, [
        createElement('button', {
          type: 'button',
          className: 'btn btn-secondary',
          textContent: cancelText,
          onclick: () => {
            if (onCancel) onCancel();
            modal.close();
          }
        }),
        createElement('button', {
          type: 'button',
          className: 'btn btn-primary',
          id: 'modal-confirm-btn',
          textContent: confirmText,
          onclick: async () => {
            const btn = document.getElementById('modal-confirm-btn');
            if (btn) btn.disabled = true;
            try {
              if (onConfirm) {
                const result = await onConfirm();
                if (result !== false) {
                  modal.close(true);
                }
              } else {
                modal.close();
              }
            } catch (err) {
              console.error('Modal confirm action error:', err);
            } finally {
              if (btn) btn.disabled = false;
            }
          }
        })
      ]);
    }

    const modal = new Modal({ title, content, footer: footerEl, width, onClose });
    modal.open();
    if (guardUnsaved) {
      const fields = [...modal.backdrop.querySelectorAll('.modal-body input, .modal-body textarea, .modal-body select')];
      const snapshot = () => JSON.stringify(fields.map(input => input.type === 'checkbox' ? input.checked : input.value));
      const initial = snapshot();
      modal.isDirty = () => snapshot() !== initial;
      modal.beforeClose = () => !modal.isDirty() || confirm('Bạn có thay đổi chưa lưu. Bạn có muốn bỏ các thay đổi này không?');
    }
    return modal;
  }

  static close() {
    if (Modal.activeModal) {
      Modal.activeModal.close();
    }
  }

  constructor({ title = '', content = '', footer = '', width = '540px', onClose = null } = {}) {
    this.title = title;
    this.content = content;
    this.footer = footer;
    this.width = width;
    this.onClose = onClose;
    this.backdrop = null;
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  open() {
    this.previousFocus = document.activeElement;
    const container = document.getElementById('modal-container') || document.body;
    const stackDepth = Modal.modalStack.length;
    const zIndex = stackDepth > 0 ? 500 + stackDepth * 10 : null;

    this.backdrop = createElement('div', {
      className: 'modal-backdrop',
      style: zIndex ? { zIndex: `${zIndex}` } : {},
      onclick: (e) => {
        if (e.target === this.backdrop && !this.busy) this.close();
      }
    });

    const dialog = createElement('div', {
      className: 'modal-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': this.title || 'Hộp thoại',
      tabIndex: -1,
      style: { maxWidth: this.width }
    });

    const header = createElement('div', { className: 'modal-header' }, [
      createElement('h3', { className: 'modal-title', textContent: this.title }),
      createElement('button', {
        type: 'button',
        className: 'modal-close-btn',
        innerHTML: '&times;',
        'aria-label': 'Đóng hộp thoại',
        onclick: () => { if (!this.busy) this.close(); }
      })
    ]);

    const body = createElement('div', { className: 'modal-body' });
    if (typeof this.content === 'string') {
      body.innerHTML = this.content;
    } else if (this.content instanceof Node) {
      body.appendChild(this.content);
    }

    dialog.appendChild(header);
    dialog.appendChild(body);

    if (this.footer) {
      const footerEl = createElement('div', { className: 'modal-footer' });
      if (typeof this.footer === 'string') {
        footerEl.innerHTML = this.footer;
      } else if (this.footer instanceof Node) {
        footerEl.appendChild(this.footer);
      }
      dialog.appendChild(footerEl);
    }

    this.backdrop.appendChild(dialog);
    container.appendChild(this.backdrop);

    Modal.modalStack.push(this);
    Modal.activeModal = this;
    document.addEventListener('keydown', this.handleKeyDown);
    (dialog.querySelector('input, textarea, select, button') || dialog).focus();
    return dialog;
  }

  handleKeyDown(e) {
    if (Modal.activeModal !== this) return;
    if (e.key === 'Tab') {
      const controls = [...this.backdrop.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
      if (controls.length) {
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    if (e.key === 'Escape') {
      if (Modal.modalStack[Modal.modalStack.length - 1] === this && !this.busy) {
        this.close();
      }
    }
  }

  close(force = false) {
    if (!force && typeof this.beforeClose === 'function' && this.beforeClose() === false) return false;
    if (this.backdrop && this.backdrop.parentNode) {
      this.backdrop.parentNode.removeChild(this.backdrop);
      this.backdrop = null;
    }
    Modal.modalStack = Modal.modalStack.filter(m => m !== this);
    Modal.activeModal = Modal.modalStack[Modal.modalStack.length - 1] || null;
    document.removeEventListener('keydown', this.handleKeyDown);
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
    if (typeof this.onClose === 'function') {
      this.onClose();
    }
    return true;
  }
}
