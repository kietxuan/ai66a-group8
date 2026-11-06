import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoadingState } from '../js/components/loading.js';

// A tiny DOM contract stub: geometry/contrast are verified in browser QA.
class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.styles = {};
    this.style = { setProperty: (key, value) => { this.styles[key] = value; } };
  }
  setAttribute(key, value) { this.attributes[key] = value; }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.append(child); return child; }
}

test('page loader has a large library spinner and a visible accessible label', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: tag => new Element(tag) };
  try {
    const state = createLoadingState('Đang tải cài đặt…');
    assert.equal(state.className, 'page-loading');
    assert.equal(state.attributes.role, 'status');
    assert.equal(state.attributes['aria-live'], 'polite');
    assert.equal(state.attributes['aria-busy'], 'true');
    const icon = state.children[0].children[0];
    assert.equal(icon.dataset.iconName, 'loader-circle');
    assert.match(icon.className, /icon-spin/);
    assert.equal(icon.styles['--icon-size'], '56px');
    assert.equal(icon.attributes['aria-hidden'], 'true');
    assert.equal(state.children[1].textContent, 'Đang tải cài đặt…');
    assert.equal(state.children[1].className, 'page-loading__label');
    assert.equal(createLoadingState().children[1].textContent, 'Đang tải dữ liệu…');
  } finally {
    globalThis.document = previous;
  }
});
