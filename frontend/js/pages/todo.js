import { createElement } from '../utils/dom.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { Toast } from '../components/toast.js';
import { formatVietnameseDate } from '../utils/date.js';
import { SmartListsSidebar } from '../todo/smart-lists.js';
import { TaskListView } from '../todo/task-list-view.js';
import { TaskForm } from '../todo/task-form.js';
import { TaskDetail } from '../todo/task-detail.js';
import { EventForm } from '../calendar/event-form.js';
import { Dropdown } from '../components/dropdown.js';

export const todoPage = {
  container: null,
  tasks: [],
  activeListId: 'board',
  activeListName: 'Bảng quản lý chung',
  activeListIcon: '📋',
  activeTask: null,
  sortBy: 'time',
  onlyImportant: false,
  searchQuery: '',

  sidebarComponent: null,
  taskListComponent: null,
  taskFormComponent: null,
  taskDetailComponent: null,

  restoreSavedListSelection() {
    const saved = store.get('activeTodoList') || localStorage.getItem('planify_todo_active_list') || 'board';
    if (!saved || saved === 'board' || ['my_day', 'important', 'planned', 'all', 'overdue', 'completed', 'time_blocked'].includes(String(saved))) {
      this.activeListId = 'board';
      this.activeListName = 'Bảng quản lý chung';
      this.activeListIcon = '📋';
      store.set('activeTodoList', 'board');
      return;
    }

    const cleanId = String(saved).startsWith('list:') ? String(saved).split(':')[1] : String(saved);
    const numId = parseInt(cleanId, 10);
    if (!isNaN(numId)) {
      this.activeListId = numId;
      const lists = store.get('taskLists') || [];
      const matched = lists.find(l => l.id === numId);
      if (matched) {
        this.activeListName = matched.name;
        this.activeListIcon = matched.icon || '📝';
      } else {
        this.activeListName = 'Danh sách công việc';
        this.activeListIcon = '📝';
      }
    } else {
      this.activeListId = 'board';
      this.activeListName = 'Bảng quản lý chung';
      this.activeListIcon = '📋';
    }
  },

  async render(container) {
    this.container = container;
    container.innerHTML = '';

    this.restoreSavedListSelection();

    const page = createElement('div', { className: 'todo-page' });

    // 1. Sidebar Container
    const sidebarEl = createElement('aside', { className: 'todo-sidebar', id: 'todo-sub-sidebar' });

    // 2. Main Content Container
    const mainEl = createElement('div', { className: 'todo-main flex-1 flex flex-col overflow-hidden' });

    // Header
    const headerEl = createElement('div', {
      className: 'todo-header',
      id: 'todo-page-header',
      dataset: { listTheme: String(this.activeListId) }
    });

    const titleRow = createElement('div', { className: 'todo-title-row' }, [
      createElement('button', {
        className: 'btn-icon mobile-only',
        textContent: '☰',
        title: 'Mở danh sách To Do',
        onclick: () => sidebarEl.classList.toggle('mobile-open')
      }),
      createElement('span', { id: 'todo-header-icon', style: { fontSize: '28px' }, textContent: this.activeListIcon }),
      createElement('div', {}, [
        createElement('h1', { className: 'todo-title', id: 'todo-header-title', textContent: this.activeListName }),
        createElement('span', {
          className: 'todo-date-subtitle',
          id: 'todo-header-subtitle',
          textContent: String(this.activeListId) === 'board'
            ? `${formatVietnameseDate(new Date())} • Sắp xếp tự động theo thời gian`
            : 'Chế độ Danh sách • Sắp xếp mặc định theo thời gian'
        })
      ])
    ]);

    const headerActions = createElement('div', { className: 'flex items-center gap-xs flex-wrap' });

    // Search Input
    const searchInput = createElement('input', {
      type: 'text',
      className: 'todo-search-input',
      placeholder: '🔍 Tìm nhanh công việc / sự kiện...',
      value: this.searchQuery,
      oninput: (e) => {
        this.searchQuery = e.target.value;
        this.updateComponents();
      }
    });

    // Filter Important (⭐) toggle button
    const filterImpBtn = createElement('button', {
      type: 'button',
      className: `btn btn-secondary btn-sm ${this.onlyImportant ? 'active' : ''}`,
      textContent: this.onlyImportant ? '⭐ Đang lọc Quan trọng' : '☆ Lọc Quan trọng',
      title: 'Chỉ hiển thị các mục có đánh dấu sao Quan trọng',
      onclick: () => {
        this.onlyImportant = !this.onlyImportant;
        filterImpBtn.classList.toggle('active', this.onlyImportant);
        filterImpBtn.textContent = this.onlyImportant ? '⭐ Đang lọc Quan trọng' : '☆ Lọc Quan trọng';
        this.updateComponents();
      }
    });

    // Sort Dropdown button
    const sortBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-secondary btn-sm',
      id: 'btn-sort-tasks',
      textContent: '⇅ Theo thời gian',
      onclick: (e) => this.showSortDropdown(e, sortBtn)
    });

    // Open Full Unified Form button
    const fullFormBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-primary btn-sm',
      textContent: '＋ Tạo Công việc / Sự kiện',
      onclick: () => {
        EventForm.showFullModal({
          hasDate: false,
          defaultListId: typeof this.activeListId === 'number' ? this.activeListId : null,
          onCreated: () => this.fetchTasks()
        });
      }
    });

    headerActions.appendChild(searchInput);
    headerActions.appendChild(filterImpBtn);
    headerActions.appendChild(sortBtn);
    headerActions.appendChild(fullFormBtn);

    headerEl.appendChild(titleRow);
    headerEl.appendChild(headerActions);

    // Quick Task Form Input Bar Container
    const formContainer = createElement('div');

    // Task Items List / Kanban Container
    const listContainer = createElement('div', { className: 'flex-1 overflow-hidden flex flex-col' });

    mainEl.appendChild(headerEl);
    mainEl.appendChild(formContainer);
    mainEl.appendChild(listContainer);

    // 3. Task Detail Panel Container
    const detailEl = createElement('div', { className: 'task-detail-container', style: { display: 'none' } });

    page.appendChild(sidebarEl);
    page.appendChild(mainEl);
    page.appendChild(detailEl);
    container.appendChild(page);

    // Initialize sub-components
    this.sidebarComponent = new SmartListsSidebar({
      container: sidebarEl,
      activeListId: this.activeListId,
      tasks: this.tasks,
      onSelectList: (id, name, icon) => {
        sidebarEl.classList.remove('mobile-open');
        this.switchList(id, name, icon);
      },
      onListsChanged: () => this.fetchTasks()
    });

    this.taskListComponent = new TaskListView({
      container: listContainer,
      tasks: this.tasks,
      activeListId: this.activeListId,
      activeTaskId: this.activeTask?.id || null,
      sortBy: this.sortBy,
      onlyImportant: this.onlyImportant,
      searchQuery: this.searchQuery,
      onSelectTask: (task) => this.selectTask(task),
      onToggleComplete: (task, isCompleted) => this.toggleComplete(task, isCompleted),
      onToggleImportant: (task, isImportant) => this.toggleImportant(task, isImportant),
      onReorderTasks: (srcId, targetId) => this.reorderTasks(srcId, targetId),
      onRefresh: () => this.fetchTasks()
    });

    this.taskFormComponent = new TaskForm({
      container: formContainer,
      listId: typeof this.activeListId === 'number' ? this.activeListId : null,
      onCreated: () => this.fetchTasks()
    });

    this.taskDetailComponent = new TaskDetail(detailEl, {
      onUpdate: (options) => this.fetchTasks(options),
      onClose: () => this.closeDetail()
    });

    this.setupShortcuts();
    this.dataChangedListener = (event) => {
      if (event.detail?.source !== 'task-detail') this.fetchTasks();
    };
    window.addEventListener('planify:data-changed', this.dataChangedListener);
    document.addEventListener('task-changed', this.dataChangedListener);

    await this.fetchTasks();
  },

  async fetchTasks({ preserveDetail = false } = {}) {
    try {
      this.tasks = await api.get('/tasks') || [];
      // Update header title if custom list was restored from localStorage
      if (typeof this.activeListId === 'number') {
        const lists = store.get('taskLists') || [];
        const matched = lists.find(l => l.id === this.activeListId);
        if (matched) {
          this.activeListName = matched.name;
          this.activeListIcon = matched.icon || '📝';
          const iconEl = document.getElementById('todo-header-icon');
          const titleEl = document.getElementById('todo-header-title');
          if (iconEl) iconEl.textContent = this.activeListIcon;
          if (titleEl) titleEl.textContent = this.activeListName;
        }
      }

      if (this.activeTask) {
        const updatedActive = this.tasks.find(t => t.id === this.activeTask.id);
        if (updatedActive) {
          if (preserveDetail) {
            Object.assign(this.activeTask, updatedActive);
            this.taskDetailComponent.task = this.activeTask;
          } else {
            this.activeTask = updatedActive;
            this.taskDetailComponent.show(updatedActive);
          }
        } else {
          this.closeDetail();
        }
      }
      this.updateComponents();
    } catch (err) {
      console.error('Failed to load tasks', err);
    }
  },

  updateComponents() {
    if (!this.sidebarComponent || !this.taskListComponent || !this.taskFormComponent) return;

    this.sidebarComponent.update({
      activeListId: this.activeListId,
      tasks: this.tasks
    });

    this.taskListComponent.setProps({
      tasks: this.tasks,
      activeListId: this.activeListId,
      activeTaskId: this.activeTask?.id || null,
      sortBy: this.sortBy,
      onlyImportant: this.onlyImportant,
      searchQuery: this.searchQuery
    });

    this.taskFormComponent.setListContext(
      typeof this.activeListId === 'number' ? this.activeListId : null
    );
  },

  switchList(id, name, icon) {
    this.activeListId = id;
    this.activeListName = name;
    this.activeListIcon = icon;

    store.set('activeTodoList', id === 'board' ? 'board' : String(id));

    const iconEl = document.getElementById('todo-header-icon');
    const titleEl = document.getElementById('todo-header-title');
    const subEl = document.getElementById('todo-header-subtitle');
    const headerEl = document.getElementById('todo-page-header');

    if (headerEl) {
      headerEl.dataset.listTheme = String(id);
    }
    if (iconEl) iconEl.textContent = icon;
    if (titleEl) titleEl.textContent = name;
    if (subEl) {
      subEl.textContent = String(id) === 'board'
        ? `${formatVietnameseDate(new Date())} • Sắp xếp tự động theo thời gian`
        : 'Chế độ Danh sách • Sắp xếp mặc định theo thời gian';
    }

    this.updateComponents();
  },

  selectTask(task) {
    if (this.activeTask && this.activeTask.id === task.id) {
      this.closeDetail();
      return;
    }

    this.activeTask = task;
    const detailContainer = this.container?.querySelector('.task-detail-container');
    if (detailContainer) {
      detailContainer.style.display = 'block';
    }
    this.taskDetailComponent.show(task);
    this.updateComponents();
  },

  closeDetail() {
    this.activeTask = null;
    const detailContainer = this.container?.querySelector('.task-detail-container');
    if (detailContainer) {
      detailContainer.style.display = 'none';
    }
    this.taskDetailComponent.hide();
    if (this.taskListComponent) {
      this.taskListComponent.setProps({ activeTaskId: null });
    }
  },

  async toggleComplete(task, isCompleted) {
    try {
      const updated = await api.patch(`/tasks/${task.id}/complete`, { is_completed: isCompleted });
      task.is_completed = isCompleted;
      window.dispatchEvent(new CustomEvent('planify:data-changed', {
        detail: { source: 'todo', action: 'complete', type: 'task', id: task.id, is_completed: isCompleted }
      }));
      document.dispatchEvent(new CustomEvent('task-changed', {
        detail: { action: 'update', task: updated }
      }));
      await this.fetchTasks();
    } catch (err) {
      Toast.error('Không thể cập nhật trạng thái');
    }
  },

  async toggleImportant(task, isImportant) {
    try {
      const updated = await api.patch(`/tasks/${task.id}/important`, { is_important: isImportant });
      task.is_important = isImportant;
      window.dispatchEvent(new CustomEvent('planify:data-changed', {
        detail: { source: 'todo', action: 'important', type: 'task', id: task.id, is_important: isImportant }
      }));
      document.dispatchEvent(new CustomEvent('task-changed', {
        detail: { action: 'update', task: updated }
      }));
      this.updateComponents();
    } catch (err) {
      Toast.error('Không thể cập nhật quan trọng');
    }
  },

  async reorderTasks(sourceId, targetId) {
    const srcIdx = this.tasks.findIndex(t => t.id === sourceId);
    const trgIdx = this.tasks.findIndex(t => t.id === targetId);
    if (srcIdx !== -1 && trgIdx !== -1) {
      const [moved] = this.tasks.splice(srcIdx, 1);
      this.tasks.splice(trgIdx, 0, moved);

      this.tasks.forEach((t, idx) => {
        t.position = idx;
      });
      this.updateComponents();

      try {
        const items = this.tasks.map((t, idx) => ({ id: t.id, position: idx }));
        await api.put('/tasks/reorder', { items });
      } catch (_) {}
    }
  },

  showSortDropdown(e, sortBtn) {
    const items = [
      {
        label: '🕒 Theo thời gian (Mặc định)',
        onClick: () => {
          this.sortBy = 'time';
          if (sortBtn) sortBtn.textContent = '⇅ Theo thời gian';
          this.updateComponents();
        }
      },
      {
        label: '⭐ Quan trọng lên đầu',
        onClick: () => {
          this.sortBy = 'important';
          if (sortBtn) sortBtn.textContent = '⇅ Quan trọng';
          this.updateComponents();
        }
      },
      {
        label: '🔤 Theo tên (A-Z)',
        onClick: () => {
          this.sortBy = 'title';
          if (sortBtn) sortBtn.textContent = '⇅ Tên A-Z';
          this.updateComponents();
        }
      }
    ];

    Dropdown.show({
      triggerEl: e.currentTarget,
      anchorEl: e.currentTarget,
      items
    });
  },

  setupShortcuts() {
    this.keyHandler = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) {
        return;
      }

      if (e.key === 'Escape' && this.activeTask) {
        this.closeDetail();
      }
    };

    document.addEventListener('keydown', this.keyHandler);
  },

  destroy() {
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
    }
    if (this.dataChangedListener) {
      window.removeEventListener('planify:data-changed', this.dataChangedListener);
      document.removeEventListener('task-changed', this.dataChangedListener);
      this.dataChangedListener = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
};
