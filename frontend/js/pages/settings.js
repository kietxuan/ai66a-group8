import { createElement } from '../utils/dom.js';
import { store } from '../store.js';
import { ThemeManager } from '../theme.js';
import { AuthManager } from '../auth.js';
import { ReminderNotifier } from '../components/reminder-notifier.js';
import { Toast } from '../components/toast.js';
import { api } from '../api.js';
import { buildCalendarIcs } from '../utils/ical.js';

export const settingsPage = {
  container: null,

  async render(container) {
    this.container = container;
    container.innerHTML = '';

    const page = createElement('div', { className: 'settings-page' });
    const inner = createElement('div', { className: 'settings-inner' });

    const currentTheme = ThemeManager.getSavedTheme();

    let user = store.get('user');
    try {
      const response = await api.get('/users/me');
      user = response?.data || response;
      store.set('user', user);
    } catch (_) {
      user = user || {};
    }

    // 1. Appearance Section (2 opciones: Light & Dark — đã bỏ Tự động theo hệ thống)
    const themeSection = createElement('div', { className: 'settings-section' }, [
      createElement('h2', { className: 'settings-section-title', textContent: '🎨 Giao diện & Chủ đề' }),
      createElement('div', { className: 'theme-options-grid' }, [
        createElement('div', {
          className: `theme-card ${currentTheme !== 'dark' ? 'active' : ''}`,
          onclick: () => {
            ThemeManager.apply('light', true);
            store.set('theme', 'light');
            settingsPage.render(container);
          }
        }, [
          createElement('span', { style: { fontSize: '26px' }, textContent: '☀️' }),
          createElement('span', { style: { fontWeight: '700' }, textContent: 'Chủ đề Sáng (Light)' }),
          createElement('span', { style: { fontSize: '12px', color: 'var(--color-text-secondary)', textAlign: 'center' }, textContent: 'Giao diện sáng sủa, độ tương phản cao' })
        ]),
        createElement('div', {
          className: `theme-card ${currentTheme === 'dark' ? 'active' : ''}`,
          onclick: () => {
            ThemeManager.apply('dark', true);
            store.set('theme', 'dark');
            settingsPage.render(container);
          }
        }, [
          createElement('span', { style: { fontSize: '26px' }, textContent: '🌙' }),
          createElement('span', { style: { fontWeight: '700' }, textContent: 'Chủ đề Tối (Dark)' }),
          createElement('span', { style: { fontSize: '12px', color: 'var(--color-text-secondary)', textAlign: 'center' }, textContent: 'Dịu mắt khi làm việc ban đêm, làm nổi bật Hôm nay' })
        ])
      ])
    ]);

    // 2. Notification Settings Section (Có thông báo hay không & Thông báo trước bao nhiêu phút)
    const initialNotifyEnabled = user.notify_enabled !== undefined
      ? Boolean(user.notify_enabled)
      : (localStorage.getItem('planify_notify_enabled') !== 'false');
    const initialNotifyMinutes = user.notify_minutes_before !== undefined && user.notify_minutes_before !== null
      ? Number(user.notify_minutes_before)
      : (Number(localStorage.getItem('planify_notify_minutes_before')) || 15);

    const notifyToggleCheck = createElement('input', {
      type: 'checkbox',
      checked: initialNotifyEnabled,
      style: { width: '18px', height: '18px', accentColor: 'var(--color-primary)', cursor: 'pointer' }
    });

    const notifyMinutesInput = createElement('input', {
      type: 'number',
      className: 'input',
      min: 1,
      max: 1440,
      value: String(initialNotifyMinutes),
      style: { width: '110px', fontWeight: '700', textAlign: 'center' }
    });

    const presetMinsRow = createElement('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' } },
      [5, 10, 15, 30, 60].map(m => createElement('button', {
        type: 'button',
        className: `btn btn-secondary btn-xs ${Number(initialNotifyMinutes) === m ? 'active' : ''}`,
        textContent: `${m} phút`,
        onclick: () => {
          notifyMinutesInput.value = String(m);
          presetMinsRow.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        }
      }))
    );

    const saveNotifyBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-primary',
      textContent: '💾 Lưu cài đặt thông báo',
      onclick: async () => {
        const enabled = notifyToggleCheck.checked;
        const mins = Math.max(1, Math.min(1440, parseInt(notifyMinutesInput.value, 10) || 15));
        notifyMinutesInput.value = String(mins);

        localStorage.setItem('planify_notify_enabled', enabled ? 'true' : 'false');
        localStorage.setItem('planify_notify_minutes_before', String(mins));

        saveNotifyBtn.disabled = true;
        try {
          const updated = await api.put('/users/me', {
            notify_enabled: enabled,
            notify_minutes_before: mins
          });
          const updatedUser = updated?.data || updated;
          store.set('user', { ...user, ...updatedUser, notify_enabled: enabled, notify_minutes_before: mins });
          Toast.success(
            enabled
              ? `Đã bật thông báo nhắc lịch (Báo trước ${mins} phút qua Email & Trình duyệt)!`
              : 'Đã tắt thông báo nhắc lịch.'
          );
        } catch (err) {
          Toast.error(err.message || 'Không thể lưu cài đặt thông báo.');
        } finally {
          saveNotifyBtn.disabled = false;
        }
      }
    });

    const testNotifyBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-secondary',
      textContent: '📧 Gửi thử thông báo qua Email & Trình duyệt',
      onclick: async () => {
        testNotifyBtn.disabled = true;
        testNotifyBtn.textContent = 'Đang gửi email thử nghiệm...';
        try {
          ReminderNotifier.notify('🔔 Thông báo thử nghiệm Planify Pro', 'Hệ thống chuông báo & thông báo trình duyệt đang hoạt động tốt!');
          const res = await api.post('/users/me/test-reminder', {});
          Toast.success(res?.message || `Đã gửi email nhắc lịch thử nghiệm tới ${user.email}!`);
        } catch (err) {
          Toast.error(err.message || 'Lỗi khi gửi thông báo thử nghiệm.');
        } finally {
          testNotifyBtn.disabled = false;
          testNotifyBtn.textContent = '📧 Gửi thử thông báo qua Email & Trình duyệt';
        }
      }
    });

    const notificationSection = createElement('div', { className: 'settings-section' }, [
      createElement('h2', { className: 'settings-section-title', textContent: '🔔 Cài đặt Thông báo Lịch hẹn (Email & Trình duyệt)' }),
      createElement('label', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderRadius: '12px',
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-light)',
          cursor: 'pointer'
        }
      }, [
        createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } }, [
          createElement('span', { style: { fontWeight: '700', fontSize: '14px', color: 'var(--color-text-primary)' }, textContent: 'Bật nhận thông báo nhắc lịch khi tới giờ' }),
          createElement('span', { style: { fontSize: '12px', color: 'var(--color-text-secondary)' }, textContent: `Tự động gửi Email tới ${user.email || 'hộp thư của bạn'} và phát chuông báo trên trình duyệt` })
        ]),
        notifyToggleCheck
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: '⏰ Thông báo trước bao nhiêu phút?' }),
        createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } }, [
          notifyMinutesInput,
          createElement('span', { style: { fontSize: '13px', fontWeight: '600', color: 'var(--color-text-secondary)' }, textContent: 'phút trước giờ bắt đầu công việc / sự kiện' })
        ]),
        presetMinsRow
      ]),
      createElement('div', { className: 'flex gap-sm flex-wrap', style: { marginTop: '4px' } }, [
        saveNotifyBtn,
        testNotifyBtn
      ])
    ]);

    // 3. Profile Section
    const nicknameInput = createElement('input', {
      type: 'text',
      className: 'input',
      value: user.nickname || ''
    });

    const currentTimezone = user.timezone || 'Asia/Ho_Chi_Minh';
    const timezoneSelect = createElement('select', { className: 'select' }, [
      createElement('option', { value: 'Asia/Ho_Chi_Minh', textContent: 'Hà Nội, TP.HCM (GMT+7)', selected: currentTimezone === 'Asia/Ho_Chi_Minh' }),
      createElement('option', { value: 'Asia/Tokyo', textContent: 'Tokyo (GMT+9)', selected: currentTimezone === 'Asia/Tokyo' }),
      createElement('option', { value: 'UTC', textContent: 'Giờ phối hợp quốc tế (UTC)', selected: currentTimezone === 'UTC' })
    ]);
    timezoneSelect.value = currentTimezone;

    const saveProfileBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-primary',
      textContent: 'Lưu thay đổi',
      onclick: async () => {
        try {
          saveProfileBtn.disabled = true;
          const updated = await api.put('/users/me', {
            nickname: nicknameInput.value.trim(),
            timezone: timezoneSelect.value
          });
          const updatedUser = updated?.data || updated;
          store.set('user', updatedUser);
          if (updatedUser?.timezone) {
            timezoneSelect.value = updatedUser.timezone;
          }
          Toast.success('Cập nhật thông tin thành công!');
        } catch (err) {
          Toast.error(err.message || 'Lỗi cập nhật.');
        } finally {
          saveProfileBtn.disabled = false;
        }
      }
    });

    const accountSection = createElement('div', { className: 'settings-section' }, [
      createElement('h2', { className: 'settings-section-title', textContent: '👤 Thông tin cá nhân' }),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: 'Email' }),
        createElement('input', {
          type: 'text',
          className: 'input',
          value: user.email || '',
          disabled: true
        })
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: 'Tên hiển thị' }),
        nicknameInput
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: 'Múi giờ' }),
        timezoneSelect
      ]),
      createElement('div', { style: { marginTop: '4px' } }, [saveProfileBtn])
    ]);

    // 4. Export Backup Section (.ICS & .JSON)
    const exportSection = createElement('div', { className: 'settings-section' }, [
      createElement('h2', { className: 'settings-section-title', textContent: '📦 Sao lưu & Xuất dữ liệu (Google/Outlook .ICS & JSON)' }),
      createElement('div', { className: 'flex gap-sm flex-wrap' }, [
        createElement('button', {
          type: 'button',
          className: 'btn btn-secondary',
          textContent: '📅 Xuất Lịch chuẩn .ICS (iCalendar)',
          onclick: async () => {
            try {
              const [tasks, events] = await Promise.all([api.get('/tasks'), api.get('/events', {start:'0001-01-01T00:00:00Z', end:'9999-12-31T23:59:59Z'})]);
              const blob = new Blob([buildCalendarIcs(tasks, events)], { type: 'text/calendar;charset=utf-8' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'planify-calendar.ics';
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
              Toast.success('Đã xuất file lịch planify-calendar.ics!');
            } catch (err) {
              Toast.error('Không thể xuất file .ics');
            }
          }
        }),
        createElement('button', {
          type: 'button',
          className: 'btn btn-secondary',
          textContent: '📋 Xuất Toàn bộ Công việc & Sự kiện (.JSON)',
          onclick: async () => {
            try {
              const [tasks, events] = await Promise.all([api.get('/tasks'), api.get('/events', {start:'0001-01-01T00:00:00Z', end:'9999-12-31T23:59:59Z'})]);
              const blob = new Blob([JSON.stringify({timezone:'Asia/Ho_Chi_Minh', tasks, events}, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'planify-tasks.json';
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
              Toast.success('Đã tải về file planify-tasks.json!');
            } catch (err) {
              Toast.error('Không thể xuất danh sách công việc');
            }
          }
        })
      ])
    ]);

    // 5. Security Section (Password Change)
    const currentPassInput = createElement('input', { type: 'password', className: 'input', placeholder: '••••••••' });
    const newPassInput = createElement('input', { type: 'password', className: 'input', placeholder: '••••••••' });
    const changePassBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-secondary',
      textContent: 'Đổi mật khẩu',
      onclick: async () => {
        if (!currentPassInput.value || !newPassInput.value) {
          Toast.error('Vui lòng điền đủ mật khẩu cũ và mới.');
          return;
        }
        if (newPassInput.value.length < 8 || new TextEncoder().encode(newPassInput.value).length > 72) {
          Toast.error('Mật khẩu mới phải có ít nhất 8 ký tự và không quá 72 bytes UTF-8.');
          return;
        }
        try {
          changePassBtn.disabled = true;
          await api.put('/users/me/password', {
            current_password: currentPassInput.value,
            new_password: newPassInput.value
          });
          Toast.success('Đổi mật khẩu thành công!');
          currentPassInput.value = '';
          newPassInput.value = '';
        } catch (err) {
          Toast.error(err.message || 'Mật khẩu cũ không chính xác.');
        } finally {
          changePassBtn.disabled = false;
        }
      }
    });

    const securitySection = createElement('div', { className: 'settings-section' }, [
      createElement('h2', { className: 'settings-section-title', textContent: '🔒 Bảo mật & Mật khẩu' }),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: 'Mật khẩu hiện tại' }),
        currentPassInput
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: 'Mật khẩu mới' }),
        newPassInput
      ]),
      createElement('div', { style: { marginTop: '4px' } }, [changePassBtn])
    ]);

    // 6. Logout Section
    const logoutSection = createElement('div', { className: 'settings-section' }, [
      createElement('h2', { className: 'settings-section-title', textContent: '🚪 Phiên làm việc' }),
      createElement('div', {}, [
        createElement('button', {
          type: 'button',
          className: 'btn btn-danger',
          textContent: 'Đăng xuất khỏi thiết bị này',
          onclick: () => {
            AuthManager.logout();
            Toast.info('Đã đăng xuất.');
          }
        })
      ])
    ]);

    inner.appendChild(themeSection);
    inner.appendChild(notificationSection);
    inner.appendChild(accountSection);
    inner.appendChild(exportSection);
    inner.appendChild(securitySection);
    inner.appendChild(logoutSection);
    page.appendChild(inner);
    container.appendChild(page);
  },

  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
};
