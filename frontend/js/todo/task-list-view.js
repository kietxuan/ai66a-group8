import { businessNow } from '../utils/date.js';
import { createElement } from '../utils/dom.js';
import { TaskItem } from './task-item.js';
import { formatDate } from '../utils/date.js';
import { store } from '../store.js';
import { api } from '../api.js';
import { isScheduleDismissal } from '../utils/api-error.js';
import { Toast } from '../components/toast.js';
import { EventForm } from '../calendar/event-form.js';
import { revisionOptions } from '../utils/revision.js';

export class TaskListView {
  constructor({
    container,
    tasks = [],
    activeListId = "board",
    activeTaskId = null,
    sortBy = "time",
    onlyImportant = false,
    statusFilter = 'all', dateFilter = 'all', dateFrom = '', dateTo = '',
    searchQuery = "",
    onSelectTask = null,
    onToggleComplete = null,
    onToggleImportant = null,
    onReorderTasks = null,
    onRefresh = null,
  }) {
    this.container = container;
    this.tasks = tasks;
    this.activeListId = activeListId;
    this.activeTaskId = activeTaskId;
    this.sortBy = sortBy || "time";
    this.onlyImportant = onlyImportant;
    Object.assign(this, { statusFilter, dateFilter, dateFrom, dateTo });
    this.searchQuery = searchQuery;
    this.onSelectTask = onSelectTask;
    this.onToggleComplete = onToggleComplete;
    this.onToggleImportant = onToggleImportant;
    this.onReorderTasks = onReorderTasks;
    this.onRefresh = onRefresh;

    this.isCompletedCollapsed = false;
  }

  setProps(props = {}) {
    Object.entries(props).forEach(([k, v]) => {
      if (v !== undefined) this[k] = v;
    });
    this.render();
  }

  /**
   * Kiểm tra một công việc chưa hoàn thành có bị Quá hạn hay không:
   * - Không có due_date -> Vĩnh viễn (Cột Cần làm), KHÔNG quá hạn.
   * Dùng giờ kết thúc; nếu chỉ có giờ bắt đầu thì cộng duration_minutes,
   * giống backend. Công việc cả ngày hết hạn ở đầu ngày tiếp theo.
   */
  isTaskOverdue(t, todayStr, nowTimeStr) {
    if (t.is_completed) return false;
    if (!t.due_date) return false;
    const dStr = String(t.due_date).slice(0, 10);
    const now = new Date(`${todayStr}T${nowTimeStr.length === 5 ? nowTimeStr + ':00' : nowTimeStr}`);
    let end = new Date(`${dStr}T00:00:00`);
    if (!t.is_all_day && (t.end_time || t.start_time || t.due_time)) {
      const clock = String(t.end_time || t.start_time || t.due_time);
      end = new Date(`${dStr}T${clock.length === 5 ? clock + ':00' : clock}`);
      if (!t.end_time) end = new Date(end.getTime() + (t.duration_minutes || 60) * 60000);
    } else {
      end.setDate(end.getDate() + 1);
    }
    return end <= now;
  }

  /**
   * Sắp xếp mặc định theo thời gian cho tất cả các cột và danh sách
   */
  sortTasks(list, isCompletedCol = false) {
    const sorted = [...list];
    if (this.sortBy === "important") {
      sorted.sort(
        (a, b) => (b.is_important ? 1 : 0) - (a.is_important ? 1 : 0),
      );
      return sorted;
    }
    if (this.sortBy === "title") {
      sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      return sorted;
    }

    // Mặc định: Sắp xếp theo thời gian (time)
    if (isCompletedCol) {
      sorted.sort((a, b) => {
        const ca = a.completed_at || a.updated_at || a.created_at || "";
        const cb = b.completed_at || b.updated_at || b.created_at || "";
        return String(cb).localeCompare(String(ca));
      });
      return sorted;
    }

    sorted.sort((a, b) => {
      const da = a.due_date ? String(a.due_date).slice(0, 10) : "9999-12-31";
      const db = b.due_date ? String(b.due_date).slice(0, 10) : "9999-12-31";
      if (da !== db) return da.localeCompare(db);

      const ta = String(a.start_time || a.due_time || "23:59:59");
      const tb = String(b.start_time || b.due_time || "23:59:59");
      if (ta !== tb) return ta.localeCompare(tb);

      if ((b.is_important ? 1 : 0) !== (a.is_important ? 1 : 0)) {
        return (b.is_important ? 1 : 0) - (a.is_important ? 1 : 0);
      }
      return (b.id || 0) - (a.id || 0);
    });
    return sorted;
  }

