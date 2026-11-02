import { createElement } from '../utils/dom.js';

export class TimePicker {
  constructor({ selectedTime = '09:00', onSelect = null } = {}) {
    this.selectedTime = selectedTime;
    this.onSelect = onSelect;
  }

  render() {
    const popup = createElement('div', { className: 'timepicker-popup' });
    const [selHour, selMin] = (this.selectedTime || '09:00').split(':');

    // Hours column (00 - 23)
    const hoursCol = createElement('div', { className: 'timepicker-column' });
    for (let h = 0; h < 24; h++) {
      const hStr = String(h).padStart(2, '0');
      const opt = createElement('div', {
        className: `timepicker-option ${hStr === selHour ? 'selected' : ''}`,
        textContent: hStr,
        onclick: () => {
          this.selectedTime = `${hStr}:${selMin || '00'}`;
          if (this.onSelect) this.onSelect(this.selectedTime);
        }
      });
      hoursCol.appendChild(opt);
    }

    // Minutes column (00, 15, 30, 45)
    const minsCol = createElement('div', { className: 'timepicker-column' });
    ['00', '15', '30', '45'].forEach(mStr => {
      const opt = createElement('div', {
        className: `timepicker-option ${mStr === selMin ? 'selected' : ''}`,
        textContent: mStr,
        onclick: () => {
          this.selectedTime = `${selHour || '09'}:${mStr}`;
          if (this.onSelect) this.onSelect(this.selectedTime);
        }
      });
      minsCol.appendChild(opt);
    });

    popup.appendChild(hoursCol);
    popup.appendChild(minsCol);
    return popup;
  }
}

