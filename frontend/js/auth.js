import { api } from './api.js';
import { store } from './store.js';
import { ThemeManager } from './theme.js';

export class AuthManager {
  static isAuthenticated() {
    return !!api.getToken();
  }

  static async login(email, password) {
    const formData = new URLSearchParams();
    formData.append('username', email.trim());
    formData.append('password', password);

    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.detail || 'Email hoặc mật khẩu không chính xác.');
    }

    if (data?.access_token) {
      api.setToken(data.access_token);
      await this.fetchCurrentUser();
    }
    return data;
  }

  static async sendOtp(email, reason = 'verify-email') {
    const cleanEmail = email.trim();
    return await api.post(`/otp/send?email=${encodeURIComponent(cleanEmail)}&reason=${encodeURIComponent(reason)}`, {
      email: cleanEmail,
      reason
    });
  }

  static async verifyOtp(email, otp, reason = 'verify-email') {
    const cleanEmail = email.trim();
    const cleanOtp = String(otp).trim();
    return await api.post(`/otp/verify?email=${encodeURIComponent(cleanEmail)}&otp=${encodeURIComponent(cleanOtp)}&reason=${encodeURIComponent(reason)}`, {
      email: cleanEmail,
      otp: cleanOtp,
      reason
    });
  }

  static async register(email, nickname, password, otp = null, verifiedToken = null) {
    const payload = {
      email: email.trim(),
      nickname: nickname.trim(),
      password: password
    };
    if (otp) payload.otp = String(otp).trim();
    if (verifiedToken) payload.verified_token = verifiedToken;

    await api.post('/auth/register', payload);
    return await this.login(email, password);
  }

  static async resetPassword(email, newPassword, otp = null, verifiedToken = null) {
    const payload = {
      email: email.trim(),
      new_password: newPassword
    };
    if (otp) payload.otp = String(otp).trim();
    if (verifiedToken) payload.verified_token = verifiedToken;

    return await api.post('/auth/reset-password', payload);
  }

  static async fetchCurrentUser() {
    if (!this.isAuthenticated()) return null;
    try {
      const response = await api.get('/users/me');
      const user = response?.data || response;
      store.set('user', user);

      // Đồng bộ cài đặt thông báo vào localStorage
      if (user) {
        if (user.notify_enabled !== undefined) {
          localStorage.setItem('planify_notify_enabled', user.notify_enabled ? 'true' : 'false');
        }
        if (user.notify_minutes_before !== undefined && user.notify_minutes_before !== null) {
          localStorage.setItem('planify_notify_minutes_before', String(user.notify_minutes_before));
        }
      }

      const localTheme = localStorage.getItem('planify_theme') || localStorage.getItem('theme');
      if (localTheme === 'light' || localTheme === 'dark') {
        ThemeManager.apply(localTheme, false);
        store.set('theme', localTheme);
        if (user?.theme_preference !== localTheme) {
          api.put('/users/me', { theme_preference: localTheme }).catch(() => {});
        }
      } else if (user?.theme_preference === 'light' || user?.theme_preference === 'dark') {
        ThemeManager.apply(user.theme_preference, false);
        store.set('theme', user.theme_preference);
      }
      return user;
    } catch (err) {
      console.warn('Failed to fetch current user:', err);
      return null;
    }
  }

  static logout() {
    api.setToken(null);
    store.set('user', null);
    window.location.hash = '#login';
  }
}
