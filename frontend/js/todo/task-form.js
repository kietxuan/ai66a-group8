import { createElement } from '../utils/dom.js';
import { newRequestId } from '../utils/request-id.js';
import { api } from '../api.js';
import { Toast } from '../components/toast.js';
import { EventForm } from '../calendar/event-form.js';

export class TaskForm {
  constructor({ container, listId = null, onCreated = null }) {
    this.container = container;
    this.listId = listId;
    this.onCreated = onCreated;

    this.isImportant = false;
    this.autoComplete = false;

    this.render();
  }

  setListContext(listId) {
    this.listId = listId;
  }

  render() {
    const draft = this.input?.value || '';
    this.container.innerHTML = '';

    const form = createElement('div', { className: 'todo-input-bar-container' });

    const inputRow = createElement('div', { className: 'todo-input-bar' });
    const addIcon = createElement('span', { style: { color: 'var(--color-primary)', fontWeight: 'bold' }, textContent: '➕' });

    const input = createElement('input', {
      type: 'text',
      className: 'todo-input',
      value: draft,
      placeholder: 'Nhập tên việc cần làm (Mặc định vĩnh viễn ở cột Cần làm, kéo thả được vào Lịch)... Nhấn Enter để lưu',
      oninput: () => { if (this.errorEl) this.errorEl.textContent = [...input.value].length > 500 ? 'Tiêu đề tối đa 500 ký tự.' : ''; },
      onkeydown: (e) => {
        if (e.key === 'Enter') {
          this.submit(input);
        }
      }
    });

    const submitBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-primary btn-sm',
      textContent: 'Thêm nhanh',
      onclick: () => this.submit(input)
    });

    inputRow.appendChild(addIcon);
    inputRow.appendChild(input);
    inputRow.appendChild(submitBtn);

    // Quick toggles bar
    const toolbar = createElement('div', {
      className: 'flex items-center justify-between gap-sm flex-wrap',
      style: { padding: '4px 8px 8px 8px', fontSize: '12px' }
    });

    const leftToggles = createElement('div', { className: 'flex items-center gap-xs flex-wrap' });

    const autoBtn = createElement('button', {
      type: 'button',
      className: `btn btn-secondary btn-sm ${this.autoComplete ? 'active' : ''}`,
      title: 'Bật nếu đây là Sự kiện tự động hoàn thành khi hết thời gian',
      textContent: this.autoComplete ? '⚡ Sự kiện (Tự hoàn thành)' : '☑️ Phải tích mới hoàn thành (Mặc định)',
      onclick: () => {
        this.autoComplete = !this.autoComplete;
        this.render();
      }
    });

    const starBtn = createElement('button', {
      type: 'button',
      className: `btn btn-secondary btn-sm ${this.isImportant ? 'active' : ''}`,
      title: 'Đánh dấu sao Quan trọng trên thẻ',
      innerHTML: this.isImportant ? '⭐ Quan trọng (Đã bật)' : '☆ Đánh dấu Quan trọng',
      onclick: () => {
        this.isImportant = !this.isImportant;
        this.render();
      }
    });

    const openFullModalBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-secondary btn-sm',
      textContent: '📅 Đặt Ngày/Giờ & Tùy chọn đầy đủ...',
      onclick: () => {
        const draftTitle = input.value.trim();
        EventForm.showFullModal({
          task: draftTitle ? { title: draftTitle, is_important: this.isImportant, auto_complete: this.autoComplete } : null,
          hasDate: false,
          defaultListId: this.listId,
          onCreated: (created) => {
            input.value = '';
            if (this.onCreated) this.onCreated(created);
          }
        });
      }
    });

    leftToggles.appendChild(autoBtn);
    leftToggles.appendChild(starBtn);
    toolbar.appendChild(leftToggles);
    toolbar.appendChild(openFullModalBtn);

    form.appendChild(inputRow);
    this.errorEl = createElement('small', { role: 'alert', style: { color: 'var(--color-danger, #dc2626)' } });
    form.appendChild(this.errorEl);
    form.appendChild(toolbar);

    this.container.appendChild(form);
    this.input = input;
  }

  async submit(inputEl) {
    const title = inputEl.value.trim();
    if (!title) return;
    if ([...title].length > 500) {
      if (this.errorEl) this.errorEl.textContent = 'Tiêu đề tối đa 500 ký tự.';
      return;
    }

    try {
      // Mặc định không để thời gian (due_date: null -> Vĩnh viễn ở cột Cần làm & kéo vào Lịch được)
      const signature = JSON.stringify({ title, listId: this.listId, isImportant: this.isImportant, autoComplete: this.autoComplete });
      const payload = {
        title,
        client_request_id: this.pendingCreate?.signature === signature ? this.pendingCreate.id : newRequestId(),
        list_id: this.listId || undefined,
        due_date: null,
        is_all_day: true,
        is_important: this.isImportant,
        auto_complete: this.autoComplete
      };
      this.pendingCreate = { signature, id: payload.client_request_id };

      const newTask = await api.post('/tasks', payload);
      this.pendingCreate = null;
      inputEl.value = '';
      this.isImportant = false;
      this.autoComplete = false;
      this.render();

      window.dispatchEvent(new CustomEvent('planify:data-changed', {
        detail: { source: 'todo-form', action: 'create', type: 'task', id: newTask?.id }
      }));
      document.dispatchEvent(new CustomEvent('task-changed', {
        detail: { action: 'create', task: newTask }
      }));

      Toast.success('Đã thêm vào cột Cần làm (Vĩnh viễn)!');
      if (this.onCreated) this.onCreated(newTask);
    } catch (err) {
      Toast.error(err.message || 'Lỗi khi thêm công việc');
    }
  }
}
