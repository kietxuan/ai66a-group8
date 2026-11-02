// Dependency-free workflow checks. This DOM double does not verify CSS/rendering.
// Run: node --experimental-vm-modules --test --test-isolation=none tests/frontend/auth-ui.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const sourceRoot = fileURLToPath(new URL('../../frontend/js/', import.meta.url));

async function setup(hash = '#login') {
  let document;
  class Element {
    constructor(tag) {
      this.tagName = tag;
      this.children = [];
      this.attributes = new Map();
      this.handlers = {};
      this.style = {};
      this.dataset = {};
      this.className = '';
      this.value = '';
      this.disabled = false;
      this.textContent = '';
    }
    get classList() {
      const list = () => new Set(this.className.split(/\s+/).filter(Boolean));
      const toggle = (name, force) => {
        const names = list(), enabled = force ?? !names.has(name);
        enabled ? names.add(name) : names.delete(name);
        this.className = [...names].join(' ');
        return enabled;
      };
      return { add: (...names) => names.forEach(name => toggle(name, true)), remove: (...names) => names.forEach(name => toggle(name, false)), contains: name => list().has(name), toggle };
    }
    set inert(value) { value ? this.setAttribute('inert', '') : this.removeAttribute('inert'); }
    get inert() { return this.attributes.has('inert'); }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    removeAttribute(key) { this.attributes.delete(key); }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    replaceChildren(...children) { this.children.forEach(child => { child.parentNode = null; }); this.children = []; this.append(...children); }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
    contains(node) { return this === node || this.children.some(child => child.contains(node)); }
    matches(selector) {
      if (selector === '[inert]') return this.inert;
      if (selector.startsWith('#')) return this.getAttribute('id') === selector.slice(1);
      if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
      return this.tagName === selector;
    }
    querySelectorAll(selector) {
      const selectors = selector.split(',').map(item => item.trim());
      return this.children.flatMap(child => [...(selectors.some(item => child.matches(item)) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) ?? null; }
    addEventListener(type, handler) { (this.handlers[type] ??= []).push(handler); }
    async fire(type) { for (const handler of this.handlers[type] ?? []) await handler({ preventDefault() {} }); }
    focus() { if (!this.closest('[inert]')) document.activeElement = this; }
  }
  const html = new Element('html'), body = new Element('body');
  html.append(body);
  document = {
    documentElement: html, body,
    createElement: tag => new Element(tag), createTextNode: text => Object.assign(new Element('#text'), { textContent: text }),
    getElementById: id => html.querySelector(`#${id}`), querySelectorAll: selector => html.querySelectorAll(selector)
  };
  for (const id of ['landing-container', 'auth-container', 'app-container', 'landing-page', 'auth-page', 'page-container']) {
    const element = new Element('div'); element.setAttribute('id', id); body.append(element);
  }
  const storage = () => {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  };
  const requests = [], messages = [], failures = new Set();
  const localStorage = storage(), sessionStorage = storage();
  const window = { location: { hash }, addEventListener() {} };
  const context = vm.createContext({
    document, window, localStorage, sessionStorage, Node: Element, URLSearchParams, Date,
    console: { ...console, error() {} },
    fetch: async (url, options = {}) => {
      requests.push({ url, ...options });
      const pathname = new URL(url, 'http://localhost').pathname;
      if (failures.has(pathname)) return { ok: false, status: 400, json: async () => ({ detail: 'Test failure' }) };
      const payload = pathname.endsWith('/login') ? { access_token: 'test-token' }
        : pathname.endsWith('/users/me') ? { email: 'test@example.com', theme_preference: 'light' }
        : pathname.endsWith('/otp/verify') ? { verified_token: 'verified-test-token' } : {};
      return { ok: true, status: 200, json: async () => payload };
    }
  });
  const modules = new Map();
  function load(file) {
    if (modules.has(file)) return modules.get(file);
    const module = file === path.join(sourceRoot, 'components/toast.js')
      ? new vm.SyntheticModule(['Toast'], function () {
        this.setExport('Toast', { success: message => messages.push(['success', message]), error: message => messages.push(['error', message]) });
      }, { context, identifier: file })
      : new vm.SourceTextModule(readFileSync(file, 'utf8'), { context, identifier: file });
    modules.set(file, module);
    return module;
  }
  const entry = new vm.SourceTextModule("export { authPage } from './pages/auth-page.js'; export { router } from './router.js'; export { store } from './store.js'; export { ThemeManager } from './theme.js';", { context, identifier: path.join(sourceRoot, '__test__.js') });
  await entry.link((specifier, importer) => load(path.resolve(path.dirname(importer.identifier), specifier)));
  await entry.evaluate();
  const { authPage, router, store, ThemeManager } = entry.namespace;
  ThemeManager.init();
  router.register('login', authPage); router.register('register', authPage);
  router.register('landing', { render() {} }); router.register('dashboard', { render() {} });
  const navigate = async route => { window.location.hash = route; await router.handleRoute(); };
  await navigate(hash);
  const get = id => document.getElementById(id);
  const fill = values => Object.entries(values).forEach(([id, value]) => { get(id).value = value; });
  const loginForm = () => get('login-email').closest('form');
  const registerForm = () => get('register-name').closest('form');
  return { ...entry.namespace, document, window, localStorage, sessionStorage, requests, messages, failures, navigate, get, fill, loginForm, registerForm };
}

const details = { 'register-name': 'Test User', 'register-email': 'test@example.com', 'register-password': 'test-password' };

test('hash navigation slides the existing forms, preserves OTP, and excludes inactive form from focus', async () => {
  const app = await setup('#register');
  const shell = app.authPage.shell;
  assert.equal(app.authPage.loginPanel.inert, true);
  app.fill(details);
  await app.registerForm().fire('submit');
  app.get('register-otp').value = '123456';
  await app.navigate('#login');
  assert.equal(app.authPage.registerPanel.inert, true);
  assert.equal(app.authPage.loginPanel.getAttribute('aria-hidden'), 'false');
  await app.navigate('#register');
  assert.equal(app.authPage.shell, shell);
  assert.equal(app.get('register-otp').value, '123456');
  assert.equal(app.get('register-email').value, details['register-email']);
  assert.equal(app.document.activeElement, app.get('auth-register-title'));
  assert.equal(app.requests.filter(r => r.url.includes('/otp/send')).length, 1);
});

test('login failure permits retry; success uses existing auth API and restores saved route', async () => {
  const app = await setup();
  app.fill({ 'login-email': 'test+alias@example.com', 'login-password': 'test-password' });
  app.failures.add('/api/v1/auth/login');
  await app.loginForm().fire('submit');
  assert.equal(app.localStorage.getItem('access_token'), null);
  assert.equal(app.loginForm().querySelectorAll('button').find(button => button.getAttribute('type') === 'submit').disabled, false);
  app.failures.clear();
  app.localStorage.setItem('planify_last_route', 'calendar');
  await app.loginForm().fire('submit');
  assert.equal(new URLSearchParams(app.requests[0].body).get('username'), 'test+alias@example.com');
  assert.equal(app.localStorage.getItem('access_token'), 'test-token');
  assert.equal(app.window.location.hash, '#calendar');
});

test('login returns to a protected route requested before authentication', async () => {
  const app = await setup();
  app.sessionStorage.setItem('planify_redirect_after_login', 'guide');
  app.localStorage.setItem('planify_last_route', 'calendar');
  app.fill({ 'login-email': 'test@example.com', 'login-password': 'test-password' });
  await app.loginForm().fire('submit');
  assert.equal(app.window.location.hash, '#guide');
  assert.equal(app.sessionStorage.getItem('planify_redirect_after_login'), null);
});

test('registration sends OTP, verifies it, registers with verified token, then signs in', async () => {
  const app = await setup('#register'); app.fill(details);
  await app.registerForm().fire('submit');
  assert.equal(app.requests.length, 1);
  assert.equal(app.get('register-otp').required, true);
  app.get('register-otp').value = '123456';
  await app.registerForm().fire('submit');
  const urls = app.requests.map(r => new URL(r.url, 'http://localhost').pathname);
  assert.deepEqual(urls.slice(0, 4), ['/api/v1/otp/send', '/api/v1/otp/verify', '/api/v1/auth/register', '/api/v1/auth/login']);
  const payload = JSON.parse(app.requests.find(r => r.url === '/api/v1/auth/register').body);
  assert.deepEqual(payload, { email: 'test@example.com', nickname: 'Test User', password: 'test-password', otp: '123456', verified_token: 'verified-test-token' });
  assert.equal(app.window.location.hash, '#dashboard');
});

test('invalid fields and malformed OTP never call registration; changing email requires a new OTP', async () => {
  const app = await setup('#register');
  await app.registerForm().fire('submit'); assert.equal(app.requests.length, 0);
  app.fill(details); await app.registerForm().fire('submit');
  app.get('register-otp').value = '1234ab'; await app.registerForm().fire('submit');
  assert.equal(app.requests.length, 1);
  app.get('register-email').value = 'changed@example.com'; await app.get('register-email').fire('input');
  assert.equal(app.get('register-otp').required, false);
  await app.registerForm().fire('submit');
  assert.equal(JSON.parse(app.requests.at(-1).body).email, 'changed@example.com');
  assert.equal(app.get('register-otp').value, '');
});

test('OTP network errors preserve the form and unlock controls for retry', async () => {
  const app = await setup('#register'); app.fill(details);
  app.failures.add('/api/v1/otp/send'); await app.registerForm().fire('submit');
  assert.equal(app.registerForm().getAttribute('aria-busy'), 'false');
  assert.equal(app.registerForm().querySelector('button').disabled, false);
  assert.equal(app.get('register-email').value, 'test@example.com');
  app.failures.clear(); await app.registerForm().fire('submit');
  app.get('register-otp').value = '123456';
  app.failures.add('/api/v1/otp/verify'); await app.registerForm().fire('submit');
  assert.equal(app.requests.some(r => r.url === '/api/v1/auth/register'), false);
  assert.equal(app.registerForm().getAttribute('aria-busy'), 'false');
});

test('repeated submits send only one OTP request and resend keeps the verification step usable', async () => {
  const app = await setup('#register'); app.fill(details);
  const firstSubmit = app.registerForm().fire('submit');
  await app.registerForm().fire('submit');
  await firstSubmit;
  assert.equal(app.requests.length, 1);
  app.get('register-otp').value = '123456';
  await app.registerForm().querySelector('.auth-resend-button').fire('click');
  assert.equal(app.requests.length, 2);
  assert.equal(app.get('register-otp').value, '');
  assert.equal(app.get('register-otp').required, true);
  assert.equal(app.registerForm().getAttribute('aria-busy'), 'false');
});

test('registration endpoint failure does not sign in and allows retry with the OTP intact', async () => {
  const app = await setup('#register'); app.fill(details);
  await app.registerForm().fire('submit');
  app.get('register-otp').value = '123456';
  app.failures.add('/api/v1/auth/register');
  await app.registerForm().fire('submit');
  assert.equal(app.requests.some(request => request.url === '/api/v1/auth/login'), false);
  assert.equal(app.get('register-otp').value, '123456');
  assert.equal(app.registerForm().getAttribute('aria-busy'), 'false');
  app.failures.clear();
  const firstSubmit = app.registerForm().fire('submit');
  await app.registerForm().fire('submit');
  await firstSubmit;
  assert.equal(app.requests.filter(request => request.url === '/api/v1/auth/login').length, 1);
});

test('password recovery still sends and verifies OTP before reset and returns to login', async () => {
  const app = await setup();
  app.get('login-email').value = 'test@example.com';
  await app.authPage.loginPanel.querySelector('.auth-forgot-button').fire('click');
  assert.equal(app.get('recovery-email').value, 'test@example.com');
  const recovery = app.authPage.loginPanel.querySelector('.auth-recovery');
  await recovery.querySelector('button').fire('click');
  app.fill({ 'recovery-otp': '123456', 'recovery-password': 'new-test-password', 'recovery-confirm-password': 'different' });
  const reset = app.get('recovery-otp').parentNode.querySelector('button');
  await reset.fire('click'); assert.equal(app.requests.length, 1);
  app.get('recovery-confirm-password').value = 'new-test-password'; await reset.fire('click');
  assert.equal(JSON.parse(app.requests.find(r => r.url === '/api/v1/auth/reset-password').body).verified_token, 'verified-test-token');
  assert.equal(recovery.classList.contains('hidden'), true);
  assert.equal(app.get('recovery-password').value, '');
  assert.equal(app.get('login-password').value, '');
});

test('theme toggle preserves form values; leaving auth removes credentials and theme subscription', async () => {
  const app = await setup(); app.get('login-email').value = 'draft@example.com';
  await app.authPage.themeButton.fire('click');
  assert.equal(app.document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(app.get('login-email').value, 'draft@example.com');
  assert.equal(app.localStorage.getItem('planify_theme'), 'dark');
  const listeners = app.store.listeners.theme.length;
  await app.navigate('#landing');
  assert.equal(app.get('login-email'), null);
  assert.equal(app.store.listeners.theme.length, listeners - 1);
  await app.navigate('#login');
  assert.equal(app.get('login-email').value, '');
  assert.equal(app.authPage.loginPanel.inert, false);
});
