import { businessNow } from '../utils/date.js';
import { overlapsDay } from '../utils/date.js';
import { recurrenceContext } from './rrule.js';
import { createElement } from '../utils/dom.js';
import { getMonthMatrix, isToday, isSameDay, formatDate, toLocalISOString } from '../utils/date.js';
import { EventCard } from './event-card.js';
import { EventForm } from './event-form.js';
import { api } from '../api.js';
import { Toast } from '../components/toast.js';

export class MonthView {
  constructor(container, {
    date = businessNow(),
    events = [],
    tasks = [],
    defaultCalendarId = null,
    onNavigateMonth = null,
    onRefresh = null
  } = {}) {
    this.container = container;
    this.date = new Date(date);
    this.events = events;
    this.tasks = tasks;
    this.defaultCalendarId = defaultCalendarId;
    this.onNavigateMonth = onNavigateMonth;
    this.onRefresh = onRefresh;
    this.wheelCooldown = false;
  }

  render() {
    this.container.innerHTML = '';

    const year = this.date.getFullYear();
    const month = this.date.getMonth();
    const matrix = getMonthMatrix(year, month);

    const monthWrapper = createElement('div', {
      className: 'month-view-wrapper',
      style: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }
    });

    const todayWeekdayIdx = (businessNow().getDay() + 6) % 7; // 0 = Thứ Hai ... 6 = Chủ Nhật
    const isCurrentMonthYear = (businessNow().getFullYear() === year && businessNow().getMonth() === month);
    const weekdayLabels = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

