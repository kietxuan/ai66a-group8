import { createElement } from '../utils/dom.js';
import { api } from '../api.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { Dropdown } from '../components/dropdown.js';
import { store } from '../store.js';
import { revisionOptions } from '../utils/revision.js';

export const HOUSE_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sidebar-item-icon"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
export const INFINITY_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sidebar-item-icon"><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z"/></svg>`;
export const FOLDER_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sidebar-folder-icon"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>`;
export const LIST_3BARS_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sidebar-list-icon"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
export const CHEVRON_DOWN_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
export const CHEVRON_UP_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`;
export const PLUS_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
export const FOLDER_PLUS_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><line x1="12" y1="10" x2="12" y2="16"/><line x1="9" y1="13" x2="15" y2="13"/></svg>`;

// Đồng bộ giữa các tab và trang khác nhau (BroadcastChannel + localStorage storage event)
export class TabSync {
  static channel = null;
  static listeners = new Set();
  static isInitialized = false;

  static init() {
    if (TabSync.isInitialized || typeof window === 'undefined') return;
    TabSync.isInitialized = true;

    if ('BroadcastChannel' in window) {
      try {
        TabSync.channel = new BroadcastChannel('planify_tab_sync');
        TabSync.channel.onmessage = (event) => {
          if (event.data?.type) {
            TabSync.listeners.forEach(fn => {
              try { fn(event.data); } catch (_) {}
            });
          }
        };
      } catch (_) {}
    }

    window.addEventListener('storage', (e) => {
      if (e.key === 'planify_sync_event' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data?.type) {
            TabSync.listeners.forEach(fn => {
              try { fn(data); } catch (_) {}
            });
          }
        } catch (_) {}
      }
    });
  }

  static subscribe(fn) {
    TabSync.init();
    TabSync.listeners.add(fn);
    return () => TabSync.listeners.delete(fn);
  }

  static broadcast(type, payload = {}) {
    TabSync.init();
    const msg = { type, payload, timestamp: Date.now() };
    if (TabSync.channel) {
      try { TabSync.channel.postMessage(msg); } catch (_) {}
    }
    try {
      localStorage.setItem('planify_sync_event', JSON.stringify(msg));
    } catch (_) {}
  }
}

export class SmartListsSidebar {
  static draggedListId = null;
  static draggedFolderId = null;

  constructor({ container, activeListId = 'board', tasks = [], onSelectList = null, onListsChanged = null }) {
    this.container = container;
    this.activeListId = activeListId;
    this.tasks = tasks;
    this.onSelectList = onSelectList;
    this.onListsChanged = onListsChanged;
    this.taskLists = [];
    this.listsLoaded = false;
    this.folders = this.loadFolders();

    // Lắng nghe đồng bộ từ các tab/trang khác
    this.unsubscribeSync = TabSync.subscribe(async (msg) => {
      if (msg.type === 'folders_updated') {
        this.folders = this.loadFolders();
        this.render();
      } else if (msg.type === 'lists_updated') {
        this.folders = this.loadFolders();
        try {
          await this.fetchLists();
          this.render();
        } catch (_) {}
      }
    });
  }

  destroy() {
    if (this.unsubscribeSync) this.unsubscribeSync();
  }

