import { createElement } from '../utils/dom.js';
import { AuthManager } from '../auth.js';
import { Toast } from '../components/toast.js';
import { isValidEmail, isValidPassword } from '../utils/validator.js';

export const registerPage = {
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
      createElement('span', { className: 'auth-logo-icon', textContent: '🚀' }),
      createElement('h1', { className: 'auth-logo-title', textContent: 'Đăng ký Tài khoản Mới' }),
      createElement('p', { className: 'auth-subtitle', textContent: 'Xác thực OTP qua Email & Khởi tạo Workspace thông minh' })
    ]);

    let otpSent = false;

    const form = createElement('form', {
      className: 'auth-form',
      onsubmit: async (e) => {
        e.preventDefault();
        const nickname = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const otp = otpInput.value.trim();

        if (!nickname) {
          Toast.error('Vui lòng nhập tên hiển thị của bạn.');
          return;
        }
        if (!isValidEmail(email)) {
          Toast.error('Địa chỉ email không hợp lệ.');
          return;
        }
        if (!isValidPassword(password, 6)) {
          Toast.error('Mật khẩu phải có ít nhất 6 ký tự.');
          return;
        }

        // Bước 1: Nếu chưa gửi OTP thì gửi mã OTP về email
        if (!otpSent) {
          sendOtpBtn.disabled = true;
          sendOtpBtn.textContent = 'Đang gửi mã OTP tới Email...';
          try {
            await AuthManager.sendOtp(email, 'verify-email');
            otpSent = true;
            otpSection.classList.remove('hidden');
            submitBtn.classList.remove('hidden');
            sendOtpBtn.textContent = '🔄 Gửi lại mã OTP qua Email';
            sendOtpBtn.className = 'btn btn-secondary btn-sm';
            Toast.success(`Đã gửi mã OTP 6 chữ số tới ${email}. Vui lòng kiểm tra hộp thư!`);
            otpInput.focus();
          } catch (err) {
            Toast.error(err.message || 'Không thể gửi mã OTP. Vui lòng kiểm tra lại email.');
            sendOtpBtn.textContent = '📨 Gửi mã OTP xác thực Email';
          } finally {
            sendOtpBtn.disabled = false;
          }
          return;
        }

        // Bước 2: Xác thực OTP và hoàn tất đăng ký
        if (!otp || otp.length < 4) {
          Toast.error('Vui lòng nhập mã OTP 6 chữ số đã được gửi tới email của bạn.');
          otpInput.focus();
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang xác thực OTP & khởi tạo tài khoản...';

        try {
          const verifyRes = await AuthManager.verifyOtp(email, otp, 'verify-email');
          const verifiedToken = verifyRes?.verified_token || verifyRes?.data?.verified_token || null;
          await AuthManager.register(email, nickname, password, otp, verifiedToken);
          Toast.success('🎉 Xác thực OTP & Đăng ký thành công! Chào mừng bạn đến với Planify Pro.');
          sessionStorage.removeItem('planify_redirect_after_login');
          localStorage.setItem('planify_last_route', 'dashboard');
          window.location.hash = '#dashboard';
        } catch (err) {
          Toast.error(err.message || 'Mã OTP không chính xác hoặc đã hết hạn.');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = '✅ Xác nhận OTP & Vào Dashboard →';
        }
      }
    });

    const nameGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', textContent: 'Họ và tên / Tên hiển thị' }),
      createElement('input', {
        type: 'text',
        className: 'input',
        placeholder: 'Nguyễn Văn A',
        required: true
      })
    ]);
    const nameInput = nameGroup.querySelector('input');

    const emailGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', textContent: 'Địa chỉ Email (Nhận mã OTP & Thông báo lịch)' }),
      createElement('input', {
        type: 'email',
        className: 'input',
        placeholder: 'tenban@gmail.com',
        required: true
      })
    ]);
    const emailInput = emailGroup.querySelector('input');

    const passGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', textContent: 'Mật khẩu (tối thiểu 6 ký tự)' }),
      createElement('input', {
        type: 'password',
        className: 'input',
        placeholder: '••••••••',
        required: true
      })
    ]);
    const passwordInput = passGroup.querySelector('input');

    const sendOtpBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-primary',
      style: { padding: '11px 16px', fontWeight: '700', marginTop: '4px', width: '100%' },
      textContent: '📨 Gửi mã OTP xác thực Email',
      onclick: async () => {
        const nickname = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!nickname) {
          Toast.error('Vui lòng nhập họ tên hiển thị trước.');
          nameInput.focus();
          return;
        }
        if (!isValidEmail(email)) {
          Toast.error('Vui lòng nhập địa chỉ email hợp lệ.');
          emailInput.focus();
          return;
        }
        if (!isValidPassword(password, 6)) {
          Toast.error('Mật khẩu phải có ít nhất 6 ký tự.');
          passwordInput.focus();
          return;
        }

        sendOtpBtn.disabled = true;
        sendOtpBtn.textContent = 'Đang gửi mã OTP tới Email...';
        try {
          await AuthManager.sendOtp(email, 'verify-email');
          otpSent = true;
          otpSection.classList.remove('hidden');
          submitBtn.classList.remove('hidden');
          sendOtpBtn.textContent = '🔄 Gửi lại mã OTP qua Email';
          sendOtpBtn.className = 'btn btn-secondary btn-sm';
          Toast.success(`Mã OTP 6 chữ số đã được gửi tới ${email}!`);
          otpInput.focus();
        } catch (err) {
          Toast.error(err.message || 'Không thể gửi mã OTP.');
          sendOtpBtn.textContent = '📨 Gửi mã OTP xác thực Email';
        } finally {
          sendOtpBtn.disabled = false;
        }
      }
    });

    const otpSection = createElement('div', {
      className: 'form-group hidden',
      style: {
        padding: '14px',
        borderRadius: '12px',
        background: 'var(--color-primary-light)',
        border: '1.5px dashed var(--color-primary)',
        marginTop: '4px'
      }
    });
    const otpLabel = createElement('label', {
      className: 'form-label',
      style: { color: 'var(--color-primary)', fontWeight: '800' },
      textContent: '🔐 Nhập mã OTP 6 chữ số vừa gửi tới Email của bạn:'
    });
    const otpInput = createElement('input', {
      type: 'text',
      className: 'input',
      placeholder: 'Nhập 6 số OTP (VD: 682914)',
      maxLength: 6,
      style: {
        letterSpacing: '6px',
        fontSize: '18px',
        fontWeight: '800',
        textAlign: 'center',
        marginTop: '6px'
      }
    });
    otpSection.appendChild(otpLabel);
    otpSection.appendChild(otpInput);

    const submitBtn = createElement('button', {
      type: 'submit',
      className: 'btn btn-primary hidden',
      style: { padding: '12px 16px', fontWeight: '800', marginTop: '6px', width: '100%' },
      textContent: '✅ Xác nhận OTP & Vào Dashboard →'
    });

    form.appendChild(nameGroup);
    form.appendChild(emailGroup);
    form.appendChild(passGroup);
    form.appendChild(otpSection);
    form.appendChild(submitBtn);
    form.appendChild(sendOtpBtn);

    const footer = createElement('div', { className: 'auth-footer' }, [
      createElement('span', { textContent: 'Đã có tài khoản? ' }),
      createElement('a', {
        className: 'auth-link',
        textContent: 'Đăng nhập ngay',
        href: '#login'
      })
    ]);

    card.appendChild(backLink);
    card.appendChild(logo);
    card.appendChild(form);
    card.appendChild(footer);
    page.appendChild(card);
    container.appendChild(page);
  },

  destroy() {}
};
