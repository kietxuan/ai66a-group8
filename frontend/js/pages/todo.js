import { businessNow } from '../utils/date.js';
import { iconMarkup } from '../utils/icons.js';
import { createElement } from '../utils/dom.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { formatVietnameseDate } from '../utils/date.js';
import { SmartListsSidebar, HOUSE_SVG, INFINITY_SVG, LIST_3BARS_SVG, TabSync, isDefaultTasksList } from '../todo/smart-lists.js';
import { TaskListView } from '../todo/task-list-view.js';
import { TaskForm } from '../todo/task-form.js';
import { TaskDetail } from '../todo/task-detail.js';
import { initTodoSidebarToggle } from '../todo/sidebar-toggle.js';
import { revisionOptions } from '../utils/revision.js';
import { isScheduleDismissal } from '../utils/api-error.js';

export const POPULAR_ICONS = [
  { icon: '📋', name: 'Bảng, Kế hoạch, Công việc' },
  { icon: '📝', name: 'Ghi chú, Viết, Bài viết' },
  { icon: '📅', name: 'Lịch, Ngày tháng, Lịch hẹn' },
  { icon: '⭐', name: 'Ngôi sao, Quan trọng, Yêu thích' },
  { icon: '🎯', name: 'Mục tiêu, Target, Trọng tâm' },
  { icon: '💼', name: 'Công việc, Sự nghiệp, Văn phòng' },
  { icon: '💻', name: 'Máy tính, Code, Lập trình, IT' },
  { icon: '📚', name: 'Sách vở, Học tập, Đọc sách' },
  { icon: '🎓', name: 'Tốt nghiệp, Đại học, Nghiên cứu' },
  { icon: '🚀', name: 'Khởi nghiệp, Dự án mới, Tên lửa' },
  { icon: '🏠', name: 'Nhà, Gia đình, Việc nhà' },
  { icon: '🛒', name: 'Mua sắm, Đi chợ, Siêu thị' },
  { icon: '💡', name: 'Ý tưởng, Sáng tạo, Đèn' },
  { icon: '🔔', name: 'Thông báo, Chuông, Nhắc nhở' },
  { icon: '⏰', name: 'Đồng hồ, Báo thức, Thời gian' },
  { icon: '☕', name: 'Cà phê, Nghỉ ngơi, Thư giãn' },
  { icon: '🍔', name: 'Ăn uống, Thực phẩm, Bữa ăn' },
  { icon: '🏃', name: 'Thể thao, Chạy bộ, Sức khỏe' },
  { icon: '🏋️', name: 'Gym, Tập luyện, Thể hình' },
  { icon: '🎨', name: 'Nghệ thuật, Thiết kế, Sáng tác' },
  { icon: '🎵', name: 'Âm nhạc, Bài hát, Giải trí' },
  { icon: '🎬', name: 'Phim ảnh, Video, Xem phim' },
  { icon: '📷', name: 'Chụp ảnh, Nhiếp ảnh, Camera' },
  { icon: '🎧', name: 'Nghe nhạc, Podcast, Audio' },
  { icon: '✈️', name: 'Du lịch, Máy bay, Chuyến đi' },
  { icon: '🚗', name: 'Xe cộ, Đi lại, Giao thông' },
  { icon: '💰', name: 'Tài chính, Tiền tệ, Chi tiêu' },
  { icon: '📈', name: 'Đầu tư, Biểu đồ, Tăng trưởng' },
  { icon: '🏥', name: 'Y tế, Bệnh viện, Sức khỏe' },
  { icon: '💊', name: 'Thuốc men, Khám bệnh, Y dược' },
  { icon: '🔑', name: 'Chìa khóa, Mật khẩu, Bảo mật' },
  { icon: '🔒', name: 'Khóa an toàn, Bảo mật, Riêng tư' },
  { icon: '🛠️', name: 'Công cụ, Sửa chữa, Kỹ thuật' },
  { icon: '📦', name: 'Đóng gói, Vận chuyển, Bưu kiện' },
  { icon: '🏷️', name: 'Nhãn thẻ, Phân loại, Tag' },
  { icon: '📌', name: 'Ghim, Đánh dấu, Lưu ý' },
  { icon: '💬', name: 'Tin nhắn, Trò chuyện, Giao tiếp' },
  { icon: '✉️', name: 'Thư điện tử, Email, Hộp thư' },
  { icon: '📞', name: 'Điện thoại, Gọi điện, Liên hệ' },
  { icon: '🌐', name: 'Website, Internet, Toàn cầu' },
  { icon: '🏆', name: 'Giải thưởng, Thành tích, Chiến thắng' },
  { icon: '🎁', name: 'Quà tặng, Sinh nhật, Kỷ niệm' },
  { icon: '🎉', name: 'Sự kiện, Tiệc tùng, Chúc mừng' },
  { icon: '🔥', name: 'Khẩn cấp, Hot, Nổi bật' },
  { icon: '⚡', name: 'Nhanh chóng, Năng lượng, Sấm sét' },
  { icon: '🌱', name: 'Cây cối, Thiên nhiên, Trồng cây' },
  { icon: '☀️', name: 'Mặt trời, Ban ngày, Buổi sáng' },
  { icon: '🌙', name: 'Mặt trăng, Buổi tối, Ban đêm' },
  { icon: '🐾', name: 'Thú cưng, Chó mèo, Động vật' },
  { icon: '🧹', name: 'Dọn dẹp, Vệ sinh, Nhà cửa' },
  { icon: '❤️', name: 'Yêu thích, Trái tim, Tình cảm' },
  { icon: '✨', name: 'Đặc biệt, Tỏa sáng, Lấp lánh' }
];