  loadFolders() {
    const userId = store.get('user')?.id || 'default';
    const key = `planify_todo_folders_${userId}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  saveFolders() {
    const userId = store.get('user')?.id || 'default';
    const key = `planify_todo_folders_${userId}`;
    try {
      localStorage.setItem(key, JSON.stringify(this.folders));
    } catch (_) {}
    TabSync.broadcast('folders_updated');
  }

  update({ activeListId, tasks }) {
    if (activeListId !== undefined) this.activeListId = activeListId;
    if (tasks !== undefined) this.tasks = tasks;
    this.render();
  }

  async fetchLists() {
    const lists = await api.get('/task-lists');
    if (!Array.isArray(lists)) throw new Error('Dữ liệu danh sách không hợp lệ.');
    this.taskLists = lists;
    this.listsLoaded = true;
    store.set('taskLists', lists);
  }

  resolveListIcon(l) {
    if (!l) return LIST_3BARS_SVG;
    const isTasks = l.is_default || (l.name && l.name.toLowerCase() === 'tasks');
    if (isTasks) return INFINITY_SVG;
    if (l.icon && l.icon !== '☰') {
      return l.icon;
    }
    return LIST_3BARS_SVG;
  }

  createIconSpan(icon, className = '') {
    const span = createElement('span', {
      className: `sidebar-icon-wrap ${className}`,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: '0',
        width: '18px',
        height: '18px',
        fontSize: '14px'
      }
    });
    if (typeof icon === 'string' && icon.trim().startsWith('<svg')) {
      span.innerHTML = icon;
    } else {
      span.textContent = icon || '☰';
    }
    return span;
  }

  getDefaultTasksList() {
    let tasksList = this.taskLists.find(l => l.is_default || (l.name && l.name.toLowerCase() === 'tasks'));
    if (!tasksList && this.taskLists.length > 0) {
      tasksList = this.taskLists[0];
    }
    return tasksList;
  }

  async render() {
    const generation = this.renderGeneration = (this.renderGeneration || 0) + 1;
    if (!this.listsLoaded) {
      this.container.replaceChildren(createElement('div', { role: 'status', textContent: 'Đang tải danh sách…' }));
      try {
        await this.fetchLists();
      } catch (err) {
        if (generation !== this.renderGeneration) return;
        this.container.replaceChildren(createElement('div', { role: 'alert' }, [
          createElement('p', { textContent: `Không tải được danh sách: ${err.message || 'Lỗi không xác định.'}` }),
          createElement('button', { type: 'button', className: 'btn btn-primary btn-sm', textContent: 'Thử lại', onclick: () => this.render() })
        ]));
        return;
      }
      if (generation !== this.renderGeneration) return;
    }

    this.container.innerHTML = '';

    const sidebar = createElement('div', { className: 'flex flex-col h-full' });
    const allPendingCount = this.tasks.filter(t => !t.is_completed).length;

    // 1. KHÔNG GIAN CHUNG (All & Tasks)
    const boardHeader = createElement('div', {
      className: 'todo-sidebar-section-title',
      textContent: 'KHÔNG GIAN CHUNG'
    });

    const isBoardActive = String(this.activeListId) === 'board';
    const boardItem = createElement('div', {
      className: `todo-list-item ${isBoardActive ? 'active' : ''}`,
      title: 'Tất cả công việc (Bảng tổng quan)',
      onclick: () => {
        this.activeListId = 'board';
        this.render();
        if (this.onSelectList) this.onSelectList('board', 'All', HOUSE_SVG, null);
      }
    }, [
      this.createIconSpan(HOUSE_SVG),
      createElement('span', { className: 'flex-1 truncate font-semibold', textContent: 'All' }),
      allPendingCount > 0 ? createElement('span', { className: 'todo-list-badge', textContent: String(allPendingCount) }) : null
    ]);

    const tasksList = this.getDefaultTasksList();
    let tasksItem = null;
    if (tasksList) {
      const isTasksActive = String(this.activeListId) === String(tasksList.id);
      const tasksPendingCount = this.tasks.filter(t => !t.is_completed && t.list_id === tasksList.id).length;
      tasksItem = createElement('div', {
        className: `todo-list-item ${isTasksActive ? 'active' : ''}`,
        title: 'Công việc mặc định (Tasks)',
        onclick: () => {
          this.activeListId = tasksList.id;
          this.render();
          if (this.onSelectList) this.onSelectList(tasksList.id, 'Tasks', INFINITY_SVG, tasksList);
        },
        ondragover: (e) => {
          e.preventDefault();
          tasksItem.classList.add('drop-target-active');
        },
        ondragleave: () => {
          tasksItem.classList.remove('drop-target-active');
        },
        ondrop: async (e) => {
          e.preventDefault();
          tasksItem.classList.remove('drop-target-active');
          const taskId = parseInt(e.dataTransfer.getData('text/plain'), 10);
          if (!taskId) return;
          try {
            const task = this.tasks.find(item => item.id === taskId);
            await api.put(`/tasks/${taskId}`, { list_id: tasksList.id }, revisionOptions(task));
            Toast.success('Đã chuyển vào "Tasks"!');
            window.dispatchEvent(new CustomEvent('planify:data-changed'));
            if (this.onListsChanged) this.onListsChanged();
          } catch (err) {
            Toast.error(err.message || 'Không thể chuyển công việc.');
            if (this.onListsChanged) this.onListsChanged();
          }
        }
      }, [
        this.createIconSpan(INFINITY_SVG),
        createElement('span', { className: 'flex-1 truncate font-semibold', textContent: 'Tasks' }),
        tasksPendingCount > 0 ? createElement('span', { className: 'todo-list-badge', textContent: String(tasksPendingCount) }) : null
      ]);
    }

    const boardGroup = createElement('div', { className: 'todo-lists-group' }, [
      boardItem,
      tasksItem
    ].filter(Boolean));

    // Divider
    const divider = createElement('div', { className: 'todo-divider' });

    // 2. DANH SÁCH CỦA TÔI (Gồm các thư mục nhóm & các danh sách riêng)
    const customHeader = createElement('div', { className: 'todo-sidebar-section-header' }, [
      createElement('span', { className: 'todo-sidebar-section-title', textContent: 'DANH SÁCH CỦA TÔI' }),
      createElement('div', { className: 'todo-sidebar-header-actions' }, [
        createElement('button', {
          type: 'button',
          className: 'btn-icon',
          title: 'Tạo thư mục mới (Nhóm danh sách)',
          onclick: () => this.showCreateFolderModal()
        }, [this.createIconSpan(FOLDER_PLUS_SVG)]),
        createElement('button', {
          type: 'button',
          className: 'btn-icon',
          title: 'Tạo danh sách mới',
          onclick: () => this.showCreateListModal(null)
        }, [this.createIconSpan(PLUS_SVG)])
      ])
    ]);

    const customSection = createElement('div', {
      className: 'todo-lists-group flex-1 overflow-y-auto',
      style: { paddingBottom: '16px' }
    });

    // Danh sách các list thuộc danh mục người dùng (bỏ qua list 'Tasks' đã ở không gian chung)
    const userLists = this.taskLists.filter(l => !tasksList || l.id !== tasksList.id);

    // Tập hợp ID danh sách đã thuộc vào thư mục
    const assignedIds = new Set();
    this.folders.forEach(f => {
      (f.listIds || []).forEach(id => assignedIds.add(id));
    });

    // A. Render các thư mục (Folder / Groups)
    this.folders.forEach(folder => {
      const folderEl = createElement('div', { className: 'todo-folder-item' });

      // Drag & drop danh sách vào folder
      const folderHeader = createElement('div', {
        className: 'todo-folder-header',
        onclick: () => {
          folder.collapsed = !folder.collapsed;
          this.saveFolders();
          this.render();
        },
        ondragover: (e) => {
          e.preventDefault();
          folderHeader.classList.add('drop-target-active');
        },
        ondragleave: () => {
          folderHeader.classList.remove('drop-target-active');
        },
        ondrop: (e) => {
          e.preventDefault();
          folderHeader.classList.remove('drop-target-active');
          const listIdStr = e.dataTransfer.getData('text/planify-list-id');
          if (listIdStr) {
            const listId = parseInt(listIdStr, 10);
            this.moveListToFolder(listId, folder.id);
          }
        }
      }, [
        this.createIconSpan(FOLDER_SVG),
        createElement('span', { className: 'todo-folder-title', textContent: folder.name }),
        createElement('div', { className: 'todo-folder-actions' }, [
          createElement('button', {
            type: 'button',
            className: 'btn-icon',
            title: `Thêm danh sách vào "${folder.name}"`,
            onclick: (e) => {
              e.stopPropagation();
              this.showCreateListModal(folder.id);
            }
          }, [this.createIconSpan(PLUS_SVG)]),
          createElement('button', {
            type: 'button',
            className: 'btn-icon',
            title: 'Tùy chọn thư mục',
            onclick: (e) => {
              e.stopPropagation();
              this.showFolderDropdown(e, folder);
            }
          }, [createElement('span', { textContent: '⋮' })])
        ]),
        this.createIconSpan(folder.collapsed ? CHEVRON_DOWN_SVG : CHEVRON_UP_SVG, 'folder-chevron')
      ]);

      folderEl.appendChild(folderHeader);

      if (!folder.collapsed) {
        const childrenEl = createElement('div', { className: 'todo-folder-children' });
        const inFolderLists = userLists.filter(l => (folder.listIds || []).includes(l.id));

        if (inFolderLists.length === 0) {
          const emptyPlaceholder = createElement('div', {
            className: 'todo-folder-empty-placeholder',
            title: 'Bấm + hoặc kéo thả danh sách vào đây',
            ondragover: (e) => {
              e.preventDefault();
              emptyPlaceholder.style.backgroundColor = 'var(--color-bg-hover)';
            },
            ondragleave: () => {
              emptyPlaceholder.style.backgroundColor = 'transparent';
            },
            ondrop: (e) => {
              e.preventDefault();
              emptyPlaceholder.style.backgroundColor = 'transparent';
              const listIdStr = e.dataTransfer.getData('text/planify-list-id');
              if (listIdStr) {
                const listId = parseInt(listIdStr, 10);
                this.moveListToFolder(listId, folder.id);
              }
            },
            textContent: 'Trống — bấm + để thêm danh sách'
          });
          childrenEl.appendChild(emptyPlaceholder);
        } else {
          inFolderLists.forEach(l => {
            childrenEl.appendChild(this.buildListItemEl(l, folder.id));
          });
        }

        folderEl.appendChild(childrenEl);
      }

      customSection.appendChild(folderEl);
    });
    if (this.taskLists.length === 0) customSection.appendChild(createElement('p', {
      style: { padding: '8px', fontSize: '12px', color: 'var(--color-text-muted)' },
      textContent: 'Chưa có danh sách cá nhân.'
    }));

    // B. Render các danh sách nằm ngoài thư mục (Root lists)
    const rootLists = userLists.filter(l => !assignedIds.has(l.id));
    rootLists.forEach(l => {
      customSection.appendChild(this.buildListItemEl(l, null));
    });

    if (this.folders.length === 0 && rootLists.length === 0) {
      customSection.appendChild(
        createElement('div', {
          style: { padding: '24px 12px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-tertiary)' },
          textContent: 'Chưa có danh sách riêng nào.\nBấm 📁 hoặc ＋ ở trên để tạo mới!'
        })
      );
    }

    sidebar.appendChild(boardHeader);
    sidebar.appendChild(boardGroup);
    sidebar.appendChild(divider);
    sidebar.appendChild(customHeader);
    sidebar.appendChild(customSection);

    this.container.appendChild(sidebar);
  }

  buildListItemEl(l, currentFolderId = null) {
    const isActive = String(this.activeListId) === String(l.id);
    const count = this.tasks.filter(t => !t.is_completed && t.list_id === l.id).length;

    const el = createElement('div', {
      className: `todo-list-item ${isActive ? 'active' : ''}`,
      draggable: true,
      ondragstart: (e) => {
        e.dataTransfer.setData('text/planify-list-id', String(l.id));
        e.dataTransfer.effectAllowed = 'move';
        SmartListsSidebar.draggedListId = l.id;
        SmartListsSidebar.draggedFolderId = currentFolderId;
        el.classList.add('is-dragging');
      },
      ondragend: () => {
        el.classList.remove('is-dragging');
        SmartListsSidebar.draggedListId = null;
        SmartListsSidebar.draggedFolderId = null;
        document.querySelectorAll('.drop-indicator-top, .drop-indicator-bottom, .drop-target-active').forEach(node => {
          node.classList.remove('drop-indicator-top', 'drop-indicator-bottom', 'drop-target-active');
        });
      },
      onclick: (e) => {
        if (e.target.closest('.list-action-btn') || e.target.closest('.dropdown-menu')) return;
        this.activeListId = l.id;
        this.render();
        const listIcon = this.resolveListIcon(l);
        if (this.onSelectList) this.onSelectList(l.id, l.name, listIcon, l);
      },
      ondragover: (e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('text/planify-list-id')) {
          if (SmartListsSidebar.draggedListId === l.id) return;
          const rect = el.getBoundingClientRect();
          const isTop = e.clientY < rect.top + rect.height / 2;
          el.classList.toggle('drop-indicator-top', isTop);
          el.classList.toggle('drop-indicator-bottom', !isTop);
        } else {
          el.classList.add('drop-target-active');
        }
      },
      ondragleave: () => {
        el.classList.remove('drop-indicator-top', 'drop-indicator-bottom', 'drop-target-active');
      },
      ondrop: async (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('drop-indicator-top', 'drop-indicator-bottom', 'drop-target-active');

        const listIdStr = e.dataTransfer.getData('text/planify-list-id');
        if (listIdStr) {
          const draggedId = parseInt(listIdStr, 10);
          if (draggedId === l.id) return;
          const rect = el.getBoundingClientRect();
          const isTop = e.clientY < rect.top + rect.height / 2;
          await this.reorderListRelative(draggedId, l.id, isTop, currentFolderId);
          return;
        }

        // Kéo thả task vào danh sách
        const taskId = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (!taskId) return;
        try {
          await api.put(`/tasks/${taskId}`, { list_id: l.id });
          Toast.success(`Đã chuyển vào danh sách "${l.name}"!`);
          window.dispatchEvent(new CustomEvent('planify:data-changed'));
          if (this.onListsChanged) this.onListsChanged();
        } catch (_) {}
      }
    }, [
      this.createIconSpan(this.resolveListIcon(l)),
      createElement('span', { className: 'flex-1 truncate', textContent: l.name }),
      count > 0 ? createElement('span', { className: 'todo-list-badge', textContent: String(count) }) : null,
      createElement('button', {
        type: 'button',
        className: 'list-action-btn btn-icon',
        title: 'Tùy chọn danh sách',
        textContent: '⋮',
        onclick: (e) => {
          e.stopPropagation();
          this.showListDropdown(e, l, currentFolderId);
        }
      })
    ]);

    return el;
  }

  async reorderListRelative(draggedId, targetId, insertBefore, targetFolderId) {
    if (!draggedId || !targetId || draggedId === targetId) return;

    // 1. Cập nhật vị trí trong thư mục
    this.folders.forEach(f => {
      f.listIds = (f.listIds || []).filter(id => id !== draggedId);
    });

    if (targetFolderId) {
      const folder = this.folders.find(f => f.id === targetFolderId);
      if (folder) {
        if (!folder.listIds) folder.listIds = [];
        folder.listIds = folder.listIds.filter(id => id !== draggedId);
        const targetIdx = folder.listIds.indexOf(targetId);
        if (targetIdx !== -1) {
          const insertIdx = insertBefore ? targetIdx : targetIdx + 1;
          folder.listIds.splice(insertIdx, 0, draggedId);
        } else {
          folder.listIds.push(draggedId);
        }
        folder.collapsed = false;
      }
    }
    this.saveFolders();

    // 2. Cập nhật thứ tự toàn cục trong this.taskLists
    const draggedList = this.taskLists.find(l => l.id === draggedId);
    if (draggedList) {
      this.taskLists = this.taskLists.filter(l => l.id !== draggedId);
      const targetIdx = this.taskLists.findIndex(l => l.id === targetId);
      if (targetIdx !== -1) {
        const insertIdx = insertBefore ? targetIdx : targetIdx + 1;
        this.taskLists.splice(insertIdx, 0, draggedList);
      } else {
        this.taskLists.push(draggedList);
      }

      this.taskLists.forEach((l, idx) => {
        l.position = idx;
      });
      store.set('taskLists', this.taskLists);

      try {
        const items = this.taskLists.map(l => ({ id: l.id, position: l.position }));
        await api.put('/task-lists/reorder', { items });
        TabSync.broadcast('lists_updated');
      } catch (err) {
        console.error('Failed to sync list order with server', err);
      }
    }

    this.render();
    if (this.onListsChanged) this.onListsChanged();
    Toast.success('Đã sắp xếp vị trí danh sách!');
  }

  async moveListToFolder(listId, targetFolderId) {
    this.folders.forEach(f => {
      f.listIds = (f.listIds || []).filter(id => id !== listId);
    });

    if (targetFolderId) {
      const targetFolder = this.folders.find(f => f.id === targetFolderId);
      if (targetFolder) {
        if (!targetFolder.listIds) targetFolder.listIds = [];
        targetFolder.listIds.push(listId);
        targetFolder.collapsed = false;
      }
    }

    this.saveFolders();
    this.render();
    if (this.onListsChanged) this.onListsChanged();
    Toast.success('Đã di chuyển danh sách!');
  }

  showFolderDropdown(e, folder) {
    const items = [
      {
        label: '✏️ Đổi tên thư mục',
        onClick: () => this.showRenameFolderModal(folder)
      },
      {
        label: '🗑️ Xóa thư mục',
        danger: true,
        onClick: () => {
          if (confirm(`Bạn có chắc muốn xóa thư mục "${folder.name}"? Các danh sách bên trong vẫn được giữ lại.`)) {
            this.folders = this.folders.filter(f => f.id !== folder.id);
            this.saveFolders();
            this.render();
            Toast.success('Đã xóa thư mục');
          }
        }
      }
    ];

    Dropdown.show({
      triggerEl: e.currentTarget,
      anchorEl: e.currentTarget,
      items
    });
  }

  showListDropdown(e, list, currentFolderId = null) {
    const moveSubmenuItems = [];

    if (currentFolderId) {
      moveSubmenuItems.push({
        label: '↩️ Ra ngoài thư mục (Gốc)',
        onClick: () => this.moveListToFolder(list.id, null)
      });
    }

    if (this.folders.length > 0) {
      this.folders.forEach(f => {
        const isCurrent = f.id === currentFolderId;
        moveSubmenuItems.push({
          label: isCurrent ? `✓ ${f.name} (Hiện tại)` : `📁 ${f.name}`,
          disabled: isCurrent,
          onClick: () => {
            if (!isCurrent) {
              this.moveListToFolder(list.id, f.id);
            }
          }
        });
      });
    }

    if (moveSubmenuItems.length === 0) {
      moveSubmenuItems.push({
        label: '(Chưa có thư mục nào)',
        disabled: true
      });
    }

    const items = [
      {
        label: '✏️ Đổi tên danh sách',
        onClick: () => this.showEditListModal(list, currentFolderId)
      },
      {
        label: 'Di chuyển',
        icon: '📁',
        submenu: moveSubmenuItems
      }
    ];

    if (!list.is_default) {
      items.push({
        label: '🗑️ Xóa danh sách',
        danger: true,
        onClick: async () => {
          if (confirm(`Bạn có chắc muốn xóa danh sách "${list.name}"? Các công việc bên trong sẽ bị xóa.`)) {
            try {
              await api.delete(`/task-lists/${list.id}`);
              this.taskLists = this.taskLists.filter(l => l.id !== list.id);
              store.set('taskLists', this.taskLists);
              this.folders.forEach(f => {
                f.listIds = (f.listIds || []).filter(id => id !== list.id);
              });
              this.saveFolders();
              if (String(this.activeListId) === String(list.id)) {
                this.activeListId = 'board';
                if (this.onSelectList) this.onSelectList('board', 'All', HOUSE_SVG, null);
              }
              this.render();
              TabSync.broadcast('lists_updated');
              window.dispatchEvent(new CustomEvent('planify:data-changed'));
              if (this.onListsChanged) this.onListsChanged();
              Toast.success('Đã xóa danh sách');
            } catch (err) {
              Toast.error(err.message || 'Lỗi khi xóa danh sách');
            }
          }
        }
      });
    }

    Dropdown.show({
      triggerEl: e.currentTarget,
      anchorEl: e.currentTarget,
      items
    });
  }

  showCreateFolderModal() {
    const nameInput = createElement('input', {
      type: 'text',
      className: 'input',
      placeholder: 'Ví dụ: Class, Project, Công việc...',
      id: 'new-folder-name-input'
    });

    const content = createElement('div', { className: 'flex flex-col gap-sm' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: 'Tên thư mục' }),
        nameInput
      ])
    ]);

    Modal.open({
      title: 'Tạo thư mục mới (Nhóm danh sách)',
      content,
      confirmText: 'Tạo thư mục',
      width: '400px',
      onConfirm: () => {
        const name = nameInput.value.trim();
        if (!name) {
          Toast.error('Vui lòng nhập tên thư mục');
          return false;
        }

        const newFolder = {
          id: `folder_${Date.now()}`,
          name,
          collapsed: false,
          listIds: []
        };

        this.folders.push(newFolder);
        this.saveFolders();
        this.render();
        Toast.success(`Đã tạo thư mục "${name}"!`);
        return true;
      }
    });

    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const confirmBtn = document.getElementById('modal-confirm-btn');
        if (confirmBtn) confirmBtn.click();
      }
    });

    setTimeout(() => nameInput.focus(), 80);
  }

  showRenameFolderModal(folder) {
    const nameInput = createElement('input', {
      type: 'text',
      className: 'input',
      value: folder.name,
      id: 'rename-folder-name-input'
    });

    const content = createElement('div', { className: 'flex flex-col gap-sm' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: 'Tên thư mục mới' }),
        nameInput
      ])
    ]);

    Modal.open({
      title: 'Đổi tên thư mục',
      content,
      confirmText: 'Lưu thay đổi',
      width: '400px',
      onConfirm: () => {
        const name = nameInput.value.trim();
        if (!name) {
          Toast.error('Vui lòng nhập tên thư mục');
          return false;
        }

        folder.name = name;
        this.saveFolders();
        this.render();
        Toast.success('Đã cập nhật tên thư mục');
        return true;
      }
    });

    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const confirmBtn = document.getElementById('modal-confirm-btn');
        if (confirmBtn) confirmBtn.click();
      }
    });

    setTimeout(() => {
      nameInput.focus();
      nameInput.select();
    }, 80);
  }

  showCreateListModal(targetFolderId = null) {
    const nameInput = createElement('input', {
      type: 'text',
      className: 'input',
      placeholder: 'Ví dụ: Trực quan hóa dữ liệu, Kỹ nghệ phần mềm...',
      id: 'new-list-name-input'
    });

    // Dropdown chọn thư mục
    const folderSelect = createElement('select', { className: 'input' }, [
      createElement('option', { value: '', textContent: '— Không thuộc thư mục (Gốc) —' }),
      ...this.folders.map(f => createElement('option', {
        value: f.id,
        textContent: `📁 ${f.name}`,
        selected: f.id === targetFolderId
      }))
    ]);

    const content = createElement('div', { className: 'flex flex-col gap-md' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: 'Tên danh sách' }),
        nameInput
      ]),
      this.folders.length > 0 ? createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: 'Thư mục chứa' }),
        folderSelect
      ]) : null
    ]);

    Modal.open({
      title: targetFolderId ? 'Tạo danh sách mới trong thư mục' : 'Tạo danh sách mới',
      content,
      confirmText: 'Tạo danh sách',
      width: '420px',
      onConfirm: async () => {
        const name = nameInput.value.trim();
        if (!name) {
          Toast.error('Vui lòng nhập tên danh sách');
          return false;
        }

        try {
          const newList = await api.post('/task-lists', {
            name,
            icon: '☰',
            color: '#4F46E5'
          });

          const chosenFolderId = folderSelect?.value || targetFolderId;
          if (chosenFolderId) {
            const f = this.folders.find(x => x.id === chosenFolderId);
            if (f) {
              if (!f.listIds) f.listIds = [];
              f.listIds.push(newList.id);
              f.collapsed = false;
              this.saveFolders();
            }
          }

          await this.fetchLists();
          this.activeListId = newList.id;
          this.render();
          TabSync.broadcast('lists_updated');
          window.dispatchEvent(new CustomEvent('planify:data-changed'));
          if (this.onSelectList) this.onSelectList(newList.id, newList.name, this.resolveListIcon(newList), newList);
          if (this.onListsChanged) this.onListsChanged();
          Toast.success(`Đã tạo danh sách "${name}"`);
          return true;
        } catch (err) {
          Toast.error(err.message || 'Lỗi khi tạo danh sách');
          return false;
        }
      }
    });

    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const confirmBtn = document.getElementById('modal-confirm-btn');
        if (confirmBtn) confirmBtn.click();
      }
    });

    setTimeout(() => nameInput.focus(), 80);
  }

  showEditListModal(list, currentFolderId = null) {
    const nameInput = createElement('input', {
      type: 'text',
      className: 'input',
      value: list.name,
      id: 'edit-list-name-input'
    });

    const folderSelect = createElement('select', { className: 'input' }, [
      createElement('option', { value: '', textContent: '— Không thuộc thư mục (Gốc) —' }),
      ...this.folders.map(f => createElement('option', {
        value: f.id,
        textContent: `📁 ${f.name}`,
        selected: f.id === currentFolderId
      }))
    ]);

    const content = createElement('div', { className: 'flex flex-col gap-md' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: 'Tên danh sách' }),
        nameInput
      ]),
      this.folders.length > 0 ? createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: 'Thư mục chứa' }),
        folderSelect
      ]) : null
    ]);

    Modal.open({
      title: 'Đổi tên danh sách',
      content,
      confirmText: 'Lưu thay đổi',
      width: '420px',
      onConfirm: async () => {
        const name = nameInput.value.trim();
        if (!name) {
          Toast.error('Vui lòng nhập tên danh sách');
          return false;
        }

        try {
          const updated = await api.put(`/task-lists/${list.id}`, { name });
          const idx = this.taskLists.findIndex(l => l.id === list.id);
          if (idx !== -1) this.taskLists[idx] = updated;
          store.set('taskLists', this.taskLists);

          // Cập nhật thư mục
          const newFolderId = folderSelect?.value || null;
          if (newFolderId !== currentFolderId) {
            this.moveListToFolder(list.id, newFolderId);
          } else {
            this.render();
          }

          if (this.onSelectList && String(this.activeListId) === String(list.id)) {
            this.onSelectList(updated.id, updated.name, this.resolveListIcon(updated), updated);
          }
          TabSync.broadcast('lists_updated');
          window.dispatchEvent(new CustomEvent('planify:data-changed'));
          if (this.onListsChanged) this.onListsChanged();
          Toast.success('Đã cập nhật danh sách');
          return true;
        } catch (err) {
          Toast.error(err.message || 'Lỗi khi cập nhật danh sách');
          return false;
        }
      }
    });

    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const confirmBtn = document.getElementById('modal-confirm-btn');
        if (confirmBtn) confirmBtn.click();
      }
    });

    setTimeout(() => {
      nameInput.focus();
      nameInput.select();
    }, 80);
  }
}
