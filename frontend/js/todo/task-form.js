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
    const addIcon = createElement('span', {
      'data-icon': 'plus',
      'aria-hidden': 'true',
      style: {
        fontSize: '18px',
        fontWeight: 'bold',
        color: 'var(--color-text-secondary)',
        display: 'flex',
        alignItems: 'center',
        userSelect: 'none',
        lineHeight: '1'
      },
      textContent: '＋'
    });

    const input = createElement('input', {
      type: 'text',
      className: 'todo-input',
      value: draft,
      placeholder: 'Nhập việc cần làm... (nhấn Enter để thêm)',
      oninput: () => { if (this.errorEl) this.errorEl.textContent = [...input.value].length > 500 ? 'Tiêu đề tối đa 500 ký tự.' : ''; },
      onkeydown: (e) => {
        if (e.key === 'Enter') {
          this.submit(input);
        }
      }
    });

    const detailBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-secondary btn-sm',
      textContent: 'Chi tiết',
      title: 'Mở biểu mẫu chi tiết đầy đủ',
      style: {
        border: '1px solid var(--color-border)',
        flexShrink: '0',
        height: '32px'
      },
      onclick: () => {
        const draftTitle = input.value.trim();
        EventForm.showFullModal({
          task: draftTitle ? { title: draftTitle } : null,
          hasDate: false,
          defaultListId: this.listId,
          onCreated: (created) => {
            input.value = '';
            if (this.onCreated) this.onCreated(created);
          }
        });
      }
    });

    inputRow.appendChild(addIcon);
    inputRow.appendChild(input);
    inputRow.appendChild(detailBtn);

    form.appendChild(inputRow);
    this.errorEl = createElement('small', { role: 'alert', style: { color: 'var(--color-danger, #dc2626)' } });
    form.appendChild(this.errorEl);

    this.container.appendChild(form);
    this.input = input;
  }

  async submit(inputEl) {
    if (this.submitting) return;
    const title = inputEl.value.trim();
    if (!title) return;
    if ([...title].length > 500) {
      if (this.errorEl) this.errorEl.textContent = 'Tiêu đề tối đa 500 ký tự.';
      return;
    }

    this.submitting = true;
    inputEl.disabled = true;
    try {
      // Mặc định không để thời gian (due_date: null -> Vĩnh viễn ở cột Cần làm & kéo vào Lịch được)
      const signature = JSON.stringify({ title, listId: this.listId, isImportant: this.isImportant });
      const payload = {
        title,
        client_request_id: this.pendingCreate?.signature === signature ? this.pendingCreate.id : newRequestId(),
        list_id: this.listId || undefined,
        due_date: null,
        is_all_day: true,
        is_important: false,
        auto_complete: false
      };
      this.pendingCreate = { signature, id: payload.client_request_id };

      const newTask = await api.post('/tasks', payload);
      this.pendingCreate = null;
      inputEl.value = '';

      window.dispatchEvent(new CustomEvent('planify:data-changed', {
        detail: { source: 'todo-form', action: 'create', type: 'task', id: newTask?.id }
      }));
      document.dispatchEvent(new CustomEvent('task-changed', {
        detail: { action: 'create', task: newTask }
      }));

      Toast.success('Đã thêm việc cần làm!');
      if (this.onCreated) this.onCreated(newTask);
    } catch (err) {
      Toast.error(err.message || 'Lỗi khi thêm công việc');
    } finally {
      this.submitting = false;
      inputEl.disabled = false;
    }
  }
}
