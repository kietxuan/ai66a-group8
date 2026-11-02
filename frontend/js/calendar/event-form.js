import { createElement } from '../utils/dom.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { formatDate } from '../utils/date.js';

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
    let modalRef = null;

    // Gộp dữ liệu nếu đang sửa task hoặc event
    const existingItem = task || event || null;
    const isEdit = Boolean(existingItem && existingItem.id);
    const isLegacyEvent = Boolean(existingItem && existingItem.start_at && !existingItem.list_id && !existingItem._isTask);

    // Đảm bảo có danh sách taskLists trong store
    let taskLists = store.get('taskLists') || [];
    if (!taskLists.length) {
      try {
        taskLists = await api.get('/task-lists') || [];
        store.set('taskLists', taskLists);
      } catch (_) {}
    }

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
    let initialDateStr = formatDate(new Date(), 'YYYY-MM-DD');
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
    } else if (hasDate || fromCalendarSlot) {
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
      type: 'text',
      className: 'input',
      style: { fontSize: '15px', fontWeight: '700', padding: '11px 14px' },
      value: existingItem?.title || '',
      placeholder: 'Nhập tên việc cần làm hoặc sự kiện (VD: Họp dự án, Tập thể dục...)',
      required: true
    });

    // 2. Chế độ Hoàn thành (Tích thủ công vs Tự động hoàn thành khi hết giờ) & Quan trọng (⭐)
    const modeRow = createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1.5fr 1fr',
        gap: '10px'
      }
    });

    const autoCompleteCard = createElement('div', {
      style: {
        padding: '11px 13px',
        borderRadius: '12px',
        border: '1.5px solid var(--color-border)',
        background: 'var(--color-bg-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        transition: 'all 0.15s ease'
      }
    });

    const autoCheck = createElement('input', {
      type: 'checkbox',
      checked: isAutoComplete,
      style: { width: '17px', height: '17px', marginTop: '2px', accentColor: 'var(--color-primary)', cursor: 'pointer' }
    });

    const autoLabelDesc = createElement('div', { style: { fontSize: '11.5px', color: 'var(--color-text-secondary)', marginTop: '2px', lineHeight: '1.4' } });
    const updateAutoUI = () => {
      autoCheck.checked = isAutoComplete;
      if (isAutoComplete) {
        autoCompleteCard.style.borderColor = 'var(--color-primary)';
        autoCompleteCard.style.background = 'var(--color-primary-light)';
        autoLabelDesc.textContent = 'Tự động sang cột Hoàn thành sau khi hết thời gian. Nếu diễn ra hôm nay sẽ nằm ở cột Hôm nay.';
      } else {
        autoCompleteCard.style.borderColor = 'var(--color-border)';
        autoCompleteCard.style.background = 'var(--color-bg-secondary)';
        autoLabelDesc.textContent = 'Mặc định: Phải tích chọn thủ công mới hoàn thành.';
      }
    };

    autoCompleteCard.onclick = (e) => {
      if (e.target !== autoCheck) {
        isAutoComplete = !isAutoComplete;
      } else {
        isAutoComplete = autoCheck.checked;
      }
      updateAutoUI();
    };

    autoCompleteCard.appendChild(autoCheck);
    autoCompleteCard.appendChild(createElement('div', { style: { flex: '1' } }, [
      createElement('div', { style: { fontSize: '13px', fontWeight: '800', color: 'var(--color-text-primary)' }, textContent: '⚡ Sự kiện (Tự động hoàn thành)' }),
      autoLabelDesc
    ]));
    updateAutoUI();

    const importantCard = createElement('div', {
      style: {
        padding: '11px 13px',
        borderRadius: '12px',
        border: '1.5px solid var(--color-border)',
        background: 'var(--color-bg-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        transition: 'all 0.15s ease'
      }
    });

    const starIcon = createElement('span', { style: { fontSize: '22px', lineHeight: '1' } });
    const updateImportantUI = () => {
      if (isImportant) {
        starIcon.textContent = '⭐';
        importantCard.style.borderColor = '#F59E0B';
        importantCard.style.background = 'rgba(245, 158, 11, 0.12)';
      } else {
        starIcon.textContent = '☆';
        importantCard.style.borderColor = 'var(--color-border)';
        importantCard.style.background = 'var(--color-bg-secondary)';
      }
    };
    importantCard.onclick = () => {
      isImportant = !isImportant;
      updateImportantUI();
    };
    importantCard.appendChild(starIcon);
    importantCard.appendChild(createElement('div', {}, [
      createElement('div', { style: { fontSize: '13px', fontWeight: '800', color: 'var(--color-text-primary)' }, textContent: 'Quan trọng' }),
      createElement('div', { style: { fontSize: '11.5px', color: 'var(--color-text-secondary)' }, textContent: 'Hiện dấu ⭐ trên thẻ việc' })
    ]));
    updateImportantUI();

    modeRow.appendChild(autoCompleteCard);
    modeRow.appendChild(importantCard);

    // 3. Danh sách lưu trữ & Màu sắc thẻ
    const listSelect = createElement('select', { className: 'input' });
    const targetListId = existingItem?.list_id || defaultListId || (taskLists[0]?.id ?? '');
    if (taskLists.length === 0) {
      listSelect.appendChild(createElement('option', { value: '', textContent: '📝 Công việc cá nhân (Mặc định)' }));
    } else {
      taskLists.forEach(lst => {
        const opt = createElement('option', {
          value: String(lst.id),
          textContent: `${lst.icon || '📝'} ${lst.name}`
        });
        if (String(lst.id) === String(targetListId)) opt.selected = true;
        listSelect.appendChild(opt);
      });
    }

    const colorRow = createElement('div', {
      style: { display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', marginTop: '4px' }
    });
    const customColorInput = createElement('input', {
      type: 'color',
      value: selectedColor,
      title: 'Tùy chỉnh mã màu bất kỳ',
      style: {
        width: '28px',
        height: '28px',
        padding: '0',
        border: '2px solid var(--color-border)',
        borderRadius: '50%',
        cursor: 'pointer',
        background: 'transparent'
      }
    });

    const updateSwatches = () => {
      colorRow.querySelectorAll('.unified-color-swatch').forEach(sw => {
        const active = sw.dataset.color.toLowerCase() === selectedColor.toLowerCase();
        sw.style.transform = active ? 'scale(1.18)' : 'scale(1)';
        sw.style.boxShadow = active ? `0 0 0 2px var(--color-surface), 0 0 0 4px ${selectedColor}` : 'none';
      });
    };

    PRESET_COLORS.forEach(c => {
      const swatch = createElement('button', {
        type: 'button',
        className: 'unified-color-swatch',
        dataset: { color: c },
        style: {
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: c,
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        },
        onclick: () => {
          selectedColor = c;
          customColorInput.value = c;
          updateSwatches();
        }
      });
      colorRow.appendChild(swatch);
    });
    customColorInput.oninput = (e) => {
      selectedColor = e.target.value;
      updateSwatches();
    };
    colorRow.appendChild(customColorInput);
    updateSwatches();

    const listAndColorGrid = createElement('div', {
      style: { display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '12px', alignItems: 'end' }
    }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: '📁 Thuộc danh sách' }),
        listSelect
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: '🎨 Màu sắc thẻ & lịch' }),
        colorRow
      ])
    ]);

    // 4. Khối Thời gian & Lịch biểu (Mặc định tắt để vĩnh viễn / kéo thả vào lịch)
    const scheduleBox = createElement('div', {
      style: {
        padding: '13px 14px',
        borderRadius: '12px',
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-light)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }
    });

    const scheduleHeader = createElement('div', {
      style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }
    });

    const scheduleStatusText = createElement('div', {
      style: { fontSize: '13px', fontWeight: '800', color: 'var(--color-text-primary)' }
    });
    const scheduleSubText = createElement('div', {
      style: { fontSize: '11.5px', color: 'var(--color-text-secondary)', marginTop: '2px' }
    });

    const toggleScheduleBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-sm',
      onclick: () => {
        scheduleEnabled = !scheduleEnabled;
        refreshScheduleUI();
      }
    });

    scheduleHeader.appendChild(createElement('div', {}, [scheduleStatusText, scheduleSubText]));
    scheduleHeader.appendChild(toggleScheduleBtn);

    const scheduleFieldsWrap = createElement('div', {
      style: { display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '8px', borderTop: '1px dashed var(--color-border)' }
    });

    const dateInput = createElement('input', {
      type: 'date',
      className: 'input',
      value: initialDateStr
    });

    const quickDateBar = createElement('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, [
      createElement('button', {
        type: 'button',
        className: 'btn btn-secondary btn-xs',
        textContent: '☀️ Hôm nay',
        onclick: () => { dateInput.value = formatDate(new Date(), 'YYYY-MM-DD'); }
      }),
      createElement('button', {
        type: 'button',
        className: 'btn btn-secondary btn-xs',
        textContent: '🌤️ Ngày mai',
        onclick: () => {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          dateInput.value = formatDate(d, 'YYYY-MM-DD');
        }
      }),
      createElement('button', {
        type: 'button',
        className: 'btn btn-secondary btn-xs',
        textContent: '📅 Thứ Hai tới',
        onclick: () => {
          const d = new Date();
          const day = d.getDay();
          const diff = (8 - day) % 7 || 7;
          d.setDate(d.getDate() + diff);
          dateInput.value = formatDate(d, 'YYYY-MM-DD');
        }
      })
    ]);

    const startTimeInput = createElement('input', {
      type: 'time',
      className: 'input',
      value: initialStartTime
    });
    const endTimeInput = createElement('input', {
      type: 'time',
      className: 'input',
      value: initialEndTime
    });

    const allDayCheck = createElement('input', {
      type: 'checkbox',
      checked: isAllDay,
      style: { width: '16px', height: '16px', accentColor: 'var(--color-primary)' },
      onchange: (e) => {
        isAllDay = e.target.checked;
        timeInputsGrid.style.display = isAllDay ? 'none' : 'grid';
      }
    });

    const timeInputsGrid = createElement('div', {
      style: {
        display: isAllDay ? 'none' : 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px'
      }
    }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: '🕒 Giờ bắt đầu' }),
        startTimeInput
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: '🏁 Giờ kết thúc' }),
        endTimeInput
      ])
    ]);

    // Nhắc nhở & Lặp lại
    const defaultRemind = existingItem?.reminder_minutes ?? store.get('user')?.notify_minutes_before ?? 15;
    const reminderSelect = createElement('select', { className: 'input' }, [
      { val: '0', label: 'Đúng giờ diễn ra (0 phút)' },
      { val: '5', label: 'Trước 5 phút' },
      { val: '10', label: 'Trước 10 phút' },
      { val: '15', label: 'Trước 15 phút (Mặc định)' },
      { val: '30', label: 'Trước 30 phút' },
      { val: '60', label: 'Trước 1 tiếng (60 phút)' }
    ].map(o => {
      const opt = createElement('option', { value: o.val, textContent: o.label });
      if (String(defaultRemind) === o.val) opt.selected = true;
      return opt;
    }));

    const rruleSelect = createElement('select', { className: 'input' }, [
      { val: '', label: 'Không lặp lại' },
      { val: 'FREQ=DAILY', label: 'Hàng ngày' },
      { val: 'FREQ=WEEKLY', label: 'Hàng tuần' },
      { val: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', label: 'Thứ 2 - Thứ 6 (Ngày làm việc)' },
      { val: 'FREQ=MONTHLY', label: 'Hàng tháng' }
    ].map(o => {
      const opt = createElement('option', { value: o.val, textContent: o.label });
      if ((existingItem?.recurrence_rule || '') === o.val) opt.selected = true;
      return opt;
    }));

    scheduleFieldsWrap.appendChild(createElement('div', {
      style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }
    }, [
      createElement('div', { style: { flex: '1', minWidth: '150px' } }, [
        createElement('label', { className: 'form-label', textContent: '📅 Ngày thực hiện' }),
        dateInput
      ]),
      createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
        createElement('label', { className: 'form-label', textContent: 'Chọn nhanh ngày' }),
        quickDateBar
      ])
    ]));

    scheduleFieldsWrap.appendChild(createElement('label', {
      style: { display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }
    }, [allDayCheck, createElement('span', { textContent: 'Diễn ra cả ngày (Không giới hạn khung giờ cụ thể)' })]));

    scheduleFieldsWrap.appendChild(timeInputsGrid);

    scheduleFieldsWrap.appendChild(createElement('div', {
      style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }
    }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: '🔔 Thông báo nhắc trước' }),
        reminderSelect
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: '🔄 Chu kỳ lặp lại' }),
        rruleSelect
      ])
    ]));

    const refreshScheduleUI = () => {
      if (scheduleEnabled) {
        scheduleStatusText.textContent = '📅 Đã bật Thời gian & Lịch biểu';
        scheduleSubText.textContent = 'Sẽ hiển thị trực tiếp trên Lịch (Calendar) và tự động phân vào cột Hôm nay / Cần làm / Quá hạn.';
        toggleScheduleBtn.className = 'btn btn-secondary btn-sm';
        toggleScheduleBtn.textContent = '✕ Bỏ thời gian (Đặt Vĩnh viễn)';
        scheduleFieldsWrap.style.display = 'flex';
      } else {
        scheduleStatusText.textContent = '📌 Chưa đặt thời gian (Vĩnh viễn — Cột Cần làm)';
        scheduleSubText.textContent = 'Mặc định lưu ở cột Cần làm và khay bên trái Lịch để bạn có thể kéo thả vào Lịch bất cứ lúc nào.';
        toggleScheduleBtn.className = 'btn btn-primary btn-sm';
        toggleScheduleBtn.textContent = '＋ Đặt Ngày & Giờ trên Lịch';
        scheduleFieldsWrap.style.display = 'none';
      }
    };
    refreshScheduleUI();

    scheduleBox.appendChild(scheduleHeader);
    scheduleBox.appendChild(scheduleFieldsWrap);

    // 5. Địa điểm & Ghi chú
    const locInput = createElement('input', {
      type: 'text',
      className: 'input',
      value: existingItem?.location || '',
      placeholder: '📍 Địa điểm hoặc đường dẫn Google Meet / Zoom (tùy chọn)...'
    });

    const descInput = createElement('textarea', {
      className: 'input',
      rows: 2,
      placeholder: '📝 Ghi chú chi tiết, nội dung chuẩn bị hoặc các bước cần lưu ý...'
    });
    descInput.value = existingItem?.note || existingItem?.description || '';

    const formContent = createElement('div', {
      style: { display: 'flex', flexDirection: 'column', gap: '12px' }
    }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: 'Tiêu đề Công việc / Sự kiện *' }),
        titleInput
      ]),
      modeRow,
      listAndColorGrid,
      scheduleBox,
      createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr', gap: '10px' } }, [
        locInput,
        descInput
      ])
    ]);

    const handleSave = async () => {
      const title = titleInput.value.trim();
      if (!title) {
        Toast.error('Vui lòng nhập tiêu đề công việc / sự kiện.');
        titleInput.focus();
        return;
      }

      let dueDateVal = null;
      let dueTimeVal = null;
      let startTimeVal = null;
      let endTimeVal = null;
      let durationMins = 60;

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

      const todayStr = formatDate(new Date(), 'YYYY-MM-DD');
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
        reminder_minutes: Number(reminderSelect.value || 15),
        recurrence_rule: scheduleEnabled ? (rruleSelect.value || null) : null
      };

      try {
        if (isEdit) {
          if (isLegacyEvent) {
            // Nếu là sự kiện cũ từ bảng events, chuyển đổi sang Task thống nhất và xóa bản ghi cũ
            const created = await api.post('/tasks', taskPayload);
            await api.delete(`/events/${existingItem.id}`).catch(() => {});
            Toast.success('Đã cập nhật & đồng bộ mục lịch biểu!');
            modalRef.close();
            window.dispatchEvent(new CustomEvent('planify:data-changed'));
            if (onUpdated) onUpdated(created);
          } else {
            const updated = await api.put(`/tasks/${existingItem.id}`, taskPayload);
            Toast.success('Đã lưu thay đổi!');
            modalRef.close();
            window.dispatchEvent(new CustomEvent('planify:data-changed'));
            if (onUpdated) onUpdated(updated);
          }
        } else {
          const created = await api.post('/tasks', taskPayload);
          const modeLabel = isAutoComplete ? 'Sự kiện (tự động hoàn thành)' : 'Việc cần làm';
          const placeLabel = !dueDateVal
            ? 'vào cột Cần làm (Vĩnh viễn)'
            : (dueDateVal === todayStr ? 'vào cột Hôm nay & Lịch biểu' : `vào ngày ${dueDateVal}`);
          Toast.success(`Đã thêm ${modeLabel} "${title}" ${placeLabel}!`);
          modalRef.close();
          window.dispatchEvent(new CustomEvent('planify:data-changed'));
          if (onCreated) onCreated(created);
        }
      } catch (err) {
        Toast.error(err.message || 'Không thể lưu dữ liệu.');
      }
    };

    const footerButtons = [];
    if (isEdit) {
      footerButtons.push({
        label: '🗑️ Xóa mục này',
        className: 'btn btn-danger',
        onClick: async () => {
          if (!confirm(`Bạn có chắc chắn muốn xóa "${existingItem.title}" không?`)) return;
          try {
            if (isLegacyEvent) {
              await api.delete(`/events/${existingItem.id}`);
            } else {
              await api.delete(`/tasks/${existingItem.id}`);
            }
            Toast.success('Đã xóa thành công.');
            modalRef.close();
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
      { label: isEdit ? '💾 Lưu cập nhật' : '✨ Tạo mới ngay', className: 'btn btn-primary', onClick: handleSave }
    );

    modalRef = Modal.open({
      title: isEdit ? '✏️ Chỉnh sửa Công việc / Sự kiện' : '✨ Thêm Công việc / Sự kiện mới',
      content: formContent,
      footerButtons
    });

    setTimeout(() => titleInput.focus(), 60);
  }
}
