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
   * - Nếu tích chọn "⚡ Sự kiện (Tự động hoàn thành khi hết thời gian)" -> auto_complete = true
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
    let createAttempt = null;
    const userId = store.get('user')?.id;

    // Gộp dữ liệu nếu đang sửa task hoặc event
    const existingItem = task || event || null;
    const isEdit = Boolean(existingItem && existingItem.id);
    const isLegacyEvent = Boolean(existingItem && existingItem.start_at && !existingItem.list_id && !existingItem._isTask);

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
    // Mặc định là phải tích mới hoàn thành (auto_complete = false)
    let isAutoComplete = isEdit
      ? Boolean(existingItem?.auto_complete || isLegacyEvent)
      : false;

    // Mặc định KHÔNG để thời gian (để nằm ở cột Cần làm & kéo vào lịch),
    // trừ khi đang sửa mục đã có due_date hoặc chọn trực tiếp từ ô trên lịch
    let scheduleEnabled = false;
    let initialDateStr = formatDate(businessNow(), 'YYYY-MM-DD');
    let initialStartTime = '09:00';
    let initialEndTime = '10:00';
    let isAllDay = false;

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
        const sDt = new Date(existingItem.start_at);
        const eDt = existingItem.end_at ? new Date(existingItem.end_at) : new Date(sDt.getTime() + 3600000);
        initialDateStr = formatDate(sDt, 'YYYY-MM-DD');
        initialStartTime = formatDate(sDt, 'HH:mm');
        initialEndTime = formatDate(eDt, 'HH:mm');
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
    const titleLimit = isLegacyEvent ? 200 : 500;
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
      checked: isAutoComplete,
      style: { width: '16px', height: '16px', accentColor: 'var(--color-primary)', cursor: 'pointer' },
      onchange: (e) => { isAutoComplete = e.target.checked; }
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
    }, [autoCompleteCheck, createElement('span', { textContent: 'Tự động hoàn thành' })]);

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

    // Lưới 4 ô: 2 ô trên, 2 ô dưới
    // 2 ô bên trái: Ngày (trên) & Chu kỳ lặp lại (dưới)
    // 2 ô bên phải: Giờ bắt đầu (trên) & Giờ kết thúc (dưới)
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

    // 2. Ô phải trên: Giờ bắt đầu
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

    // Gắn vào lưới theo thứ tự: Trái trên (Ngày), Phải trên (Giờ bắt đầu), Trái dưới (Chu kỳ lặp), Phải dưới (Giờ kết thúc)
    scheduleFieldsGrid.appendChild(dateGroup);
    scheduleFieldsGrid.appendChild(startTimeGroup);
    scheduleFieldsGrid.appendChild(rruleGroup);
    scheduleFieldsGrid.appendChild(endTimeGroup);
    scheduleFieldsGrid.appendChild(allDayLabel);

    let lastTimedStart = initialStartTime;
    let lastTimedEnd = initialEndTime;
    const refreshScheduleUI = () => {
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
    refreshScheduleUI();

    scheduleBox.appendChild(scheduleHeader);
    scheduleBox.appendChild(scheduleFieldsGrid);

    // 5. Địa điểm & Ghi chú
    const locInput = createElement('input', {
      'aria-label': 'Địa điểm hoặc đường dẫn họp',
      type: 'text',
      className: 'input',
      value: existingItem?.location || '',
      placeholder: 'Địa điểm hoặc liên kết họp (tùy chọn)...'
    });
    const locError = createElement('small', { role: 'alert', style: { color: 'var(--color-danger, #dc2626)' } });

    const descInput = createElement('textarea', {
      'aria-label': 'Ghi chú chi tiết',
      className: 'input',
      rows: 2,
      placeholder: 'Ghi chú chi tiết nội dung công việc...'
    });
    descInput.value = existingItem?.note || existingItem?.description || '';
    const noteError = createElement('small', { role: 'alert', style: { color: 'var(--color-danger, #dc2626)' } });
    titleInput.addEventListener('input', () => { titleError.textContent = [...titleInput.value].length > titleLimit ? `Tiêu đề tối đa ${titleLimit} ký tự.` : ''; });
    locInput.addEventListener('input', () => { locError.textContent = [...locInput.value].length > 300 ? 'Địa điểm tối đa 300 ký tự.' : ''; });
    descInput.addEventListener('input', () => {
      noteError.textContent = [...descInput.value].length > 5000 ? 'Ghi chú tối đa 5.000 ký tự.' : '';
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
      createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr', gap: '10px' } }, [
        locInput,
        locError,
        descInput,
        noteError
      ])
    ]);

    const handleSave = async () => {
      if (store.get('user')?.id !== userId) return;
      const title = titleInput.value.trim();
      if (!title) {
        Toast.error('Vui lòng nhập tiêu đề công việc.');
        titleInput.focus();
        return;
      }
      if ([...title].length > titleLimit) {
        titleError.textContent = `Tiêu đề tối đa ${titleLimit} ký tự.`;
        titleInput.focus();
        return;
      }
      if ([...locInput.value.trim()].length > 300) {
        locError.textContent = 'Địa điểm tối đa 300 ký tự.';
        locInput.focus();
        return;
      }
      if ([...descInput.value].length > 5000) {
        noteError.textContent = 'Ghi chú tối đa 5.000 ký tự.';
        descInput.focus();
        return;
      }

      let dueDateVal = null;
      let dueTimeVal = null;
      let startTimeVal = null;
      let endTimeVal = null;
      let durationMins = 60;

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
          if (diff <= 0) {
            Toast.error('Giờ kết thúc phải sau giờ bắt đầu.');
            return;
          }
          durationMins = diff;
        }
      }

      const todayStr = formatDate(businessNow(), 'YYYY-MM-DD');
      const taskPayload = {
        title,
        note: descInput.value.trim() || null,
        location: locInput.value.trim() || null,
        list_id: listSelect.value ? Number(listSelect.value) : null,
        is_important: isImportant,
        is_in_my_day: dueDateVal === todayStr,
        auto_complete: isAutoComplete,
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

      if (!isEdit) {
        const signature = JSON.stringify(taskPayload);
        if (createAttempt?.signature !== signature) createAttempt = { signature, id: newRequestId() };
        taskPayload.client_request_id = createAttempt.id;
      }
      try {
        if (isEdit) {
          const revision = existingItem.updated_at || existingItem.created_at;
          if (!revision) throw new Error('Thiếu phiên bản dữ liệu. Hãy tải lại mục trước khi lưu.');
          const editOptions = { headers: { 'If-Match': revision } };
          if (isLegacyEvent) {
            // Preserve the event identity and recurring occurrence; never create a task twin.
            if (!dueDateVal) throw new Error('Sự kiện phải có ngày diễn ra.');
            const start = `${dueDateVal}T${isAllDay ? '00:00:00' : startTimeVal}`;
            const endDate = new Date(`${dueDateVal}T12:00:00`);
            const oldDays = Math.max(0, Math.round((new Date(String(existingItem.end_at).slice(0, 10) + 'T12:00:00') - new Date(String(existingItem.start_at).slice(0, 10) + 'T12:00:00')) / 86400000));
            endDate.setDate(endDate.getDate() + (isAllDay ? Math.max(1, oldDays) : oldDays));
            const updated = await api.put(`/events/${existingItem.id}`, {
              title, description: taskPayload.note, location: taskPayload.location,
              start_at: start, end_at: `${formatDate(endDate)}T${isAllDay ? '00:00:00' : endTimeVal}`,
              is_all_day: isAllDay, color: selectedColor, category: categorySelect.value || null, recurrence_rule: taskPayload.recurrence_rule,
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
          const created = await api.post('/tasks', taskPayload);
          const placeLabel = !dueDateVal
            ? 'vào cột Cần làm'
            : (dueDateVal === todayStr ? 'vào cột Hôm nay & Lịch biểu' : `vào ngày ${dueDateVal}`);
          Toast.success(`Đã thêm công việc "${title}" ${placeLabel}!`);
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
      title: isEdit ? 'Chỉnh sửa công việc' : 'Thêm công việc mới',
      content: formContent,
      footerButtons
    });
    if (modalRef.content !== formContent) return;

    const snapshot = () => JSON.stringify({
      fields: [...formContent.querySelectorAll('input, textarea, select')].map(input => input.type === 'checkbox' ? input.checked : input.value),
      scheduleEnabled, isAllDay, isImportant, isAutoComplete, selectedColor
    });
    const original = snapshot();
    modalRef.beforeClose = () => snapshot() === original || confirm('Bạn có thay đổi chưa lưu. Bạn có muốn bỏ các thay đổi này không?');
    modalRef.isDirty = () => snapshot() !== original;

    setTimeout(() => titleInput.focus(), 60);
  }
}
