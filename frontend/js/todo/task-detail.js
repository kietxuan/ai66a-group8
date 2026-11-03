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
    this.saveTimer = null;
  }

  show(task) {
    this.task = task;
    this.render();
  }

  hide() {
    this.task = null;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.container.innerHTML = '';
  }

  isDirty() {
    return false;
  }

  canLeave() {
    return true;
  }

  destroy() {
    this.hide();
  }

  notifyChanged(action = 'update', { preserveDetail = false } = {}) {
    window.dispatchEvent(new CustomEvent('planify:data-changed', {
      detail: { source: 'task-detail', action, type: 'task', id: this.task?.id }
    }));
    if (this.onUpdate) this.onUpdate({ preserveDetail });
  }

  debouncedSave(fields) {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveDirectly(fields);
    }, 350);
  }

  async saveDirectly(fields) {
    if (!this.task?.id) return;
    try {
      const payload = { ...fields };
      const updated = await api.put(`/tasks/${this.task.id}`, payload, revisionOptions(this.task));
      if (updated) {
        Object.assign(this.task, updated);
        if (updated.updated_at) this.task.updated_at = updated.updated_at;
      }
      this.notifyChanged('edit', { preserveDetail: true });
    } catch (err) {
      if (!isScheduleDismissal(err)) {
        Toast.error(err.message || 'Không thể lưu thay đổi');
      }
    }
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
      style: { height: '100%', overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }
    });

    // 1. Header: "Chi tiết công việc" & Nút Đóng
    const header = createElement('div', {
      className: 'flex items-center justify-between',
      style: { paddingBottom: '10px', borderBottom: '1px solid var(--color-border-light)' }
    }, [
      createElement('div', {
        className: 'flex items-center gap-xs',
        style: { fontSize: '14px', fontWeight: '700', color: 'var(--color-text-primary)' }
      }, [
        createElement('span', { textContent: '📋' }),
        createElement('span', { textContent: 'Chi tiết công việc' })
      ]),
      createElement('button', {
        type: 'button',
        className: 'btn-icon',
        innerHTML: '&times;',
        style: { fontSize: '20px', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        title: 'Đóng chi tiết',
        onclick: () => {
          this.hide();
          if (this.onClose) this.onClose();
        }
      })
    ]);

    // 2. Tiêu đề: Nhãn Tiêu đề * ở trên, dưới là ô tích tròn + input tiêu đề
    const titleLabel = createElement('label', {
      className: 'form-label',
      style: { fontSize: '13px', fontWeight: '700', marginBottom: '6px' },
      textContent: 'Tiêu đề *'
    });

    const completeCheckbox = createElement('div', {
      className: `task-checkbox ${t.is_completed ? 'checked' : ''}`,
      style: {
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        border: t.is_completed ? '2px solid var(--color-success, #10B981)' : '2px solid var(--color-text-secondary)',
        backgroundColor: t.is_completed ? 'var(--color-success, #10B981)' : 'transparent',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: '0',
        transition: 'all 0.15s ease'
      },
      title: t.is_completed ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành',
      onclick: async () => {
        try {
          const nextState = !t.is_completed;
          t.is_completed = nextState;
          if (nextState) soundManager.playTaskComplete();
          titleInput.style.textDecoration = nextState ? 'line-through' : 'none';
          completeCheckbox.style.borderColor = nextState ? 'var(--color-success, #10B981)' : 'var(--color-text-secondary)';
          completeCheckbox.style.backgroundColor = nextState ? 'var(--color-success, #10B981)' : 'transparent';
          if (nextState) {
            completeCheckbox.replaceChildren(
              createElement('span', { style: { color: '#ffffff', fontSize: '12px', fontWeight: 'bold', lineHeight: '1' }, textContent: '✓' })
            );
          } else {
            completeCheckbox.replaceChildren();
          }
          completeCheckbox.classList.toggle('checked', nextState);
          completeCheckbox.title = nextState ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành';

          const updated = await api.patch(`/tasks/${t.id}/complete`, { is_completed: nextState }, revisionOptions(t));
          if (updated?.updated_at) t.updated_at = updated.updated_at;
          this.notifyChanged('complete', { preserveDetail: true });
        } catch (err) {
          if (!isScheduleDismissal(err)) Toast.error(err.message || 'Không thể cập nhật trạng thái.');
        }
      }
    }, t.is_completed ? [
      createElement('span', { style: { color: '#ffffff', fontSize: '12px', fontWeight: 'bold', lineHeight: '1' }, textContent: '✓' })
    ] : []);

    const titleInput = createElement('input', {
      'aria-label': 'Tiêu đề Công việc',
      type: 'text',
      className: 'input flex-1',
      value: t.title || '',
      placeholder: 'Nhập tên công việc...',
      style: {
        fontSize: '15px',
        fontWeight: '700',
        padding: '11px 14px',
        textDecoration: t.is_completed ? 'line-through' : 'none'
      },
      oninput: (e) => {
        t.title = e.target.value;
        this.debouncedSave({ title: t.title });
      },
      onchange: (e) => {
        const val = e.target.value.trim();
        if (val) {
          t.title = val;
          this.saveDirectly({ title: val });
        }
      }
    });

    const titleRow = createElement('div', {
      style: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }
    }, [
      completeCheckbox,
      titleInput
    ]);

    const titleGroup = createElement('div', { className: 'form-group' }, [
      titleLabel,
      titleRow
    ]);

    // 3. Tùy chọn Tự động hoàn thành & Quan trọng (Thứ tự và style giống modal form)
    let isImportant = Boolean(t.is_important);
    let isAutoComplete = Boolean(t.auto_complete);

    const checkRow = createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        padding: '2px 0'
      }
    });

    const autoCompleteCheck = createElement('input', {
      type: 'checkbox',
      checked: isAutoComplete,
      style: { width: '16px', height: '16px', accentColor: 'var(--color-primary)', cursor: 'pointer' },
      onchange: (e) => {
        isAutoComplete = e.target.checked;
        t.auto_complete = isAutoComplete;
        this.saveDirectly({ auto_complete: isAutoComplete });
      }
    });

    const autoCompleteLabel = createElement('label', {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        fontWeight: '600',
        color: 'var(--color-text-primary)',
        cursor: 'pointer',
        userSelect: 'none'
      }
    }, [
      autoCompleteCheck,
      createElement('span', { textContent: 'Tự động hoàn thành' })
    ]);

    const importantCheck = createElement('input', {
      type: 'checkbox',
      checked: isImportant,
      style: { display: 'none' }
    });

    const starIcon = createElement('span', {
      style: {
        fontSize: '18px',
        lineHeight: '1',
        color: isImportant ? '#F59E0B' : 'var(--color-text-muted)',
        transition: 'color 0.15s ease',
        userSelect: 'none'
      },
      textContent: isImportant ? '⭐' : '☆'
    });

    const importantLabel = createElement('label', {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '13px',
        fontWeight: '600',
        color: isImportant ? '#D97706' : 'var(--color-text-primary)',
        cursor: 'pointer',
        userSelect: 'none'
      }
    }, [
      importantCheck,
      starIcon,
      createElement('span', { textContent: 'Quan trọng' })
    ]);

    importantCheck.onchange = (e) => {
      isImportant = e.target.checked;
      starIcon.textContent = isImportant ? '⭐' : '☆';
      starIcon.style.color = isImportant ? '#F59E0B' : 'var(--color-text-muted)';
      importantLabel.style.color = isImportant ? '#D97706' : 'var(--color-text-primary)';
      t.is_important = isImportant;
      this.saveDirectly({ is_important: isImportant });
    };

    checkRow.appendChild(autoCompleteLabel);
    checkRow.appendChild(importantLabel);

    // 4. Thuộc danh sách & Phân loại (Lưới 2 cột giống modal form)
    const listSelect = createElement('select', { className: 'input', 'aria-label': 'Thuộc danh sách' },
      taskLists.map(l => createElement('option', {
        value: String(l.id),
        textContent: l.name,
        selected: t.list_id === l.id
      }))
    );
    listSelect.onchange = () => {
      const newListId = parseInt(listSelect.value, 10);
      t.list_id = newListId;
      this.saveDirectly({ list_id: newListId });
    };

    const catSelect = createElement('select', { className: 'input', 'aria-label': 'Phân loại' });
    const emptyCatOpt = createElement('option', { value: '', textContent: 'Chưa phân loại' });
    emptyCatOpt.dataset.color = '';
    catSelect.appendChild(emptyCatOpt);

    let selectedColor = t.color || '';
    const activeResolvedCat = resolveCategoryForTask(t);
    categories.forEach(c => {
      const opt = createElement('option', {
        value: c.name,
        textContent: c.name,
        selected: activeResolvedCat ? (c.name.toLowerCase() === activeResolvedCat.name.toLowerCase()) : false
      });
      opt.dataset.color = c.color;
      catSelect.appendChild(opt);
    });

    catSelect.onchange = () => {
      const opt = catSelect.options[catSelect.selectedIndex];
      selectedColor = opt?.dataset?.color || '';
      t.color = selectedColor || null;
      t.category = catSelect.value || null;
      this.saveDirectly({ color: t.color, category: t.category });
    };

    const listAndCategoryGrid = createElement('div', {
      style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }
    }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: 'Thuộc danh sách' }),
        listSelect
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: 'Phân loại' }),
        catSelect
      ])
    ]);

    // 5. Khối Thời gian (Đồng bộ nút Cài đặt thời gian / Bỏ cài đặt thời gian)
    let scheduleEnabled = Boolean(t.due_date);
    let initialDate = t.due_date ? String(t.due_date).slice(0, 10) : formatDate(businessNow(), 'YYYY-MM-DD');
    let initialStartTime = t.start_time ? String(t.start_time).substring(0, 5) : (t.due_time ? String(t.due_time).substring(0, 5) : '09:00');
    let initialEndTime = t.end_time ? String(t.end_time).substring(0, 5) : '10:00';
    let isAllDay = Boolean(t.is_all_day);

    const scheduleBox = createElement('div', {
      style: {
        padding: '12px 14px',
        borderRadius: '8px',
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-light)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }
    });

    const scheduleHeader = createElement('div', {
      style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%' }
    });

    const scheduleLabel = createElement('span', {
      style: { fontSize: '13px', fontWeight: '700', color: 'var(--color-text-primary)' },
      textContent: 'Thời gian'
    });

    const toggleScheduleBtn = createElement('button', {
      type: 'button',
      className: `btn btn-sm ${scheduleEnabled ? 'btn-secondary' : 'btn-primary'}`,
      style: { flexShrink: '0', whiteSpace: 'nowrap' },
      textContent: scheduleEnabled ? 'Bỏ cài đặt thời gian' : 'Cài đặt thời gian',
      onclick: () => {
        scheduleEnabled = !scheduleEnabled;
        refreshScheduleUI();
        saveSchedule();
      }
    });

    scheduleHeader.appendChild(scheduleLabel);
    scheduleHeader.appendChild(toggleScheduleBtn);

    const scheduleGrid = createElement('div', {
      style: {
        display: scheduleEnabled ? 'grid' : 'none',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px 14px',
        paddingTop: '8px',
        borderTop: '1px solid var(--color-border-light)'
      }
    });

    // Ngày
    const dateInput = createElement('input', {
      type: 'date',
      className: 'input',
      value: initialDate,
      onchange: () => saveSchedule()
    });
    const dateGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', textContent: 'Ngày' }),
      dateInput
    ]);

    // Giờ bắt đầu
    const startTimeInput = createElement('input', {
      type: isAllDay ? 'text' : 'time',
      className: 'input',
      value: isAllDay ? '--:--' : initialStartTime,
      disabled: isAllDay,
      style: isAllDay ? { opacity: '0.5', cursor: 'not-allowed', textAlign: 'center' } : {},
      onchange: () => {
        if (!isAllDay && startTimeInput.value) {
          initialStartTime = startTimeInput.value;
          saveSchedule();
        }
      }
    });
    const startTimeGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', textContent: 'Giờ bắt đầu' }),
      startTimeInput
    ]);

    // Chu kỳ lặp
    const recurrenceOptions = [
      { val: '', label: 'Không lặp lại' },
      { val: 'FREQ=DAILY', label: 'Hàng ngày' },
      { val: 'FREQ=WEEKLY', label: 'Hàng tuần' },
      { val: 'FREQ=MONTHLY', label: 'Hàng tháng' }
    ];
    const rruleSelect = createElement('select', {
      className: 'input',
      onchange: () => saveSchedule()
    }, recurrenceOptions.map(o => {
      const opt = createElement('option', { value: o.val, textContent: o.label });
      if (t.recurrence_rule === o.val) opt.selected = true;
      return opt;
    }));
    const rruleGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', textContent: 'Chu kỳ lặp lại' }),
      rruleSelect
    ]);

    // Giờ kết thúc
    const endTimeInput = createElement('input', {
      type: isAllDay ? 'text' : 'time',
      className: 'input',
      value: isAllDay ? '--:--' : initialEndTime,
      disabled: isAllDay,
      style: isAllDay ? { opacity: '0.5', cursor: 'not-allowed', textAlign: 'center' } : {},
      onchange: () => {
        if (!isAllDay && endTimeInput.value) {
          initialEndTime = endTimeInput.value;
          saveSchedule();
        }
      }
    });
    const endTimeGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', textContent: 'Giờ kết thúc' }),
      endTimeInput
    ]);

    // Checkbox Cả ngày
    const allDayCheck = createElement('input', {
      type: 'checkbox',
      checked: isAllDay,
      style: { width: '16px', height: '16px', accentColor: 'var(--color-primary)', cursor: 'pointer' },
      onchange: (e) => {
        isAllDay = e.target.checked;
        refreshAllDayUI();
        saveSchedule();
      }
    });
    const allDayLabel = createElement('label', {
      style: { display: 'flex', alignItems: 'center', gap: '8px', gridColumn: '1 / -1', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }
    }, [
      allDayCheck,
      createElement('span', { textContent: 'Cả ngày' })
    ]);

    const refreshAllDayUI = () => {
      if (isAllDay) {
        startTimeInput.type = 'text';
        startTimeInput.value = '--:--';
        startTimeInput.disabled = true;
        startTimeInput.style.opacity = '0.5';
        startTimeInput.style.cursor = 'not-allowed';
        startTimeInput.style.textAlign = 'center';

        endTimeInput.type = 'text';
        endTimeInput.value = '--:--';
        endTimeInput.disabled = true;
        endTimeInput.style.opacity = '0.5';
        endTimeInput.style.cursor = 'not-allowed';
        endTimeInput.style.textAlign = 'center';
      } else {
        startTimeInput.type = 'time';
        startTimeInput.value = initialStartTime;
        startTimeInput.disabled = false;
        startTimeInput.style.opacity = '1';
        startTimeInput.style.cursor = '';
        startTimeInput.style.textAlign = '';

        endTimeInput.type = 'time';
        endTimeInput.value = initialEndTime;
        endTimeInput.disabled = false;
        endTimeInput.style.opacity = '1';
        endTimeInput.style.cursor = '';
        endTimeInput.style.textAlign = '';
      }
    };

    const refreshScheduleUI = () => {
      if (scheduleEnabled) {
        toggleScheduleBtn.className = 'btn btn-secondary btn-sm';
        toggleScheduleBtn.textContent = 'Bỏ cài đặt thời gian';
        scheduleGrid.style.display = 'grid';
      } else {
        toggleScheduleBtn.className = 'btn btn-primary btn-sm';
        toggleScheduleBtn.textContent = 'Cài đặt thời gian';
        scheduleGrid.style.display = 'none';
      }
    };

    const saveSchedule = () => {
      const updates = {};
      if (scheduleEnabled) {
        updates.due_date = dateInput.value || null;
        updates.is_all_day = isAllDay;
        updates.recurrence_rule = rruleSelect.value || null;
        if (isAllDay) {
          updates.start_time = null;
          updates.end_time = null;
          updates.due_time = null;
        } else {
          updates.start_time = startTimeInput.value && startTimeInput.value !== '--:--' ? `${startTimeInput.value}:00` : null;
          updates.end_time = endTimeInput.value && endTimeInput.value !== '--:--' ? `${endTimeInput.value}:00` : null;
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
      this.saveDirectly(updates);
    };

    scheduleGrid.appendChild(dateGroup);
    scheduleGrid.appendChild(startTimeGroup);
    scheduleGrid.appendChild(rruleGroup);
    scheduleGrid.appendChild(endTimeGroup);
    scheduleGrid.appendChild(allDayLabel);

    scheduleBox.appendChild(scheduleHeader);
    scheduleBox.appendChild(scheduleGrid);

    // 6. Địa điểm & Ghi chú (Giống 100% modal form, không cần nhãn thừa)
    const locationInput = createElement('input', {
      type: 'text',
      className: 'input',
      placeholder: 'Địa điểm hoặc liên kết họp (tùy chọn)...',
      value: t.location || '',
      style: { fontSize: '13px' },
      onchange: () => {
        t.location = locationInput.value.trim() || null;
        this.saveDirectly({ location: t.location });
      }
    });

    const notesTextarea = createElement('textarea', {
      className: 'textarea',
      rows: 3,
      placeholder: 'Ghi chú chi tiết nội dung công việc...',
      value: t.note || '',
      style: { fontSize: '12.5px', resize: 'vertical' },
      oninput: () => {
        t.note = notesTextarea.value.trim() || null;
        this.debouncedSave({ note: t.note });
      },
      onchange: () => {
        t.note = notesTextarea.value.trim() || null;
        this.saveDirectly({ note: t.note });
      }
    });

    // 7. Nút Xóa công việc
    const deleteBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-danger',
      style: { width: '100%', padding: '9px 14px', fontSize: '13px', justifyContent: 'center', fontWeight: '600' },
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
      style: { marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--color-border-light)' }
    }, [
      deleteBtn
    ]);

    panel.appendChild(header);
    panel.appendChild(titleGroup);
    panel.appendChild(checkRow);
    panel.appendChild(listAndCategoryGrid);
    panel.appendChild(scheduleBox);
    panel.appendChild(locationInput);
    panel.appendChild(notesTextarea);
    panel.appendChild(actionsContainer);

    this.container.appendChild(panel);
  }
}
