import { createElement } from '../utils/dom.js';
import { AuthManager } from '../auth.js';
import { Toast } from '../components/toast.js';
import { isValidEmail, isValidPassword } from '../utils/validator.js';

export const loginPage = {
  render(container) {
    container.innerHTML = '';

    const page = createElement('div', { className: 'auth-page' });
    const card = createElement('div', { className: 'auth-card' });

    const backLink = createElement('a', {
      href: '#landing',
      style: { fontSize: '12px', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' },
      textContent: '← Quay về Trang chủ'
    });

    const logo = createElement('div', { className: 'auth-logo' }, [
      createElement('span', { className: 'auth-logo-icon', textContent: '✨' }),
      createElement('h1', { className: 'auth-logo-title', textContent: 'Đăng nhập Planify Pro' }),
      createElement('p', { className: 'auth-subtitle', textContent: 'Truy cập Dashboard, To Do Kanban, Calendar & AI Agent' })
    ]);

    // ===== 1. LOGIN FORM =====
    const loginView = createElement('div');
    const form = createElement('form', {
      className: 'auth-form',
      onsubmit: async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!isValidEmail(email)) {
          Toast.error('Vui lòng nhập địa chỉ email hợp lệ.');
          return;
        }
        if (!password) {
          Toast.error('Vui lòng nhập mật khẩu.');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang đăng nhập...';

        try {
          await AuthManager.login(email, password);
          Toast.success('Đăng nhập thành công! Chào mừng bạn quay trở lại.');
          const redirectRoute = sessionStorage.getItem('planify_redirect_after_login');
          sessionStorage.removeItem('planify_redirect_after_login');
          const savedRoute = localStorage.getItem('planify_last_route') || 'dashboard';
          window.location.hash = `#${redirectRoute || savedRoute}`;
        } catch (err) {
          Toast.error(err.message || 'Đăng nhập thất bại.');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Đăng nhập vào Workspace';
        }
      }
    });

    const emailGroup = createElement('div', { className: 'form-group' });
    const emailLabel = createElement('label', { className: 'form-label', textContent: 'Địa chỉ Email' });
    const emailInput = createElement('input', {
      type: 'email',
      className: 'input',
      placeholder: 'tenban@example.com',
      required: true,
      autocomplete: 'email'
    });
    emailGroup.appendChild(emailLabel);
    emailGroup.appendChild(emailInput);

    const passGroup = createElement('div', { className: 'form-group' });
    const passLabelRow = createElement('div', {
      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
    });
    const passLabel = createElement('label', { className: 'form-label', textContent: 'Mật khẩu' });
    const forgotBtn = createElement('button', {
      type: 'button',
      style: {
        background: 'none',
        border: 'none',
        color: 'var(--color-primary)',
        fontSize: '12px',
        fontWeight: '700',
        cursor: 'pointer',
        padding: '0'
      },
      textContent: '🔑 Quên mật khẩu?',
      onclick: () => {
        if (emailInput.value.trim()) {
          fpEmailInput.value = emailInput.value.trim();
        }
        loginView.classList.add('hidden');
        forgotView.classList.remove('hidden');
        logo.querySelector('.auth-logo-title').textContent = 'Khôi phục Mật khẩu';
        logo.querySelector('.auth-subtitle').textContent = 'Xác thực bằng mã OTP 6 chữ số gửi qua Email của bạn';
      }
    });
    passLabelRow.appendChild(passLabel);
    passLabelRow.appendChild(forgotBtn);

    const passwordInput = createElement('input', {
      type: 'password',
      className: 'input',
      placeholder: '••••••••',
      required: true,
      autocomplete: 'current-password'
    });
    passGroup.appendChild(passLabelRow);
    passGroup.appendChild(passwordInput);

    const submitBtn = createElement('button', {
      type: 'submit',
      className: 'btn btn-primary',
      style: { padding: '11px 16px', fontWeight: '700', marginTop: '4px' },
      textContent: 'Đăng nhập vào Workspace'
    });

    form.appendChild(emailGroup);
    form.appendChild(passGroup);
    form.appendChild(submitBtn);
    loginView.appendChild(form);

    // ===== 2. FORGOT PASSWORD OTP FLOW =====
    const forgotView = createElement('div', { className: 'hidden' });
    let fpVerifiedToken = null;

    const fpEmailGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', textContent: 'Email tài khoản cần đặt lại mật khẩu' }),
      createElement('input', {
        type: 'email',
        className: 'input',
        placeholder: 'Nhập email đã đăng ký...'
      })
    ]);
    const fpEmailInput = fpEmailGroup.querySelector('input');

    const fpSendOtpBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-primary',
      style: { width: '100%', padding: '10px 14px', fontWeight: '700', marginTop: '6px' },
      textContent: '📨 Gửi mã OTP đặt lại mật khẩu',
      onclick: async () => {
        const email = fpEmailInput.value.trim();
        if (!isValidEmail(email)) {
          Toast.error('Vui lòng nhập địa chỉ email hợp lệ.');
          return;
        }
        fpSendOtpBtn.disabled = true;
        fpSendOtpBtn.textContent = 'Đang gửi mã OTP qua Email...';
        try {
          await AuthManager.sendOtp(email, 'change-password');
          Toast.success(`Đã gửi mã OTP 6 chữ số tới ${email}. Vui lòng kiểm tra hộp thư!`);
          fpStep2Box.classList.remove('hidden');
          fpSendOtpBtn.textContent = '🔄 Gửi lại mã OTP';
        } catch (err) {
          Toast.error(err.message || 'Không thể gửi mã OTP. Hãy kiểm tra lại email.');
          fpSendOtpBtn.textContent = '📨 Gửi mã OTP đặt lại mật khẩu';
        } finally {
          fpSendOtpBtn.disabled = false;
        }
      }
    });

    const fpStep2Box = createElement('div', {
      className: 'hidden',
      style: {
        marginTop: '14px',
        padding: '14px',
        borderRadius: '12px',
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-light)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }
    });

    const fpOtpInput = createElement('input', {
      type: 'text',
      className: 'input',
      placeholder: 'Nhập 6 chữ số OTP (VD: 123456)',
      maxLength: 6,
      style: { letterSpacing: '4px', fontWeight: '800', textAlign: 'center', fontSize: '16px' }
    });

    const fpNewPassInput = createElement('input', {
      type: 'password',
      className: 'input',
      placeholder: 'Mật khẩu mới (tối thiểu 6 ký tự)'
    });

    const fpConfirmPassInput = createElement('input', {
      type: 'password',
      className: 'input',
      placeholder: 'Nhập lại mật khẩu mới'
    });

    const fpResetBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-primary',
      style: { padding: '11px 16px', fontWeight: '700' },
      textContent: '🔒 Xác nhận OTP & Đặt lại mật khẩu',
      onclick: async () => {
        const email = fpEmailInput.value.trim();
        const otp = fpOtpInput.value.trim();
        const newPass = fpNewPassInput.value;
        const confirmPass = fpConfirmPassInput.value;

        if (!otp || otp.length < 4) {
          Toast.error('Vui lòng nhập mã OTP đã nhận qua email.');
          return;
        }
        if (!isValidPassword(newPass, 6)) {
          Toast.error('Mật khẩu mới phải có ít nhất 6 ký tự.');
          return;
        }
        if (newPass !== confirmPass) {
          Toast.error('Mật khẩu xác nhận không khớp.');
          return;
        }

        fpResetBtn.disabled = true;
        fpResetBtn.textContent = 'Đang xác thực OTP & đổi mật khẩu...';
        try {
          const verifyRes = await AuthManager.verifyOtp(email, otp, 'change-password');
          fpVerifiedToken = verifyRes?.verified_token || verifyRes?.data?.verified_token || null;
          await AuthManager.resetPassword(email, newPass, otp, fpVerifiedToken);
          Toast.success('🎉 Đặt lại mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới.');
          emailInput.value = email;
          passwordInput.value = '';
          forgotView.classList.add('hidden');
          loginView.classList.remove('hidden');
          logo.querySelector('.auth-logo-title').textContent = 'Đăng nhập Planify Pro';
          logo.querySelector('.auth-subtitle').textContent = 'Truy cập Dashboard, To Do Kanban, Calendar & AI Agent';
        } catch (err) {
          Toast.error(err.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.');
        } finally {
          fpResetBtn.disabled = false;
          fpResetBtn.textContent = '🔒 Xác nhận OTP & Đặt lại mật khẩu';
        }
      }
    });

    fpStep2Box.appendChild(createElement('label', { className: 'form-label', textContent: 'Mã xác thực OTP (6 chữ số từ Email)' }));
    fpStep2Box.appendChild(fpOtpInput);
    fpStep2Box.appendChild(createElement('label', { className: 'form-label', textContent: 'Mật khẩu mới' }));
    fpStep2Box.appendChild(fpNewPassInput);
    fpStep2Box.appendChild(createElement('label', { className: 'form-label', textContent: 'Xác nhận mật khẩu mới' }));
    fpStep2Box.appendChild(fpConfirmPassInput);
    fpStep2Box.appendChild(fpResetBtn);

    const backToLoginBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-secondary btn-sm',
      style: { width: '100%', marginTop: '10px' },
      textContent: '← Quay lại màn hình Đăng nhập',
      onclick: () => {
        forgotView.classList.add('hidden');
        loginView.classList.remove('hidden');
        logo.querySelector('.auth-logo-title').textContent = 'Đăng nhập Planify Pro';
        logo.querySelector('.auth-subtitle').textContent = 'Truy cập Dashboard, To Do Kanban, Calendar & AI Agent';
      }
    });

    forgotView.appendChild(fpEmailGroup);
    forgotView.appendChild(fpSendOtpBtn);
    forgotView.appendChild(fpStep2Box);
    forgotView.appendChild(backToLoginBtn);

    const footer = createElement('div', { className: 'auth-footer' }, [
      createElement('span', { textContent: 'Chưa có tài khoản? ' }),
      createElement('a', {
        className: 'auth-link',
        textContent: 'Đăng ký miễn phí ngay',
        href: '#register'
      })
    ]);

    card.appendChild(backLink);
    card.appendChild(logo);
    card.appendChild(loginView);
    card.appendChild(forgotView);
    card.appendChild(footer);
    page.appendChild(card);
    container.appendChild(page);
  },

  destroy() {}
};
