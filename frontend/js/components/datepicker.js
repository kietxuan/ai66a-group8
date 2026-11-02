import { createElement } from '../utils/dom.js';
import { getMonthMatrix, getMonthName, isToday, isSameDay } from '../utils/date.js';

export class DatePicker {
  constructor({ selectedDate = new Date(), onSelect = null } = {}) {
    this.selectedDate = new Date(selectedDate);
    this.viewYear = this.selectedDate.getFullYear();
    this.viewMonth = this.selectedDate.getMonth();
    this.onSelect = onSelect;
    this.element = null;
  }

  render() {
    const popup = createElement('div', { className: 'datepicker-popup' });
    this.element = popup;
    this.update();
    return popup;
  }

  update() {
    if (!this.element) return;
    this.element.innerHTML = '';

    // Header with prev/next buttons
    const header = createElement('div', { className: 'datepicker-header' }, [
      createElement('button', {
        className: 'btn-icon',
        innerHTML: '&#9664;',
        onclick: (e) => {
          e.stopPropagation();
          this.prevMonth();
        }
      }),
      createElement('span', {
        className: 'datepicker-title',
        textContent: `${getMonthName(this.viewMonth)}, ${this.viewYear}`
      }),
      createElement('button', {
        className: 'btn-icon',
        innerHTML: '&#9654;',
        onclick: (e) => {
          e.stopPropagation();
          this.nextMonth();
        }
      })
    ]);

    // Weekday labels
    const weekdays = createElement('div', { className: 'datepicker-weekdays' }, [
      createElement('span', { textContent: 'T2' }),
      createElement('span', { textContent: 'T3' }),
      createElement('span', { textContent: 'T4' }),
      createElement('span', { textContent: 'T5' }),
      createElement('span', { textContent: 'T6' }),
      createElement('span', { textContent: 'T7' }),
      createElement('span', { textContent: 'CN' })
    ]);

    // Grid of days
    const grid = createElement('div', { className: 'datepicker-grid' });
    const matrix = getMonthMatrix(this.viewYear, this.viewMonth);

    matrix.forEach(week => {
      week.forEach(cell => {
        const isSel = isSameDay(cell.date, this.selectedDate);
        const isTod = isToday(cell.date);
        const cellEl = createElement('div', {
          className: `datepicker-cell ${cell.isCurrentMonth ? '' : 'other-month'} ${isSel ? 'selected' : ''} ${isTod ? 'today' : ''}`,
          textContent: cell.date.getDate(),
          onclick: (e) => {
            e.stopPropagation();
            this.selectedDate = new Date(cell.date);
            this.update();
            if (typeof this.onSelect === 'function') {
              this.onSelect(this.selectedDate);
            }
          }
        });
        grid.appendChild(cellEl);
      });
    });

    this.element.appendChild(header);
    this.element.appendChild(weekdays);
    this.element.appendChild(grid);
  }

  prevMonth() {
    if (this.viewMonth === 0) {
      this.viewMonth = 11;
      this.viewYear--;
    } else {
      this.viewMonth--;
    }
    this.update();
  }

  nextMonth() {
    if (this.viewMonth === 11) {
      this.viewMonth = 0;
      this.viewYear++;
    } else {
      this.viewMonth++;
    }
    this.update();
  }
}

