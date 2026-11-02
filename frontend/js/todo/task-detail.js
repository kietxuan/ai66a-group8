import { createElement } from '../utils/dom.js';
import { api } from '../api.js';
import { Toast } from '../components/toast.js';
import { store } from '../store.js';
import { formatDate } from '../utils/date.js';
import { soundManager } from '../utils/sound.js';
import { EventForm } from '../calendar/event-form.js';

export class TaskDetail {
  constructor(container, { onUpdate = null, onClose = null } = {}) {
    this.container = container;
    this.onUpdate = onUpdate;
    this.onClose = onClose;
    this.task = null;
  }

  show(task) {
    this.task = task;
    this.render();
  }

  hide() {
    this.task = null;
    this.container.innerHTML = '';
  }

  notifyChanged(action = 'update') {
    window.dispatchEvent(new CustomEvent('planify:data-changed', {
      detail: { source: 'task-detail', action, type: 'task', id: this.task?.id }
    }));
    document.dispatchEvent(new CustomEvent('task-changed', {
      detail: { action, task: this.task }
    }));
    if (this.onUpdate) this.onUpdate();
  }

  render() {
    if (!this.task) {
      this.hide();
      return;
    }

    const t = this.task;
    const taskLists = store.get('taskLists') || [];
    this.container.innerHTML = '';

    const panel = createElement('div', {
      className: 'task-detail-panel',
      style: { height: '100%', overflowY: 'auto', padding: '18px' }
    });

    // 1. Header
    const header = createElement('div', {
      className: 'flex items-center justify-between',
      style: { marginBottom: '14px' }
    }, [
      createElement('button', {
        type: 'button',
        className: 'btn btn-secondary btn-xs',
        textContent: '✏️ Mở Form đầy đủ',
        onclick: () => {
          EventForm.showFullModal({
            task: t,
            onUpdated: () => this.notifyChanged('update'),
            onDeleted: () => {
              this.hide();
              if (this.onClose) this.onClose();
              this.notifyChanged('delete');
            }
          });
        }
      }),
      createElement('button', {
        type: 'button',
        className: 'btn-icon',
        innerHTML: '&times;',
        title: 'Đóng cửa sổ chi tiết (hoặc bấm lại vào thẻ việc)',
        onclick: () => {
          this.hide();
          if (this.onClose) this.onClose();
        }
      })
    ]);

    // 2. Title Row (Checkbox + Title edit + Star)
    const titleRow = createElement('div', {
      className: 'flex items-center gap-sm',
      style: { marginBottom: '14px' }
    });

    const checkbox = createElement('div', {
      className: 'task-checkbox',
      onclick: async () => {
        const nextState = !t.is_completed;
        if (nextState) {
          soundManager.playTaskComplete();
        }
        await api.patch(`/tasks/${t.id}/complete`, { is_completed: nextState });
        t.is_completed = nextState;
        this.render();
        this.notifyChanged('complete');
      }
    }, [
      t.is_completed ? createElement('span', { style: { color: '#fff', fontSize: '12px' }, textContent: '✓' }) : null
    ]);

    const titleInput = createElement('input', {
      type: 'text',
      className: 'input flex-1',
      value: t.title,
      style: { fontWeight: '700', textDecoration: t.is_completed ? 'line-through' : 'none' },
      onchange: async () => {
        const val = titleInput.value.trim();
        if (val) {
          await api.put(`/tasks/${t.id}`, { title: val });
          t.title = val;
          this.notifyChanged('update');
        }
      }
    });

    const starBtn = createElement('button', {
      type: 'button',
      className: `task-star-btn ${t.is_important ? 'starred' : ''}`,
      title: 'Đánh dấu Quan trọng',
      innerHTML: t.is_important ? '&#9733;' : '&#9734;',
      onclick: async () => {
        const nextState = !t.is_important;
        await api.patch(`/tasks/${t.id}/important`, { is_important: nextState });
        t.is_important = nextState;
        this.render();
        this.notifyChanged('important');
      }
    });

    titleRow.appendChild(checkbox);
    titleRow.appendChild(titleInput);
    titleRow.appendChild(starBtn);

    // 3. Completion Mode Toggle (Phải tích vs Tự động hoàn thành khi hết giờ)
    const modeCard = createElement('div', {
      style: {
        padding: '10px 12px',
        borderRadius: '10px',
        backgroundColor: t.auto_complete ? 'var(--color-primary-light)' : 'var(--color-bg-secondary)',
        border: `1px solid ${t.auto_complete ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
        marginBottom: '16px',
        cursor: 'pointer'
      },
      onclick: async () => {
        const nextAuto = !t.auto_complete;
        await api.put(`/tasks/${t.id}`, { auto_complete: nextAuto });
        t.auto_complete = nextAuto;
        Toast.success(nextAuto ? 'Đã bật chế độ Sự kiện (Tự động hoàn thành khi hết giờ)' : 'Đã chuyển về chế độ Phải tích thủ công mới hoàn thành');
        this.render();
        this.notifyChanged('auto_complete');
      }
    }, [
      createElement('div', { style: { fontSize: '12.5px', fontWeight: '800', color: 'var(--color-text-primary)' }, textContent: t.auto_complete ? '⚡ Chế độ: Sự kiện (Tự động hoàn thành)' : '☑️ Chế độ: Phải tích mới hoàn thành' }),
      createElement('div', { style: { fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }, textContent: 'Bấm vào đây để chuyển đổi chế độ hoàn thành' })
    ]);

    // 4. Steps (Subtasks) List
    const stepsSection = createElement('div', {
      className: 'flex flex-col gap-xs',
      style: { marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--color-border-light)' }
    });

    stepsSection.appendChild(createElement('div', {
      style: { fontSize: '12px', fontWeight: '700', color: 'var(--color-text-secondary)', marginBottom: '4px' },
      textContent: `Các bước thực hiện (${t.steps?.filter(s => s.is_completed).length || 0}/${t.steps?.length || 0})`
    }));

    (t.steps || []).forEach(step => {
      const stepRow = createElement('div', {
        className: 'flex items-center gap-sm',
        style: { padding: '3px 0' }
      });

      const stepCheck = createElement('input', {
        type: 'checkbox',
        checked: step.is_completed,
        onchange: async (e) => {
          step.is_completed = e.target.checked;
          await api.patch(`/tasks/${t.id}/steps/${step.id}/complete`, { is_completed: step.is_completed });
          this.render();
          this.notifyChanged('step_complete');
        }
      });

      const stepText = createElement('input', {
        type: 'text',
        className: 'input flex-1',
        value: step.title,
        style: {
          padding: '4px 8px',
          fontSize: '12px',
          textDecoration: step.is_completed ? 'line-through' : 'none'
        },
        onchange: async () => {
          const val = stepText.value.trim();
          if (val) {
            await api.put(`/tasks/${t.id}/steps/${step.id}`, { title: val });
            step.title = val;
            this.notifyChanged('step_update');
          }
        }
      });

      const stepDelBtn = createElement('button', {
        type: 'button',
        className: 'btn-icon',
        style: { width: '24px', height: '24px', fontSize: '12px' },
        innerHTML: '&times;',
        onclick: async () => {
          await api.delete(`/tasks/${t.id}/steps/${step.id}`);
          t.steps = t.steps.filter(s => s.id !== step.id);
          this.render();
          this.notifyChanged('step_delete');
        }
      });

      stepRow.appendChild(stepCheck);
      stepRow.appendChild(stepText);
      stepRow.appendChild(stepDelBtn);
      stepsSection.appendChild(stepRow);
    });

    const addStepInput = createElement('input', {
      type: 'text',
      className: 'input',
      placeholder: '+ Thêm bước nhỏ... (Nhấn Enter)',
      style: { fontSize: '12px', marginTop: '4px' },
      onkeydown: async (e) => {
        if (e.key === 'Enter') {
          const val = addStepInput.value.trim();
          if (val) {
            const newStep = await api.post(`/tasks/${t.id}/steps`, { title: val });
            if (!t.steps) t.steps = [];
            t.steps.push(newStep);
            addStepInput.value = '';
            this.render();
            this.notifyChanged('step_add');
          }
        }
      }
    });
    stepsSection.appendChild(addStepInput);

    // 5. Date, Time & List Controls
    const actionsGroup = createElement('div', {
      className: 'flex flex-col gap-sm',
      style: { marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--color-border-light)' }
    });

    const dueHeaderRow = createElement('div', { className: 'flex items-center justify-between' }, [
      createElement('label', { className: 'form-label', style: { marginBottom: 0 }, textContent: '📅 Ngày thực hiện (Trống = Vĩnh viễn)' }),
      t.due_date ? createElement('button', {
        type: 'button',
        className: 'btn btn-secondary btn-xs',
        textContent: '✕ Bỏ ngày (Vĩnh viễn)',
        onclick: async () => {
          await api.put(`/tasks/${t.id}`, { due_date: null, due_time: null, start_time: null, end_time: null, is_all_day: true });
          t.due_date = null;
          t.start_time = null;
          t.end_time = null;
          t.is_all_day = true;
          this.render();
          this.notifyChanged('due_date');
        }
      }) : null
    ]);

    const dueInput = createElement('input', {
      type: 'date',
      className: 'input',
      value: t.due_date ? String(t.due_date).slice(0, 10) : '',
      onchange: async (e) => {
        const val = e.target.value || null;
        await api.put(`/tasks/${t.id}`, { due_date: val });
        t.due_date = val;
        this.render();
        this.notifyChanged('due_date');
      }
    });

    actionsGroup.appendChild(dueHeaderRow);
    actionsGroup.appendChild(dueInput);

    // Time inputs
    const isAllDay = t.is_all_day !== false;
    const startTimeVal = t.start_time ? String(t.start_time).substring(0, 5) : '';
    const endTimeVal = t.end_time ? String(t.end_time).substring(0, 5) : '';

    const timeBlockSection = createElement('div', {
      className: 'form-group',
      style: {
        padding: '10px 12px',
        backgroundColor: 'var(--color-bg-secondary)',
        borderRadius: '10px',
        border: '1px solid var(--color-border-light)'
      }
    });

    const timeBlockHeader = createElement('div', {
      className: 'flex items-center justify-between'
    }, [
      createElement('label', {
        className: 'form-label',
        style: { marginBottom: 0, fontWeight: '700' },
        textContent: '🕒 Khung giờ trên Lịch'
      }),
      createElement('label', {
        className: 'flex items-center gap-xs cursor-pointer',
        style: { fontSize: '12px' }
      }, [
        createElement('input', {
          type: 'checkbox',
          checked: isAllDay,
          onchange: async (e) => {
            const nextAllDay = e.target.checked;
            const updates = { is_all_day: nextAllDay };
            if (!nextAllDay && !t.start_time) {
              updates.start_time = '09:00:00';
              updates.end_time = '10:00:00';
              updates.duration_minutes = 60;
              if (!t.due_date) updates.due_date = formatDate(new Date(), 'YYYY-MM-DD');
            }
            await api.put(`/tasks/${t.id}`, updates);
            Object.assign(t, updates);
            this.render();
            this.notifyChanged('time_blocking');
          }
        }),
        createElement('span', { textContent: 'Cả ngày' })
      ])
    ]);
    timeBlockSection.appendChild(timeBlockHeader);

    if (!isAllDay) {
      const timeInputsRow = createElement('div', {
        className: 'flex items-center gap-sm',
        style: { marginTop: '8px' }
      }, [
        createElement('div', { className: 'flex-1' }, [
          createElement('label', { style: { fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }, textContent: 'Bắt đầu' }),
          createElement('input', {
            type: 'time',
            className: 'input',
            value: startTimeVal || '09:00',
            onchange: async (e) => {
              const val = `${e.target.value}:00`;
              await api.put(`/tasks/${t.id}`, { start_time: val, due_time: val });
              t.start_time = val;
              this.notifyChanged('time_blocking');
            }
          })
        ]),
        createElement('div', { className: 'flex-1' }, [
          createElement('label', { style: { fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }, textContent: 'Kết thúc' }),
          createElement('input', {
            type: 'time',
            className: 'input',
            value: endTimeVal || '10:00',
            onchange: async (e) => {
              const val = e.target.value ? `${e.target.value}:00` : null;
              await api.put(`/tasks/${t.id}`, { end_time: val });
              t.end_time = val;
              this.notifyChanged('time_blocking');
            }
          })
        ])
      ]);
      timeBlockSection.appendChild(timeInputsRow);
    }

    actionsGroup.appendChild(timeBlockSection);

    const listRow = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', textContent: '📁 Thuộc danh sách' }),
      createElement('select', {
        className: 'select',
        onchange: async (e) => {
          const val = parseInt(e.target.value, 10);
          await api.put(`/tasks/${t.id}`, { list_id: val });
          t.list_id = val;
          this.notifyChanged('list_move');
        }
      }, taskLists.map(l => createElement('option', {
        value: l.id,
        textContent: `${l.icon || '📝'} ${l.name}`,
        selected: t.list_id === l.id
      })))
    ]);
    actionsGroup.appendChild(listRow);

    // 6. Notes textarea
    const notesSection = createElement('div', {
      className: 'form-group',
      style: { marginBottom: '16px' }
    }, [
      createElement('label', { className: 'form-label', textContent: '📝 Ghi chú' }),
      createElement('textarea', {
        className: 'textarea',
        rows: 3,
        placeholder: 'Thêm ghi chú chi tiết...',
        value: t.note || '',
        onchange: async (e) => {
          const val = e.target.value.trim() || null;
          await api.put(`/tasks/${t.id}`, { note: val });
          t.note = val;
        }
      })
    ]);

    // 7. Delete Button
    const deleteBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-danger',
      style: { width: '100%' },
      textContent: '🗑️ Xóa mục này',
      onclick: async () => {
        if (confirm(`Bạn có chắc chắn muốn xóa "${t.title}"?`)) {
          await api.delete(`/tasks/${t.id}`);
          Toast.success('Đã xóa thành công.');
          this.notifyChanged('delete');
          this.hide();
        }
      }
    });

    panel.appendChild(header);
    panel.appendChild(titleRow);
    panel.appendChild(modeCard);
    panel.appendChild(stepsSection);
    panel.appendChild(actionsGroup);
    panel.appendChild(notesSection);
    panel.appendChild(deleteBtn);

    this.container.appendChild(panel);
  }
}
