import { createElement } from '../utils/dom.js';
import { api } from '../api.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { store } from '../store.js';
import { revisionOptions } from '../utils/revision.js';

const LIST_ICONS = ['📝', '🛒', '💼', '🏠', '📚', '🎯', '💡', '🎨', '✈️', '🏋️', '🚀', '❤️'];
const LIST_COLORS = ['#4F46E5', '#10B981', '#EF4444', '#F59E0B', '#8B5CF6', '#06B6D4', '#EC4899', '#64748B'];

export class SmartListsSidebar {
  constructor({ container, activeListId = 'board', tasks = [], onSelectList = null, onListsChanged = null }) {
    this.container = container;
    this.activeListId = activeListId;
    this.tasks = tasks;
    this.onSelectList = onSelectList;
    this.onListsChanged = onListsChanged;
    this.taskLists = [];
    this.listsLoaded = false;
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

    // 1. BẢNG QUẢN LÝ CHUNG (Kanban 4 cột: Cần làm, Hôm nay, Quá hạn, Hoàn thành)
    const boardHeader = createElement('div', {
      className: 'todo-sidebar-section-title',
      textContent: 'KHÔNG GIAN CHUNG'
    });

    const isBoardActive = String(this.activeListId) === 'board';
    const boardItem = createElement('div', {
      className: `todo-list-item ${isBoardActive ? 'active' : ''}`,
      onclick: () => {
        this.activeListId = 'board';
        this.render();
        if (this.onSelectList) this.onSelectList('board', 'Bảng quản lý chung', '📋', null);
      }
    }, [
      createElement('span', { style: { fontSize: '18px' }, textContent: '📋' }),
      createElement('div', { className: 'flex-1 flex flex-col overflow-hidden' }, [
        createElement('span', { className: 'truncate', style: { fontWeight: '700' }, textContent: 'Bảng quản lý chung' }),
        createElement('span', { style: { fontSize: '10.5px', opacity: '0.78' }, textContent: 'Kanban 4 cột tự động theo giờ' })
      ]),
      allPendingCount > 0 ? createElement('span', { className: 'todo-list-badge', textContent: String(allPendingCount) }) : null
    ]);

    const boardGroup = createElement('div', { className: 'todo-lists-group' }, [boardItem]);

    // Divider
    const divider = createElement('div', { className: 'todo-divider' });

    // 2. DANH SÁCH CỦA TÔI (Hiển thị theo dạng Danh sách chuẩn, sắp xếp theo thời gian)
    const customHeader = createElement('div', {
      className: 'todo-sidebar-section-title',
      textContent: 'DANH SÁCH CỦA TÔI'
    });

    const customSection = createElement('div', {
      className: 'todo-lists-group flex-1 overflow-y-auto',
      style: { paddingBottom: '12px' }
    });

    this.taskLists.forEach(l => {
      const isActive = String(this.activeListId) === String(l.id);
      const count = this.tasks.filter(t => !t.is_completed && t.list_id === l.id).length;

      const el = createElement('div', {
        className: `todo-list-item ${isActive ? 'active' : ''}`,
        onclick: (e) => {
          if (e.target.closest('.list-action-btn')) return;
          this.activeListId = l.id;
          this.render();
          if (this.onSelectList) this.onSelectList(l.id, l.name, l.icon || '📝', l);
        },
        ondragover: (e) => {
          e.preventDefault();
          el.classList.add('drop-target-active');
        },
        ondragleave: () => {
          el.classList.remove('drop-target-active');
        },
        ondrop: async (e) => {
          e.preventDefault();
          el.classList.remove('drop-target-active');
          const taskId = parseInt(e.dataTransfer.getData('text/plain'), 10);
          if (!taskId) return;
          try {
            const task = this.tasks.find(item => item.id === taskId);
            await api.put(`/tasks/${taskId}`, { list_id: l.id }, revisionOptions(task));
            Toast.success(`Đã chuyển vào danh sách "${l.name}"!`);
            window.dispatchEvent(new CustomEvent('planify:data-changed'));
            if (this.onListsChanged) this.onListsChanged();
          } catch (err) {
            Toast.error(err.message || 'Không thể chuyển công việc.');
            if (this.onListsChanged) this.onListsChanged();
          }
        }
      }, [
        createElement('span', { style: { fontSize: '16px' }, textContent: l.icon || '📝' }),
        createElement('span', {
          className: 'todo-list-color-dot',
          style: { backgroundColor: l.color || '#4F46E5' }
        }),
        createElement('span', { className: 'flex-1 truncate', textContent: l.name }),
        count > 0 ? createElement('span', { className: 'todo-list-badge', textContent: String(count) }) : null,
        createElement('button', {
          className: 'list-action-btn btn-icon',
          style: { width: '24px', height: '24px', fontSize: '13px', opacity: 0.75 },
          title: 'Chỉnh sửa hoặc xóa danh sách',
          textContent: '⋮',
          onclick: (e) => {
            e.stopPropagation();
            this.showListOptionsModal(l);
          }
        })
      ]);

      customSection.appendChild(el);
    });
    if (this.taskLists.length === 0) customSection.appendChild(createElement('p', {
      style: { padding: '8px', fontSize: '12px', color: 'var(--color-text-muted)' },
      textContent: 'Chưa có danh sách cá nhân.'
    }));

    // 3. Add list button
    const addListBtn = createElement('button', {
      className: 'btn btn-primary',
      style: { marginTop: '12px', width: '100%', padding: '10px 14px', fontWeight: '700' },
      textContent: '＋ Tạo danh sách mới',
      onclick: () => this.showCreateListModal()
    });

    sidebar.appendChild(boardHeader);
    sidebar.appendChild(boardGroup);
    sidebar.appendChild(divider);
    sidebar.appendChild(customHeader);
    sidebar.appendChild(customSection);
    sidebar.appendChild(addListBtn);

    this.container.appendChild(sidebar);
  }

