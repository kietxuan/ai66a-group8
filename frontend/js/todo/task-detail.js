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
    this.beforeUnload = event => {
      if (this.isSaving || this.isDirty()) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', this.beforeUnload);
  }

  show(task) {
    this.task = task;
    this.render();
  }

  hide() {
    this.task = null;
    this.getDraft = null;
    this.container.innerHTML = '';
  }

  destroy() {
    window.removeEventListener('beforeunload', this.beforeUnload);
    this.hide();
  }

  isDirty() {
    return Boolean(this.task && this.getDraft && JSON.stringify(this.getDraft()) !== this.initialDraft);
  }

  canLeave() {
    if (this.isSaving) { Toast.info('Vui lòng chờ thao tác đang lưu hoàn tất.'); return false; }
    return !this.isDirty() || confirm('Bạn có thay đổi chưa lưu. Bạn có muốn bỏ các thay đổi này không?');
  }

  async mutate(action) {
    if (this.isSaving) return;
    this.isSaving = true;
    const fields = [...this.container.querySelectorAll('input, textarea, select, button')];
    const disabled = fields.map(field => field.disabled);
    fields.forEach(field => { field.disabled = true; });
    try { return await action(); }
    finally {
      this.isSaving = false;
      fields.forEach((field, index) => { field.disabled = disabled[index]; });
      this.updateDirtyState?.();
    }
  }

  refreshPreservingDraft() {
    const draft = this.getDraft?.();
    this.render();
    if (draft) this.restoreDraft?.(draft);
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
      maxlength: 500,
      'aria-label': 'Tên việc cần làm',
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
        if (this.isSaving) return;
        try {
          const nextState = !t.is_completed;
          const updated = await this.mutate(() => api.patch(`/tasks/${t.id}/complete`, { is_completed: nextState }, revisionOptions(t)));
          Object.assign(t, updated);
          if (this.task !== t) return;
          if (nextState) soundManager.playTaskComplete();
          this.refreshPreservingDraft();
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
      onclick: (event) => {
        event.stopPropagation();
        if (this.isSaving) return;
        isImportant = !isImportant;
        starBtn.className = `task-star-btn ${isImportant ? 'starred' : ''}`;
        starBtn.innerHTML = isImportant ? '&#9733;' : '&#9734;';
        starLabelText.style.color = isImportant ? '#D97706' : 'var(--color-text-secondary)';
        this.updateDirtyState?.();
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
    const listSelect = createElement('select', { className: 'input', 'aria-label': 'Thuộc danh sách' },
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
    const catSelect = createElement('select', { className: 'input', 'aria-label': 'Phân loại thẻ' });
    const emptyCatOpt = createElement('option', { value: '', textContent: '— Chưa phân loại —' });
    emptyCatOpt.dataset.color = '';
    catSelect.appendChild(emptyCatOpt);

    let selectedColor = t.color || '';
    categories.forEach(c => {
      const opt = createElement('option', {
        value: c.name,
        textContent: c.name,
        selected: (t.category && t.category.toLowerCase() === c.name.toLowerCase()) ||
                  (!t.category && t.color && t.color.toLowerCase() === c.color.toLowerCase())
      });
      opt.dataset.color = c.color;
      catSelect.appendChild(opt);
    });
    if (t.color && !t.category && !categories.some(c => c.color?.toLowerCase() === t.color.toLowerCase())) {
      const retained = createElement('option', { value: '__current_color', textContent: 'Thẻ màu hiện tại (giữ nguyên)', selected: true });
      retained.dataset.color = t.color;
      catSelect.appendChild(retained);
    }

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
        this.updateDirtyState?.();
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
      'aria-label': 'Ngày',
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
      'aria-label': 'Giờ bắt đầu',
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
    if (t.recurrence_rule && !recurrenceOptions.some(option => option.val === t.recurrence_rule)) {
      recurrenceOptions.push({ val: t.recurrence_rule, label: 'Chu kỳ hiện tại (giữ nguyên)' });
    }
    const rruleSelect = createElement('select', { className: 'input', 'aria-label': 'Chu kỳ lặp' }, recurrenceOptions.map(o => {
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
      'aria-label': 'Giờ kết thúc',
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
          if (this.isSaving) { e.target.checked = step.is_completed; return; }
          const next = e.target.checked;
          try {
            await this.mutate(() => api.patch(`/tasks/${t.id}/steps/${step.id}/complete`, { is_completed: next }));
            step.is_completed = next;
            if (this.task !== t) return;
            this.refreshPreservingDraft();
            this.notifyChanged('step_complete', { preserveDetail: true });
          } catch (err) {
            e.target.checked = step.is_completed;
            Toast.error('Không thể cập nhật bước');
          }
        }
      });

      const stepInput = createElement('input', {
        type: 'text',
        className: 'input flex-1',
        value: step.title,
        maxlength: 500,
        style: {
          padding: '4px 8px',
          fontSize: '12px',
          textDecoration: step.is_completed ? 'line-through' : 'none'
        },
        onchange: async () => {
          if (this.isSaving) return;
          const val = stepInput.value.trim();
          if (!val) { stepInput.value = step.title; Toast.error('Tên bước không được để trống.'); return; }
          if (val && val !== step.title) {
            try {
              await this.mutate(() => api.put(`/tasks/${t.id}/steps/${step.id}`, { title: val }));
              step.title = val;
              this.notifyChanged('step_update', { preserveDetail: true });
            } catch (err) {
              stepInput.value = step.title;
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
          if (this.isSaving) return;
          if (!confirmDeleteItem({ title: step.title })) return;
          try {
            await this.mutate(() => api.delete(`/tasks/${t.id}/steps/${step.id}`));
            t.steps = t.steps.filter(s => s.id !== step.id);
            if (this.task !== t) return;
            this.refreshPreservingDraft();
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
      maxlength: 500,
      style: { fontSize: '12px', marginTop: '6px' },
      onkeydown: async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (this.isSaving) return;
          const val = addStepInput.value.trim();
          if (val) {
            try {
              const newStep = await this.mutate(() => api.post(`/tasks/${t.id}/steps`, { title: val }));
              if (!t.steps) t.steps = [];
              t.steps.push(newStep);
              addStepInput.value = '';
              if (this.task !== t) return;
              this.refreshPreservingDraft();
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
      maxlength: 300,
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
      maxlength: 5000,
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
        if (newTitle.length > 500 || notesTextarea.value.length > 5000 || locationInput.value.length > 300) {
          Toast.error('Tiêu đề tối đa 500, ghi chú 5.000 và địa điểm 300 ký tự.'); return;
        }
        if (scheduleEnabled && (!dateInput.value || (!isAllDay && (!startTimeInput.value || !endTimeInput.value || endTimeInput.value <= startTimeInput.value)))) {
          Toast.error('Vui lòng nhập ngày hợp lệ và giờ kết thúc sau giờ bắt đầu.'); return;
        }
        if (!this.isDirty()) return;
        if (addStepInput.value.trim()) { Toast.info('Nhấn Enter để thêm bước nhỏ trước khi lưu.'); addStepInput.focus(); return; }
        saveBtn.textContent = 'Đang lưu...';

        try {
          const updates = {
            title: newTitle,
            list_id: parseInt(listSelect.value, 10),
            is_important: isImportant,
            auto_complete: isAutoComplete,
            color: selectedColor || null,
            category: catSelect.value && catSelect.value !== '__current_color' ? catSelect.value : null,
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

          // Editing a note/star must not resubmit an unchanged schedule (and
          // trigger overlap checks or truncate seconds from existing times).
          const original = JSON.parse(this.initialDraft);
          const draft = this.getDraft();
          for (const [key, field] of Object.entries({ title: 'title', list: 'list_id', important: 'is_important', auto: 'auto_complete', color: 'color', category: 'category', location: 'location', note: 'note' })) {
            if (draft[key] === original[key]) delete updates[field];
          }
          const scheduleFields = ['scheduled', 'date', 'allDay', 'start', 'end', 'rule'];
          if (scheduleFields.every(key => draft[key] === original[key])) {
            for (const field of ['due_date', 'is_all_day', 'start_time', 'end_time', 'due_time', 'recurrence_rule']) delete updates[field];
          } else if (scheduleEnabled && !isAllDay && original.scheduled && !original.allDay) {
            if (draft.start === original.start) { delete updates.start_time; delete updates.due_time; }
            if (draft.end === original.end) delete updates.end_time;
          }
          const result = await this.mutate(() => api.put(`/tasks/${t.id}`, updates, revisionOptions(t)));
          Object.assign(t, result);
          if (this.task !== t) return;
          this.initialDraft = JSON.stringify(this.getDraft());
          this.updateDirtyState();

          Toast.success('Đã lưu thay đổi công việc thành công!');
          this.notifyChanged('update', { preserveDetail: true });
        } catch (err) {
          if (!isScheduleDismissal(err)) {
            Toast.error(err.message || 'Lỗi khi lưu thay đổi công việc');
          }
        } finally {
          this.updateDirtyState?.();
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
        if (this.isSaving) return;
        if (!confirmDeleteItem(t)) return;
        try {
          await this.mutate(() => api.delete(`/tasks/${t.id}`));
          Toast.success('Đã xóa công việc thành công');
          this.notifyChanged('delete');
          this.hide();
          if (this.onClose) this.onClose();
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
    this.getDraft = () => ({
      title: titleInput.value, list: listSelect.value, important: isImportant,
      auto: autoCheck.checked, color: selectedColor, category: catSelect.value,
      scheduled: scheduleEnabled, date: dateInput.value, allDay: isAllDay,
      start: startTimeInput.value, end: endTimeInput.value, rule: rruleSelect.value,
      location: locationInput.value, note: notesTextarea.value, stepDraft: addStepInput.value
    });
    this.initialDraft = JSON.stringify(this.getDraft());
    this.updateDirtyState = () => { saveBtn.disabled = this.isSaving || !this.isDirty(); };
    this.restoreDraft = draft => {
      titleInput.value = draft.title; listSelect.value = draft.list;
      if (isImportant !== draft.important) starBtn.click();
      isAutoComplete = draft.auto; autoCheck.checked = draft.auto;
      catSelect.value = draft.category; selectedColor = draft.color; catSelect.onchange();
      scheduleEnabled = draft.scheduled; updateScheduleFieldsVisibility();
      dateInput.value = draft.date; isAllDay = draft.allDay; allDayCheck.checked = draft.allDay;
      startTimeInput.value = draft.start; endTimeInput.value = draft.end;
      startTimeInput.disabled = endTimeInput.disabled = draft.allDay;
      rruleSelect.value = draft.rule; locationInput.value = draft.location;
      notesTextarea.value = draft.note; addStepInput.value = draft.stepDraft;
      this.updateDirtyState();
    };
    panel.addEventListener('input', this.updateDirtyState);
    panel.addEventListener('change', this.updateDirtyState);
    this.updateDirtyState();
  }
}
