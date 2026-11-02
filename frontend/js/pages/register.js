import { createElement } from '../utils/dom.js';
import { AuthManager } from '../auth.js';
import { Toast } from '../components/toast.js';
import { isValidEmail, isValidPassword } from '../utils/validator.js';

export function createRegisterForm() {
  let otpEmail = null;
  let busy = false;
  const field = (id, label, attrs) => createElement('div', { className: 'form-group' }, [
    createElement('label', { for: id, className: 'form-label', textContent: label }),
    createElement('input', { id, name: id, className: 'input', ...attrs })
  ]);
  const nameGroup = field('register-name', 'Tên hiển thị', {
    type: 'text', placeholder: 'Nguyễn Văn A', required: true, autocomplete: 'nickname'
  });
  const emailGroup = field('register-email', 'Email', {
    type: 'email', placeholder: 'tenban@example.com', required: true, autocomplete: 'email'
  });
  const passGroup = field('register-password', 'Mật khẩu', {
    type: 'password', placeholder: 'Tối thiểu 6 ký tự', required: true, minlength: 6, autocomplete: 'new-password'
  });
  const nameInput = nameGroup.querySelector('input');
  const emailInput = emailGroup.querySelector('input');
  const passwordInput = passGroup.querySelector('input');
  const otpSection = field('register-otp', 'Mã OTP từ email', {
    type: 'text', placeholder: 'Nhập 6 chữ số', inputmode: 'numeric', autocomplete: 'one-time-code',
    pattern: '[0-9]{6}', maxLength: 6, 'aria-describedby': 'register-otp-help'
  });
  otpSection.classList.add('auth-otp-section', 'hidden');
  const otpInput = otpSection.querySelector('input');
  otpSection.appendChild(createElement('p', {
    id: 'register-otp-help', className: 'auth-field-hint', textContent: 'Kiểm tra hộp thư đến hoặc thư rác để lấy mã xác thực.'
  }));

  const submitBtn = createElement('button', {
    type: 'submit', className: 'btn btn-primary', textContent: 'Tạo tài khoản'
  });
  const resendBtn = createElement('button', {
    type: 'button', className: 'auth-resend-button hidden', textContent: 'Gửi lại mã OTP',
    onclick: () => sendOtp()
  });

  function validateDetails() {
    if (!nameInput.value.trim()) {
      Toast.error('Vui lòng nhập tên hiển thị của bạn.');
      nameInput.focus();
      return false;
    }
    if (!isValidEmail(emailInput.value.trim())) {
      Toast.error('Vui lòng nhập địa chỉ email hợp lệ.');
      emailInput.focus();
      return false;
    }
    if (!isValidPassword(passwordInput.value, 6)) {
      Toast.error('Mật khẩu phải có ít nhất 6 ký tự.');
      passwordInput.focus();
      return false;
    }
    return true;
  }

  function setBusy(value) {
    busy = value;
    submitBtn.disabled = value;
    resendBtn.disabled = value;
    [nameInput, emailInput, passwordInput, otpInput].forEach(input => { input.readOnly = value; });
    form.setAttribute('aria-busy', String(value));
    submitBtn.textContent = value ? 'Đang xử lý...' : (otpEmail ? 'Xác nhận & Đăng ký' : 'Tạo tài khoản');
  }

  async function sendOtp() {
    if (busy || !validateDetails()) return;
    const email = emailInput.value.trim();
    setBusy(true);
    try {
      await AuthManager.sendOtp(email, 'verify-email');
      otpEmail = email;
      otpInput.value = '';
      otpInput.required = true;
      otpSection.classList.remove('hidden');
      resendBtn.classList.remove('hidden');
      Toast.success(`Đã gửi mã OTP 6 chữ số tới ${email}. Vui lòng kiểm tra hộp thư!`);
      if (!form.closest('[inert]')) otpInput.focus();
    } catch (err) {
      Toast.error(err.message || 'Không thể gửi mã OTP. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  emailInput.addEventListener('input', () => {
    if (otpEmail && emailInput.value.trim() !== otpEmail) {
      otpEmail = null;
      otpInput.value = '';
      otpInput.required = false;
      otpSection.classList.add('hidden');
      resendBtn.classList.add('hidden');
      submitBtn.textContent = 'Tạo tài khoản';
    }
  });

  const form = createElement('form', {
    className: 'auth-form',
    onsubmit: async event => {
      event.preventDefault();
      if (busy || !validateDetails()) return;
      if (!otpEmail || emailInput.value.trim() !== otpEmail) {
        await sendOtp();
        return;
      }
      const otp = otpInput.value.trim();
      if (!/^\d{6}$/.test(otp)) {
        Toast.error('Vui lòng nhập đủ 6 chữ số OTP đã gửi tới email.');
        otpInput.focus();
        return;
      }
      setBusy(true);
      try {
        const verifyRes = await AuthManager.verifyOtp(otpEmail, otp, 'verify-email');
        const verifiedToken = verifyRes?.verified_token || verifyRes?.data?.verified_token || null;
        await AuthManager.register(otpEmail, nameInput.value.trim(), passwordInput.value, otp, verifiedToken);
        Toast.success('Đăng ký thành công! Chào mừng bạn đến với Planify Pro.');
        sessionStorage.removeItem('planify_redirect_after_login');
        localStorage.setItem('planify_last_route', 'dashboard');
        window.location.hash = '#dashboard';
      } catch (err) {
        Toast.error(err.message || 'Không thể đăng ký. Vui lòng kiểm tra mã OTP và thử lại.');
      } finally {
        setBusy(false);
      }
    }
  }, [nameGroup, emailGroup, passGroup, otpSection, submitBtn, resendBtn]);

  return createElement('div', { className: 'auth-card' }, [
    createElement('div', { className: 'auth-logo' }, [
      createElement('h1', { id: 'auth-register-title', tabindex: '-1', className: 'auth-logo-title', textContent: 'Tạo tài khoản' }),
      createElement('p', { className: 'auth-subtitle', textContent: 'Bắt đầu sắp xếp công việc cùng Planify Pro.' })
    ]),
    form
  ]);
}