function renderHeaderIcon(el, icon) {
  if (!el) return;
  if ([HOUSE_SVG, INFINITY_SVG, LIST_3BARS_SVG].includes(icon)) {
    el.innerHTML = icon;
    const svg = el.querySelector("svg");
    if (svg) {
      svg.setAttribute("width", "24");
      svg.setAttribute("height", "24");
    }
  } else {
    el.textContent = icon || "☰";
  }
}

export const todoPage = {
  container: null,
  tasks: [],
  activeListId: "board",
  activeListName: "Tất cả",
  activeListIcon: HOUSE_SVG,
  activeTask: null,
  sortBy: "time",
  onlyImportant: false,
  searchQuery: "",

  isProtectedList(id = this.activeListId) {
    if (String(id) === 'board' || String(id) === 'tasks') return true;
    return isDefaultTasksList(id, store.get('taskLists'));
  },

  restoreSavedListSelection() {
    const saved = store.get("activeTodoList");
    if (
      !saved ||
      saved === "board" ||
      [
        "my_day",
        "important",
        "planned",
        "all",
        "overdue",
        "completed",
        "time_blocked",
      ].includes(String(saved))
    ) {
      this.activeListId = "board";
      this.activeListName = "Tất cả";
      this.activeListIcon = HOUSE_SVG;
      store.set("activeTodoList", "board");
      return;
    }

    if (saved === "tasks" || String(saved) === "tasks") {
      const lists = store.get("taskLists") || [];
      const defaultList = lists.find((l) => l.is_default || l.name?.toLowerCase() === "tasks");
      this.activeListId = defaultList ? defaultList.id : "tasks";
      this.activeListName = "Công việc";
      this.activeListIcon = INFINITY_SVG;
      return;
    }

    const cleanId = String(saved).startsWith("list:")
      ? String(saved).split(":")[1]
      : String(saved);
    const numId = parseInt(cleanId, 10);
    if (!isNaN(numId)) {
      this.activeListId = numId;
      const lists = store.get("taskLists") || [];
      const matched = lists.find((l) => l.id === numId);
      if (matched) {
        const isTasks = isDefaultTasksList(matched.id, lists);
        this.activeListName = isTasks ? "Công việc" : matched.name;
        this.activeListIcon = isTasks ? INFINITY_SVG : (matched.icon && matched.icon !== '☰' ? matched.icon : LIST_3BARS_SVG);
      } else {
        this.activeListName = "Danh sách công việc";
        this.activeListIcon = LIST_3BARS_SVG;
      }
    } else {
      this.activeListId = "board";
      this.activeListName = "Tất cả";
      this.activeListIcon = HOUSE_SVG;
    }
  },

  async render(container) {
    const filterOwner = store.get('user')?.id;
    if (this.filterOwner !== filterOwner) this.savedFilters = null;
    this.filterOwner = filterOwner;
    this.container = container;
    container.innerHTML = '';
    this.tasks = [];
    this.activeTask = null;

    this.restoreSavedListSelection();

    const page = createElement("div", { className: "todo-page" });

    // 1. Sidebar Container
    const sidebarEl = createElement("aside", {
      className: "todo-sidebar",
      id: "todo-sub-sidebar",
    });

    // 2. Main Content Container
    const mainEl = createElement("div", {
      className: "todo-main flex-1 flex flex-col",
      dataset: { view: String(this.activeListId) === 'board' ? 'board' : 'list' },
    });

    // Header
    const headerEl = createElement("div", {
      className: "todo-header",
      id: "todo-page-header",
      dataset: { listTheme: String(this.activeListId) },
    });

    const isProtected = this.isProtectedList();

    // Nút Icon bên trái Tiêu đề (Đổi biểu tượng)
    const iconBtn = createElement("button", {
      type: "button",
      className: `todo-header-icon-btn ${!isProtected ? 'interactive' : ''}`,
      id: "todo-header-icon",
      title: !isProtected ? 'Bấm để đổi biểu tượng danh sách' : '',
      onclick: () => this.showIconPickerModal()
    });
    renderHeaderIcon(iconBtn, this.activeListIcon);

    // Tiêu đề danh sách (Cho phép bấm vào để đổi tên)
    const titleEl = createElement("h1", {
      className: `todo-title ${!isProtected ? 'editable-title' : ''}`,
      id: "todo-header-title",
      textContent: this.activeListName,
      title: !isProtected ? 'Bấm vào để đổi tên danh sách' : '',
      onclick: () => this.startInlineTitleEdit(titleEl)
    });

    const sidebarToggle = createElement('button', {
      type: 'button',
      id: 'btn-todo-sidebar-toggle',
      className: 'btn-icon todo-sidebar-toggle',
      innerHTML: iconMarkup('panel-left'),
      'aria-controls': 'todo-sub-sidebar',
      title: 'Thu gọn danh sách To Do',
    });
    const titleRow = createElement("div", { className: "todo-title-row" }, [
      sidebarToggle,
      iconBtn,
      titleEl
    ]);

    const headerActions = createElement("div", {
      className: "todo-header-actions",
      style: { marginLeft: "auto" },
    });

    this.matchCountEl = createElement('div', {
      className: 'todo-header-counter-pill',
      role: 'status'
    });
    headerActions.appendChild(this.matchCountEl);

    headerEl.appendChild(titleRow);
    headerEl.appendChild(headerActions);

    // Quick Task Form Input Bar Container
    const formContainer = createElement("div");

    // Task Items List / Kanban Container
    const listContainer = createElement('div', { className: 'todo-list-container flex-1 flex flex-col' });

    mainEl.appendChild(headerEl);
    mainEl.appendChild(formContainer);
    mainEl.appendChild(listContainer);

    // 3. Task Detail Panel Container
    const detailEl = createElement("div", {
      className: "task-detail-container",
      style: { display: "none" },
    });

    page.appendChild(sidebarEl);
    page.appendChild(mainEl);
    page.appendChild(detailEl);
    container.appendChild(page);
    this.sidebarToggleCleanup = initTodoSidebarToggle({ page, sidebar: sidebarEl, button: sidebarToggle });

    // Initialize sub-components
    this.sidebarComponent = new SmartListsSidebar({
      container: sidebarEl,
      activeListId: this.activeListId,
      tasks: this.tasks,
      onSelectList: (id, name, icon) => {
        sidebarEl.classList.remove("mobile-open");
        this.switchList(id, name, icon);
      },
      onListsChanged: () => this.fetchTasks(),
    });

    this.taskListComponent = new TaskListView({
      container: listContainer,
      tasks: this.tasks,
      activeListId: this.activeListId,
      activeTaskId: this.activeTask?.id || null,
      sortBy: this.sortBy,
      onlyImportant: this.onlyImportant,
      searchQuery: this.searchQuery,
      ...this.savedFilters,
      onSelectTask: (task) => this.selectTask(task),
      onToggleComplete: (task, isCompleted) =>
        this.toggleComplete(task, isCompleted),
      onToggleImportant: (task, isImportant) =>
        this.toggleImportant(task, isImportant),
      onReorderTasks: (srcId, targetId) => this.reorderTasks(srcId, targetId),
      onRefresh: () => this.fetchTasks(),
      onFilteredChange: (tasks) => this.updateMatchCount(tasks),
    });

    this.taskFormComponent = new TaskForm({
      container: formContainer,
      listId: typeof this.activeListId === "number" ? this.activeListId : null,
      onCreated: () => this.fetchTasks(),
    });

    this.taskDetailComponent = new TaskDetail(detailEl, {
      onUpdate: (options) => this.fetchTasks(options),
      onClose: () => this.closeDetail(),
    });

    this.setupShortcuts();
    this.dataChangedListener = (event) => {
      if (event.detail?.source === 'task-detail') return;
      const calls = event.detail?.toolCalls;
      const refreshLists = event.detail?.source === 'ai' && Array.isArray(calls) && calls.some(call =>
        call?.result?.success === true && /^(create|update|delete)_task_list$/.test(call.name || call.tool || '')
      );
      this.fetchTasks({ refreshLists, preserveDetail: true });
    };
    window.addEventListener("planify:data-changed", this.dataChangedListener);
    document.addEventListener("task-changed", this.dataChangedListener);

    this.tabSyncUnsubscribe = TabSync.subscribe((msg) => {
      if (msg.type === 'lists_updated') {
        this.fetchTasks({ refreshLists: true, preserveDetail: true });
      } else if (msg.type === 'folders_updated') {
        if (this.sidebarComponent) {
          this.sidebarComponent.folders = this.sidebarComponent.loadFolders();
          this.sidebarComponent.render();
        }
      }
    });

    await this.fetchTasks({ refreshLists: true });
  },

  showIconPickerModal() {
    const isProtected = this.isProtectedList();
    if (isProtected) return;

    const searchInput = createElement('input', {
      type: 'text',
      className: 'input',
      placeholder: '🔍 Tìm kiếm biểu tượng (công việc, học tập, sao, nhà, cà phê...)...',
      id: 'icon-picker-search'
    });

    const gridContainer = createElement('div', {
      className: 'list-icon-grid',
      style: {
        maxHeight: '280px',
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '8px',
        padding: '6px'
      }
    });

    const renderGrid = (query = '') => {
      gridContainer.innerHTML = '';
      const q = query.trim().toLowerCase();
      const filtered = POPULAR_ICONS.filter(item => !q || item.name.toLowerCase().includes(q) || item.icon.includes(q));

      if (filtered.length === 0) {
        gridContainer.appendChild(createElement('div', {
          style: { gridColumn: '1 / -1', padding: '24px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '13px' },
          textContent: 'Không tìm thấy biểu tượng phù hợp'
        }));
        return;
      }

      filtered.forEach(item => {
        const btn = createElement('button', {
          type: 'button',
          className: 'list-icon-option',
          title: item.name,
          textContent: item.icon,
          style: {
            fontSize: '20px',
            height: '42px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          },
          onclick: async () => {
            try {
              await api.put(`/task-lists/${this.activeListId}`, { icon: item.icon });
              this.activeListIcon = item.icon;
              const lists = store.get('taskLists') || [];
              const matched = lists.find(l => String(l.id) === String(this.activeListId));
              if (matched) matched.icon = item.icon;
              store.set('taskLists', lists);

              const iconEl = document.getElementById('todo-header-icon');
              renderHeaderIcon(iconEl, item.icon);
              if (this.sidebarComponent) {
                await this.sidebarComponent.fetchLists();
                this.sidebarComponent.render();
              }
              TabSync.broadcast('lists_updated');
              Modal.close();
              Toast.success(`Đã đổi biểu tượng thành ${item.icon}`);
            } catch (err) {
              Toast.error(err.message || 'Lỗi khi cập nhật biểu tượng');
            }
          }
        });
        gridContainer.appendChild(btn);
      });
    };

    searchInput.oninput = (e) => renderGrid(e.target.value);
    renderGrid('');

    const clearBtn = createElement('button', {
      type: 'button',
      className: 'btn btn-secondary',
      style: { width: '100%', marginTop: '8px', justifyContent: 'center' },
      textContent: '🧹 Đặt lại mặc định (3 gạch ☰)',
      onclick: async () => {
        try {
          await api.put(`/task-lists/${this.activeListId}`, { icon: '☰' });
          this.activeListIcon = LIST_3BARS_SVG;
          const lists = store.get('taskLists') || [];
          const matched = lists.find(l => String(l.id) === String(this.activeListId));
          if (matched) matched.icon = '☰';
          store.set('taskLists', lists);

          const iconEl = document.getElementById('todo-header-icon');
          renderHeaderIcon(iconEl, LIST_3BARS_SVG);
          if (this.sidebarComponent) {
            await this.sidebarComponent.fetchLists();
            this.sidebarComponent.render();
          }
          TabSync.broadcast('lists_updated');
          Modal.close();
          Toast.success('Đã đặt lại biểu tượng mặc định (3 gạch)');
        } catch (err) {
          Toast.error(err.message || 'Lỗi khi đặt lại biểu tượng');
        }
      }
    });

    const content = createElement('div', { className: 'flex flex-col gap-sm' }, [
      searchInput,
      gridContainer,
      clearBtn
    ]);

    Modal.open({
      title: 'Chọn biểu tượng danh sách',
      content,
      width: '460px',
      showConfirm: false
    });

    setTimeout(() => searchInput.focus(), 80);
  },

  startInlineTitleEdit(titleEl) {
    const isProtected = this.isProtectedList();
    if (isProtected) return;

    const currentText = this.activeListName;
    const input = createElement('input', {
      type: 'text',
      className: 'input todo-title-edit-input',
      value: currentText,
      maxlength: 100,
      style: {
        fontSize: '18px',
        fontWeight: '800',
        padding: '3px 8px',
        minWidth: '220px',
        maxWidth: '400px'
      }
    });

    let saved = false;
    const saveName = async () => {
      if (saved) return;
      saved = true;
      const newName = input.value.trim();
      if (newName && newName !== currentText) {
        try {
          await api.put(`/task-lists/${this.activeListId}`, { name: newName });
          this.activeListName = newName;
          const lists = store.get('taskLists') || [];
          const found = lists.find(l => l.id === this.activeListId);
          if (found) found.name = newName;
          store.set('taskLists', lists);
          if (this.sidebarComponent) await this.sidebarComponent.fetchLists();
          TabSync.broadcast('lists_updated');
          Toast.success('Đã cập nhật tên danh sách');
        } catch (err) {
          Toast.error(err.message || 'Lỗi khi cập nhật tên');
        }
      }
      titleEl.textContent = this.activeListName;
      titleEl.style.display = '';
      input.remove();
    };

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveName();
      } else if (e.key === 'Escape') {
        saved = true;
        titleEl.textContent = currentText;
        titleEl.style.display = '';
        input.remove();
      }
    };

    input.onblur = () => {
      saveName();
    };

    titleEl.style.display = 'none';
    titleEl.parentNode.insertBefore(input, titleEl);
    input.focus();
    input.select();
  },

  async fetchTasks({ preserveDetail = false, refreshLists = false } = {}) {
    const userId = store.get('user')?.id;
    if (refreshLists) this.listsNeedRefresh = true;
    const reloadLists = this.listsNeedRefresh;
    const generation = this.requestGeneration = (this.requestGeneration || 0) + 1;
    const listContainer = this.taskListComponent?.container;
    if (this.matchCountEl) this.matchCountEl.textContent = 'Đang tải…';
    if (listContainer && !this.tasks?.length) listContainer.replaceChildren(createElement('div', { role: 'status', className: 'empty-state', textContent: 'Đang tải công việc…' }));
    try {
      const [tasks, refreshedLists, refreshedCategories] = await Promise.all([
        api.get('/tasks'),
        reloadLists ? api.get('/task-lists') : Promise.resolve(null),
        api.get('/categories').catch(() => null)
      ]);
      if (generation !== this.requestGeneration || !this.container || userId !== store.get('user')?.id) return;
      if (!Array.isArray(tasks) || (reloadLists && !Array.isArray(refreshedLists))) throw new Error('Dữ liệu công việc không hợp lệ.');
      this.tasks = tasks;
      if (Array.isArray(refreshedCategories)) {
        store.set('categories', refreshedCategories);
      }
      if (reloadLists) {
        const lists = refreshedLists || [];
        store.set('taskLists', lists);
        this.sidebarComponent.taskLists = lists;
        this.sidebarComponent.listsLoaded = true;
        this.listsNeedRefresh = false;
        if (typeof this.activeListId === 'number' && !lists.some(l => l.id === this.activeListId)) {
          this.switchList('board', 'Tất cả', HOUSE_SVG);
        }
      }

      if (String(this.activeListId) === "board") {
        this.activeListName = "Tất cả";
        this.activeListIcon = HOUSE_SVG;
        const iconEl = document.getElementById("todo-header-icon");
        const titleEl = document.getElementById("todo-header-title");
        renderHeaderIcon(iconEl, this.activeListIcon);
        if (titleEl) titleEl.textContent = this.activeListName;
      } else if (isDefaultTasksList(this.activeListId, store.get("taskLists"))) {
        this.activeListName = "Công việc";
        this.activeListIcon = INFINITY_SVG;
        const iconEl = document.getElementById("todo-header-icon");
        const titleEl = document.getElementById("todo-header-title");
        renderHeaderIcon(iconEl, this.activeListIcon);
        if (titleEl) titleEl.textContent = this.activeListName;
      } else {
        const lists = store.get("taskLists") || [];
        const matched = lists.find((l) => String(l.id) === String(this.activeListId));
        if (matched) {
          const isTasks = matched.is_default;
          this.activeListName = matched.name;
          this.activeListIcon = isTasks ? INFINITY_SVG : (matched.icon && matched.icon !== '☰' ? matched.icon : LIST_3BARS_SVG);
          const iconEl = document.getElementById("todo-header-icon");
          const titleEl = document.getElementById("todo-header-title");
          renderHeaderIcon(iconEl, this.activeListIcon);
          if (titleEl) titleEl.textContent = this.activeListName;
        }
      }

      if (this.activeTask) {
        const updatedActive = this.tasks.find(
          (t) => t.id === this.activeTask.id,
        );
        if (updatedActive) {
          if (preserveDetail || this.taskDetailComponent.isDirty?.() || this.taskDetailComponent.isSaving) {
            // Keep the form's original revision
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
      if (generation !== this.requestGeneration || !this.container || userId !== store.get('user')?.id) return;
      console.error('Failed to load tasks', err);
      if (this.matchCountEl) this.matchCountEl.textContent = '';
      if (listContainer) listContainer.replaceChildren(createElement('div', { className: 'empty-state', role: 'alert' }, [
        createElement('p', { textContent: `Không tải được công việc: ${err.message || 'Lỗi không xác định.'}` }),
        createElement('button', { type: 'button', className: 'btn btn-primary', textContent: 'Thử lại', onclick: () => this.fetchTasks({ refreshLists: true }) })
      ]));
    }
  },

  updateComponents() {
    if (
      !this.sidebarComponent ||
      !this.taskListComponent ||
      !this.taskFormComponent
    )
      return;

    this.sidebarComponent.update({
      activeListId: this.activeListId,
      tasks: this.tasks,
    });

    this.taskListComponent.setProps({
      tasks: this.tasks,
      activeListId: this.activeListId,
      activeTaskId: this.activeTask?.id || null,
      taskLists: store.get("taskLists") || [],
    });

    this.updateMatchCount(this.taskListComponent.filterTasks());

    const isTasksContext = isDefaultTasksList(this.activeListId, store.get("taskLists"));
    let formListId = typeof this.activeListId === "number" ? this.activeListId : null;
    if (isTasksContext) {
      const lists = store.get("taskLists") || [];
      const defaultList = lists.find(l => l.is_default || l.name?.toLowerCase() === "tasks");
      formListId = defaultList ? defaultList.id : formListId;
    }
    this.taskFormComponent.setListContext(formListId);
  },

  updateMatchCount(filtered) {
    const isTasks = isDefaultTasksList(this.activeListId, store.get("taskLists"));
    const activeListTasks = this.tasks.filter(t => {
      if (String(this.activeListId) === 'board' || isTasks) return true;
      return t.list_id === parseInt(this.activeListId, 10);
    });
    const pendingCount = filtered.filter(t => !t.is_completed).length;
    const totalCount = activeListTasks.length;
    if (this.matchCountEl) {
      this.matchCountEl.innerHTML = `
        <span class="counter-item pending"><strong class="counter-num">${pendingCount}</strong> việc cần làm</span>
        <span class="counter-sep">•</span>
        <span class="counter-item total"><strong class="counter-num">${filtered.length}</strong> khớp / ${totalCount} tổng số</span>
      `.trim();
    }

  },

  switchList(id, name, icon) {
    if (this.activeTask && String(this.activeListId) !== String(id) && this.closeDetail() === false) {
      this.updateComponents();
      return false;
    }
    this.activeListId = id;
    this.activeListName = name;

    if (String(id) === "board") {
      this.activeListIcon = HOUSE_SVG;
    } else if (isDefaultTasksList(id, store.get("taskLists"))) {
      this.activeListIcon = INFINITY_SVG;
    } else {
      const lists = store.get("taskLists") || [];
      const matched = lists.find((l) => String(l.id) === String(id));
      const isTasks = matched?.is_default;
      if (isTasks) {
        this.activeListIcon = INFINITY_SVG;
      } else if (icon && icon !== LIST_3BARS_SVG) {
        this.activeListIcon = icon;
      } else if (matched?.icon && matched.icon !== "☰") {
        this.activeListIcon = matched.icon;
      } else {
        this.activeListIcon = LIST_3BARS_SVG;
      }
    }

    store.set("activeTodoList", id === "board" ? "board" : String(id));

    const iconEl = document.getElementById("todo-header-icon");
    const titleEl = document.getElementById("todo-header-title");
    const headerEl = document.getElementById("todo-page-header");

    if (headerEl) {
      headerEl.dataset.listTheme = String(id);
    }
    const mainEl = this.container?.querySelector('.todo-main');
    if (mainEl) mainEl.dataset.view = String(id) === 'board' ? 'board' : 'list';

    const isProtected = this.isProtectedList(id);

    if (iconEl) {
      iconEl.className = `todo-header-icon-btn ${!isProtected ? 'interactive' : ''}`;
      iconEl.title = !isProtected ? 'Bấm để đổi biểu tượng danh sách' : '';
      renderHeaderIcon(iconEl, this.activeListIcon);
    }
    if (titleEl) {
      titleEl.className = `todo-title ${!isProtected ? 'editable-title' : ''}`;
      titleEl.title = !isProtected ? 'Bấm vào để đổi tên danh sách' : '';
      titleEl.textContent = name;
    }

    this.updateComponents();
  },

  selectTask(task) {
    if (this.activeTask && this.activeTask.id === task.id) {
      this.closeDetail();
      return;
    }

    if (this.taskDetailComponent?.canLeave?.() === false) return;

    this.activeTask = task;
    const detailContainer = this.container?.querySelector(
      ".task-detail-container",
    );
    if (detailContainer) {
      detailContainer.style.display = "block";
    }
    this.taskDetailComponent.show(task);
    this.updateComponents();
  },

  closeDetail() {
    if (this.taskDetailComponent?.canLeave?.() === false) return false;
    this.activeTask = null;
    const detailContainer = this.container?.querySelector(
      ".task-detail-container",
    );
    if (detailContainer) {
      detailContainer.style.display = "none";
    }
    this.taskDetailComponent.hide();
    if (this.taskListComponent) {
      this.taskListComponent.setProps({ activeTaskId: null });
    }
  },

  canLeave() {
    try {
      return this.taskDetailComponent?.canLeave?.() !== false;
    } catch {
      return true;
    }
  },

  async toggleComplete(task, isCompleted) {
    try {
      const updated = await api.patch(`/tasks/${task.id}/complete`, { is_completed: isCompleted }, revisionOptions(task));
      Object.assign(task, updated);
      window.dispatchEvent(
        new CustomEvent("planify:data-changed", {
          detail: {
            source: "todo",
            action: "complete",
            type: "task",
            id: task.id,
            is_completed: isCompleted,
          },
        }),
      );
      document.dispatchEvent(
        new CustomEvent("task-changed", {
          detail: { action: "update", task: updated },
        }),
      );
      this.updateComponents();
    } catch (err) {
      if (!isScheduleDismissal(err)) Toast.error(err.message || 'Không thể cập nhật trạng thái');
      this.fetchTasks();
    }
  },

  async toggleImportant(task, isImportant) {
    try {
      const updated = await api.patch(`/tasks/${task.id}/important`, { is_important: isImportant }, revisionOptions(task));
      Object.assign(task, updated);
      window.dispatchEvent(
        new CustomEvent("planify:data-changed", {
          detail: {
            source: "todo",
            action: "important",
            type: "task",
            id: task.id,
            is_important: isImportant,
          },
        }),
      );
      document.dispatchEvent(
        new CustomEvent("task-changed", {
          detail: { action: "update", task: updated },
        }),
      );
      this.updateComponents();
    } catch (err) {
      Toast.error(err.message || 'Không thể cập nhật quan trọng');
      this.fetchTasks();
    }
  },

  async reorderTasks(sourceId, targetId) {
    const srcIdx = this.tasks.findIndex((t) => t.id === sourceId);
    const trgIdx = this.tasks.findIndex((t) => t.id === targetId);
    if (srcIdx !== -1 && trgIdx !== -1) {
      const [moved] = this.tasks.splice(srcIdx, 1);
      this.tasks.splice(trgIdx, 0, moved);

      this.tasks.forEach((t, idx) => {
        t.position = idx;
      });
      this.updateComponents();

      try {
        const items = this.tasks.map((t, idx) => ({ id: t.id, position: idx }));
        await api.put("/tasks/reorder", { items });
      } catch (_) {}
    }
  },

  setupShortcuts() {
    this.keyHandler = (e) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) ||
        e.target.isContentEditable
      ) {
        return;
      }

      if (e.key === "Escape" && this.activeTask) {
        this.closeDetail();
      }
    };

    document.addEventListener("keydown", this.keyHandler);
  },

  destroy() {
    this.sidebarToggleCleanup?.();
    this.sidebarToggleCleanup = null;
    this.savedFilters = this.taskListComponent?.getFilterState();
    this.requestGeneration = (this.requestGeneration || 0) + 1;
    if (this.keyHandler) {
      document.removeEventListener("keydown", this.keyHandler);
    }
    if (this.dataChangedListener) {
      window.removeEventListener(
        "planify:data-changed",
        this.dataChangedListener,
      );
      document.removeEventListener("task-changed", this.dataChangedListener);
      this.dataChangedListener = null;
    }
    if (this.tabSyncUnsubscribe) {
      this.tabSyncUnsubscribe();
      this.tabSyncUnsubscribe = null;
    }
    if (this.sidebarComponent?.destroy) {
      this.sidebarComponent.destroy();
    }
    try { this.taskDetailComponent?.destroy?.(); } catch {}
    if (this.container) {
      this.container.innerHTML = "";
      this.container = null;
    }
  },
};