    const weekdaysHeader = createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-bg-secondary)',
        textAlign: 'center',
        padding: '10px 0',
        fontWeight: '700',
        fontSize: '12.5px',
        color: 'var(--color-text-secondary)',
        flexShrink: '0'
      }
    }, weekdayLabels.map((label, idx) => {
      const isTodayCol = isCurrentMonthYear && idx === todayWeekdayIdx;
      return createElement('span', {
        style: isTodayCol ? {
          color: '#6366F1',
          fontWeight: '800',
          textDecoration: 'underline',
          textUnderlineOffset: '4px'
        } : {},
        textContent: isTodayCol ? `📍 ${label}` : label
      });
    }));

    // Lịch Tháng hỗ trợ cuộn dọc mượt mà (overflow-y: auto) + lăn chuột chuyển tháng khi ở đầu/cuối bảng
    const monthGrid = createElement('div', {
      className: 'month-grid-scrollable',
      style: {
        flex: '1',
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gridAutoRows: 'minmax(132px, 1fr)',
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollBehavior: 'smooth'
      }
    });

    // Hỗ trợ lăn con lăn chuột (wheel) để cuộn nội dung tháng và chuyển tháng mượt mà khi cuộn kịch biên
    monthGrid.addEventListener('wheel', (e) => {
      if (this.wheelCooldown || !this.onNavigateMonth) return;
      const atTop = monthGrid.scrollTop <= 0;
      const atBottom = Math.ceil(monthGrid.scrollTop + monthGrid.clientHeight) >= monthGrid.scrollHeight - 2;

      if (e.deltaY > 45 && atBottom) {
        this.wheelCooldown = true;
        this.onNavigateMonth(1);
        setTimeout(() => { this.wheelCooldown = false; }, 420);
      } else if (e.deltaY < -45 && atTop) {
        this.wheelCooldown = true;
        this.onNavigateMonth(-1);
        setTimeout(() => { this.wheelCooldown = false; }, 420);
      }
    }, { passive: true });

    matrix.forEach(week => {
      week.forEach(cell => {
        const isTod = isToday(cell.date);
        const dayCell = createElement('div', {
          className: `month-day-cell ${isTod ? 'is-today-cell' : ''} ${cell.isCurrentMonth ? '' : 'other-month-cell'}`,
          style: {
            borderRight: isTod ? '2px solid #6366F1' : '1px solid var(--color-border-light)',
            borderBottom: isTod ? '2px solid #6366F1' : '1px solid var(--color-border-light)',
            borderTop: isTod ? '2px solid #6366F1' : 'none',
            borderLeft: isTod ? '2px solid #6366F1' : 'none',
            padding: '6px',
            backgroundColor: isTod
              ? 'rgba(99, 102, 241, 0.16)'
              : (cell.isCurrentMonth ? 'var(--color-bg-primary)' : 'var(--color-bg-secondary)'),
            boxShadow: isTod ? 'inset 0 0 0 1px rgba(99, 102, 241, 0.35), 0 4px 14px rgba(99, 102, 241, 0.16)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '132px',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background-color 0.15s ease'
          },
          onclick: (e) => {
            if (e.target.closest('.event-card')) return;
            const startAt = new Date(cell.date);
            startAt.setHours(9, 0, 0, 0);
            const endAt = new Date(startAt.getTime() + 3600000);
            // Mở Form thống nhất đầy đủ trường thông tin
            EventForm.showFullModal({
              startAt,
              endAt,
              hasDate: true,
              fromCalendarSlot: true,
              onCreated: this.onRefresh
            });
          },
          ondragover: (e) => {
            e.preventDefault();
            dayCell.classList.add('day-col-dragover');
          },
          ondragleave: () => {
            dayCell.classList.remove('day-col-dragover');
          },
          ondrop: async (e) => {
            e.preventDefault();
            dayCell.classList.remove('day-col-dragover');
            try {
              const raw = e.dataTransfer.getData('text/plain');
              if (!raw) return;
              const data = JSON.parse(raw);
              if (!data || !data.id) return;
              const targetDateStr = formatDate(cell.date, 'YYYY-MM-DD');
              const todayStr = formatDate(businessNow(), 'YYYY-MM-DD');

              if (data.is_task) {
                await api.put(`/tasks/${data.id}`, {
                  due_date: targetDateStr,
                  is_in_my_day: targetDateStr === todayStr
                });
                Toast.success(`Đã xếp "${data.title || 'công việc'}" vào ngày ${targetDateStr}`);
              } else {
                const origS = data.start_at ? new Date(data.start_at) : new Date(cell.date);
                const origE = data.end_at ? new Date(data.end_at) : new Date(origS.getTime() + 3600000);
                const dur = Math.max(3600000, origE.getTime() - origS.getTime());
                const newS = new Date(cell.date);
                newS.setHours(origS.getHours() || 9, origS.getMinutes() || 0, 0, 0);
                const newE = new Date(newS.getTime() + dur);
                await api.put(`/events/${data.id}`, {
              ...recurrenceContext(data),
                  start_at: toLocalISOString(newS),
                  end_at: toLocalISOString(newE)
                });
                Toast.success(`Đã dời sự kiện sang ngày ${targetDateStr}`);
              }
              window.dispatchEvent(new CustomEvent('planify:data-changed'));
              if (this.onRefresh) this.onRefresh();
            } catch (_) {}
          }
        });

        const dayHeaderRow = createElement('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '5px'
          }
        });

        const dayNumber = createElement('div', {
          style: {
            fontSize: '12.5px',
            fontWeight: isTod ? '800' : (cell.isCurrentMonth ? '700' : '500'),
            color: isTod ? '#ffffff' : (cell.isCurrentMonth ? 'var(--color-text-primary)' : 'var(--color-text-muted)'),
            width: '26px',
            height: '26px',
            lineHeight: '26px',
            textAlign: 'center',
            borderRadius: '999px',
            backgroundColor: isTod ? '#6366F1' : 'transparent',
            boxShadow: isTod ? '0 0 0 3px rgba(99, 102, 241, 0.32)' : 'none'
          },
          textContent: String(cell.date.getDate())
        });
        dayHeaderRow.appendChild(dayNumber);

        if (isTod) {
          dayHeaderRow.appendChild(createElement('span', {
            style: {
              fontSize: '10px',
              fontWeight: '800',
              padding: '2px 7px',
              borderRadius: '999px',
              backgroundColor: '#6366F1',
              color: '#ffffff',
              letterSpacing: '0.04em'
            },
            textContent: 'HÔM NAY'
          }));
        }

        dayCell.appendChild(dayHeaderRow);

        const cellItems = createElement('div', {
          style: {
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            overflowY: 'auto',
            maxHeight: '96px'
          }
        });

        const dayTasks = this.tasks.filter(t => overlapsDay(t, cell.date));
        const dayEvents = this.events.filter(e => overlapsDay(e, cell.date));
        const allItems = [...dayTasks, ...dayEvents];

        allItems.forEach(item => {
          const card = EventCard.create({ event: item, onUpdate: this.onRefresh });
          card.style.position = 'relative';
          card.setAttribute('draggable', 'true');
          card.addEventListener('dragstart', (ev) => {
            ev.stopPropagation();
            ev.dataTransfer.setData('text/plain', JSON.stringify({
              id: item.id,
              is_task: !!item.is_task,
              ...recurrenceContext(item),
              start_at: item.start_at,
              end_at: item.end_at,
              title: item.title
            }));
          });
          cellItems.appendChild(card);
        });

        dayCell.appendChild(cellItems);
        monthGrid.appendChild(dayCell);

        if (isTod) {
          requestAnimationFrame(() => {
            dayCell.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          });
        }
      });
    });

    monthWrapper.appendChild(weekdaysHeader);
    monthWrapper.appendChild(monthGrid);
    this.container.appendChild(monthWrapper);
  }

  destroy() {}
}
