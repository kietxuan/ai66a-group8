/**
 * DOM Helper Utilities
 */
export const $ = (selector, parent = document) => parent.querySelector(selector);
export const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  
  const booleanAttrs = new Set([
    'checked', 'selected', 'disabled', 'readOnly', 'readonly',
    'required', 'multiple', 'autofocus', 'hidden', 'open'
  ]);

  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'innerHTML') {
      el.innerHTML = value;
    } else if (key === 'textContent') {
      el.textContent = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(el.dataset, value);
    } else if (booleanAttrs.has(key)) {
      const boolVal = Boolean(value);
      const propKey = key === 'readonly' ? 'readOnly' : key;
      el[propKey] = boolVal;
      if (boolVal) {
        el.setAttribute(key, '');
      } else {
        el.removeAttribute(key);
      }
    } else if (key === 'value') {
      el.value = value !== null && value !== undefined ? value : '';
      if (value !== null && value !== undefined) {
        el.setAttribute('value', value);
      } else {
        el.removeAttribute('value');
      }
    } else if (value !== null && value !== undefined && value !== false) {
      el.setAttribute(key, value);
    }
  });
  if (attrs.onclick && attrs.className !== 'modal-backdrop' && !['button', 'input', 'textarea', 'select', 'a', 'label'].includes(tag.toLowerCase())) {
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.addEventListener('keydown', e => {
      if (e.target === el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); el.click(); }
    });
  }
  
  const childArray = Array.isArray(children) ? children : [children];
  childArray.forEach(child => {
    if (child === null || child === undefined) return;
    if (typeof child === 'string' || typeof child === 'number') {
      el.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  });
  
  return el;
}

export function show(el) {
  if (el) el.classList.remove('hidden');
}

export function hide(el) {
  if (el) el.classList.add('hidden');
}

export function toggle(el, force) {
  if (el) el.classList.toggle('hidden', force);
}

