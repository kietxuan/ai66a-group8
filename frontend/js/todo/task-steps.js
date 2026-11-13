import { createElement } from '../utils/dom.js';
import { createIcon } from '../utils/icons.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { confirmDeleteItem } from '../utils/confirm-delete.js';

export function validateStepTitle(value) {
  const title = String(value || '').trim();
  if (!title) throw new Error('Vui lòng nhập tên bước con.');
  if ([...title].length > 500) throw new Error('Tên bước con tối đa 500 ký tự.');
  return title;
}

export function stepProgress(steps = []) {
  const total = steps.length;
  const completed = steps.filter(step => step.is_completed).length;
  return { total, completed, percent: total ? Math.round(completed * 100 / total) : 0 };
}

let nextSectionId = 0;

/** Saved steps are independent of the parent form: only drafts need a guard. */
export class TaskSteps {
  constructor(task, { onChange = null } = {}) {
    this.task = task;
    this.owner = store.get('user')?.id;
    this.onChange = onChange;
    this.steps = Array.isArray(task.steps) ? [...task.steps] : [];
    this.draft = '';
    this.editId = null;
    this.editValue = '';
    this.busy = false;
    this.loading = false;
    this.loaded = false;
    this.error = '';
    this.mustReload = false;
    this.destroyed = false;
    this.generation = 0;
    this.headingId = `task-steps-${++nextSectionId}`;
    this.element = createElement('section', { className: 'task-steps', 'aria-labelledby': this.headingId });
    this.render();
  }

  isLive() {
    return !this.destroyed && this.element.isConnected && this.owner === store.get('user')?.id;
  }

  isDirty() {
    const original = this.steps.find(step => step.id === this.editId)?.title || '';
    return Boolean(this.draft.trim()) || (this.editId !== null && this.editValue.trim() !== original);
  }

  get isSaving() { return this.busy && !this.loading; }

  focusDraft() {
    this.element.querySelector(this.editId !== null ? '.task-step-edit input' : '.task-step-add input')?.focus();
  }

  destroy() {
    this.destroyed = true;
    this.generation++;
  }

  setSteps(steps) {
    if (this.busy || this.isDirty()) return false;
    if (this.loaded && JSON.stringify(this.steps) === JSON.stringify(steps || [])) return true;
    this.steps = [...(steps || [])];
    this.loaded = true;
    this.render();
    return true;
  }

  async load() {
    if (this.busy || this.destroyed) return;
    const generation = ++this.generation;
    this.busy = true;
    this.loading = true;
    this.error = '';
    this.render();
    try {
      const fresh = await api.get(`/tasks/${this.task.id}`);
      if (!this.isLive() || generation !== this.generation) return;
      if (!Array.isArray(fresh?.steps)) throw new Error('Không đọc được danh sách bước con.');
      this.steps = fresh.steps;
      this.task.steps = [...fresh.steps];
      // A timed-out write may already have succeeded. Reconcile its response
      // from the canonical list before permitting another explicit attempt.
      const pending = this.uncertain;
      if (pending?.action === 'add' && fresh.steps.some(step => !pending.ids.includes(step.id) && step.title === pending.title)) this.draft = '';
      if (pending?.action === 'edit' && fresh.steps.some(step => step.id === pending.stepId && step.title === pending.title)) this.editId = null;
      this.uncertain = null;
      this.loaded = true;
      this.mustReload = false;
    } catch (error) {
      if (this.isLive() && generation === this.generation) this.error = error.message || 'Không tải được bước con.';
    } finally {
      if (this.isLive() && generation === this.generation) {
        this.busy = false;
        this.loading = false;
        this.render();
      }
    }
  }

  async mutate(action, { step = null, title = null } = {}) {
    if (!this.isLive() || this.busy || !this.loaded || this.mustReload) return;
    const generation = ++this.generation;
    this.busy = true;
    this.error = '';
    this.render();
    const url = `/tasks/${this.task.id}/steps`;
    const previousIds = this.steps.map(item => item.id);
    try {
      if (action === 'add') {
        const position = this.steps.reduce((max, item) => Math.max(max, item.position || 0), -1) + 1;
        const created = await api.post(url, { title, position });
        if (!this.isLive() || generation !== this.generation) return;
        if (!created?.id) throw new Error('Chưa xác nhận được kết quả lưu.');
        this.steps.push(created);
        this.draft = '';
      } else if (action === 'edit') {
        const updated = await api.put(`${url}/${step.id}`, { title });
        if (!this.isLive() || generation !== this.generation) return;
        if (!updated?.id) throw new Error('Chưa xác nhận được kết quả lưu.');
        this.steps = this.steps.map(item => item.id === step.id ? updated : item);
        this.editId = null;
        this.editValue = '';
      } else if (action === 'toggle') {
        const updated = await api.patch(`${url}/${step.id}/complete`, { is_completed: !step.is_completed });
        if (!this.isLive() || generation !== this.generation) return;
        if (!updated?.id) throw new Error('Chưa xác nhận được kết quả lưu.');
        this.steps = this.steps.map(item => item.id === step.id ? updated : item);
      } else if (action === 'delete') {
        await api.delete(`${url}/${step.id}`);
        if (!this.isLive() || generation !== this.generation) return;
        this.steps = this.steps.filter(item => item.id !== step.id);
      }
      this.task.steps = [...this.steps];
      this.onChange?.([...this.steps]);
    } catch (error) {
      if (this.isLive() && generation === this.generation) {
        this.error = `${error.message || 'Không lưu được bước con.'} Hãy tải lại danh sách trước khi thử lại để tránh lưu trùng.`;
        this.mustReload = true;
        this.uncertain = { action, title, stepId: step?.id, ids: previousIds };
      }
    } finally {
      if (this.isLive() && generation === this.generation) {
        this.busy = false;
        this.render();
        if (action === 'add' && !this.error) this.focusDraft();
      }
    }
  }