  filterTasks() {
    let filtered = [...this.tasks];

    // Nếu không phải Bảng quản lý chung ('board'), lọc theo list_id của Danh sách của tôi
    if (String(this.activeListId) !== "board") {
      const targetListId = parseInt(this.activeListId, 10);
      if (!isNaN(targetListId)) {
        filtered = filtered.filter((t) => t.list_id === targetListId);
      }
    }

    if (this.onlyImportant) {
      filtered = filtered.filter((t) => Boolean(t.is_important));
    }

    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (t) =>
          (t.title || "").toLowerCase().includes(q) ||
          (t.note || "").toLowerCase().includes(q) ||
          (t.location || "").toLowerCase().includes(q),
      );
    }

    if (this.statusFilter === 'open') filtered = filtered.filter(t => !t.is_completed);
    if (this.statusFilter === 'completed') filtered = filtered.filter(t => t.is_completed);
    if (this.dateFilter && this.dateFilter !== 'all') {
      const today = businessNow();
      const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
      const last = new Date(today); last.setDate(today.getDate() + 6);
      const from = this.dateFilter === 'tomorrow' ? formatDate(tomorrow, 'YYYY-MM-DD')
        : this.dateFilter === 'next7' ? formatDate(today, 'YYYY-MM-DD') : this.dateFrom;
      const to = this.dateFilter === 'tomorrow' ? from
        : this.dateFilter === 'next7' ? formatDate(last, 'YYYY-MM-DD') : this.dateTo;
      filtered = filtered.filter(t => {
        const date = t.due_date ? String(t.due_date).slice(0, 10) : '';
        return date && (!from || date >= from) && (!to || date <= to);
      });
    }

    return filtered;
  }

  render() {
    this.container.innerHTML = "";

    // 1. Bảng quản lý chung -> Luôn hiển thị dạng Kanban 4 cột
    if (String(this.activeListId) === "board") {
      this.renderGeneralKanbanBoard();
      return;
    }

    // 2. Danh sách của tôi -> Luôn hiển thị dạng Danh sách chuẩn, sắp xếp theo thời gian
    this.renderCustomListView();
  }

  renderGeneralKanbanBoard() {
    const allFiltered = this.filterTasks();
    const now = businessNow();
    const todayStr = formatDate(now, 'YYYY-MM-DD');
    const nowTimeStr = `${formatDate(now, 'HH:mm')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const listMap = (store.get("taskLists") || []).reduce((acc, l) => {
      acc[l.id] = l.name;
      return acc;
    }, {});

    // Phân loại vào đúng 4 cột theo mô tả của người dùng:
    // 1. Cần làm: Chưa hoàn thành & (Không có thời gian vĩnh viễn HOẶC thời gian trong tương lai > hôm nay)
    // 2. Hôm nay: Chưa hoàn thành & diễn ra trong ngày hôm nay (due_date === todayStr) & chưa quá hạn
    // 3. Quá hạn: Chưa hoàn thành & đã quá thời gian
    // 4. Hoàn thành: Đã tích hoàn thành hoặc Sự kiện tự động hoàn thành sau khi hết thời gian
    const colTodoItems = [];
    const colTodayItems = [];
    const colOverdueItems = [];
    const colCompletedItems = [];

    allFiltered.forEach((t) => {
      if (t.is_completed) {
        colCompletedItems.push(t);
        return;
      }

      const overdue = this.isTaskOverdue(t, todayStr, nowTimeStr);
      if (overdue) {
        colOverdueItems.push(t);
        return;
      }

      const dStr = t.due_date ? String(t.due_date).slice(0, 10) : null;
      if (dStr === todayStr) {
        colTodayItems.push(t);
      } else {
        // Không có thời gian (vĩnh viễn) hoặc trong tương lai (dStr > todayStr)
        colTodoItems.push(t);
      }
    });

    const columns = [
      {
        id: "todo",
        title: "Cần làm",
        subtitle: "Việc vĩnh viễn & tương lai",
        color: "#6366F1",
        items: this.sortTasks(colTodoItems, false),
        onAddQuick: () =>
          EventForm.showFullModal({
            hasDate: false,
            onCreated: this.onRefresh,
          }),
        onDropTask: async (taskId) => {
          const targetTask = this.tasks.find((x) => x.id === taskId);
          const dStr = targetTask?.due_date
            ? String(targetTask.due_date).slice(0, 10)
            : null;
          // Nếu kéo từ Hôm nay / Quá hạn / Hoàn thành sang Cần làm: bỏ hoàn thành, nếu ngày <= hôm nay thì bỏ giới hạn ngày để thành vĩnh viễn
          const clearDate = !dStr || dStr <= todayStr;
          await api.put(`/tasks/${taskId}`, {
            is_completed: false,
            ...(clearDate ? { due_date: null, due_time: null, start_time: null, end_time: null, is_all_day: true } : {})
          }, revisionOptions(targetTask));
        }
      },
      {
        id: "today",
        title: "Hôm nay",
        subtitle: "Công việc trong hôm nay",
        color: "#F59E0B",
        items: this.sortTasks(colTodayItems, false),
        onAddQuick: () =>
          EventForm.showFullModal({
            hasDate: true,
            startAt: businessNow(),
            onCreated: this.onRefresh,
          }),
        onDropTask: async (taskId) => {
          const targetTask = this.tasks.find(x => x.id === taskId);
          await api.put(`/tasks/${taskId}`, {
            is_completed: false,
            due_date: todayStr,
            is_in_my_day: true
          }, revisionOptions(targetTask));
        }
      },
      {
        id: "overdue",
        title: "Quá hạn",
        subtitle: "Chưa xong & đã quá thời gian",
        color: "#EF4444",
        items: this.sortTasks(colOverdueItems, false),
        headerAction: colOverdueItems.length > 0 ? {
          label: '↪ Hôm nay',
          onClick: async () => {
            try {
              await api.post('/tasks/batch', { action: 'reschedule_overdue', due_date: todayStr });
              Toast.success('Đã dời toàn bộ việc quá hạn sang cột Hôm nay!');
              window.dispatchEvent(new CustomEvent('planify:data-changed'));
              if (this.onRefresh) this.onRefresh();
            } catch (err) {
              if (!isScheduleDismissal(err)) Toast.error(err.message || 'Không thể dời công việc quá hạn.');
              if (this.onRefresh) this.onRefresh();
            }
          }
        } : null,
        onDropTask: null
      },
      {
        id: "completed",
        title: "Hoàn thành",
        subtitle: "Công việc đã hoàn thành",
        color: "#10B981",
        items: this.sortTasks(colCompletedItems, true),
        onDropTask: async (taskId) => {
          const targetTask = this.tasks.find(x => x.id === taskId);
          await api.patch(`/tasks/${taskId}/complete`, { is_completed: true }, revisionOptions(targetTask));
        }
      }
    ];

    const board = createElement("div", { className: "todo-kanban-board" });

    columns.forEach((col) => {
      const colEl = createElement("div", {
        className: "kanban-column",
        ondragover: (e) => {
          if (!col.onDropTask) return;
          e.preventDefault();
          colEl.style.borderColor = col.color;
          colEl.style.boxShadow = `0 0 0 2px ${col.color}33`;
        },
        ondragleave: () => {
          colEl.style.borderColor = "";
          colEl.style.boxShadow = "";
        },
        ondrop: async (e) => {
          if (!col.onDropTask) return;
          e.preventDefault();
          colEl.style.borderColor = "";
          colEl.style.boxShadow = "";
          const taskId = parseInt(e.dataTransfer.getData("text/plain"), 10);
          if (!taskId) return;
          try {
            await col.onDropTask(taskId);
            Toast.success(`Đã chuyển sang cột "${col.title}"`);
            window.dispatchEvent(new CustomEvent("planify:data-changed"));
            if (this.onRefresh) this.onRefresh();
          } catch (err) {
            if (!isScheduleDismissal(err)) Toast.error(err.message || 'Không thể chuyển công việc.');
            if (this.onRefresh) this.onRefresh();
          }
        }
      });

      const headerTop = createElement(
        "div",
        {
          className: "kanban-col-header",
          style: {
            borderBottom: `2px solid ${col.color}40`,
            paddingBottom: "8px",
          },
        },
        [
          createElement("div", { className: "flex flex-col" }, [
            createElement("div", { className: "flex items-center gap-xs" }, [
              createElement("span", {
                style: {
                  color: col.color,
                  fontWeight: "800",
                  fontSize: "14px",
                },
                textContent: col.title,
              }),
              createElement("span", {
                className: "todo-list-badge",
                textContent: `${col.items.length}`,
              }),
            ]),
            createElement("span", {
              style: {
                fontSize: "11px",
                color: "var(--color-text-secondary)",
                fontWeight: "500",
              },
              textContent: col.subtitle,
            }),
          ]),
          col.onAddQuick
            ? createElement("button", {
                type: "button",
                className: "btn-icon",
                style: {
                  width: "26px",
                  height: "26px",
                  fontSize: "15px",
                  color: col.color,
                },
                title: `Thêm mới vào cột ${col.title}`,
                textContent: "＋",
                onclick: col.onAddQuick,
              })
            : col.headerAction
              ? createElement("button", {
                  type: "button",
                  className: "btn btn-secondary btn-xs",
                  style: {
                    fontSize: "10.5px",
                    padding: "3px 7px",
                    whiteSpace: "nowrap",
                    flexShrink: "0",
                  },
                  textContent: col.headerAction.label,
                  onclick: col.headerAction.onClick,
                })
              : null,
        ],
      );

      const colBody = createElement("div", { className: "kanban-col-body" });
      if (col.items.length === 0) {
        colBody.appendChild(
          createElement("div", {
            style: {
              padding: "28px 12px",
              textAlign: "center",
              fontSize: "12px",
              color: "var(--color-text-tertiary)",
              border: "1px dashed var(--color-border-light)",
              borderRadius: "10px",
              marginTop: "4px",
            },
            textContent: "Trống — Kéo thả thẻ việc vào đây",
          }),
        );
      } else {
        col.items.forEach((task) => {
          colBody.appendChild(
            TaskItem.create({
              task,
              listName: listMap[task.list_id] || null,
              isActiveDetail: this.activeTaskId === task.id,
              isOverdue: col.id === "overdue",
              onToggleComplete: this.onToggleComplete,
              onToggleImportant: this.onToggleImportant,
              onSelect: this.onSelectTask,
              onUpdated: this.onRefresh,
            }),
          );
        });
      }

      colEl.appendChild(headerTop);
      colEl.appendChild(colBody);
      board.appendChild(colEl);
    });

    this.container.appendChild(board);
  }

  renderCustomListView() {
    const allFiltered = this.filterTasks();
    const now = businessNow();
    const todayStr = formatDate(now, "YYYY-MM-DD");
    const nowTimeStr = formatDate(now, "HH:mm");

    const activeTasks = this.sortTasks(
      allFiltered.filter((t) => !t.is_completed),
      false,
    );
    const completedTasks = this.sortTasks(
      allFiltered.filter((t) => t.is_completed),
      true,
    );

    const wrapper = createElement('div', {
      className: 'todo-list-scroll',
      style: { paddingRight: '4px', paddingBottom: '28px' }
    });

    const createItemEl = (task) =>
      TaskItem.create({
        task,
        listName: null,
        isActiveDetail: this.activeTaskId === task.id,
        isOverdue: this.isTaskOverdue(task, todayStr, nowTimeStr),
        onToggleComplete: this.onToggleComplete,
        onToggleImportant: this.onToggleImportant,
        onSelect: this.onSelectTask,
        onReorder: this.onReorderTasks,
        onUpdated: this.onRefresh,
      });

    if (activeTasks.length === 0 && completedTasks.length === 0) {
      wrapper.appendChild(
        createElement("div", {
          style: {
            padding: "48px 16px",
            textAlign: "center",
            color: "var(--color-text-secondary)",
            background: "var(--color-surface)",
            borderRadius: "14px",
            border: "1px dashed var(--color-border)",
          },
          textContent: "Chưa có công việc nào trong danh sách này!",
        }),
      );
    } else if (activeTasks.length > 0) {
      const activeContainer = createElement("div", {
        className: "flex flex-col gap-sm",
      });
      activeTasks.forEach((task) => {
        activeContainer.appendChild(createItemEl(task));
      });
      wrapper.appendChild(activeContainer);
    }

    // Mục xổ xuống "Đã hoàn thành (X)" ở phía dưới danh sách
    if (completedTasks.length > 0) {
      const completedSection = createElement("div", {
        className: "flex flex-col gap-sm",
        style: {
          marginTop: "14px",
          paddingTop: "12px",
          borderTop: "1px solid var(--color-border-light)",
        },
      });

      const headerBtn = createElement(
        "button",
        {
          type: "button",
          className: "flex items-center gap-xs font-semibold",
          style: {
            background: "var(--color-surface)",
            border: "1px solid var(--color-border-light)",
            borderRadius: "8px",
            color: "var(--color-text-secondary)",
            cursor: "pointer",
            padding: "7px 12px",
            fontSize: "13px",
            width: "fit-content",
          },
          onclick: () => {
            this.isCompletedCollapsed = !this.isCompletedCollapsed;
            this.render();
          },
        },
        [
          createElement("span", {
            textContent: this.isCompletedCollapsed ? "▶" : "▼",
          }),
          createElement("span", {
            textContent: `Đã hoàn thành (${completedTasks.length})`,
          }),
        ],
      );

      completedSection.appendChild(headerBtn);

      if (!this.isCompletedCollapsed) {
        const completedList = createElement("div", {
          className: "flex flex-col gap-sm",
        });
        completedTasks.forEach((task) => {
          completedList.appendChild(createItemEl(task));
        });
        completedSection.appendChild(completedList);
      }

      wrapper.appendChild(completedSection);
    }

    this.container.appendChild(wrapper);
  }
}
