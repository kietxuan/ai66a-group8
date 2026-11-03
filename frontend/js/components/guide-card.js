import { createElement } from '../utils/dom.js';

export class GuideCard {
  static STORAGE_KEY = 'planify_calendar_guide_collapsed';

  constructor({ onToggle = null } = {}) {
    this.onToggle = onToggle;
    this.isCollapsed = localStorage.getItem(GuideCard.STORAGE_KEY) === 'true';
    this.element = null;
  }

  toggle() {
    this.isCollapsed = !this.isCollapsed;
    localStorage.setItem(GuideCard.STORAGE_KEY, this.isCollapsed ? 'true' : 'false');
    this.updateDisplay();
    if (this.onToggle) this.onToggle(this.isCollapsed);
  }

  updateDisplay() {
    if (!this.element) return;
    const body = this.element.querySelector('.guide-card-body');
    const toggleBtn = this.element.querySelector('.guide-card-toggle-btn');
    if (body) {
      body.style.display = this.isCollapsed ? 'none' : 'grid';
    }
    if (toggleBtn) {
      toggleBtn.textContent = this.isCollapsed ? 'Mở rộng ▼' : 'Thu gọn ▲';
    }
  }

  render() {
    const card = createElement('div', { className: 'guide-card' });

    // Header
    const header = createElement('div', {
      className: 'guide-card-header',
      onclick: (e) => {
        if (!e.target.closest('.guide-card-close-btn')) {
          this.toggle();
        }
      }
    }, [
      createElement('div', { className: 'guide-card-title' }, [
        createElement('span', { textContent: '💡' }),
        createElement('span', { textContent: 'Hướng dẫn thao tác nhanh trên Lịch biểu & Việc cần làm' })
      ]),
      createElement('div', { className: 'guide-card-actions' }, [
        createElement('button', {
          className: 'guide-card-toggle-btn',
          textContent: this.isCollapsed ? 'Mở rộng ▼' : 'Thu gọn ▲',
          onclick: (e) => {
            e.stopPropagation();
            this.toggle();
          }
        }),
        createElement('button', {
          className: 'btn-icon guide-card-close-btn',
          style: { width: '20px', height: '20px', fontSize: '13px' },
          innerHTML: '&times;',
          title: 'Đóng thẻ hướng dẫn',
          onclick: (e) => {
            e.stopPropagation();
            this.isCollapsed = true;
            localStorage.setItem(GuideCard.STORAGE_KEY, 'true');
            this.updateDisplay();
          }
        })
      ])
    ]);

    // Body (3 columns)
    const body = createElement('div', {
      className: 'guide-card-body',
      style: { display: this.isCollapsed ? 'none' : 'grid' }
    }, [
      // Col 1: Mouse actions
      createElement('div', { className: 'guide-col' }, [
        createElement('div', { className: 'guide-col-title', textContent: '🖱️ Tạo & Chỉnh sửa Nhanh' }),
        createElement('ul', {}, [
          createElement('li', { textContent: 'Click ô giờ trống: Tạo nhanh Sự kiện hoặc Việc cần làm (Time-Block).' }),
          createElement('li', { textContent: 'Click vào thẻ: Xem chi tiết đầy đủ, chỉnh sửa nội dung hoặc xóa.' }),
          createElement('li', { textContent: 'Tick ô vuông ☐ trên lịch: Đánh dấu hoàn thành việc cần làm ngay lập tức.' })
        ])
      ]),

      // Col 2: Drag & Drop
      createElement('div', { className: 'guide-col' }, [
        createElement('div', { className: 'guide-col-title', textContent: '✋ Kéo thả & Thời lượng' }),
        createElement('ul', {}, [
          createElement('li', { textContent: 'Kéo thẻ di chuyển: Thay đổi khung giờ làm việc hoặc chuyển sang ngày khác.' }),
          createElement('li', { textContent: 'Kéo cạnh dưới: Tăng hoặc giảm thời lượng công việc trực tiếp.' }),
          createElement('li', { textContent: 'Công việc lặp lại: Tự động hiển thị qua mọi tuần/tháng theo chu kỳ.' })
        ])
      ]),

      // Col 3: Time-blocking
      createElement('div', { className: 'guide-col' }, [
        createElement('div', { className: 'guide-col-title', textContent: '📌 Quản lý & Khung giờ' }),
        createElement('ul', {}, [
          createElement('li', { textContent: 'Chuyển đổi linh hoạt giữa các chế độ xem Lịch Tháng, Tuần, Ngày và Lịch trình.' }),
          createElement('li', { textContent: 'Nút "Hôm nay" giúp bạn lập tức quay trở lại ngày hiện tại trên Lịch biểu.' }),
          createElement('li', { textContent: 'Việc cần làm có cài đặt Giờ sẽ xuất hiện trực tiếp trên khung giờ lịch biểu.' })
        ])
      ])
    ]);

    card.appendChild(header);
    card.appendChild(body);
    this.element = card;
    return card;
  }
}

