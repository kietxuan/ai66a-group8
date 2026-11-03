import { businessNow } from '../utils/date.js';
import { createElement } from '../utils/dom.js';
import { api } from '../api.js';
import { Toast } from '../components/toast.js';
import { store } from '../store.js';
import { formatDate } from '../utils/date.js';
import { soundManager } from '../utils/sound.js';
import { confirmDeleteItem } from '../utils/confirm-delete.js';
import { revisionOptions } from '../utils/revision.js';
import { isScheduleDismissal } from '../utils/api-error.js';
import { getAvailableCategories, resolveCategoryForTask } from './task-item.js';

export class TaskDetail {
  constructor(container, { onUpdate = null, onClose = null } = {}) {
    this.container = container;
    this.onUpdate = onUpdate;
    this.onClose = onClose;
    this.task = null;
    this.isSaving = false;
  }

  show(task) {
    this.task = task;
    this.render();
  }

  hide() {
    this.task = null;
    this.container.innerHTML = '';
  }

  notifyChanged(action = 'update', { preserveDetail = false } = {}) {
    window.dispatchEvent(new CustomEvent('planify:data-changed', {
      detail: { source: 'task-detail', action, type: 'task', id: this.task?.id }
    }));
    if (this.onUpdate) this.onUpdate({ preserveDetail });
  }

