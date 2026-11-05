import { createElement } from './dom.js';
import { iconMarkup } from './icons.js';

const EYE_OPEN = iconMarkup('eye');
const EYE_CLOSED = iconMarkup('eye-off');

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