  saveTitle(action, step = null) {
    try {
      const title = validateStepTitle(action === 'add' ? this.draft : this.editValue);
      if (action === 'edit' && title === step.title) {
        this.editId = null;
        this.error = '';
        this.render();
        return;
      }
      this.mutate(action, { step, title });
    } catch (error) {
      this.error = error.message;
      this.render();
      this.focusDraft();
    }
  }

  render() {
    const progress = stepProgress(this.steps);
    const disabled = this.busy || !this.loaded || this.mustReload;
    const list = createElement('ul', { className: 'task-step-list' });
    const sorted = [...this.steps].sort((a, b) => (a.position || 0) - (b.position || 0) || a.id - b.id);
    for (const step of sorted) {
      const editing = this.editId === step.id;
      const row = createElement('li', { className: `task-step-row${step.is_completed ? ' is-completed' : ''}`, dataset: { stepId: step.id } });
      if (editing) {
        row.classList.add('task-step-edit');
        const input = createElement('input', {
          className: 'input', 'aria-label': 'Sửa tên bước con', value: this.editValue, disabled,
          oninput: event => { this.editValue = event.target.value; },
          onkeydown: event => {
            if (event.isComposing) return;
            if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); this.saveTitle('edit', step); }
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.editId = null; this.error = ''; this.render(); }
          }
        });
        row.append(input, createElement('div', { className: 'task-step-edit-actions' }, [
          createElement('button', { type: 'button', className: 'btn btn-sm btn-primary', textContent: 'Lưu bước', disabled, onclick: () => this.saveTitle('edit', step) }),
          createElement('button', { type: 'button', className: 'btn btn-sm btn-secondary', textContent: 'Hủy sửa', disabled: this.busy, onclick: () => { this.editId = null; this.error = ''; this.render(); } })
        ]));
      } else {
        row.append(createElement('label', { className: 'task-step-main' }, [
          createElement('input', { type: 'checkbox', checked: step.is_completed, disabled: disabled || this.editId !== null, 'aria-label': `Hoàn thành bước: ${step.title}`, onchange: () => this.mutate('toggle', { step }) }),
          createElement('span', { className: 'task-step-title', textContent: step.title })
        ]), createElement('div', { className: 'task-step-actions' }, [
          createElement('button', { type: 'button', className: 'btn-icon', 'aria-label': `Sửa bước: ${step.title}`, title: 'Sửa bước', disabled: disabled || this.editId !== null, onclick: () => { this.editId = step.id; this.editValue = step.title; this.error = ''; this.render(); this.focusDraft(); } }, [createIcon('pencil', { size: 16 })]),
          createElement('button', { type: 'button', className: 'btn-icon task-step-delete', 'aria-label': `Xóa bước: ${step.title}`, title: 'Xóa bước', disabled: disabled || this.editId !== null, onclick: () => {
            if (confirmDeleteItem({ title: `${step.title} (bước con của ${this.task.title})` })) this.mutate('delete', { step });
          } }, [createIcon('trash-2', { size: 16 })])
        ]));
      }
      list.appendChild(row);
    }
    const addInput = createElement('input', {
      type: 'text', className: 'input', 'aria-label': 'Thêm bước con', placeholder: 'Thêm bước con...', value: this.draft,
      disabled: disabled || this.editId !== null,
      oninput: event => { this.draft = event.target.value; },
      onkeydown: event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); event.stopPropagation(); this.saveTitle('add'); } }
    });
    this.element.replaceChildren(
      createElement('div', { className: 'task-step-heading' }, [
        createElement('h3', { id: this.headingId, textContent: 'Bước con' }),
        createElement('span', { className: 'task-step-count', 'aria-live': 'polite', textContent: `${progress.completed}/${progress.total} bước` })
      ]),
      createElement('div', { className: 'task-step-progress', role: 'progressbar', 'aria-label': 'Tiến độ bước con', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(progress.percent) }, [
        createElement('span', { style: { width: `${progress.percent}%` } })
      ]),
      ...(this.busy ? [createElement('div', { className: 'task-step-state', role: 'status' }, [createIcon('loader-circle', { spin: true }), createElement('span', { textContent: this.loading ? 'Đang tải bước con...' : 'Đang lưu bước con...' })])] : []),
      ...(this.error ? [createElement('div', { className: 'task-step-error', role: 'alert' }, [
        createElement('span', { textContent: this.error }),
        ...((this.mustReload || !this.loaded) ? [createElement('button', { type: 'button', className: 'btn btn-sm btn-secondary', textContent: 'Tải lại bước con', disabled: this.busy, onclick: () => this.load() })] : [])
      ])] : []),
      ...(this.loaded && !this.steps.length && !this.busy ? [createElement('p', { className: 'task-step-empty', textContent: 'Chưa có bước con. Chia công việc thành các bước nhỏ để dễ theo dõi.' })] : []),
      list,
      createElement('div', { className: 'task-step-add' }, [addInput, createElement('button', { type: 'button', className: 'btn btn-sm btn-secondary', textContent: 'Thêm', 'aria-label': 'Thêm bước con vào công việc', disabled: disabled || this.editId !== null, onclick: () => this.saveTitle('add') })]),
      createElement('small', { className: 'task-step-hint', textContent: 'Bước con được lưu ngay. Hoàn thành các bước không tự đánh dấu xong công việc chính.' })
    );
  }
}
