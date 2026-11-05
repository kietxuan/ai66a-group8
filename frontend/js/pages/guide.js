import { createElement } from '../utils/dom.js';

export const guidePage = {
  container: null,
  activeTab: localStorage.getItem('planify_guide_tab') || 'overview',

  render(container) {
    this.container = container;
    const saved = localStorage.getItem('planify_guide_tab') || 'overview';
    this.activeTab = ['overview', 'todo', 'mouse', 'calendar', 'ai'].includes(saved) ? saved : 'overview';
    this.updateView();
  },

  updateView() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const page = createElement('div', { className: 'guide-page' });

    const hero = createElement('section', { className: 'guide-hero' }, [
      createElement('div', {}, [
        createElement('h1', { className: 'guide-hero-title', textContent: 'Hướng dẫn sử dụng' }),
        createElement('p', {
          className: 'guide-hero-desc',
          textContent: 'Chọn một mục để xem cách quản lý công việc, lịch biểu và sử dụng trợ lý AI.'
        })
      ]),
      createElement('div', { className: 'flex gap-sm' }, [
        createElement('a', { href: '#todo', className: 'btn-dash-white', textContent: '📋 Mở Bảng Kanban' }),
        createElement('a', { href: '#calendar', className: 'btn-dash-glass', textContent: '📅 Mở Lịch Tháng' })
      ])
    ]);

    const tabs = [
      { id: 'overview', icon: '🚀', label: 'Tổng quan' },
      { id: 'todo', icon: '📋', label: 'Công việc' },
      { id: 'mouse', icon: '🖱️', label: 'Thao tác' },
      { id: 'calendar', icon: '📅', label: 'Lịch' },
      { id: 'ai', icon: '🤖', label: 'Trợ lý AI' }
    ];

    const tabsBar = createElement('div', { className: 'guide-tabs-bar' },
      tabs.map(t => createElement('button', {
        type: 'button',
        className: `guide-tab-btn ${this.activeTab === t.id ? 'active' : ''}`,
        textContent: `${t.icon} ${t.label}`,
        onclick: () => {
          this.activeTab = t.id;
          try { localStorage.setItem('planify_guide_tab', t.id); } catch (_) {}
          this.updateView();
        }
      }))
    );

    page.appendChild(hero);
    page.appendChild(tabsBar);
    page.appendChild(this.renderTabContent(this.activeTab));

    this.container.appendChild(page);
  },

  renderTabContent(tabId) {
    if (tabId === 'todo') {
      return this.buildCardsGrid([
        {
          badge: '📋 Bảng Quản Lý Chung (Kanban 4 Cột)', bg: '#EEF2FF', color: '#4F46E5',
          title: 'Cách hoạt động của 4 cột: Cần làm • Hôm nay • Quá hạn • Hoàn thành',
          steps: [
            '📌 Cột Cần làm: Chứa các việc chưa đặt thời gian (vĩnh viễn) và các việc/sự kiện sẽ làm trong tương lai (ngày > hôm nay).',
            '☀️ Cột Hôm nay: Tự động chứa toàn bộ công việc và sự kiện diễn ra trong ngày hôm nay.',
            '⚠️ Cột Quá hạn: Chứa các công việc chưa hoàn thành mà đã qua ngày hạn hoặc qua giờ kết thúc.',
            '✅ Cột Hoàn thành: Chứa các việc bạn đã tích hoàn thành HOẶC các Sự kiện tự động hoàn thành sau khi hết thời gian.',
            '⭐ Quan trọng: Hiển thị trực tiếp ngôi sao vàng ⭐ ngay trên thẻ công việc thay vì tách cột riêng. Mọi cột đều tự động sắp xếp theo thời gian!'
          ]
        },
        {
          badge: '📁 Danh sách của tôi', bg: '#ECFDF5', color: '#10B981',
          title: 'Quản lý theo Danh sách Cá nhân & Mục Đã hoàn thành',
          steps: [
            'Khi bấm vào bất kỳ danh sách nào trong phần "DANH SÁCH CỦA TÔI" ở cột bên trái, giao diện sẽ hiển thị dạng Danh sách chuẩn sắp xếp theo thời gian.',
            'Các công việc đã xong sẽ được gom gọn vào thanh xổ xuống "▼ Đã hoàn thành (X)" ở cuối danh sách.',
            'Bấm lại lần thứ 2 vào cùng một công việc đang mở sẽ tự động đóng cửa sổ chi tiết bên phải.'
          ]
        }
      ]);
    }

    if (tabId === 'mouse') {
      return this.buildCardsGrid([
        {
          badge: '🖱️ Cách dùng Chuột Phải (Right-Click)', bg: '#FDF2F8', color: '#EC4899',
          title: 'Bấm Chuột Phải (hoặc nút ⋮) vào bất kỳ Thẻ Việc / Sự kiện nào',
          steps: [
            'Đưa con trỏ chuột vào bất kỳ thẻ công việc nào (trong To Do Kanban, Danh sách, hoặc trên Lịch) rồi nhấn nút CHUỘT PHẢI (hoặc bấm chuột trái vào biểu tượng ⋮ ở góc phải thẻ).',
            'Một Menu Ngữ Cảnh nổi bật sẽ hiện ra ngay lập tức cho phép bạn: (1) Mở Form chỉnh sửa đầy đủ, (2) Đánh dấu Sao Quan trọng ⭐, (3) Chuyển đổi giữa Phải tích thủ công và ⚡ Sự kiện tự động hoàn thành.',
            'Ngoài ra trong menu chuột phải, bạn có thể chuyển nhanh thẻ vào cột Hôm nay, dời sang Ngày mai, bỏ thời gian (đặt Vĩnh viễn về cột Cần làm), hoặc Xóa.'
          ]
        },
        {
          badge: '✋ Kéo Thả Chuột Trái', bg: '#ECFDF5', color: '#10B981',
          title: 'Kéo Thả Giữa Các Cột Kanban & Kéo Việc Vĩnh Viễn Vào Lịch',
          steps: [
            'Trong Bảng quản lý chung: Nhấn giữ chuột trái vào thẻ công việc và kéo sang cột "☀️ Hôm nay" (tự gán ngày hôm nay), kéo sang "📌 Cần làm" (đặt lại vĩnh viễn), hoặc kéo sang "✅ Hoàn thành".',
            'Trong trang Calendar: Ở cột bên trái có khay "📌 Việc chưa xếp lịch (Kéo vào Lịch)" chứa các việc không đặt thời gian. Bạn chỉ cần kéo thả thẻ từ khay này vào bất kỳ ô ngày/giờ nào trên Lịch!',
            'Trên Lịch Ngày/Tuần: Quét giữ chuột trái trên các ô giờ trống để tạo mới, hoặc kéo cạnh dưới của thẻ để thay đổi thời lượng.'
          ]
        }
      ]);
    }

    if (tabId === 'calendar') {
      return this.buildCardsGrid([
        {
          badge: '📅 Mặc định Lịch Tháng', bg: '#EEF2FF', color: '#4F46E5',
          title: 'Chế độ Lịch Tháng Mặc định & Nổi bật Ngày Hôm Nay',
          steps: [
            'Khi mở trang Calendar, hệ thống mặc định hiển thị Lịch Tháng (Month View) và ghi nhớ chế độ xem kể cả khi bạn nhấn F5 tải lại trang.',
            'Toàn bộ các tuần trong tháng được bố trí trực quan, vừa vặn không gian màn hình giúp bạn quan sát tổng thể toàn bộ tháng dễ dàng.',
            'Ô ngày HÔM NAY (và cột Hôm nay trong Lịch Tuần) được nhận diện bằng màu nhấn và nền nhẹ trong cả chế độ Sáng (Light Mode) và Tối (Dark Mode).'
          ]
        },
        {
          badge: '⚡ Đồng bộ Công Việc & Calendar', bg: '#FFFBEB', color: '#F59E0B',
          title: 'Thống nhất Biểu mẫu Đầy đủ cho Công việc và Calendar',
          steps: [
            'Mọi nút "+ Tạo mới" hay bấm vào ô lịch đều mở cùng một Biểu mẫu công việc với đầy đủ trường thông tin.',
            'Mặc định khi tạo mới từ Công việc, phần thời gian có thể để trống (nằm gọn ở cột Cần làm và có thể xếp lịch bất cứ khi nào bạn muốn).',
            'Khi đặt hạn chót hoặc khung giờ, công việc sẽ tự động đồng bộ và hiển thị trực tiếp trên Lịch biểu.'
          ]
        }
      ]);
    }

    if (tabId === 'ai') {
      const samplePrompts = [
        { label: '📅 Kiểm tra toàn bộ công việc trong cột Hôm nay', prompt: 'Hôm nay tôi có những công việc gì?' },
        { label: '🕒 Tìm các khung giờ còn trống trong hôm nay để xếp việc', prompt: 'Tìm khung giờ trống 60 phút hôm nay' },
        { label: '⚡ Tạo công việc có giờ bắt đầu & kết thúc hôm nay', prompt: "Hãy tạo cho tôi một công việc 'Họp nhóm dự án' bắt đầu từ 14:00 đến 15:30 hôm nay" },
        { label: '📌 Tạo việc cần làm quan trọng', prompt: "Tạo việc cần làm 'Hoàn thiện báo cáo tổng kết' hạn hôm nay và đánh dấu quan trọng" },
        { label: '⚠️ Dời toàn bộ các công việc bị quá hạn sang hôm nay', prompt: 'Dời toàn bộ việc quá hạn sang hôm nay' },
        { label: '📊 Xem báo cáo phân tích năng suất & tiến độ công việc', prompt: 'Xem báo cáo thống kê năng suất của tôi' }
      ];

      return createElement('div', { className: 'dash-panel-card' }, [
        createElement('h3', { className: 'dash-panel-title', textContent: '🤖 Thực hành Giao tiếp với AI Agent & Thông báo Email tự động' }),
        createElement('p', { className: 'dash-panel-subtitle', textContent: 'Click vào bất kỳ kịch bản nào bên dưới để gửi lệnh ngay cho AI Agent, hoặc vào mục Cài đặt (⚙️) để tùy chỉnh gửi Email nhắc lịch trước X phút.' }),
        createElement('div', { className: 'flex flex-col gap-sm', style: { marginTop: '8px' } },
          samplePrompts.map(item => createElement('div', {
            className: 'guide-prompt-card',
            onclick: () => {
              sessionStorage.setItem('planify_ai_pending_prompt', item.prompt);
              window.location.hash = '#ai';
            }
          }, [
            createElement('div', { className: 'flex flex-col gap-2xs' }, [
              createElement('span', { style: { fontWeight: '600', color: 'var(--color-text-primary)' }, textContent: item.label }),
              createElement('span', { style: { fontSize: '12px', color: 'var(--color-text-secondary)' }, textContent: `Câu lệnh: "${item.prompt}"` })
            ]),
            createElement('span', { className: 'btn btn-primary btn-sm', textContent: 'Thử ngay →' })
          ]))
        )
      ]);
    }

    return this.buildCardsGrid([
      {
        badge: '✨ Quản Lý Công Việc Toàn Diện', bg: '#EEF2FF', color: '#4F46E5',
        title: 'Biểu mẫu Công Việc Chi tiết & Linh hoạt',
        steps: [
          'Quản lý công việc dễ dàng với biểu mẫu chi tiết đầy đủ thông tin: danh sách, đánh dấu quan trọng, ngày giờ và ghi chú.',
          'Mặc định công việc được hoàn thành khi bạn tích chọn ô đánh dấu hoàn thành.',
          'Mặc định khi tạo mới có thể không cần đặt thời gian để nằm gọn trong cột Cần làm và có thể xếp lịch bất cứ lúc nào.'
        ]
      },
      {
        badge: '📋 Bảng Quản Lý Chung 4 Cột', bg: '#ECFDF5', color: '#10B981',
        title: 'Kanban 4 Cột Tự động Sắp xếp theo Thời gian',
        steps: [
          '📌 Cần làm: Việc không đặt giờ hoặc việc cần làm trong tương lai.',
          '☀️ Hôm nay: Toàn bộ công việc diễn ra trong ngày hôm nay.',
          '⚠️ Quá hạn: Việc chưa hoàn thành và đã qua thời gian hạn.',
          '✅ Hoàn thành: Công việc đã tích chọn hoàn thành.'
        ]
      },
      {
        badge: '🔔 Xác thực OTP & Nhắc lịch Email', bg: '#FFFBEB', color: '#F59E0B',
        title: 'OTP Đăng ký, Quên mật khẩu & Thông báo Lịch hẹn',
        steps: [
          'Hỗ trợ gửi mã OTP 6 chữ số qua Email khi Đăng ký tài khoản mới và khi Quên mật khẩu.',
          'Trong trang Cài đặt (⚙️), bạn có thể bật/tắt thông báo nhắc lịch và tùy chỉnh báo trước bao nhiêu phút qua cả Email và Trình duyệt.'
        ]
      },
      {
        badge: '📅 Lịch Tháng Trực Quan & Lưu Trạng Thái F5', bg: '#F5F3FF', color: '#7C3AED',
        title: 'Mặc định Lịch Tháng, Làm nổi bật Hôm nay & Nhớ vị trí khi F5',
        steps: [
          'Trang Calendar mặc định mở Lịch Tháng trực quan, vừa vặn không gian màn hình và làm nổi bật rõ nét ô/cột HÔM NAY trong cả chế độ Dark Mode.',
          'Mọi lựa chọn của bạn (trang đang mở, danh sách đang xem, chế độ lịch, giao diện Sáng/Tối) đều được lưu bền vững khi nhấn F5 Refresh.'
        ]
      }
    ]);
  },

  buildCardsGrid(cards) {
    return createElement('div', { className: 'guide-section-grid' },
      cards.map(c => createElement('div', { className: 'guide-feature-box' }, [
        createElement('span', { className: 'guide-box-badge', textContent: c.badge }),
        createElement('h3', { className: 'guide-box-title', textContent: c.title }),
        createElement('div', { className: 'guide-step-list' },
          c.steps.map(s => createElement('div', { className: 'guide-step-item' }, [
            createElement('span', { className: 'guide-step-bullet', textContent: '✓' }),
            createElement('span', { textContent: s })
          ]))
        )
      ]))
    );
  },

  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
};
