/**
 * API Client with JWT authorization handling
 */
import { businessWallTime } from './utils/date.js';

function calendarTimes(data, outgoing = false) {
  if (Array.isArray(data)) return data.map(value => calendarTimes(value, outgoing));
  if (!data || typeof data !== 'object') return data;
  return Object.fromEntries(Object.entries(data).map(([key, value]) => {
    if (['start_at', 'end_at', 'original_start', 'recurrence_end'].includes(key) && typeof value === 'string') {
      return [key, outgoing ? (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value) ? `${value}+07:00` : value) : businessWallTime(value)];
    }
    return [key, calendarTimes(value, outgoing)];
  }));
}

class ApiClient {
  constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl;
  }

  getToken() {
    return localStorage.getItem('access_token');
  }

  setToken(token) {
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    };

    const config = {
      ...options,
      headers
    };
    const controller = new AbortController();
    config.signal = options.signal || controller.signal;
    const timer = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(url, config);
      if (token !== this.getToken()) throw new Error('Phiên đăng nhập đã thay đổi.');

      if (response.status === 401) {
        // Token expired or invalid
        this.setToken(null);
        try {
          const { store } = await import('./store.js');
          store.set('user', null);
        } catch (e) {}
        window.location.hash = '#login';
        throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      }

      if (response.status === 204) {
        return null;
      }

      let data;
      try { data = await response.json(); } catch (_) {
        throw new Error('Máy chủ trả về dữ liệu không hợp lệ. Hãy tải lại danh sách trước khi thử thao tác ghi lần nữa.');
      }

      if (!response.ok) {
        const errorMsg = data?.error?.message || data?.detail || data?.message || `Lỗi yêu cầu: ${response.status}`;
        const error = new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
        error.status = response.status;
        throw error;
      }

      // Auto-unwrap ApiResponse wrapper if present
      if (data && typeof data === 'object' && data.success === true && data.data !== undefined) {
        return calendarTimes(data.data);
      }

      return calendarTimes(data);
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Yêu cầu quá thời gian. Thao tác có thể đã được lưu; hãy tải lại dữ liệu trước khi thử lại.');
      console.error(`API Error [${options.method || 'GET'} ${endpoint}]:`, err);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  get(endpoint, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, v);
      }
    });
    const queryString = query.toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(calendarTimes(body, true))
    });
  }

  put(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(calendarTimes(body, true))
    });
  }

  patch(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(calendarTimes(body, true))
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();

