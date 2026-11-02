import { businessNow, parseLocalDate } from '../utils/date.js';
import { createElement } from '../utils/dom.js';
import { api } from '../api.js';
import { Toast } from '../components/toast.js';
import { isToday, formatDate } from '../utils/date.js';

export class MyDaySuggestions {
  constructor({ tasks = [], onAdd = null, onClose = null }) {
    this.tasks = tasks;
    this.onAdd = onAdd;
    this.onClose = onClose;
    this.modalEl = null;
  }

  show() {
    this.render();
  }

  hide() {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
  }

  getSuggestions() {
    const today = businessNow();
    today.setHours(0, 0, 0, 0);

    // Filter uncompleted tasks not in My Day
    const candidates = this.tasks.filter(t => !t.is_completed && !t.is_in_my_day);

    const overdue = [];
    const dueToday = [];
    const important = [];
    const recent = [];

    candidates.forEach(t => {
      if (t.due_date) {
        const d = parseLocalDate(t.due_date);
        d.setHours(0, 0, 0, 0);
        if (d.getTime() === today.getTime()) {
          dueToday.push(t);
          return;
        } else if (d < today) {
          overdue.push(t);
          return;
        }
      }

      if (t.is_important) {
        important.push(t);
        return;
      }

      recent.push(t);
    });

    return { overdue, dueToday, important, recent: recent.slice(0, 5) };
  }

  render() {
    this.hide();

    const overlay = createElement('div', {
      className: 'modal-overlay',
      onclick: (e) => {
        if (e.target === overlay) {
          this.hide();
          if (this.onClose) this.onClose();
        }
      }
    });

    const modal = createElement('div', {
      className: 'modal-content',
      style: { maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }
    });

    const header = createElement('div', {
      className: 'modal-header flex items-center justify-between',
      style: { paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }
    }, [
      createElement('h3', { className: 'modal-title', textContent: '💡 Gợi ý cho My Day' }),
      createElement('button', {
        className: 'btn-icon',
        innerHTML: '&times;',
        onclick: () => {
          this.hide();
          if (this.onClose) this.onClose();
        }
      })
    ]);

    const body = createElement('div', {
      className: 'modal-body flex-1 overflow-y-auto',
      style: { padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }
    });

    const { overdue, dueToday, important, recent } = this.getSuggestions();

    const renderGroup = (title, icon, list) => {
      if (!list || list.length === 0) return null;

      const group = createElement('div', { className: 'flex flex-col gap-xs' }, [
        createElement('div', {
          style: { fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', padding: '0 8px' },
          textContent: `${icon} ${title} (${list.length})`
        })
      ]);

      list.forEach(t => {
        const row = createElement('div', {
          className: 'flex items-center justify-between p-sm rounded hover:bg-hover',
          style: {
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border-light)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)'
          }
        }, [
          createElement('div', { className: 'flex flex-col overflow-hidden gap-xs' }, [
            createElement('span', { className: 'font-medium truncate', textContent: t.title }),
            createElement('span', {
              style: { fontSize: '11px', color: 'var(--color-text-tertiary)' },
              textContent: t.due_date ? `Hạn: ${t.due_date}` : 'Không có hạn'
            })
          ]),
          createElement('button', {
            className: 'btn btn-secondary btn-sm',
            textContent: '+ Thêm',
            onclick: async () => {
              try {
                await api.patch(`/tasks/${t.id}/my-day`, { is_in_my_day: true });
                t.is_in_my_day = true;
                Toast.success(`Đã thêm "${t.title}" vào My Day`);
                window.dispatchEvent(new CustomEvent('planify:data-changed', {
                  detail: { source: 'todo-suggestions', action: 'my-day', type: 'task', id: t.id }
                }));
                document.dispatchEvent(new CustomEvent('task-changed', {
                  detail: { action: 'update', task: t }
                }));
                if (this.onAdd) this.onAdd(t);
                this.render();
              } catch (err) {
                Toast.error('Không thể thêm vào My Day');
              }
            }
          })
        ]);
        group.appendChild(row);
      });

      return group;
    };

    const hasAny = overdue.length + dueToday.length + important.length + recent.length > 0;

    if (!hasAny) {
      body.appendChild(createElement('div', {
        style: { textAlign: 'center', padding: '32px 16px', color: 'var(--color-text-secondary)' },
        textContent: '🎉 Tuyệt vời! Bạn không còn công việc nào tồn đọng cần gợi ý.'
      }));
    } else {
      const gDue = renderGroup('Đến hạn hôm nay', '📌', dueToday);
      const gOver = renderGroup('Quá hạn', '⚠️', overdue);
      const gImp = renderGroup('Quan trọng', '⭐', important);
      const gRec = renderGroup('Mới tạo gần đây', '📝', recent);

      if (gDue) body.appendChild(gDue);
      if (gOver) body.appendChild(gOver);
      if (gImp) body.appendChild(gImp);
      if (gRec) body.appendChild(gRec);
    }

    modal.appendChild(header);
    modal.appendChild(body);
    overlay.appendChild(modal);

    document.body.appendChild(overlay);
    this.modalEl = overlay;
  }
}

