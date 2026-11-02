import { createElement } from '../utils/dom.js';
import { ThemeManager } from '../theme.js';
import { AuthManager } from '../auth.js';

export const landingPage = {
  container: null,

  async render(container) {
    this.container = container;
    container.innerHTML = '';

    const isAuth = AuthManager.isAuthenticated();
    const page = createElement('div', { className: 'landing-container' });

    // 1. NAVBAR with Login & Register buttons
    const navbar = createElement('header', { className: 'landing-navbar' }, [
      createElement('a', { href: '#landing', className: 'landing-logo' }, [
        createElement('span', { style: { fontSize: '26px' }, textContent: '✨' }),
        createElement('span', { className: 'landing-logo-gradient', textContent: 'Planify Pro' })
      ]),
      createElement('nav', { className: 'landing-nav-links' }, [
        createElement('a', { href: '#features', className: 'landing-nav-link', textContent: 'Tính năng' }),
        createElement('a', { href: '#calendar-feature', className: 'landing-nav-link', textContent: 'Google & Outlook Calendar' }),
        createElement('a', { href: '#todo-feature', className: 'landing-nav-link', textContent: 'Microsoft To Do' }),
        createElement('a', { href: '#ai-feature', className: 'landing-nav-link', textContent: 'AI Agent 32 Tools' })
      ]),
      createElement('div', { className: 'landing-nav-actions' }, [
        createElement('button', {
          className: 'btn-icon',
          title: 'Đổi giao diện Sáng / Tối',
          textContent: '🌓',
          onclick: () => ThemeManager.toggle()
        }),
        isAuth
          ? createElement('a', { href: '#dashboard', className: 'btn btn-primary', textContent: 'Vào Dashboard →' })
          : createElement('div', { className: 'flex items-center gap-sm' }, [
              createElement('a', { href: '#login', className: 'btn btn-secondary', id: 'landing-btn-login', textContent: 'Đăng nhập' }),
              createElement('a', { href: '#register', className: 'btn btn-primary', id: 'landing-btn-register', textContent: 'Đăng ký miễn phí' })
            ])
      ])
    ]);

    // 2. HERO SECTION
    const hero = createElement('section', { className: 'landing-hero' }, [
      createElement('div', { className: 'landing-badge' }, [
        createElement('span', { textContent: '🚀' }),
        createElement('span', { textContent: 'Hợp nhất Google Calendar + Outlook Calendar + Microsoft To Do + AI Agent' })
      ]),
      createElement('h1', { className: 'landing-title' }, [
        createElement('span', { textContent: 'Nền tảng Quản lý ' }),
        createElement('span', { className: 'landing-title-highlight', textContent: 'Công việc & Lịch trình' }),
        createElement('span', { textContent: ' Thông minh Toàn diện' })
      ]),
      createElement('p', {
        className: 'landing-subtitle',
        textContent: 'Trực quan hơn, mượt mà hơn với thao tác quét chuột trái tạo lịch, kéo thả Time-Blocking giữa To Do và Calendar, bảng thống kê Dashboard chuyên sâu và Trợ lý AI tự động hóa mọi tác vụ.'
      }),
      createElement('div', { className: 'landing-cta-group' }, [
        isAuth
          ? createElement('a', { href: '#dashboard', className: 'btn-hero-primary', textContent: 'Mở Bảng điều khiển Dashboard 📊' })
          : createElement('a', { href: '#register', className: 'btn-hero-primary', textContent: 'Đăng ký Tài khoản Miễn phí 🚀' }),
        createElement('a', { href: isAuth ? '#calendar' : '#login', className: 'btn-hero-secondary', textContent: isAuth ? 'Mở Lịch biểu 📅' : 'Đăng nhập Ngay →' })
      ]),

      // Live Interactive-Looking Preview Card
      createElement('div', { className: 'landing-preview' }, [
        createElement('div', { className: 'landing-preview-header' }, [
          createElement('span', { className: 'preview-dot', style: { backgroundColor: '#EF4444' } }),
          createElement('span', { className: 'preview-dot', style: { backgroundColor: '#F59E0B' } }),
          createElement('span', { className: 'preview-dot', style: { backgroundColor: '#10B981' } }),
          createElement('span', {
            style: { marginLeft: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--color-text-secondary)' },
            textContent: 'Planify Pro — 5 Phân hệ: Dashboard • To Do • Calendar • AI Assistant • Hướng dẫn'
          })
        ]),
        createElement('div', { className: 'preview-body' }, [
          // Sidebar mock showing 5 tabs
          createElement('div', { className: 'preview-sidebar' }, [
            createElement('div', { style: { fontSize: '11px', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '6px' }, textContent: '5 THẺ ĐIỀU HƯỚNG CHÍNH' }),
            createElement('div', { style: { padding: '8px 10px', borderRadius: '8px', backgroundColor: 'var(--color-bg-selected)', color: 'var(--color-accent)', fontWeight: '700', fontSize: '13px' }, textContent: '📊 1. Dashboard (Thống kê)' }),
            createElement('div', { style: { padding: '8px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: '600' }, textContent: '✅ 2. To Do (Công việc)' }),
            createElement('div', { style: { padding: '8px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: '600' }, textContent: '📅 3. Calendar (Lịch biểu)' }),
            createElement('div', { style: { padding: '8px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: '600' }, textContent: '🤖 4. AI Assistant (32 Tools)' }),
            createElement('div', { style: { padding: '8px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: '600' }, textContent: '📖 5. Hướng dẫn sử dụng' })
          ]),

          // Center mock
          createElement('div', { className: 'preview-main' }, [
            createElement('div', { className: 'flex items-center justify-between', style: { paddingBottom: '8px', borderBottom: '1px solid var(--color-border-light)' } }, [
              createElement('span', { style: { fontWeight: '700', fontSize: '14px' }, textContent: '📊 Thống kê Năng suất & Lịch trình Hôm nay' }),
              createElement('span', { style: { fontSize: '11px', padding: '2px 8px', borderRadius: '99px', backgroundColor: '#EEF2FF', color: '#4F46E5', fontWeight: '700' }, textContent: 'Điểm năng suất: 94/100' })
            ]),
            createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' } }, [
              createElement('div', { style: { padding: '10px', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' } }, [
                createElement('div', { style: { fontSize: '18px', fontWeight: '800', color: '#4F46E5' }, textContent: '88%' }),
                createElement('div', { style: { fontSize: '11px', color: 'var(--color-text-secondary)' }, textContent: 'Tỷ lệ hoàn thành' })
              ]),
              createElement('div', { style: { padding: '10px', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' } }, [
                createElement('div', { style: { fontSize: '18px', fontWeight: '800', color: '#10B981' }, textContent: '6 việc' }),
                createElement('div', { style: { fontSize: '11px', color: 'var(--color-text-secondary)' }, textContent: 'Ngày của tôi (My Day)' })
              ]),
              createElement('div', { style: { padding: '10px', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' } }, [
                createElement('div', { style: { fontSize: '18px', fontWeight: '800', color: '#F59E0B' }, textContent: '4.5h' }),
                createElement('div', { style: { fontSize: '11px', color: 'var(--color-text-secondary)' }, textContent: 'Khung giờ Time-Block' })
              ])
            ]),
            createElement('div', { className: 'flex flex-col gap-xs' }, [
              createElement('div', {
                style: { padding: '9px 12px', borderRadius: '8px', backgroundColor: '#4F46E5', color: '#fff', fontSize: '12px', fontWeight: '600' },
                textContent: '📅 09:00 - 10:30: Họp chiến lược sản phẩm Q4 (Google Meet • Lặp hàng tuần)'
              }),
              createElement('div', {
                style: { padding: '9px 12px', borderRadius: '8px', backgroundColor: '#10B981', color: '#fff', fontSize: '12px', fontWeight: '600' },
                textContent: '☑️ 14:00 - 15:30: [Time-Blocking] Hoàn thiện thiết kế UI/UX & Kiểm thử'
              })
            ])
          ]),

          // Right AI mock
          createElement('div', { className: 'preview-ai' }, [
            createElement('div', { style: { fontWeight: '700', fontSize: '13px' }, textContent: '🤖 AI Agent Thông minh' }),
            createElement('div', { style: { padding: '10px', borderRadius: '8px', backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', fontSize: '12px' }, textContent: '"Tự động xếp lịch các việc quan trọng vào giờ trống hôm nay giúp tôi"' }),
            createElement('div', { style: { padding: '10px', borderRadius: '8px', backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)', fontSize: '12px', fontWeight: '600' }, textContent: '⚙️ Đã gọi: auto_plan_my_day & find_free_slots → Đã xếp 4 việc vào lịch hôm nay!' })
          ])
        ])
      ])
    ]);

    // 3. FEATURES SECTION
    const features = createElement('section', { className: 'landing-features', id: 'features' }, [
      createElement('div', { className: 'features-header' }, [
        createElement('h2', { className: 'features-title', textContent: 'Thiết Kế Tinh Gọn — Đầy Đủ Mọi Tính Năng Cao Cấp' }),
        createElement('p', { style: { color: 'var(--color-text-secondary)' }, textContent: 'Mượt mà trên cả Máy tính và Điện thoại di động với hệ thống thao tác chuột trái/phải trực quan.' })
      ]),
      createElement('div', { className: 'features-grid' }, [
        createElement('div', { className: 'feature-card', id: 'calendar-feature' }, [
          createElement('div', { className: 'feature-icon-wrapper', style: { backgroundColor: '#EEF2FF', color: '#4F46E5' }, textContent: '📅' }),
          createElement('h3', { className: 'feature-title', textContent: 'Google & Outlook Calendar Pro' }),
          createElement('p', { className: 'feature-desc', textContent: '5 chế độ xem (Ngày, Tuần làm việc 5 ngày, Tuần 7 ngày, Tháng, Lịch biểu). Quét giữ chuột trái trên lưới giờ để tạo sự kiện, kéo thả đổi giờ, kéo cạnh dưới chỉnh thời lượng và xuất file .ics.' })
        ]),
        createElement('div', { className: 'feature-card', id: 'todo-feature' }, [
          createElement('div', { className: 'feature-icon-wrapper', style: { backgroundColor: '#ECFDF5', color: '#10B981' }, textContent: '✅' }),
          createElement('h3', { className: 'feature-title', textContent: 'Microsoft To Do + Kanban + Pomodoro' }),
          createElement('p', { className: 'feature-desc', textContent: 'Danh sách thông minh (My Day, Quan trọng, Đã lên lịch, Quá hạn), chuyển đổi linh hoạt giữa Danh sách và Bảng Kanban, kéo thả việc vào lịch, thao tác hàng loạt và đồng hồ Pomodoro 25 phút.' })
        ]),
        createElement('div', { className: 'feature-card', id: 'ai-feature' }, [
          createElement('div', { className: 'feature-icon-wrapper', style: { backgroundColor: '#F5F3FF', color: '#7C3AED' }, textContent: '🤖' }),
          createElement('h3', { className: 'feature-title', textContent: 'AI Agent 32 Tools Toàn Năng' }),
          createElement('p', { className: 'feature-desc', textContent: 'Tự động lập kế hoạch My Day, tìm khung giờ trống, kiểm tra trùng lịch, dời toàn bộ việc quá hạn, quản lý bước con (subtasks), danh sách và báo cáo năng suất (bảo vệ an toàn tuyệt đối các tác vụ bảo mật).' })
        ])
      ])
    ]);

    // 4. FOOTER
    const footer = createElement('footer', { className: 'landing-footer' }, [
      createElement('div', {}, [
        createElement('span', { style: { fontWeight: '700' }, textContent: 'Planify Pro' }),
        createElement('span', { textContent: ' — Hệ sinh thái Quản lý Thời gian, Công việc & AI © 2026' })
      ]),
      createElement('div', { className: 'flex items-center gap-md' }, [
        createElement('a', { href: '#login', className: 'landing-nav-link', textContent: 'Đăng nhập' }),
        createElement('a', { href: '#register', className: 'landing-nav-link', textContent: 'Đăng ký' })
      ])
    ]);

    page.appendChild(navbar);
    page.appendChild(hero);
    page.appendChild(features);
    page.appendChild(footer);

    container.appendChild(page);
  },

  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
};
