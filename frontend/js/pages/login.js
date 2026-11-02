import { createElement } from '../utils/dom.js';
import { AuthManager } from '../auth.js';
import { Toast } from '../components/toast.js';
import { isValidEmail, isValidPassword } from '../utils/validator.js';

export function createLoginForm() {
  const card = createElement('div', { className: 'auth-card' });

  const logo = createElement('div', { className: 'auth-logo' }, [
    createElement('h1', { id: 'auth-login-title', tabindex: '-1', className: 'auth-logo-title', textContent: 'Chào mừng trở lại' }),
    createElement('p', { className: 'auth-subtitle', textContent: 'Đăng nhập để tiếp tục kế hoạch của bạn.' })
  ]);

  // ===== 1. LOGIN FORM =====
  const loginView = createElement('div');
  const form = createElement('form', {
    className: 'auth-form',
    onsubmit: async (e) => {
      e.preventDefault();
      if (submitBtn.disabled) return;
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
        submitBtn.textContent = 'Đăng nhập';
      }
    }
  });

  const emailGroup = createElement('div', { className: 'form-group' });
  const emailLabel = createElement('label', { for: 'login-email', className: 'form-label', textContent: 'Email' });
  const emailInput = createElement('input', {
    type: 'email',
    id: 'login-email',
    name: 'email',
    className: 'input',
    placeholder: 'tenban@example.com',
    required: true,
    autocomplete: 'email'
  });
  emailGroup.appendChild(emailLabel);
  emailGroup.appendChild(emailInput);

  const passGroup = createElement('div', { className: 'form-group' });
  const passLabel = createElement('label', { for: 'login-password', className: 'form-label', textContent: 'Mật khẩu' });
  const forgotBtn = createElement('button', {
    type: 'button',
    className: 'auth-forgot-button',
    textContent: 'Quên mật khẩu?',
    onclick: () => {
      if (emailInput.value.trim()) {
        fpEmailInput.value = emailInput.value.trim();
      }
      loginView.classList.add('hidden');
      forgotView.classList.remove('hidden');
      logo.querySelector('.auth-logo-title').textContent = 'Khôi phục Mật khẩu';
      logo.querySelector('.auth-subtitle').textContent = 'Xác thực bằng mã OTP 6 chữ số gửi qua Email của bạn';
      fpEmailInput.focus();
    }
  });
  const passwordInput = createElement('input', {
    type: 'password',
    id: 'login-password',
    name: 'password',
    className: 'input',
    placeholder: '••••••••',
    required: true,
    autocomplete: 'current-password'
  });
  passGroup.appendChild(passLabel);
  passGroup.appendChild(passwordInput);

  const submitBtn = createElement('button', {
    type: 'submit',
    className: 'btn btn-primary',
    style: { padding: '11px 16px', fontWeight: '700', marginTop: '4px' },
    textContent: 'Đăng nhập'
  });

  form.appendChild(emailGroup);
  form.appendChild(passGroup);
  form.appendChild(forgotBtn);
  form.appendChild(submitBtn);
  loginView.appendChild(form);

  // ===== 2. FORGOT PASSWORD OTP FLOW =====
  const forgotView = createElement('div', { className: 'auth-recovery hidden' });
  let fpVerifiedToken = null;
  let fpVerifiedEmail = null;
  let fpVerifiedOtp = null;
  let recoveryBusy = false;

  function setRecoveryBusy(value) {
    recoveryBusy = value;
    fpSendOtpBtn.disabled = value;
    fpResetBtn.disabled = value;
    [fpEmailInput, fpOtpInput, fpNewPassInput, fpConfirmPassInput].forEach(input => { input.readOnly = value; });
  }

  const fpEmailGroup = createElement('div', { className: 'form-group' }, [
    createElement('label', { for: 'recovery-email', className: 'form-label', textContent: 'Email tài khoản' }),
    createElement('input', {
      type: 'email',
      id: 'recovery-email',
      autocomplete: 'email',
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
      if (recoveryBusy) return;
      const email = fpEmailInput.value.trim();
      if (!isValidEmail(email)) {
        Toast.error('Vui lòng nhập địa chỉ email hợp lệ.');
        return;
      }
      setRecoveryBusy(true);
      fpSendOtpBtn.textContent = 'Đang gửi mã OTP qua Email...';
      try {
        await AuthManager.sendOtp(email, 'change-password');
        fpVerifiedToken = null;
        fpVerifiedEmail = null;
        fpVerifiedOtp = null;
        fpOtpInput.value = '';
        Toast.success(`Đã gửi mã OTP 6 chữ số tới ${email}. Vui lòng kiểm tra hộp thư!`);
        fpStep2Box.classList.remove('hidden');
        fpSendOtpBtn.textContent = '🔄 Gửi lại mã OTP';
      } catch (err) {
        Toast.error(err.message || 'Không thể gửi mã OTP. Hãy kiểm tra lại email.');
        fpSendOtpBtn.textContent = '📨 Gửi mã OTP đặt lại mật khẩu';
      } finally {
        setRecoveryBusy(false);
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
    id: 'recovery-otp',
    inputmode: 'numeric',
    autocomplete: 'one-time-code',
    pattern: '[0-9]{6}',
    className: 'input',
    placeholder: 'Nhập 6 chữ số OTP (VD: 123456)',
    maxLength: 6,
    style: { letterSpacing: '4px', fontWeight: '800', textAlign: 'center', fontSize: '16px' }
  });

  const fpNewPassInput = createElement('input', {
    type: 'password',
    id: 'recovery-password',
    autocomplete: 'new-password',
    className: 'input',
    placeholder: 'Mật khẩu mới (tối thiểu 8 ký tự)'
  });

  const fpConfirmPassInput = createElement('input', {
    type: 'password',
    id: 'recovery-confirm-password',
    autocomplete: 'new-password',
    className: 'input',
    placeholder: 'Nhập lại mật khẩu mới'
  });

  const fpResetBtn = createElement('button', {
    type: 'button',
    className: 'btn btn-primary',
    style: { padding: '11px 16px', fontWeight: '700' },
    textContent: '🔒 Xác nhận OTP & Đặt lại mật khẩu',
    onclick: async () => {
      if (recoveryBusy) return;
      const email = fpEmailInput.value.trim();
      const otp = fpOtpInput.value.trim();
      const newPass = fpNewPassInput.value;
      const confirmPass = fpConfirmPassInput.value;

      if (!/^\d{6}$/.test(otp)) {
        Toast.error('Vui lòng nhập mã OTP đã nhận qua email.');
        return;
      }
      if (!isValidPassword(newPass, 8)) {
        Toast.error('Mật khẩu mới phải có ít nhất 8 ký tự và không quá 72 bytes UTF-8.');
        return;
      }
      if (newPass !== confirmPass) {
        Toast.error('Mật khẩu xác nhận không khớp.');
        return;
      }

      setRecoveryBusy(true);
      fpResetBtn.textContent = 'Đang xác thực OTP & đổi mật khẩu...';
      try {
        if (!fpVerifiedToken || fpVerifiedEmail !== email || fpVerifiedOtp !== otp) {
          const verifyRes = await AuthManager.verifyOtp(email, otp, 'change-password');
          fpVerifiedToken = verifyRes?.verified_token || verifyRes?.data?.verified_token || null;
          fpVerifiedEmail = email;
          fpVerifiedOtp = otp;
          if (!fpVerifiedToken) throw new Error('Máy chủ không trả về xác thực OTP hợp lệ.');
        }
        await AuthManager.resetPassword(email, newPass, otp, fpVerifiedToken);
        Toast.success('🎉 Đặt lại mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới.');
        emailInput.value = email;
        passwordInput.value = '';
        forgotView.classList.add('hidden');
        loginView.classList.remove('hidden');
        logo.querySelector('.auth-logo-title').textContent = 'Chào mừng trở lại';
        logo.querySelector('.auth-subtitle').textContent = 'Đăng nhập để tiếp tục kế hoạch của bạn.';
        fpOtpInput.value = '';
        fpNewPassInput.value = '';
        fpConfirmPassInput.value = '';
        fpVerifiedToken = null;
        passwordInput.focus();
      } catch (err) {
        Toast.error(err.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.');
      } finally {
        setRecoveryBusy(false);
        fpResetBtn.textContent = '🔒 Xác nhận OTP & Đặt lại mật khẩu';
      }
    }
  });

  fpStep2Box.appendChild(createElement('label', { for: 'recovery-otp', className: 'form-label', textContent: 'Mã xác thực OTP (6 chữ số từ Email)' }));
  fpStep2Box.appendChild(fpOtpInput);
  fpStep2Box.appendChild(createElement('label', { for: 'recovery-password', className: 'form-label', textContent: 'Mật khẩu mới' }));
  fpStep2Box.appendChild(fpNewPassInput);
  fpStep2Box.appendChild(createElement('label', { for: 'recovery-confirm-password', className: 'form-label', textContent: 'Xác nhận mật khẩu mới' }));
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
      logo.querySelector('.auth-logo-title').textContent = 'Chào mừng trở lại';
      logo.querySelector('.auth-subtitle').textContent = 'Đăng nhập để tiếp tục kế hoạch của bạn.';
      passwordInput.focus();
    }
  });

  forgotView.appendChild(fpEmailGroup);
  forgotView.appendChild(fpSendOtpBtn);
  forgotView.appendChild(fpStep2Box);
  forgotView.appendChild(backToLoginBtn);

  card.appendChild(logo);
  card.appendChild(loginView);
  card.appendChild(forgotView);
  return card;
}
