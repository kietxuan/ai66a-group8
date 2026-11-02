import { createElement } from '../utils/dom.js';
import { formatDate, toLocalISOString } from '../utils/date.js';
import { EventForm } from './event-form.js';
import { api } from '../api.js';
import { Toast } from '../components/toast.js';
import { ContextMenu } from '../components/contextmenu.js';
import { toggleCalendarTaskComplete } from './task-adapter.js';

export class EventCard {
  static create({ event, onUpdate = null }) {
    const isTask = !!event.is_task;
    const rawTask = event.raw_task || null;
    const isAutoComplete = Boolean(rawTask?.auto_complete || !isTask);
    const isImportant = Boolean(rawTask?.is_important);

    const start = new Date(event.start_at);
    const end = new Date(event.end_at);
    const timeStr = event.is_all_day ? 'Cả ngày' : `${formatDate(start, 'HH:mm')} - ${formatDate(end, 'HH:mm')}`;

    const card = createElement('div', {
      className: `event-card ${event.is_all_day ? 'all-day' : ''} ${event.is_completed ? 'completed opacity-60' : ''}`,
      style: {
        backgroundColor: event.color || (isAutoComplete ? '#4F46E5' : '#0B8043'),
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 6px',
        borderRadius: '6px',
        cursor: 'pointer'
      },
      title: 'Bấm chuột trái để chỉnh sửa đầy đủ • Bấm chuột phải để mở menu thao tác nhanh',
      onclick: (e) => {
        e.stopPropagation();
        if (card.dataset.justResized === 'true' || card.dataset.justDragged === 'true') {
          return;
        }
        // Mở biểu mẫu thống nhất đầy đủ trường thông tin cho cả Công việc và Sự kiện
        EventForm.showFullModal({
          task: rawTask || null,
          event: !rawTask ? event : null,
          onUpdated: onUpdate,
          onDeleted: onUpdate
        });
      },
      oncontextmenu: (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showContextMenu(e.clientX, e.clientY, event, isTask, onUpdate);
      }
    });

    if (isTask) {
      const checkBtn = createElement('span', {
        className: 'event-task-check-icon cursor-pointer',
        style: { fontWeight: 'bold', flexShrink: '0' },
        textContent: event.is_completed ? '☑' : (isAutoComplete ? '⚡' : '☐'),
        title: event.is_completed ? 'Đã hoàn thành (Bấm để mở lại)' : 'Bấm để đánh dấu hoàn thành',
        onclick: async (e) => {
          e.stopPropagation();
          try {
            await toggleCalendarTaskComplete(event.id, event.is_completed);
            if (onUpdate) onUpdate();
          } catch (_) {}
        }
      });
      card.appendChild(checkBtn);
    }

    if (isImportant) {
      card.appendChild(createElement('span', {
        style: { fontSize: '11px', flexShrink: '0' },
        textContent: '⭐'
      }));
    }

    if (!event.is_all_day) {
      card.appendChild(createElement('span', {
        className: 'event-card-time',
        style: { fontSize: '10.5px', opacity: '0.92', fontWeight: '700', flexShrink: '0' },
        textContent: formatDate(start, 'HH:mm')
      }));
    }

    card.appendChild(createElement('span', {
      className: 'event-card-title truncate',
      style: {
        textDecoration: event.is_completed ? 'line-through' : 'none',
        fontWeight: '600',
        fontSize: '11.5px',
        flex: '1'
      },
      textContent: event.title
    }));

    return card;
  }

  static showContextMenu(x, y, event, isTask, onUpdate) {
    const rawTask = event.raw_task || null;

    if (isTask) {
      ContextMenu.show({
        x,
        y,
        title: event.title,
        items: [
          {
            icon: '✏️',
            label: 'Chỉnh sửa đầy đủ (Mở Form thống nhất)',
            onClick: () => {
              EventForm.showFullModal({
                task: rawTask || event,
                onUpdated: onUpdate,
                onDeleted: onUpdate
              });
            }
          },
          {
            icon: event.is_completed ? '☐' : '✅',
            label: event.is_completed ? 'Đánh dấu Chưa hoàn thành' : 'Đánh dấu Hoàn thành',
            onClick: async () => {
              await toggleCalendarTaskComplete(event.id, event.is_completed);
              if (onUpdate) onUpdate();
            }
          },
          {
            icon: '⚡',
            label: rawTask?.auto_complete
              ? 'Chuyển sang: Phải tích mới hoàn thành'
              : 'Chuyển sang: Sự kiện (Tự động hoàn thành)',
            onClick: async () => {
              await api.put(`/tasks/${event.id}`, { auto_complete: !rawTask?.auto_complete });
              Toast.success('Đã cập nhật chế độ hoàn thành!');
              window.dispatchEvent(new CustomEvent('planify:data-changed'));
              if (onUpdate) onUpdate();
            }
          },
          {
            icon: '📌',
            label: 'Bỏ ngày giờ (Đưa về cột Cần làm vĩnh viễn)',
            onClick: async () => {
              await api.put(`/tasks/${event.id}`, {
                due_date: null,
                due_time: null,
                start_time: null,
                end_time: null,
                is_all_day: true
              });
              Toast.success('Đã đưa về cột Cần làm (Vĩnh viễn)!');
              window.dispatchEvent(new CustomEvent('planify:data-changed'));
              if (onUpdate) onUpdate();
            }
          },
          { divider: true },
          {
            icon: '🗑️',
            label: 'Xóa mục này',
            danger: true,
            onClick: async () => {
              await api.delete(`/tasks/${event.id}`);
              Toast.success('Đã xóa thành công');
              window.dispatchEvent(new CustomEvent('planify:data-changed'));
              if (onUpdate) onUpdate();
            }
          }
        ]
      });
    } else {
      ContextMenu.show({
        x,
        y,
        title: event.title,
        items: [
          {
            icon: '✏️',
            label: 'Chỉnh sửa sự kiện (Form đầy đủ)',
            onClick: () => EventForm.showFullModal({ event, onUpdated: onUpdate, onDeleted: onUpdate })
          },
          {
            icon: '⏩',
            label: 'Dời sang ngày mai (+1 ngày)',
            onClick: async () => {
              const s = new Date(event.start_at);
              const e = new Date(event.end_at);
              s.setDate(s.getDate() + 1);
              e.setDate(e.getDate() + 1);
              await api.put(`/events/${event.id}`, {
                start_at: toLocalISOString(s),
                end_at: toLocalISOString(e)
              });
              Toast.success('Đã dời sự kiện sang ngày mai!');
              window.dispatchEvent(new CustomEvent('planify:data-changed'));
              if (onUpdate) onUpdate();
            }
          },
          { divider: true },
          {
            icon: '🗑️',
            label: 'Xóa sự kiện',
            danger: true,
            onClick: async () => {
              const targetId = event.parent_event_id || event.id;
              await api.delete(`/events/${targetId}`);
              Toast.success('Đã xóa sự kiện');
              window.dispatchEvent(new CustomEvent('planify:data-changed'));
              if (onUpdate) onUpdate();
            }
          }
        ]
      });
    }
  }
}
