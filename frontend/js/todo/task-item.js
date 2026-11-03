import { businessNow } from '../utils/date.js';
import { createElement } from '../utils/dom.js';
import { isToday, formatDate } from '../utils/date.js';
import { soundManager } from '../utils/sound.js';
import { ContextMenu } from '../components/contextmenu.js';
import { confirmDeleteItem } from '../utils/confirm-delete.js';
import { revisionOptions } from '../utils/revision.js';
import { api } from '../api.js';
import { Toast } from '../components/toast.js';
import { store } from '../store.js';

export const DEFAULT_CATEGORIES = [
  { name: 'Công việc', color: '#3B82F6' },
  { name: 'Cá nhân', color: '#10B981' },
  { name: 'Dự án', color: '#F97316' },
  { name: 'Khẩn cấp', color: '#EF4444' },
  { name: 'Học tập', color: '#8B5CF6' }
];

export function getAvailableCategories() {
  const storeCats = store.get('categories');
  if (Array.isArray(storeCats)) return storeCats;
  return [];
}

export function resolveCategoryForTask(task) {
  if (!task) return null;
  const cats = getAvailableCategories();
  if (task.category) {
    const match = cats.find(c => c.name.toLowerCase() === String(task.category).toLowerCase());
    if (match) return match;
  }
  if (task.color) {
    const match = cats.find(c => c.color.toLowerCase() === String(task.color).toLowerCase());
    if (match) return match;
    return { name: 'Thẻ màu', color: task.color };
  }
  return null;
}