  render() {
    if (!this.task) {
      this.hide();
      return;
    }

    const t = this.task;
    const taskLists = store.get('taskLists') || [];
    const categories = getAvailableCategories();
    this.container.innerHTML = '';

    const panel = createElement('div', {
      className: 'task-detail-panel',
      style: { height: '100%', overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }
    });

    // 1. Header (Danh sách & Nút Đóng)
    const currentList = taskLists.find(l => l.id === t.list_id);
    const header = createElement('div', {
      className: 'flex items-center justify-between',
      style: { paddingBottom: '10px', borderBottom: '1px solid var(--color-border-light)' }
    }, [
      createElement('div', {
        className: 'flex items-center gap-xs',
        style: { fontSize: '13px', fontWeight: '600', color: 'var(--color-text-secondary)' }
      }, [
        createElement('span', { textContent: '📁' }),
        createElement('span', { textContent: currentList?.name || 'Công việc' })
      ]),
      createElement('button', {
        type: 'button',
        className: 'btn-icon',
        innerHTML: '&times;',
        style: { fontSize: '18px', width: '28px', height: '28px' },
        title: 'Đóng chi tiết',
        onclick: () => {
          this.hide();
          if (this.onClose) this.onClose();
        }
      })
    ]);

    // 2. Tiêu đề công việc
    const titleInput = createElement('input', {
      type: 'text',
      className: 'input',
      value: t.title || '',
      placeholder: 'Tên việc cần làm...',
      style: {
        fontSize: '15px',
        fontWeight: '700',
        padding: '10px 12px',
        textDecoration: t.is_completed ? 'line-through' : 'none'
      }
    });

    // 3. Hàng trạng thái nhanh: Hoàn thành, Quan trọng (sao), Tự động hoàn thành
    let isImportant = Boolean(t.is_important);
    let isAutoComplete = Boolean(t.auto_complete);

    const quickRow = createElement('div', {
      className: 'flex items-center gap-md flex-wrap',
      style: { padding: '4px 0' }
    });

    // Checkbox hoàn thành
    const completeCheckbox = createElement('div', {
      className: 'task-checkbox',
      title: t.is_completed ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành',
      onclick: async () => {
        try {
          const nextState = !t.is_completed;
          const updated = await api.patch(`/tasks/${t.id}/complete`, { is_completed: nextState }, revisionOptions(t));
          if (updated?.updated_at) t.updated_at = updated.updated_at;
          t.is_completed = nextState;
          if (nextState) soundManager.playTaskComplete();
          this.render();
          this.notifyChanged('complete', { preserveDetail: true });
        } catch (err) {
          if (!isScheduleDismissal(err)) Toast.error(err.message || 'Không thể cập nhật trạng thái.');
        }
      }
    }, [
      t.is_completed ? createElement('span', { style: { color: '#fff', fontSize: '12px', fontWeight: 'bold' }, textContent: '✓' }) : null
    ]);

    const completeLabel = createElement('label', {
      className: 'flex items-center gap-xs cursor-pointer',
      style: { fontSize: '12.5px', fontWeight: '600', color: t.is_completed ? 'var(--color-success)' : 'var(--color-text-primary)' }
    }, [
      completeCheckbox,
      createElement('span', { textContent: t.is_completed ? 'Đã hoàn thành' : 'Chưa hoàn thành' })
    ]);

    // Star Quan trọng
    const starBtn = createElement('button', {
      type: 'button',
      className: `task-star-btn ${isImportant ? 'starred' : ''}`,
      style: { fontSize: '17px', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' },
      title: isImportant ? 'Bỏ đánh dấu Quan trọng' : 'Đánh dấu Quan trọng',
      innerHTML: isImportant ? '&#9733;' : '&#9734;',
      onclick: () => {
        isImportant = !isImportant;
        starBtn.className = `task-star-btn ${isImportant ? 'starred' : ''}`;
        starBtn.innerHTML = isImportant ? '&#9733;' : '&#9734;';
        starLabelText.style.color = isImportant ? '#D97706' : 'var(--color-text-secondary)';
      }
    });

    const starLabelText = createElement('span', {
      style: { fontSize: '12.5px', fontWeight: '600', color: isImportant ? '#D97706' : 'var(--color-text-secondary)' },
      textContent: 'Quan trọng'
    });

    const starWrap = createElement('div', {
      className: 'flex items-center gap-xs cursor-pointer',
      onclick: () => starBtn.click()
    }, [starBtn, starLabelText]);

    // Tự động hoàn thành
    const autoCheck = createElement('input', {
      type: 'checkbox',
      checked: isAutoComplete,
      style: { width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--color-primary)' },
      onchange: (e) => { isAutoComplete = e.target.checked; }
    });

    const autoLabel = createElement('label', {
      className: 'flex items-center gap-xs cursor-pointer',
      style: { fontSize: '12.5px', fontWeight: '500', color: 'var(--color-text-primary)' }
    }, [
      autoCheck,
      createElement('span', { textContent: 'Tự động hoàn thành khi hết giờ' })
    ]);

    quickRow.appendChild(completeLabel);
    quickRow.appendChild(starWrap);
    quickRow.appendChild(autoLabel);

    // 4. Hai cột: Thuộc danh sách & Phân loại thẻ
    const twoColSection = createElement('div', {
      style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }
    });

    // Danh sách select
    const listSelect = createElement('select', { className: 'input' },
      taskLists.map(l => createElement('option', {
        value: String(l.id),
        textContent: `${l.icon || '📝'} ${l.name}`,
        selected: t.list_id === l.id
      }))
    );
    const listGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', style: { fontSize: '11px', fontWeight: '700' }, textContent: 'Thuộc danh sách' }),
      listSelect
    ]);

    // Phân loại thẻ select
    const catSelect = createElement('select', { className: 'input' });
    const emptyCatOpt = createElement('option', { value: '', textContent: '— Chưa phân loại —' });
    emptyCatOpt.dataset.color = '';
    catSelect.appendChild(emptyCatOpt);

    let selectedColor = t.color || '';
    categories.forEach(c => {
      const opt = createElement('option', {
        value: c.name,
        textContent: c.name,
        selected: (t.category && t.category.toLowerCase() === c.name.toLowerCase()) ||
                  (t.color && t.color.toLowerCase() === c.color.toLowerCase())
      });
      opt.dataset.color = c.color;
      catSelect.appendChild(opt);
    });

    const tagColorPreview = createElement('span', {
      style: {
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        backgroundColor: selectedColor || 'transparent',
        display: selectedColor ? 'inline-block' : 'none',
        marginLeft: '6px'
      }
    });

    catSelect.onchange = () => {
      const opt = catSelect.options[catSelect.selectedIndex];
      selectedColor = opt?.dataset?.color || '';
      if (selectedColor) {
        tagColorPreview.style.backgroundColor = selectedColor;
        tagColorPreview.style.display = 'inline-block';
      } else {
        tagColorPreview.style.display = 'none';
      }
    };

    const catLabelWrap = createElement('div', { className: 'flex items-center justify-between' }, [
      createElement('label', { className: 'form-label', style: { fontSize: '11px', fontWeight: '700', marginBottom: 0 }, textContent: 'Phân loại thẻ' }),
      tagColorPreview
    ]);

    const catGroup = createElement('div', { className: 'form-group' }, [
      catLabelWrap,
      catSelect
    ]);

    twoColSection.appendChild(listGroup);
    twoColSection.appendChild(catGroup);

    // 5. Cài đặt thời gian (Schedule Box)
    // 4 ô: 2 trên 2 dưới
    // 2 ô bên trái: Ngày (trên) & Chu kỳ lặp (dưới)
    // 2 ô bên phải: Giờ bắt đầu (trên) & Giờ kết thúc (dưới)
    let scheduleEnabled = Boolean(t.due_date);
    let initialDate = t.due_date ? String(t.due_date).slice(0, 10) : formatDate(businessNow(), 'YYYY-MM-DD');
    let initialStartTime = t.start_time ? String(t.start_time).substring(0, 5) : (t.due_time ? String(t.due_time).substring(0, 5) : '09:00');
    let initialEndTime = t.end_time ? String(t.end_time).substring(0, 5) : '10:00';
    let isAllDay = Boolean(t.is_all_day);

    const scheduleBox = createElement('div', {
      style: {
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-light)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }
    });

    const scheduleHeader = createElement('div', {
      className: 'flex items-center justify-between'
    });

    const scheduleTitle = createElement('span', {
      style: { fontSize: '12.5px', fontWeight: '700', color: 'var(--color-text-primary)' },
      textContent: '🕒 Cài đặt thời gian'
    });

    const toggleScheduleBtn = createElement('button', {
      type: 'button',
      className: `btn btn-xs ${scheduleEnabled ? 'btn-secondary' : 'btn-primary'}`,
      textContent: scheduleEnabled ? 'Bỏ cài đặt thời gian' : 'Cài đặt thời gian',
      onclick: () => {
        scheduleEnabled = !scheduleEnabled;
        updateScheduleFieldsVisibility();
      }
    });

    scheduleHeader.appendChild(scheduleTitle);
    scheduleHeader.appendChild(toggleScheduleBtn);

    // Lưới 4 ô: 2 trên, 2 dưới
    const scheduleGrid = createElement('div', {
      style: {
        display: scheduleEnabled ? 'grid' : 'none',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px 12px',
        paddingTop: '8px',
        borderTop: '1px solid var(--color-border-light)'
      }
    });

    // Ô trái trên: Ngày
    const dateInput = createElement('input', {
      type: 'date',
      className: 'input',
      value: initialDate
    });
    const dateGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', style: { fontSize: '11px', fontWeight: '600' }, textContent: 'Ngày' }),
      dateInput
    ]);

    // Ô phải trên: Giờ bắt đầu
    const startTimeInput = createElement('input', {
      type: 'time',
      className: 'input',
      value: initialStartTime,
      disabled: isAllDay
    });
    const startTimeGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', style: { fontSize: '11px', fontWeight: '600' }, textContent: 'Giờ bắt đầu' }),
      startTimeInput
    ]);

    // Ô trái dưới: Chu kỳ lặp lại
    const recurrenceOptions = [
      { val: '', label: 'Không lặp lại' },
      { val: 'FREQ=DAILY', label: 'Hàng ngày' },
      { val: 'FREQ=WEEKLY', label: 'Hàng tuần' },
      { val: 'FREQ=MONTHLY', label: 'Hàng tháng' }
    ];
    const rruleSelect = createElement('select', { className: 'input' }, recurrenceOptions.map(o => {
      const opt = createElement('option', { value: o.val, textContent: o.label });
      if (t.recurrence_rule === o.val) opt.selected = true;
      return opt;
    }));
    const rruleGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', style: { fontSize: '11px', fontWeight: '600' }, textContent: 'Chu kỳ lặp' }),
      rruleSelect
    ]);

    // Ô phải dưới: Giờ kết thúc
    const endTimeInput = createElement('input', {
      type: 'time',
      className: 'input',
      value: initialEndTime,
      disabled: isAllDay
    });
    const endTimeGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', style: { fontSize: '11px', fontWeight: '600' }, textContent: 'Giờ kết thúc' }),
      endTimeInput
    ]);

    // Cả ngày checkbox (hàng dưới cùng)
    const allDayCheck = createElement('input', {
      type: 'checkbox',
      checked: isAllDay,
      style: { cursor: 'pointer', accentColor: 'var(--color-primary)' },
      onchange: (e) => {
        isAllDay = e.target.checked;
        startTimeInput.disabled = isAllDay;
        endTimeInput.disabled = isAllDay;
      }
    });
    const allDayLabel = createElement('label', {
      className: 'flex items-center gap-xs cursor-pointer',
      style: { gridColumn: '1 / -1', fontSize: '12px', fontWeight: '600', color: 'var(--color-text-secondary)' }
    }, [
      allDayCheck,
      createElement('span', { textContent: 'Cả ngày (Không đặt khung giờ cụ thể)' })
    ]);

    scheduleGrid.appendChild(dateGroup);
    scheduleGrid.appendChild(startTimeGroup);
    scheduleGrid.appendChild(rruleGroup);
    scheduleGrid.appendChild(endTimeGroup);
    scheduleGrid.appendChild(allDayLabel);

    const updateScheduleFieldsVisibility = () => {
      if (scheduleEnabled) {
        toggleScheduleBtn.className = 'btn btn-xs btn-secondary';
        toggleScheduleBtn.textContent = 'Bỏ cài đặt thời gian';
        scheduleGrid.style.display = 'grid';
      } else {
        toggleScheduleBtn.className = 'btn btn-xs btn-primary';
        toggleScheduleBtn.textContent = 'Cài đặt thời gian';
        scheduleGrid.style.display = 'none';
      }
    };

    scheduleBox.appendChild(scheduleHeader);
    scheduleBox.appendChild(scheduleGrid);

    // 6. Các bước thực hiện (Subtasks / Steps)
    const stepsSection = createElement('div', {
      className: 'flex flex-col gap-xs',
      style: {
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-light)'
      }
    });

    const stepsTitleRow = createElement('div', {
      className: 'flex items-center justify-between',
      style: { marginBottom: '6px' }
    }, [
      createElement('span', {
        style: { fontSize: '12px', fontWeight: '700', color: 'var(--color-text-primary)' },
        textContent: `Các bước thực hiện (${t.steps?.filter(s => s.is_completed).length || 0}/${t.steps?.length || 0})`
      })
    ]);
    stepsSection.appendChild(stepsTitleRow);

    const stepsListContainer = createElement('div', { className: 'flex flex-col gap-xs' });
    (t.steps || []).forEach(step => {
      const stepRow = createElement('div', {
        className: 'flex items-center gap-xs',
        style: { padding: '2px 0' }
      });

      const stepCheck = createElement('input', {
        type: 'checkbox',
        checked: Boolean(step.is_completed),
        style: { accentColor: 'var(--color-primary)', cursor: 'pointer' },
        onchange: async (e) => {
          step.is_completed = e.target.checked;
          try {
            await api.patch(`/tasks/${t.id}/steps/${step.id}/complete`, { is_completed: step.is_completed });
            this.render();
            this.notifyChanged('step_complete', { preserveDetail: true });
          } catch (err) {
            Toast.error('Không thể cập nhật bước');
          }
        }
      });

      const stepInput = createElement('input', {
        type: 'text',
        className: 'input flex-1',
        value: step.title,
        style: {
          padding: '4px 8px',
          fontSize: '12px',
          textDecoration: step.is_completed ? 'line-through' : 'none'
        },
        onchange: async () => {
          const val = stepInput.value.trim();
          if (val && val !== step.title) {
            try {
              await api.put(`/tasks/${t.id}/steps/${step.id}`, { title: val });
              step.title = val;
              this.notifyChanged('step_update', { preserveDetail: true });
            } catch (err) {
              Toast.error('Không thể lưu tên bước');
            }
          }
        }
      });

      const stepDelBtn = createElement('button', {
        type: 'button',
        className: 'btn-icon',
        style: { width: '22px', height: '22px', fontSize: '13px' },
        innerHTML: '&times;',
        title: 'Xóa bước này',
        onclick: async () => {
          if (!confirmDeleteItem({ title: step.title })) return;
          try {
            await api.delete(`/tasks/${t.id}/steps/${step.id}`);
            t.steps = t.steps.filter(s => s.id !== step.id);
            this.render();
            this.notifyChanged('step_delete', { preserveDetail: true });
          } catch (err) {
            Toast.error('Lỗi khi xóa bước');
          }
        }
      });

      stepRow.appendChild(stepCheck);
      stepRow.appendChild(stepInput);
      stepRow.appendChild(stepDelBtn);
      stepsListContainer.appendChild(stepRow);
    });
    stepsSection.appendChild(stepsListContainer);

    const addStepInput = createElement('input', {
      type: 'text',
      className: 'input',
      placeholder: '+ Thêm bước nhỏ... (Nhấn Enter)',
      style: { fontSize: '12px', marginTop: '6px' },
      onkeydown: async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = addStepInput.value.trim();
          if (val) {
            try {
              const newStep = await api.post(`/tasks/${t.id}/steps`, { title: val });
              if (!t.steps) t.steps = [];
              t.steps.push(newStep);
              addStepInput.value = '';
              this.render();
              this.notifyChanged('step_add', { preserveDetail: true });
            } catch (err) {
              Toast.error('Không thể thêm bước mới');
            }
          }
        }
      }
    });
    stepsSection.appendChild(addStepInput);

    // 7. Địa điểm
    const locationInput = createElement('input', {
      type: 'text',
      className: 'input',
      placeholder: 'Thêm địa điểm / vị trí...',
      value: t.location || '',
      style: { fontSize: '13px' }
    });
    const locationGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', style: { fontSize: '11px', fontWeight: '700' }, textContent: '📍 Địa điểm' }),
      locationInput
    ]);

    // 8. Ghi chú
    const notesTextarea = createElement('textarea', {
      className: 'textarea',
      rows: 3,
      placeholder: 'Thêm ghi chú chi tiết...',
      value: t.note || '',
      style: { fontSize: '12.5px', resize: 'vertical' }
    });
    const notesGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', style: { fontSize: '11px', fontWeight: '700' }, textContent: '📝 Ghi chú' }),
      notesTextarea
    ]);

    // 9. Nút Lưu thay đổi (Primary) và Nút Xóa (Danger)
    const saveBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-primary',
      style: { width: '100%', padding: '10px 16px', fontSize: '13.5px', fontWeight: '700' },
      textContent: '💾 Lưu thay đổi',
      onclick: async () => {
        if (this.isSaving) return;
        const newTitle = titleInput.value.trim();
        if (!newTitle) {
          Toast.error('Tiêu đề công việc không được để trống');
          titleInput.focus();
          return;
        }

        this.isSaving = true;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Đang lưu...';

        try {
          const updates = {
            title: newTitle,
            list_id: parseInt(listSelect.value, 10),
            is_important: isImportant,
            auto_complete: isAutoComplete,
            color: selectedColor || null,
            category: catSelect.value || null,
            location: locationInput.value.trim() || null,
            note: notesTextarea.value.trim() || null,
          };

          if (scheduleEnabled) {
            updates.due_date = dateInput.value || null;
            updates.is_all_day = isAllDay;
            updates.recurrence_rule = rruleSelect.value || null;
            if (isAllDay) {
              updates.start_time = null;
              updates.end_time = null;
              updates.due_time = null;
            } else {
              updates.start_time = startTimeInput.value ? `${startTimeInput.value}:00` : null;
              updates.end_time = endTimeInput.value ? `${endTimeInput.value}:00` : null;
              updates.due_time = updates.start_time;
            }
          } else {
            updates.due_date = null;
            updates.start_time = null;
            updates.end_time = null;
            updates.due_time = null;
            updates.is_all_day = true;
            updates.recurrence_rule = null;
          }

          const result = await api.put(`/tasks/${t.id}`, updates, revisionOptions(t));
          Object.assign(t, updates);
          if (result?.updated_at) t.updated_at = result.updated_at;

          Toast.success('Đã lưu thay đổi công việc thành công!');
          this.notifyChanged('update', { preserveDetail: true });
        } catch (err) {
          if (!isScheduleDismissal(err)) {
            Toast.error(err.message || 'Lỗi khi lưu thay đổi công việc');
          }
        } finally {
          this.isSaving = false;
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 Lưu thay đổi';
        }
      }
    });

    const deleteBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-danger',
      style: { width: '100%', padding: '8px 14px', fontSize: '12.5px' },
      textContent: '🗑️ Xóa công việc này',
      onclick: async () => {
        if (!confirmDeleteItem(t)) return;
        try {
          await api.delete(`/tasks/${t.id}`);
          Toast.success('Đã xóa công việc thành công');
          this.hide();
          if (this.onClose) this.onClose();
          this.notifyChanged('delete');
        } catch (err) {
          Toast.error(err.message || 'Lỗi khi xóa công việc');
        }
      }
    });

    const actionsContainer = createElement('div', {
      className: 'flex flex-col gap-xs',
      style: { marginTop: '8px', paddingTop: '12px', borderTop: '1px solid var(--color-border-light)' }
    }, [
      saveBtn,
      deleteBtn
    ]);

    panel.appendChild(header);
    panel.appendChild(titleInput);
    panel.appendChild(quickRow);
    panel.appendChild(twoColSection);
    panel.appendChild(scheduleBox);
    panel.appendChild(stepsSection);
    panel.appendChild(locationGroup);
    panel.appendChild(notesGroup);
    panel.appendChild(actionsContainer);

    this.container.appendChild(panel);
  }
}
