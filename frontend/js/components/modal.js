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
    allowStack = false
  } = {}) {
    if (!allowStack && Modal.activeModal) {
      Modal.activeModal.close();
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
        onclick: () => {
          if (typeof btnCfg.onClick === 'function') btnCfg.onClick();
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
                  modal.close();
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
    const container = document.getElementById('modal-container') || document.body;
    const stackDepth = Modal.modalStack.length;
    const zIndex = stackDepth > 0 ? 500 + stackDepth * 10 : null;

    this.backdrop = createElement('div', {
      className: 'modal-backdrop',
      style: zIndex ? { zIndex: `${zIndex}` } : {},
      onclick: (e) => {
        if (e.target === this.backdrop) this.close();
      }
    });

    const dialog = createElement('div', {
      className: 'modal-dialog',
      style: { maxWidth: this.width }
    });

    const header = createElement('div', { className: 'modal-header' }, [
      createElement('h3', { className: 'modal-title', textContent: this.title }),
      createElement('button', {
        type: 'button',
        className: 'modal-close-btn',
        innerHTML: '&times;',
        onclick: () => this.close()
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
    return dialog;
  }

  handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (Modal.modalStack[Modal.modalStack.length - 1] === this) {
        this.close();
      }
    }
  }

  close() {
    if (this.backdrop && this.backdrop.parentNode) {
      this.backdrop.parentNode.removeChild(this.backdrop);
      this.backdrop = null;
    }
    Modal.modalStack = Modal.modalStack.filter(m => m !== this);
    Modal.activeModal = Modal.modalStack[Modal.modalStack.length - 1] || null;
    document.removeEventListener('keydown', this.handleKeyDown);
    if (typeof this.onClose === 'function') {
      this.onClose();
    }
  }
}
