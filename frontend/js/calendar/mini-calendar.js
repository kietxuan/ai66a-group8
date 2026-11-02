import { businessNow } from '../utils/date.js';
import { createElement } from '../utils/dom.js';
import { getMonthMatrix, getMonthName, isToday, isSameDay } from '../utils/date.js';
import { store } from '../store.js';

export class MiniCalendar {
  constructor(container, { onDateSelect = null } = {}) {
    this.container = container;
    this.onDateSelect = onDateSelect;
    this.currentDate = businessNow();
    this.viewYear = this.currentDate.getFullYear();
    this.viewMonth = this.currentDate.getMonth();
  }

  render() {
    this.container.innerHTML = '';

    const wrapper = createElement('div', { className: 'mini-calendar-wrapper' });

    // Header
    const header = createElement('div', {
      className: 'flex items-center justify-between',
      style: { marginBottom: '8px' }
    }, [
      createElement('span', {
        style: { fontWeight: '600', fontSize: '13px' },
        textContent: `${getMonthName(this.viewMonth)} ${this.viewYear}`
      }),
      createElement('div', { className: 'flex gap-xs' }, [
        createElement('button', {
          className: 'btn-icon',
          style: { width: '24px', height: '24px', fontSize: '10px' },
          innerHTML: '&#9664;',
          onclick: () => this.prevMonth()
        }),
        createElement('button', {
          className: 'btn-icon',
          style: { width: '24px', height: '24px', fontSize: '10px' },
          innerHTML: '&#9654;',
          onclick: () => this.nextMonth()
        })
      ])
    ]);

    // Weekdays row
    const weekdays = createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        textAlign: 'center',
        fontSize: '11px',
        color: 'var(--color-text-secondary)',
        marginBottom: '4px'
      }
    }, [
      createElement('span', { textContent: 'T2' }),
      createElement('span', { textContent: 'T3' }),
      createElement('span', { textContent: 'T4' }),
      createElement('span', { textContent: 'T5' }),
      createElement('span', { textContent: 'T6' }),
      createElement('span', { textContent: 'T7' }),
      createElement('span', { textContent: 'CN' })
    ]);

    // Days grid
    const grid = createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '2px',
        textAlign: 'center',
        fontSize: '11px'
      }
    });

    const matrix = getMonthMatrix(this.viewYear, this.viewMonth);
    const selectedDate = store.get('selectedDate') || businessNow();

    matrix.forEach(week => {
      week.forEach(cell => {
        const isSel = isSameDay(cell.date, selectedDate);
        const isTod = isToday(cell.date);

        const dayEl = createElement('button', {
          style: {
            padding: '4px 0',
            borderRadius: 'var(--radius-full)',
            cursor: 'pointer',
            fontWeight: isTod || isSel ? '600' : 'normal',
            color: cell.isCurrentMonth
              ? (isSel ? 'var(--color-accent-contrast)' : 'var(--color-text-primary)')
              : 'var(--color-text-muted)',
            backgroundColor: isSel
              ? 'var(--color-accent)'
              : (isTod ? 'var(--color-accent-light)' : 'transparent')
          },
          textContent: cell.date.getDate(),
          onclick: () => {
            store.set('selectedDate', new Date(cell.date));
            if (this.onDateSelect) this.onDateSelect(new Date(cell.date));
            this.render();
          }
        });

        grid.appendChild(dayEl);
      });
    });

    wrapper.appendChild(header);
    wrapper.appendChild(weekdays);
    wrapper.appendChild(grid);
    this.container.appendChild(wrapper);
  }

  prevMonth() {
    if (this.viewMonth === 0) {
      this.viewMonth = 11;
      this.viewYear--;
    } else {
      this.viewMonth--;
    }
    this.render();
  }

  nextMonth() {
    if (this.viewMonth === 11) {
      this.viewMonth = 0;
      this.viewYear++;
    } else {
      this.viewMonth++;
    }
    this.render();
  }
}

