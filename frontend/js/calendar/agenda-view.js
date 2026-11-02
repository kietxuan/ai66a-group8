import { businessNow } from '../utils/date.js';
import { createElement } from '../utils/dom.js';
import { formatDate, isToday, isSameDay, getWeekdayName, addDays } from '../utils/date.js';
import { EventForm } from './event-form.js';
import { api } from '../api.js';
import { Toast } from '../components/toast.js';
import { toggleCalendarTaskComplete } from './task-adapter.js';
import { overlapsDay } from '../utils/date.js';

export class AgendaView {
  constructor(container = null, { date = businessNow(), events = [], tasks = [], defaultCalendarId = null, onRefresh = null } = {}) {
    this.container = container;
    this.date = new Date(date);
    this.events = events;
    this.tasks = tasks;
    this.defaultCalendarId = defaultCalendarId;
    this.onRefresh = onRefresh;
    this.rangeDays = 30; // Display upcoming 30 days
  }

  /**
   * Render Agenda / Schedule View
   * Accepts optional (container, events, currentDate) for caller flexibility
   */
  render(container = null, events = null, currentDate = null) {
    if (container) this.container = container;
    if (events) this.events = events;
    if (currentDate) this.date = new Date(currentDate);

    if (!this.container) return;
    this.container.innerHTML = '';

    const wrapper = createElement('div', {
      className: 'agenda-view-container'
    });

    const startDay = new Date(this.date);
    startDay.setHours(0, 0, 0, 0);

    const endDay = new Date(startDay);
    endDay.setDate(endDay.getDate() + this.rangeDays);
    endDay.setHours(23, 59, 59, 999);

    // Combine all events and tasks that fall within range
    const allItems = [];

    (this.events || []).forEach(e => {
      const s = new Date(e.start_at);
      if (s <= endDay && new Date(e.end_at) > startDay) {
        allItems.push({
          ...e,
          _type: 'event',
          _dateObj: s
        });
      }
    });

    (this.tasks || []).forEach(t => {
      const s = new Date(t.start_at);
      if (s <= endDay && new Date(t.end_at) > startDay) {
        allItems.push({
          ...t,
          _type: 'task',
          _dateObj: s
        });
      }
    });

    // Group items by day YYYY-MM-DD
    const dayMap = new Map();
    for (let i = 0; i < this.rangeDays; i++) {
      const d = addDays(startDay, i);
      const key = formatDate(d, 'YYYY-MM-DD');
      dayMap.set(key, { date: d, items: [] });
    }

    allItems.forEach(item => dayMap.forEach(group => {
      if (overlapsDay(item, group.date)) group.items.push({ ...item, _dateObj: new Date(Math.max(item._dateObj, group.date)) });
    }));

    // Sort items within each day (all-day first, then by time)
    dayMap.forEach(group => {
      group.items.sort((a, b) => {
        if (a.is_all_day && !b.is_all_day) return -1;
        if (!a.is_all_day && b.is_all_day) return 1;
        return a._dateObj - b._dateObj;
      });
    });

    // Render list of days that have items (or today even if empty)
    let totalItemsRendered = 0;

    dayMap.forEach((group) => {
      const isTod = isToday(group.date);
      if (group.items.length === 0 && !isTod) {
        return; // Skip empty days except today
      }

      totalItemsRendered += group.items.length;

      const dayBlock = createElement('div', {
        className: `agenda-day-block ${isTod ? 'today' : ''}`
      });

      // Day Header
      const weekdayStr = getWeekdayName(group.date.getDay());
      const dateFormatted = formatDate(group.date, 'DD/MM/YYYY');

      const dayHeader = createElement('div', {
        className: 'agenda-day-header'
      }, [
        createElement('span', {
          className: 'agenda-day-title',
          textContent: `📅 ${weekdayStr}, ${dateFormatted}`
        }),
        isTod ? createElement('span', {
          className: 'agenda-today-badge',
          textContent: 'Hôm nay'
        }) : null
      ]);

      dayBlock.appendChild(dayHeader);

      // Items Container
      if (group.items.length === 0) {
        dayBlock.appendChild(createElement('div', {
          className: 'agenda-day-empty',
          textContent: 'Không có sự kiện hoặc công việc nào.'
        }));
      } else {
        const itemsList = createElement('div', {
          className: 'agenda-items-list'
        });

        group.items.forEach(item => {
          const isEvent = item._type === 'event';
          const isTask = item._type === 'task' || !!item.is_task;
          const startTimeStr = item.is_all_day ? 'Cả ngày' : formatDate(item._dateObj, 'HH:mm');
          const endTimeStr = (item.is_all_day || !item.end_at) ? '' : ` - ${formatDate(new Date(item.end_at), 'HH:mm')}`;
          const timeLabel = `${startTimeStr}${endTimeStr}`;

          const itemCard = createElement('div', {
            className: `agenda-item-card ${item.is_completed ? 'completed' : ''}`,
            style: {
              borderLeftColor: item.color || (isEvent ? 'var(--color-accent)' : '#0B8043')
            },
            onclick: () => {
              EventForm.showFullModal({
                task: isTask ? (item.raw_task || item) : null,
                event: isEvent ? item : null,
                defaultCalendarId: this.defaultCalendarId,
                onUpdated: this.onRefresh,
                onDeleted: this.onRefresh
              });
            }
          });

          // Time Badge
          const timeBadge = createElement('div', {
            className: 'agenda-item-time',
            textContent: timeLabel
          });

          // Checkbox for Task
          let taskCheckbox = null;
          if (isTask) {
            taskCheckbox = createElement('span', {
              className: 'agenda-task-checkbox',
              textContent: item.is_completed ? '☑' : '☐',
              title: item.is_completed ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành',
              onclick: async (e) => {
                e.stopPropagation();
                try {
                  await toggleCalendarTaskComplete(item.id, item.is_completed);
                  if (this.onRefresh) this.onRefresh();
                } catch (err) {
                  // Handled in toggleCalendarTaskComplete
                }
              }
            });
          }

          // Title & Details
          const contentCol = createElement('div', {
            className: 'agenda-item-content'
          }, [
            createElement('div', {
              className: 'agenda-item-title-row'
            }, [
              taskCheckbox,
              createElement('span', {
                className: 'agenda-item-icon',
                textContent: isEvent ? '🗓️' : '✅'
              }),
              createElement('span', {
                className: `agenda-item-title ${item.is_completed ? 'strikethrough' : ''}`,
                textContent: item.title
              })
            ]),
            item.location ? createElement('div', {
              className: 'agenda-item-detail agenda-item-location',
              textContent: `📍 ${item.location}`
            }) : null,
            item.recurrence_rule ? createElement('div', {
              className: 'agenda-item-detail agenda-item-recurrence',
              textContent: '🔄 Lặp lại'
            }) : null
          ]);

          // Type Pill
          const typePill = createElement('span', {
            className: `agenda-type-pill ${isEvent ? 'event' : 'task'}`,
            textContent: isEvent ? 'Sự kiện' : 'Việc cần làm'
          });

          itemCard.appendChild(timeBadge);
          itemCard.appendChild(contentCol);
          itemCard.appendChild(typePill);

          itemsList.appendChild(itemCard);
        });

        dayBlock.appendChild(itemsList);
      }

      wrapper.appendChild(dayBlock);
    });

    if (totalItemsRendered === 0) {
      wrapper.appendChild(createElement('div', {
        className: 'agenda-empty-state',
        textContent: '🎉 Không có sự kiện hoặc công việc nào trong 30 ngày tới.'
      }));
    }

    this.container.appendChild(wrapper);
  }

  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