  buildListFormContent({ initialName = '', initialIcon = '📝', initialColor = '#4F46E5', inputId = 'new-list-name-input' } = {}) {
    let selectedIcon = initialIcon;
    let selectedColor = initialColor;

    const previewIconBox = createElement('div', {
      className: 'list-preview-icon',
      style: { backgroundColor: selectedColor },
      textContent: selectedIcon
    });
    const previewNameText = createElement('div', {
      style: { fontWeight: '700', fontSize: '15px', color: 'var(--color-text-primary)' },
      textContent: initialName || 'Tên danh sách mới...'
    });
    const previewSubText = createElement('div', {
      style: { fontSize: '11px', color: 'var(--color-text-secondary)' },
      textContent: `Đang chọn: Biểu tượng ${selectedIcon} • Màu ${selectedColor.toUpperCase()}`
    });

    const previewBanner = createElement('div', {
      className: 'list-preview-banner',
      style: { borderColor: selectedColor }
    }, [
      previewIconBox,
      createElement('div', { className: 'flex flex-col gap-2xs overflow-hidden' }, [
        previewNameText,
        previewSubText
      ])
    ]);

    const updatePreview = () => {
      previewIconBox.textContent = selectedIcon;
      previewIconBox.style.backgroundColor = selectedColor;
      previewBanner.style.borderColor = selectedColor;
      const curName = nameInput.value.trim();
      previewNameText.textContent = curName || 'Tên danh sách mới...';
      previewSubText.textContent = `Đang chọn: Biểu tượng ${selectedIcon} • Màu ${selectedColor.toUpperCase()}`;
    };

    const nameInput = createElement('input', {
      type: 'text',
      id: inputId,
      className: 'input',
      placeholder: 'Ví dụ: Việc công ty, Mua sắm, Học tập...',
      value: initialName,
      oninput: () => updatePreview()
    });

    const iconGrid = createElement('div', { className: 'list-icon-grid' });
    const renderIcons = () => {
      iconGrid.innerHTML = '';
      LIST_ICONS.forEach(ic => {
        const isSel = ic === selectedIcon;
        const btn = createElement('button', {
          type: 'button',
          className: `list-icon-option ${isSel ? 'selected' : ''}`,
          style: isSel ? {
            borderColor: selectedColor,
            boxShadow: `0 0 0 3px ${selectedColor}40`
          } : {},
          onclick: () => {
            selectedIcon = ic;
            renderIcons();
            updatePreview();
          }
        }, [
          createElement('span', { textContent: ic }),
          isSel ? createElement('span', {
            className: 'list-icon-check',
            style: { backgroundColor: selectedColor },
            textContent: '✓'
          }) : null
        ]);
        iconGrid.appendChild(btn);
      });
    };

    const colorGrid = createElement('div', { className: 'list-color-grid' });
    const nativeColorInput = createElement('input', {
      type: 'color',
      className: 'custom-color-input-native',
      value: selectedColor,
      title: 'Bấm để mở bảng pha màu tùy chỉnh'
    });
    const hexInput = createElement('input', {
      type: 'text',
      className: 'input',
      value: selectedColor.toUpperCase(),
      style: { width: '110px', fontSize: '12px', fontWeight: '700', padding: '6px 10px', textTransform: 'uppercase' },
      placeholder: '#4F46E5'
    });

    const renderColors = () => {
      colorGrid.innerHTML = '';
      LIST_COLORS.forEach(c => {
        const isSel = c.toLowerCase() === selectedColor.toLowerCase();
        const swatch = createElement('button', {
          type: 'button',
          className: `list-color-swatch ${isSel ? 'selected' : ''}`,
          style: { backgroundColor: c },
          title: `Chọn màu ${c}`,
          textContent: isSel ? '✓' : '',
          onclick: () => {
            selectedColor = c;
            nativeColorInput.value = c;
            hexInput.value = c.toUpperCase();
            renderColors();
            renderIcons();
            updatePreview();
          }
        });
        colorGrid.appendChild(swatch);
      });
    };

    nativeColorInput.addEventListener('input', (e) => {
      selectedColor = e.target.value;
      hexInput.value = selectedColor.toUpperCase();
      renderColors();
      renderIcons();
      updatePreview();
    });

    hexInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        selectedColor = val;
        nativeColorInput.value = val;
        renderColors();
        renderIcons();
        updatePreview();
      }
    });

    renderIcons();
    renderColors();

    const customColorRow = createElement('div', { className: 'custom-color-picker-row' }, [
      nativeColorInput,
      createElement('div', { className: 'flex-1 flex flex-col' }, [
        createElement('span', { style: { fontSize: '12px', fontWeight: '700', color: 'var(--color-text-primary)' }, textContent: '🎨 Tự pha màu tùy ý' }),
        createElement('span', { style: { fontSize: '11px', color: 'var(--color-text-secondary)' }, textContent: 'Bấm vào ô màu bên trái hoặc nhập mã màu Hex' })
      ]),
      hexInput
    ]);

    const content = createElement('div', { className: 'flex flex-col gap-md' }, [
      previewBanner,
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: 'Tên danh sách' }),
        nameInput
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: 'Chọn biểu tượng (Icon)' }),
        iconGrid
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'form-label', textContent: 'Chọn màu sắc đại diện' }),
        colorGrid,
        customColorRow
      ])
    ]);

    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const confirmBtn = document.getElementById('modal-confirm-btn');
        if (confirmBtn) confirmBtn.click();
      }
    });

    return {
      content,
      nameInput,
      getValues: () => ({
        name: nameInput.value.trim(),
        icon: selectedIcon,
        color: selectedColor
      })
    };
  }

  showCreateListModal() {
    const formObj = this.buildListFormContent({
      initialName: '',
      initialIcon: '📝',
      initialColor: '#4F46E5',
      inputId: 'new-list-name-input'
    });

    Modal.open({
      title: 'Tạo danh sách mới',
      content: formObj.content,
      guardUnsaved: true,
      confirmText: 'Tạo danh sách',
      width: '480px',
      onConfirm: async () => {
        const { name, icon, color } = formObj.getValues();
        if (!name) {
          Toast.error('Vui lòng nhập tên danh sách');
          return false;
        }

        try {
          const newList = await api.post('/task-lists', { name, icon, color });
          this.taskLists = [...this.taskLists, newList];
          this.listsLoaded = true;
          store.set('taskLists', this.taskLists);
          this.activeListId = newList.id;
          this.render();
          if (this.onSelectList) this.onSelectList(newList.id, newList.name, newList.icon, newList);
          if (this.onListsChanged) this.onListsChanged();
          Toast.success(`Đã tạo danh sách "${name}"`);
          return true;
        } catch (err) {
          Toast.error(err.message || 'Lỗi khi tạo danh sách');
          return false;
        }
      }
    });

    setTimeout(() => formObj.nameInput.focus(), 80);
  }

  showListOptionsModal(list) {
    const content = createElement('div', { className: 'flex flex-col gap-md' }, [
      createElement('button', {
        className: 'btn btn-secondary',
        style: { justifyContent: 'flex-start' },
        textContent: '✏️ Đổi tên, biểu tượng & màu sắc',
        onclick: () => {
          Modal.close();
          this.showEditListModal(list);
        }
      }),
      !list.is_default ? createElement('button', {
        className: 'btn btn-danger',
        style: { justifyContent: 'flex-start' },
        textContent: '🗑️ Xóa danh sách này',
        onclick: async () => {
          const count = (this.tasks || []).filter(task => task.list_id === list.id).length;
          if (confirm(`Xóa danh sách "${list.name}" và ${count} công việc bên trong?`)) {
            try {
              await api.delete(`/task-lists/${list.id}`);
              this.taskLists = this.taskLists.filter(l => l.id !== list.id);
              store.set('taskLists', this.taskLists);
              this.activeListId = 'board';
              this.render();
              if (this.onSelectList) this.onSelectList('board', 'Bảng quản lý chung', '📋', null);
              if (this.onListsChanged) this.onListsChanged();
              Modal.close();
              Toast.success('Đã xóa danh sách');
            } catch (err) {
              Toast.error(err.message || 'Lỗi khi xóa danh sách');
            }
          }
        }
      }) : null
    ]);

    Modal.open({
      title: `Tùy chọn: ${list.name}`,
      content,
      confirmText: 'Đóng'
    });
  }

  showEditListModal(list) {
    const formObj = this.buildListFormContent({
      initialName: list.name || '',
      initialIcon: list.icon || '📝',
      initialColor: list.color || '#4F46E5',
      inputId: 'edit-list-name-input'
    });

    Modal.open({
      title: 'Chỉnh sửa danh sách',
      content: formObj.content,
      guardUnsaved: true,
      confirmText: 'Lưu thay đổi',
      width: '480px',
      onConfirm: async () => {
        const { name, icon, color } = formObj.getValues();
        if (!name) {
          Toast.error('Vui lòng nhập tên danh sách');
          return false;
        }

        try {
          const updated = await api.put(`/task-lists/${list.id}`, { name, icon, color });
          const idx = this.taskLists.findIndex(l => l.id === list.id);
          if (idx !== -1) this.taskLists[idx] = updated;
          store.set('taskLists', this.taskLists);
          this.render();
          if (this.onSelectList && String(this.activeListId) === String(list.id)) {
            this.onSelectList(updated.id, updated.name, updated.icon, updated);
          }
          if (this.onListsChanged) this.onListsChanged();
          Toast.success('Đã cập nhật danh sách');
          return true;
        } catch (err) {
          Toast.error(err.message || 'Lỗi khi cập nhật danh sách');
          return false;
        }
      }
    });

    setTimeout(() => formObj.nameInput.focus(), 80);
  }
}
