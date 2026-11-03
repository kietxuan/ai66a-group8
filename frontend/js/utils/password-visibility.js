import { createElement } from './dom.js';

const EYE_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_CLOSED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a15 15 0 0 1-3.1 4.1"/><path d="M6.1 6.1C3.3 8 2 12 2 12s3.5 7 10 7a11 11 0 0 0 4.3-.9"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/></svg>';

export function initPasswordVisibility() {
  const attach = () => {
    document.querySelectorAll('input[type="password"]').forEach(input => {
      if (input.dataset.visibilityToggle) return;
      input.dataset.visibilityToggle = 'true';
      const wrapper = createElement('div', { className: 'password-field' });
      const button = createElement('button', {
        type: 'button', className: 'password-visibility-toggle',
        innerHTML: EYE_CLOSED,
        'aria-label': 'Hiện mật khẩu',
        'aria-pressed': 'false',
        title: 'Hiện mật khẩu',
        onclick: event => {
          event.preventDefault();
          event.stopPropagation();
          const visible = input.type === 'password';
          input.type = visible ? 'text' : 'password';
          const label = visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
          button.innerHTML = visible ? EYE_OPEN : EYE_CLOSED;
          button.setAttribute('aria-label', label);
          button.setAttribute('aria-pressed', String(visible));
          button.title = label;
        }
      });
      input.replaceWith(wrapper);
      wrapper.append(input, button);
    });
  };
  attach();
  new MutationObserver(mutations => {
    const hasNewPasswordField = mutations.some(mutation => [...mutation.addedNodes].some(node =>
      node.nodeType === Node.ELEMENT_NODE &&
      (node.matches('input[type="password"]') || node.querySelector('input[type="password"]'))
    ));
    if (hasNewPasswordField) attach();
  }).observe(document.body, { childList: true, subtree: true });
}
