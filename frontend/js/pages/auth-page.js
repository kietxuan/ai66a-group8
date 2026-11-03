import { createElement } from '../utils/dom.js';
import { ThemeManager } from '../theme.js';
import { store } from '../store.js';
import { createLoginForm } from './login.js';
import { createRegisterForm } from './register.js';

const isAuthRoute = () => ['#login', '#register'].includes(window.location.hash);

export const authPage = {
  render(container) {
    const signup = window.location.hash === '#register';
    if (!this.page || !container.contains(this.page)) {
      container.replaceChildren();
      this.page = createElement('main', { className: 'auth-page' });
      this.themeButton = createElement('button', {
        type: 'button',
        className: 'auth-theme-button',
        onclick: () => ThemeManager.toggle()
      });
      const updateThemeButton = () => {
        const dark = store.get('theme') === 'dark';
        this.themeButton.textContent = dark ? '☾' : '☀';
        this.themeButton.setAttribute('aria-label', dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
        this.themeButton.title = this.themeButton.getAttribute('aria-label');
      };
      updateThemeButton();
      this.unsubscribeTheme = store.on('theme', updateThemeButton);

      const header = createElement('header', { className: 'auth-header' }, [
        createElement('a', { className: 'auth-brand', href: '#landing', 'aria-label': 'Planify Pro — Trang chủ' }, [
          createElement('span', { className: 'auth-brand-icon', textContent: '✨', 'aria-hidden': 'true' }),
          createElement('span', { textContent: 'Planify Pro' })
        ]),
        createElement('div', { className: 'auth-header-actions' }, [
          createElement('a', { href: '#landing', className: 'auth-home-link', textContent: '← Trang chủ' }),
          this.themeButton
        ])
      ]);

      this.loginPanel = createElement('section', {
        className: 'auth-panel auth-panel-signin', 'aria-labelledby': 'auth-login-title'
      }, [createLoginForm()]);
      this.registerPanel = createElement('section', {
        className: 'auth-panel auth-panel-signup', 'aria-labelledby': 'auth-register-title'
      }, [createRegisterForm()]);

      this.invitationTitle = createElement('h2');
      this.invitationText = createElement('p');
      this.switchLink = createElement('a', { className: 'auth-switch-button' });
      const invitation = createElement('aside', { className: 'auth-invitation' }, [
        createElement('span', { className: 'auth-invitation-mark', textContent: '✦', 'aria-hidden': 'true' }),
        createElement('div', { className: 'auth-invitation-copy' }, [this.invitationTitle, this.invitationText]),
        this.switchLink,
        createElement('span', { className: 'auth-invitation-caption', textContent: 'Công việc · Lịch biểu · Trợ lý AI' })
      ]);

      this.shell = createElement('div', { className: 'auth-shell' }, [this.loginPanel, this.registerPanel, invitation]);
      this.page.append(header, createElement('div', { className: 'auth-stage' }, [this.shell]));
      container.appendChild(this.page);
    }

    const switching = this.signup !== undefined && this.signup !== signup;
    this.signup = signup;
    this.shell.classList.toggle('s--signup', signup);
    this.loginPanel.inert = signup;
    this.registerPanel.inert = !signup;
    this.loginPanel.setAttribute('aria-hidden', String(signup));
    this.registerPanel.setAttribute('aria-hidden', String(!signup));
    this.invitationTitle.textContent = signup ? 'Đã có tài khoản?' : 'Chưa có tài khoản?';
    this.invitationText.textContent = signup
      ? 'Chào mừng bạn trở lại. Đăng nhập để tiếp tục kế hoạch của mình.'
      : 'Tạo tài khoản và bắt đầu quản lý công việc, lịch trình của bạn.';
    this.switchLink.textContent = signup ? 'Đăng nhập' : 'Đăng ký';
    this.switchLink.href = signup ? '#login' : '#register';
    document.title = `${signup ? 'Đăng ký' : 'Đăng nhập'} — Planify Pro`;
    if (switching) {
      const activePanel = signup ? this.registerPanel : this.loginPanel;
      activePanel.querySelector('.auth-logo-title').focus({ preventScroll: true });
    }
  },

  destroy() {
    // Keep both forms mounted while the hash router switches auth modes so the
    // sliding transition and in-progress OTP form survive navigation.
    if (isAuthRoute()) return;
    this.unsubscribeTheme?.();
    this.page?.remove();
    this.page = null;
    this.signup = undefined;
    document.title = 'Planify Pro — Quản lý Công việc, Lịch biểu & Trợ lý AI';
  }
};
