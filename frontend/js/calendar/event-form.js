import { businessNow } from '../utils/date.js';
import { createElement } from '../utils/dom.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { formatDate } from '../utils/date.js';
import { recurrenceContext, eventDeleteUrl } from './rrule.js';
import { confirmDeleteItem } from '../utils/confirm-delete.js';
import { newRequestId } from '../utils/request-id.js';
import { buildEventRange, readEventRange, shiftEventDate } from './event-range.js';
import { TaskSteps } from '../todo/task-steps.js';
import { combinedItemNotes, buildNotesUpdate, NOTES_LIMIT } from '../utils/item-notes.js';

const PRESET_COLORS = [
  '#4F46E5', '#2563EB', '#0EA5E9', '#10B981',
  '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6'
];

export class EventForm {
  /**
   * Thống nhất 1 biểu mẫu đầy đủ duy nhất cho cả To Do và Calendar
   */
  static showQuickCreate(options = {}) {
    return this.showFullModal({
      ...options,
      fromCalendarSlot: Boolean(options.startAt && options.fromCalendarSlot !== false)
    });
  }

  /**
   * Biểu mẫu thống nhất cho Việc cần làm & Sự kiện (Unified Task & Event Modal)
   * - Mặc định: Phải tích mới hoàn thành (auto_complete = false)
   * - Task hoàn thành thủ công; Event tự hoàn thành khi hết thời gian.
   * - Mặc định không để thời gian (Vĩnh viễn -> nằm ở cột Cần làm và có thể kéo thả vào Lịch)
   *   trừ khi người dùng bật "Đặt thời gian" hoặc đang chỉnh sửa mục đã có lịch.
   */
  static async showFullModal({
    event = null,
    task = null,
    startAt = null,
    endAt = null,
    hasDate = false,
    fromCalendarSlot = false,
    defaultListId = null,
    onCreated,
    onUpdated,
    onDeleted
  } = {}) {
    if (Modal.activeModal?.beforeClose && Modal.activeModal.close() === false) return;
    let modalRef = null;
    let taskSteps = null;
    let createAttempt = null;
    const userId = store.get('user')?.id;

    // Gộp dữ liệu nếu đang sửa task hoặc event
    const existingItem = task || event || null;
    const isEdit = Boolean(existingItem && existingItem.id);
    const isLegacyEvent = Boolean(existingItem && existingItem.start_at && !existingItem.list_id && !existingItem._isTask);
    // Editing never silently converts a Task to an Event or creates a duplicate.
    let isMultiDay = isLegacyEvent;
    const usesEvent = () => isLegacyEvent || isMultiDay;
    const dialogTitle = () => usesEvent()
      ? (isEdit ? 'Chỉnh sửa sự kiện' : 'Thêm sự kiện mới')
      : (isEdit ? 'Chỉnh sửa công việc' : 'Thêm công việc mới');

    // Đảm bảo có danh sách taskLists trong store
    let taskLists = store.get('taskLists') || [];
    if (!taskLists.length) {
      try {
        taskLists = await api.get('/task-lists') || [];
        if (store.get('user')?.id !== userId) return;
        store.set('taskLists', taskLists);
      } catch (_) {}
    }

    if (!store.get('categories')) {
      try {
        const catRes = await api.get('/categories');
        if (store.get('user')?.id !== userId) return;
        store.set('categories', Array.isArray(catRes) ? catRes : (catRes?.data || []));
      } catch (_) {}
    }

    if (store.get('user')?.id !== userId) return;
    // Trạng thái ban đầu của các trường
    let selectedColor = existingItem?.color || '#4F46E5';
    let isImportant = Boolean(existingItem?.is_important);

    // Mặc định KHÔNG để thời gian (để nằm ở cột Cần làm & kéo vào lịch),
    // trừ khi đang sửa mục đã có due_date hoặc chọn trực tiếp từ ô trên lịch
    let scheduleEnabled = false;
    let initialDateStr = formatDate(businessNow(), 'YYYY-MM-DD');
    let initialStartTime = '09:00';
    let initialEndTime = '10:00';
    let isAllDay = false;
    let initialEndDateStr = initialDateStr;

    if (isEdit) {
      if (existingItem.due_date) {
        scheduleEnabled = true;
        initialDateStr = String(existingItem.due_date).slice(0, 10);
        isAllDay = Boolean(existingItem.is_all_day && !existingItem.start_time && !existingItem.due_time);
        if (existingItem.start_time || existingItem.due_time) {
          initialStartTime = String(existingItem.start_time || existingItem.due_time).slice(0, 5);
        }
        if (existingItem.end_time) {
          initialEndTime = String(existingItem.end_time).slice(0, 5);
        } else if (existingItem.start_time) {
          const [hh, mm] = initialStartTime.split(':').map(Number);
          const endH = Math.min(23, (hh || 9) + 1);
          initialEndTime = `${String(endH).padStart(2, '0')}:${String(mm || 0).padStart(2, '0')}`;
        }
      } else if (existingItem.start_at) {
        scheduleEnabled = true;
        const range = readEventRange(existingItem);
        initialDateStr = range.startDate;
        initialEndDateStr = range.endDate;
        initialStartTime = range.startTime;
        initialEndTime = range.endTime;
        isAllDay = Boolean(existingItem.is_all_day);
      }
    } else {
      scheduleEnabled = Boolean(hasDate || fromCalendarSlot);
      if (startAt) {
        const sDt = new Date(startAt);
        const eDt = endAt ? new Date(endAt) : new Date(sDt.getTime() + 3600000);
        initialDateStr = formatDate(sDt, 'YYYY-MM-DD');
        initialStartTime = formatDate(sDt, 'HH:mm');
        initialEndTime = formatDate(eDt, 'HH:mm');
      }
    }

    // 1. Tiêu đề
    const titleInput = createElement('input', {
      'aria-label': 'Tiêu đề Công việc',
      type: 'text',
      className: 'input',
      style: { fontSize: '15px', fontWeight: '700', padding: '11px 14px' },
      value: existingItem?.title || '',
      placeholder: 'Nhập tên công việc...',
      required: true
    });
    const titleLimit = () => usesEvent() ? 200 : 500;
    const titleError = createElement('small', { role: 'alert', style: { color: 'var(--color-danger, #dc2626)' } });

    // 2. Tùy chọn Tự động hoàn thành & Quan trọng (ngôi sao tick)
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
      checked: true,
      disabled: true,
      style: { width: '16px', height: '16px', accentColor: 'var(--color-primary)' }
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
    }, [autoCompleteCheck, createElement('span', { textContent: 'Tự động hoàn thành khi sự kiện kết thúc' })]);

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
    };

    checkRow.appendChild(autoCompleteLabel);
    checkRow.appendChild(importantLabel);

    // 3. Thuộc danh sách & Phân loại
    const listSelect = createElement('select', { className: 'input', 'aria-label': 'Thuộc danh sách' });
    const targetListId = existingItem?.list_id || defaultListId || (taskLists[0]?.id ?? '');
    if (taskLists.length === 0) {
      listSelect.appendChild(createElement('option', { value: '', textContent: 'Công việc cá nhân' }));
    } else {
      taskLists.forEach(lst => {
        const opt = createElement('option', {
          value: String(lst.id),
          textContent: lst.name
        });
        if (String(lst.id) === String(targetListId)) opt.selected = true;
        listSelect.appendChild(opt);
      });
    }

    const categorySelect = createElement('select', { className: 'input', 'aria-label': 'Phân loại' });
    const userCategories = store.get('categories') || [];
    const unclassifiedOpt = createElement('option', { value: '', textContent: 'Chưa phân loại' });
    unclassifiedOpt.dataset.color = '';
    categorySelect.appendChild(unclassifiedOpt);

    const categoriesList = userCategories.length > 0
      ? userCategories.map(c => ({ name: c.name, color: c.color }))
      : [
          { name: 'Công việc', color: '#3B82F6' },
          { name: 'Cá nhân', color: '#10B981' },
          { name: 'Dự án', color: '#F97316' },
          { name: 'Khẩn cấp', color: '#EF4444' },
          { name: 'Học tập', color: '#8B5CF6' }
        ];

    categoriesList.forEach(cat => {
      const opt = createElement('option', { value: cat.name, textContent: cat.name });
      opt.dataset.color = cat.color;
      if (existingItem?.category && String(existingItem.category).toLowerCase() === String(cat.name).toLowerCase()) {
        opt.selected = true;
      } else if (!existingItem?.category && existingItem?.color && String(existingItem.color).toLowerCase() === String(cat.color).toLowerCase()) {
        opt.selected = true;
      }
      categorySelect.appendChild(opt);
    });

    categorySelect.onchange = () => {
      const selectedOpt = categorySelect.options[categorySelect.selectedIndex];
      const catColor = selectedOpt?.dataset?.color;
      if (catColor) {
        selectedColor = catColor;
      } else if (!categorySelect.value) {
        selectedColor = null;
      }
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
        categorySelect
      ])
    ]);
    // 4. Khối Thời gian (Mặc định không cài đặt)
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
      style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }
    });

    const scheduleLabel = createElement('span', {
      style: { fontSize: '13px', fontWeight: '700', color: 'var(--color-text-primary)' },
      textContent: 'Thời gian'
    });

    const toggleScheduleBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-sm',
      onclick: () => {
        scheduleEnabled = !scheduleEnabled;
        refreshScheduleUI();
      }
    });

    scheduleHeader.appendChild(scheduleLabel);
    scheduleHeader.appendChild(toggleScheduleBtn);

    // Task: Ngày / Chu kỳ lặp ở hàng trên, hai ô giờ ở cùng hàng dưới.
    // Event: hai ô ngày ở hàng trên, hai ô giờ ở cùng hàng dưới.
    const scheduleFieldsGrid = createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px 14px',
        paddingTop: '8px',
        borderTop: '1px solid var(--color-border-light)'
      }
    });

    // 1. Ô trái trên: Ngày
    const dateInput = createElement('input', {
      'aria-label': 'Ngày',
      type: 'date',
      className: 'input',
      value: initialDateStr
    });

    const dateGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', textContent: 'Ngày' }),
      dateInput
    ]);
    const endDateInput = createElement('input', {
      type: 'date', className: 'input', 'aria-label': 'Ngày kết thúc', value: initialEndDateStr
    });
    const endDateGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', textContent: 'Ngày kết thúc' }), endDateInput
    ]);
    const rangeError = createElement('small', { role: 'alert', style: { color: 'var(--color-danger)', gridColumn: '1 / -1' } });
    const rangeHint = createElement('small', { style: { gridColumn: '1 / -1', color: 'var(--color-text-secondary)', lineHeight: '1.5' } });
    const multiDayCheck = createElement('input', {
      type: 'checkbox', 'aria-label': 'Kéo dài nhiều ngày', checked: isMultiDay,
      disabled: isEdit,
      onchange: e => {
        isMultiDay = e.target.checked;
        if (isMultiDay && endDateInput.value <= dateInput.value && dateInput.value) endDateInput.value = shiftEventDate(dateInput.value, 1);
        refreshScheduleUI();
      }
    });
    const multiDayLabel = createElement('label', {
      style: { display: 'flex', alignItems: 'center', gap: '8px', gridColumn: '1 / -1' }
    }, [multiDayCheck, createElement('span', { textContent: 'Kéo dài nhiều ngày (lưu dưới dạng sự kiện)' })]);

    // Giờ bắt đầu (cùng hàng với Giờ kết thúc)
    const startTimeInput = createElement('input', {
      'aria-label': 'Giờ bắt đầu',
      type: 'time',
      className: 'input',
      value: initialStartTime
    });

    const startTimeGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', textContent: 'Giờ bắt đầu' }),
      startTimeInput
    ]);

    const currentRule = existingItem?.recurrence_rule || '';
    const recurrenceOptions = [
      { val: '', label: 'Không lặp lại' },
      { val: 'FREQ=DAILY', label: 'Hàng ngày' },
      { val: 'FREQ=WEEKLY', label: 'Hàng tuần' },
      { val: 'FREQ=MONTHLY', label: 'Hàng tháng' }
    ];
    if (currentRule && !recurrenceOptions.some(o => o.val === currentRule)) {
      recurrenceOptions.push({ val: currentRule, label: 'Chu kỳ hiện tại (giữ nguyên)' });
    }
    const rruleSelect = createElement('select', { className: 'input', 'aria-label': 'Chu kỳ lặp lại' }, recurrenceOptions.map(o => {
      const opt = createElement('option', { value: o.val, textContent: o.label });
      if (currentRule === o.val) opt.selected = true;
      return opt;
    }));

    const rruleGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', textContent: 'Chu kỳ lặp lại' }),
      rruleSelect
    ]);

    // 4. Ô phải dưới: Giờ kết thúc
    const endTimeInput = createElement('input', {
      'aria-label': 'Giờ kết thúc',
      type: 'time',
      className: 'input',
      value: initialEndTime
    });

    const endTimeGroup = createElement('div', { className: 'form-group' }, [
      createElement('label', { className: 'form-label', textContent: 'Giờ kết thúc' }),
      endTimeInput
    ]);

    const allDayCheck = createElement('input', {
      type: 'checkbox', 'aria-label': 'Cả ngày', checked: isAllDay,
      onchange: (e) => { isAllDay = e.target.checked; refreshScheduleUI(); }
    });
    const allDayLabel = createElement('label', {
      style: { display: 'flex', alignItems: 'center', gap: '8px', gridColumn: '1 / -1' }
    }, [allDayCheck, createElement('span', { textContent: 'Cả ngày' })]);

    // Thứ tự hiển thị được thiết lập trong refreshScheduleUI theo loại mục.
    scheduleFieldsGrid.appendChild(dateGroup);
    scheduleFieldsGrid.appendChild(startTimeGroup);
    scheduleFieldsGrid.appendChild(endDateGroup);
    scheduleFieldsGrid.appendChild(endTimeGroup);
    scheduleFieldsGrid.appendChild(rruleGroup);
    scheduleFieldsGrid.appendChild(allDayLabel);
    scheduleFieldsGrid.appendChild(multiDayLabel);
    scheduleFieldsGrid.appendChild(rangeHint);
    scheduleFieldsGrid.appendChild(rangeError);

    let lastTimedStart = initialStartTime;
    let lastTimedEnd = initialEndTime;
    const refreshScheduleUI = () => {
      const eventMode = usesEvent();
      endDateGroup.style.display = eventMode ? '' : 'none';
      dateGroup.querySelector('label').textContent = eventMode ? 'Ngày bắt đầu' : 'Ngày';
      dateInput.setAttribute('aria-label', eventMode ? 'Ngày bắt đầu' : 'Ngày');
      endDateInput.min = dateInput.value;
      autoCompleteLabel.style.display = eventMode ? 'inline-flex' : 'none';
      importantLabel.style.display = eventMode ? 'none' : 'inline-flex';
      listAndCategoryGrid.children[0].style.display = eventMode ? 'none' : '';
      listAndCategoryGrid.style.gridTemplateColumns = eventMode ? '1fr' : '1fr 1fr';
      dateGroup.style.order = '0';
      endDateGroup.style.order = '1';
      startTimeGroup.style.order = '2';
      endTimeGroup.style.order = '3';
      rruleGroup.style.order = eventMode ? '4' : '1';
      rruleGroup.style.gridColumn = eventMode ? '1 / -1' : '';
      allDayLabel.style.order = '5';
      multiDayLabel.style.order = '-1';
      rangeHint.style.order = '7';
      rangeError.style.order = '8';
      toggleScheduleBtn.disabled = eventMode;
      rangeHint.textContent = eventMode
        ? 'Sự kiện liên tục trong khoảng ngày đã chọn, hiển thị trên Calendar; không tạo thêm công việc To Do. Cả ngày tính đến hết ngày kết thúc.'
        : isEdit ? 'Mục này giữ nguyên loại công việc; hãy tạo mới nếu cần sự kiện nhiều ngày.' : '';
      titleError.textContent = [...titleInput.value].length > titleLimit() ? `Tiêu đề tối đa ${titleLimit()} ký tự.` : '';
      if (modalRef?.backdrop) {
        modalRef.backdrop.querySelector('.modal-title').textContent = dialogTitle();
        modalRef.backdrop.querySelector('.modal-dialog').setAttribute('aria-label', dialogTitle());
      }
      if (isAllDay) {
        if (startTimeInput.type === 'time') lastTimedStart = startTimeInput.value || lastTimedStart;
        if (endTimeInput.type === 'time') lastTimedEnd = endTimeInput.value || lastTimedEnd;
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
        const restoreStart = startTimeInput.type !== 'time';
        const restoreEnd = endTimeInput.type !== 'time';
        startTimeInput.type = 'time';
        if (restoreStart) startTimeInput.value = lastTimedStart;
        startTimeInput.disabled = false;
        startTimeInput.style.opacity = '1';
        startTimeInput.style.cursor = '';
        startTimeInput.style.textAlign = '';

        endTimeInput.type = 'time';
        if (restoreEnd) endTimeInput.value = lastTimedEnd;
        endTimeInput.disabled = false;
        endTimeInput.style.opacity = '1';
        endTimeInput.style.cursor = '';
        endTimeInput.style.textAlign = '';
      }

      if (scheduleEnabled) {
        toggleScheduleBtn.className = 'btn btn-secondary btn-sm';
        toggleScheduleBtn.textContent = 'Bỏ cài đặt thời gian';
        scheduleFieldsGrid.style.display = 'grid';
      } else {
        toggleScheduleBtn.className = 'btn btn-primary btn-sm';
        toggleScheduleBtn.textContent = 'Cài đặt thời gian';
        scheduleFieldsGrid.style.display = 'none';
      }
    };
    dateInput.addEventListener('change', () => { endDateInput.min = dateInput.value; rangeError.textContent = ''; });
    endDateInput.addEventListener('change', () => { rangeError.textContent = ''; });
    refreshScheduleUI();

    scheduleBox.appendChild(scheduleHeader);
    scheduleBox.appendChild(scheduleFieldsGrid);

    // 5. One field shared by Task notes and Event descriptions.
    const descInput = createElement('textarea', {
      id: 'item-form-notes',
      'aria-describedby': 'item-form-notes-error',
      className: 'textarea item-notes-input',
      rows: 5,
      placeholder: 'Nhập ghi chú, địa điểm hoặc liên kết họp…'
    });
    descInput.value = combinedItemNotes(existingItem || {});
    const noteError = createElement('small', { id: 'item-form-notes-error', role: 'alert', className: 'item-notes-error' });
    titleInput.addEventListener('input', () => { titleError.textContent = [...titleInput.value].length > titleLimit() ? `Tiêu đề tối đa ${titleLimit()} ký tự.` : ''; });
    descInput.addEventListener('input', () => {
      const invalid = [...descInput.value.trim()].length > NOTES_LIMIT;
      noteError.textContent = invalid ? 'Ghi chú và địa điểm tối đa 5.000 ký tự.' : '';
      descInput.setAttribute('aria-invalid', String(invalid));
    });

    const formContent = createElement('div', {
      style: { display: 'flex', flexDirection: 'column', gap: '12px' }
    }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: 'Tiêu đề *' }),
        titleInput,
        titleError
      ]),
      checkRow,
      listAndCategoryGrid,
      scheduleBox,
      createElement('div', { className: 'form-group item-notes-field' }, [
        createElement('label', { className: 'form-label', for: 'item-form-notes', textContent: 'Ghi chú & địa điểm' }),
        descInput,
        noteError
      ])
    ]);

    if (isEdit && !isLegacyEvent) {
      taskSteps = new TaskSteps(existingItem, { onChange: () => {
        window.dispatchEvent(new CustomEvent('planify:data-changed', { detail: { source: 'task-steps', type: 'task', id: existingItem.id } }));
      } });
      formContent.insertBefore(taskSteps.element, scheduleBox);
    }

    const handleSave = async () => {
      if (store.get('user')?.id !== userId) return;
      if (taskSteps?.busy || taskSteps?.isDirty()) {
        Toast.warning('Hãy lưu hoặc hủy bước con đang nhập trước khi lưu công việc.');
        taskSteps.focusDraft();
        return;
      }
      const title = titleInput.value.trim();
      if (!title) {
        Toast.error('Vui lòng nhập tiêu đề công việc.');
        titleInput.focus();
        return;
      }
      if ([...title].length > titleLimit()) {
        titleError.textContent = `Tiêu đề tối đa ${titleLimit()} ký tự.`;
        titleInput.focus();
        return;
      }
      if ([...descInput.value.trim()].length > NOTES_LIMIT) {
        noteError.textContent = 'Ghi chú và địa điểm tối đa 5.000 ký tự.';
        descInput.setAttribute('aria-invalid', 'true');
        descInput.focus();
        return;
      }

      let dueDateVal = null;
      let dueTimeVal = null;
      let startTimeVal = null;
      let endTimeVal = null;
      let durationMins = 60;
      let eventRange = null;
      if (usesEvent()) {
        try {
          eventRange = buildEventRange({ startDate: dateInput.value, endDate: endDateInput.value,
            startTime: startTimeInput.value, endTime: endTimeInput.value, allDay: isAllDay });
          rangeError.textContent = '';
        } catch (error) {
          rangeError.textContent = error.message;
          endDateInput.focus();
          return;
        }
      }

      if (scheduleEnabled && !dateInput.value) {
        Toast.error('Vui lòng chọn ngày thực hiện.');
        return;
      }
      if (scheduleEnabled && dateInput.value) {
        dueDateVal = dateInput.value;
        if (!isAllDay) {
          startTimeVal = `${startTimeInput.value || '09:00'}:00`;
          dueTimeVal = startTimeVal;
          endTimeVal = `${endTimeInput.value || '10:00'}:00`;
          const [sh, sm] = (startTimeInput.value || '09:00').split(':').map(Number);
          const [eh, em] = (endTimeInput.value || '10:00').split(':').map(Number);
          const diff = (eh * 60 + em) - (sh * 60 + sm);
          if (diff <= 0 && !usesEvent()) {
            Toast.error('Giờ kết thúc phải sau giờ bắt đầu.');
            return;
          }
          durationMins = diff;
        }
      }

      const todayStr = formatDate(businessNow(), 'YYYY-MM-DD');
      const taskPayload = {
        title,
        ...buildNotesUpdate(descInput.value),
        list_id: listSelect.value ? Number(listSelect.value) : null,
        is_important: isImportant,
        is_in_my_day: dueDateVal === todayStr,
        auto_complete: false,
        due_date: dueDateVal,
        due_time: dueTimeVal,
        start_time: startTimeVal,
        end_time: endTimeVal,
        duration_minutes: durationMins,
        is_all_day: scheduleEnabled ? isAllDay : true,
        color: selectedColor,
        category: categorySelect.value || null,
        reminder_minutes: Number(existingItem?.reminder_minutes ?? store.get('user')?.notify_minutes_before ?? 15),
        recurrence_rule: (isEdit || scheduleEnabled) ? (rruleSelect.value || null) : null
      };

      const eventPayload = usesEvent() ? {
        title, description: taskPayload.note, location: taskPayload.location,
        ...eventRange, is_all_day: isAllDay, color: selectedColor,
        category: categorySelect.value || null, recurrence_rule: rruleSelect.value || null,
        ...(isLegacyEvent ? { calendar_id: existingItem.calendar_id } : {})
      } : null;
      if (!isEdit) {
        const signature = JSON.stringify(eventPayload || taskPayload);
        if (createAttempt?.signature !== signature) createAttempt = { signature, id: newRequestId() };
        (eventPayload || taskPayload).client_request_id = createAttempt.id;
      }
      try {
        if (isEdit) {
          const revision = existingItem.updated_at || existingItem.created_at;
          if (!revision) throw new Error('Thiếu phiên bản dữ liệu. Hãy tải lại mục trước khi lưu.');
          const editOptions = { headers: { 'If-Match': revision } };
          if (isLegacyEvent) {
            // Preserve the event identity and recurring occurrence; never create a task twin.
            if (!dueDateVal) throw new Error('Sự kiện phải có ngày diễn ra.');
            const updated = await api.put(`/events/${existingItem.id}`, {
              ...eventPayload,
              ...recurrenceContext(existingItem)
            }, editOptions);
            Toast.success('Đã cập nhật sự kiện!');
            modalRef.close(true);
            window.dispatchEvent(new CustomEvent('planify:data-changed'));
            if (onUpdated) onUpdated(updated);
          } else {
            const updated = await api.put(`/tasks/${existingItem.id}`, taskPayload, editOptions);
            Toast.success('Đã lưu thay đổi!');
            modalRef.close(true);
            window.dispatchEvent(new CustomEvent('planify:data-changed'));
            if (onUpdated) onUpdated(updated);
          }
        } else {
          const created = await api.post(usesEvent() ? '/events' : '/tasks', eventPayload || taskPayload);
          const placeLabel = !dueDateVal
            ? 'vào cột Cần làm'
            : (dueDateVal === todayStr ? 'vào cột Hôm nay & Lịch biểu' : `vào ngày ${dueDateVal}`);
          Toast.success(usesEvent() ? `Đã tạo sự kiện "${title}" trên Calendar!` : `Đã thêm công việc "${title}" ${placeLabel}!`);
          modalRef.close(true);
          window.dispatchEvent(new CustomEvent('planify:data-changed'));
          if (onCreated) onCreated(created);
        }
      } catch (err) {
        if (err.code === 'SCHEDULE_CANCEL') return;
        if (err.code === 'SCHEDULE_CHANGE') {
          (scheduleEnabled && !isAllDay ? startTimeInput : dateInput).focus();
          return;
        }
        Toast.error(err.message || 'Không thể lưu dữ liệu.');
      }
    };

    const footerButtons = [];
    if (isEdit) {
      footerButtons.push({
        label: 'Xóa mục này',
        className: 'btn btn-danger',
        onClick: async () => {
          if (taskSteps?.isSaving) { Toast.warning('Vui lòng chờ lưu bước con xong.'); return; }
          if (!confirmDeleteItem(existingItem, { scope: isLegacyEvent && (existingItem.recurrence_rule || existingItem.parent_event_id) ? 'this' : null })) return;
          try {
            if (isLegacyEvent) {
              await api.delete(eventDeleteUrl(existingItem));
            } else {
              await api.delete(`/tasks/${existingItem.id}`);
            }
            Toast.success('Đã xóa thành công.');
            modalRef.close(true);
            window.dispatchEvent(new CustomEvent('planify:data-changed'));
            if (onDeleted) onDeleted(existingItem.id);
          } catch (err) {
            Toast.error(err.message || 'Không thể xóa.');
          }
        }
      });
    }

    footerButtons.push(
      { label: 'Hủy', className: 'btn btn-secondary', onClick: () => modalRef.close() },
      { label: isEdit ? 'Lưu cập nhật' : 'Tạo mới', className: 'btn btn-primary', onClick: handleSave }
    );

    modalRef = Modal.open({
      title: dialogTitle(),
      content: formContent,
      footerButtons,
      onClose: () => taskSteps?.destroy()
    });
    if (modalRef.content !== formContent) return;

    const snapshot = () => JSON.stringify({
      fields: [...formContent.querySelectorAll('input, textarea, select')].filter(input => !input.closest('.task-steps')).map(input => input.type === 'checkbox' ? input.checked : input.value),
      scheduleEnabled, isAllDay, isImportant, selectedColor
    });
    const original = snapshot();
    modalRef.beforeClose = () => {
      if (taskSteps?.isSaving) { Toast.warning('Vui lòng chờ lưu bước con xong.'); return false; }
      return (snapshot() === original && !taskSteps?.isDirty()) || confirm('Bạn có thay đổi chưa lưu. Bạn có muốn bỏ các thay đổi này không?');
    };
    modalRef.isDirty = () => snapshot() !== original || Boolean(taskSteps?.isDirty() || taskSteps?.isSaving);
    taskSteps?.load();

    setTimeout(() => titleInput.focus(), 60);
  }
}
