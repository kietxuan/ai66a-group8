import { businessNow } from '../utils/date.js';
import { createElement } from '../utils/dom.js';
import { isToday, formatDate } from '../utils/date.js';
import { soundManager } from '../utils/sound.js';
import { ContextMenu } from '../components/contextmenu.js';
import { EventForm } from '../calendar/event-form.js';
import { api } from '../api.js';
import { Toast } from '../components/toast.js';

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
    const isAutoEvent = Boolean(task.auto_complete);

    const totalSteps = task.steps?.length || 0;
    const completedSteps = task.steps?.filter(s => s.is_completed).length || 0;

    const item = createElement('div', {
      className: `task-item ${isCompleted ? 'completed' : ''} ${isActiveDetail ? 'active-task-open' : ''}`,
      style: task.color ? { borderLeft: `4px solid ${task.color}` } : {},
      draggable: 'true',
      dataset: { taskId: task.id },
      title: isActiveDetail
        ? 'Bấm chuột trái lần nữa để đóng cửa sổ chi tiết • Bấm chuột phải để mở menu thao tác nhanh'
        : 'Bấm chuột trái để mở chi tiết • Bấm chuột phải để mở menu thao tác nhanh',
      onclick: (e) => {
        if (
          e.target.closest('.task-checkbox') ||
          e.target.closest('.task-star-btn') ||
          e.target.closest('.task-menu-btn') ||
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

    const content = createElement('div', { className: 'flex-1 flex flex-col gap-xs overflow-hidden' });
    const titleRow = createElement('div', { className: 'flex items-center gap-xs overflow-hidden' });



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
                await api.put(`/tasks/${task.id}`, { title: newVal });
                task.title = newVal;
                Toast.success('Đã cập nhật tên công việc!');
                window.dispatchEvent(new CustomEvent('planify:data-changed'));
                if (onUpdated) onUpdated();
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
        titleRow.insertBefore(inlineInput, titleEl);
        inlineInput.focus();
      }
    });
    titleRow.appendChild(titleEl);
    content.appendChild(titleRow);

    const metaRow = createElement('div', {
      className: 'flex items-center gap-xs flex-wrap',
      style: { fontSize: '11px', color: 'var(--color-text-secondary)' }
    });



    if (task.due_date) {
      const isTod = isToday(task.due_date);
      let dateLabel = `📅 ${isTod ? 'Hôm nay' : task.due_date}`;
      const startT = task.start_time || task.due_time;
      if (startT && !task.is_all_day) {
        dateLabel += ` 🕒 ${String(startT).substring(0, 5)}`;
        if (task.end_time) {
          dateLabel += `-${String(task.end_time).substring(0, 5)}`;
        }
      }
      metaRow.appendChild(createElement('span', {
        style: {
          color: (isOverdue && !isCompleted) ? 'var(--color-danger)' : (isTod ? 'var(--color-primary)' : 'inherit'),
          fontWeight: (isOverdue || isTod) ? '700' : '600'
        },
        textContent: dateLabel
      }));
    } else {
      metaRow.appendChild(createElement('span', {
        style: { color: 'var(--color-text-tertiary)', fontStyle: 'italic' },
        textContent: '📌 Vĩnh viễn (Chưa đặt giờ)'
      }));
    }

    if (listName) {
      metaRow.appendChild(createElement('span', {
        style: {
          backgroundColor: 'var(--color-bg-tertiary)',
          padding: '1px 6px',
          borderRadius: '4px'
        },
        textContent: `📁 ${listName}`
      }));
    }

    if (totalSteps > 0) {
      metaRow.appendChild(createElement('span', { textContent: `☑️ ${completedSteps}/${totalSteps}` }));
    }

    if (task.location) {
      metaRow.appendChild(createElement('span', {
        className: 'truncate',
        style: { maxWidth: '120px' },
        textContent: `📍 ${task.location}`
      }));
    }

    if (task.recurrence_rule) {
      metaRow.appendChild(createElement('span', { title: 'Lặp lại', textContent: '🔄' }));
    }

    if (metaRow.children.length > 0) {
      content.appendChild(metaRow);
    }

    // Star button (Quan trọng hiển thị ngay trên thẻ)
    const starBtn = createElement('button', {
      type: 'button',
      className: `task-star-btn ${isStarred ? 'starred' : ''}`,
      title: isStarred ? 'Bỏ đánh dấu Quan trọng' : 'Đánh dấu Quan trọng (Hiện ngôi sao ⭐)',
      innerHTML: isStarred ? '&#9733;' : '&#9734;',
      onclick: (e) => {
        e.stopPropagation();
        if (onToggleImportant) onToggleImportant(task, !isStarred);
      }
    });

    // Context menu button (for both left-click on ⋮ and right-click anywhere on the card)
    const menuBtn = createElement('button', {
      type: 'button',
      className: 'task-menu-btn btn-icon',
      style: { width: '24px', height: '24px', fontSize: '14px', opacity: '0.75' },
      title: 'Mở menu thao tác nhanh (hoặc bấm Chuột phải vào thẻ)',
      textContent: '⋮',
      onclick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = menuBtn.getBoundingClientRect();
        this.showContextMenu(rect.left, rect.bottom + 4, task, onToggleComplete, onToggleImportant, onUpdated);
      }
    });

    item.appendChild(checkbox);
    item.appendChild(content);
    item.appendChild(starBtn);
    item.appendChild(menuBtn);

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
          icon: '✏️',
          label: 'Chỉnh sửa đầy đủ (Mở Form thống nhất)',
          onClick: () => {
            EventForm.showFullModal({
              task,
              onUpdated: () => {
                if (onUpdated) onUpdated();
              },
              onDeleted: () => {
                if (onUpdated) onUpdated();
              }
            });
          }
        },
        {
          icon: '⭐',
          label: task.is_important ? 'Bỏ đánh dấu Quan trọng' : 'Đánh dấu Quan trọng (Hiện ⭐)',
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
            await api.put(`/tasks/${task.id}`, { due_date: todayStr, is_completed: false, is_in_my_day: true });
            Toast.success('Đã chuyển vào cột Hôm nay!');
            window.dispatchEvent(new CustomEvent('planify:data-changed'));
            if (onUpdated) onUpdated();
          }
        },
        {
          icon: '🌤️',
          label: 'Dời sang Ngày mai (Cột Cần làm)',
          onClick: async () => {
            await api.put(`/tasks/${task.id}`, { due_date: tomorrowStr, is_completed: false });
            Toast.success('Đã dời lịch sang Ngày mai (Cột Cần làm)!');
            window.dispatchEvent(new CustomEvent('planify:data-changed'));
            if (onUpdated) onUpdated();
          }
        },
        {
          icon: '📌',
          label: 'Bỏ thời gian (Đặt Vĩnh viễn ở cột Cần làm)',
          onClick: async () => {
            await api.put(`/tasks/${task.id}`, {
              due_date: null,
              due_time: null,
              start_time: null,
              end_time: null,
              is_all_day: true,
              is_completed: false
            });
            Toast.success('Đã đặt làm Vĩnh viễn trong cột Cần làm!');
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