export class TaskItem {
  static create({
    task,
    listName = null,
    isActiveDetail = false,
    isOverdue = false,
    onToggleComplete = null,
    onToggleImportant = null,
    onSelect = null,
    onReorder = null,
    onUpdated = null
  }) {
    const isCompleted = Boolean(task.is_completed);
    const isStarred = Boolean(task.is_important);
    const cat = resolveCategoryForTask(task);

    const item = createElement('div', {
      className: `task-item ${isCompleted ? 'completed' : ''} ${isActiveDetail ? 'active-task-open' : ''}`,
      style: cat?.color ? { borderLeft: `3px solid ${cat.color}` } : {},
      draggable: 'true',
      dataset: { taskId: task.id },
      title: isActiveDetail
        ? 'Bấm chuột trái lần nữa để đóng chi tiết • Bấm chuột phải để mở thao tác nhanh'
        : 'Bấm chuột trái để mở chi tiết • Bấm chuột phải để mở thao tác nhanh',
      onclick: (e) => {
        if (
          e.target.closest('.task-checkbox') ||
          e.target.closest('.task-star-btn') ||
          e.target.tagName === 'INPUT'
        ) {
          return;
        }
        if (onSelect) onSelect(task);
      },
      oncontextmenu: (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showContextMenu(e.clientX, e.clientY, task, onToggleComplete, onToggleImportant, onUpdated);
      },
      ondragstart: (e) => {
        e.dataTransfer.setData('text/plain', String(task.id));
        e.dataTransfer.effectAllowed = 'move';
        item.classList.add('opacity-50');
      },
      ondragend: () => {
        item.classList.remove('opacity-50');
      },
      ondragover: (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        item.classList.add('task-drag-over');
      },
      ondragleave: () => {
        item.classList.remove('task-drag-over');
      },
      ondrop: (e) => {
        e.preventDefault();
        item.classList.remove('task-drag-over');
        const sourceTaskId = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (sourceTaskId && sourceTaskId !== task.id && onReorder) {
          onReorder(sourceTaskId, task.id);
        }
      }
    });

    // 1. Cột Chính (Bên Trái): Checkbox + Tiêu đề
    const checkbox = createElement('div', {
      className: 'task-checkbox',
      title: isCompleted ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành',
      onclick: (e) => {
        e.stopPropagation();
        if (onToggleComplete) {
          if (!isCompleted) {
            soundManager.playTaskComplete();
          }
          item.classList.add('task-completing');
          setTimeout(() => {
            onToggleComplete(task, !isCompleted);
          }, 180);
        }
      }
    }, [
      isCompleted ? createElement('span', {
        style: { color: '#ffffff', fontSize: '12px', fontWeight: 'bold' },
        textContent: '✓'
      }) : null
    ]);

    const titleEl = createElement('span', {
      className: 'task-title',
      title: 'Nhấp đúp chuột trái để sửa nhanh tiêu đề',
      textContent: task.title,
      ondblclick: (e) => {
        e.stopPropagation();
        const inlineInput = createElement('input', {
          type: 'text',
          className: 'input',
          value: task.title,
          style: { padding: '2px 8px', fontSize: '13px', fontWeight: '600' },
          onkeydown: async (ke) => {
            if (ke.key === 'Enter') {
              const newVal = inlineInput.value.trim();
              if (newVal && newVal !== task.title) {
                try {
                  await api.put(`/tasks/${task.id}`, { title: newVal }, revisionOptions(task));
                  task.title = newVal;
                  Toast.success('Đã cập nhật tên công việc!');
                  window.dispatchEvent(new CustomEvent('planify:data-changed'));
                  if (onUpdated) onUpdated();
                } catch (err) {
                  Toast.error(err.message || 'Không thể đổi tên công việc.');
                }
              } else {
                titleEl.style.display = '';
                inlineInput.remove();
              }
            } else if (ke.key === 'Escape') {
              titleEl.style.display = '';
              inlineInput.remove();
            }
          },
          onblur: () => {
            titleEl.style.display = '';
            inlineInput.remove();
          }
        });
        titleEl.style.display = 'none';
        colMain.insertBefore(inlineInput, titleEl);
        inlineInput.focus();
      }
    });

    const colMain = createElement('div', { className: 'task-col-main' }, [
      checkbox,
      titleEl
    ]);

    // 2. Cột Thời gian (Đầy đủ ngày tháng năm DD/MM/YYYY)
    let timeLabel = 'Chưa đặt giờ';
    let timeClass = 'task-col-time is-unscheduled';

    if (task.due_date) {
      const isTod = isToday(task.due_date);
      const dStr = String(task.due_date).slice(0, 10);
      const fullDate = formatDate(new Date(dStr + 'T00:00:00'), 'DD/MM/YYYY');
      const startT = task.start_time || task.due_time;

      if (startT && !task.is_all_day) {
        const timePart = String(startT).substring(0, 5);
        timeLabel = `${timePart}, ${fullDate}`;
      } else {
        timeLabel = fullDate;
      }

      if (isOverdue && !isCompleted) {
        timeClass = 'task-col-time is-overdue';
      } else if (isTod) {
        timeClass = 'task-col-time is-today';
      } else {
        timeClass = 'task-col-time';
      }
    }

    const colTime = createElement('div', {
      className: timeClass,
      title: task.due_date ? `Hạn: ${task.due_date}` : 'Chưa đặt giờ',
      textContent: timeLabel
    });

    // 3. Cột Thẻ / Phân loại
    const colTag = createElement('div', { className: 'task-col-tag' });
    if (cat) {
      const badge = createElement('span', {
        className: 'task-tag-badge',
        style: {
          backgroundColor: `${cat.color}18`,
          color: cat.color,
          border: `1px solid ${cat.color}55`
        },
        title: `Phân loại: ${cat.name}`
      }, [
        createElement('span', {
          className: 'task-tag-icon',
          style: { display: 'inline-flex', alignItems: 'center', marginRight: '2px' },
          innerHTML: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`
        }),
        createElement('span', {
          className: 'task-tag-text',
          textContent: cat.name
        })
      ]);
      colTag.appendChild(badge);
    } else {
      colTag.appendChild(createElement('span', { className: 'task-col-empty', textContent: '—' }));
    }

    // 4. Cột Ngôi sao Đánh dấu Quan trọng
    const starBtn = createElement('button', {
      type: 'button',
      className: `task-star-btn ${isStarred ? 'starred' : ''}`,
      title: isStarred ? 'Bỏ đánh dấu Quan trọng' : 'Đánh dấu Quan trọng',
      innerHTML: isStarred ? '&#9733;' : '&#9734;',
      onclick: (e) => {
        e.stopPropagation();
        if (onToggleImportant) onToggleImportant(task, !isStarred);
      }
    });

    const colStar = createElement('div', { className: 'task-col-star' }, [starBtn]);

    item.appendChild(colMain);
    item.appendChild(colTime);
    item.appendChild(colTag);
    item.appendChild(colStar);

    return item;
  }

  static showContextMenu(x, y, task, onToggleComplete, onToggleImportant, onUpdated) {
    const todayStr = formatDate(businessNow(), 'YYYY-MM-DD');
    const tomorrow = businessNow();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow, 'YYYY-MM-DD');

    ContextMenu.show({
      x,
      y,
      title: task.title,
      items: [
        {
          icon: '⭐',
          label: task.is_important ? 'Bỏ đánh dấu Quan trọng' : 'Đánh dấu Quan trọng',
          onClick: () => {
            if (onToggleImportant) onToggleImportant(task, !task.is_important);
          }
        },
        {
          icon: task.is_completed ? '☐' : '✅',
          label: task.is_completed ? 'Chuyển về Chưa hoàn thành' : 'Đánh dấu Hoàn thành ngay',
          onClick: () => {
            if (onToggleComplete) onToggleComplete(task, !task.is_completed);
          }
        },
        { divider: true },
        {
          icon: '☀️',
          label: 'Chuyển vào cột Hôm nay',
          onClick: async () => {
            await api.put(`/tasks/${task.id}`, { due_date: todayStr, is_completed: false, is_in_my_day: true }, revisionOptions(task));
            Toast.success('Đã chuyển vào cột Hôm nay!');
            window.dispatchEvent(new CustomEvent('planify:data-changed'));
            if (onUpdated) onUpdated();
          }
        },
        {
          icon: '🌤️',
          label: 'Dời sang Ngày mai (Cột Cần làm)',
          onClick: async () => {
            await api.put(`/tasks/${task.id}`, { due_date: tomorrowStr, is_completed: false }, revisionOptions(task));
            Toast.success('Đã dời lịch sang Ngày mai (Cột Cần làm)!');
            window.dispatchEvent(new CustomEvent('planify:data-changed'));
            if (onUpdated) onUpdated();
          }
        },
        {
          icon: '📌',
          label: 'Bỏ thời gian (Chưa đặt giờ)',
          onClick: async () => {
            await api.put(`/tasks/${task.id}`, {
              due_date: null,
              due_time: null,
              start_time: null,
              end_time: null,
              is_all_day: true,
              is_completed: false
            }, revisionOptions(task));
            Toast.success('Đã chuyển về Chưa đặt giờ!');
            window.dispatchEvent(new CustomEvent('planify:data-changed'));
            if (onUpdated) onUpdated();
          }
        },
        { divider: true },
        {
          icon: '🗑️',
          label: 'Xóa mục này',
          danger: true,
          onClick: async () => {
            if (!confirmDeleteItem(task)) return;
            await api.delete(`/tasks/${task.id}`);
            Toast.success('Đã xóa thành công');
            window.dispatchEvent(new CustomEvent('planify:data-changed'));
            if (onUpdated) onUpdated();
          }
        }
      ]
    });
  }
}
