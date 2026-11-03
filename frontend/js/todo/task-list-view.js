import { businessNow } from "../utils/date.js";
import { createElement } from "../utils/dom.js";
import {
  TaskItem,
  getAvailableCategories,
  resolveCategoryForTask,
} from "./task-item.js";
import { formatDate } from "../utils/date.js";
import { store } from "../store.js";
import { api } from "../api.js";
import { isScheduleDismissal } from "../utils/api-error.js";
import { Toast } from "../components/toast.js";
import { EventForm } from "../calendar/event-form.js";
import { Dropdown } from "../components/dropdown.js";
import { Modal } from "../components/modal.js";
import { revisionOptions } from "../utils/revision.js";

export class TaskListView {
  constructor({
    container,
    tasks = [],
    activeListId = "board",
    activeTaskId = null,
    sortBy = "time",
    onlyImportant = false,
    timeFilter = "all",
    tagFilter = "all",
    dateFrom = "",
    dateTo = "",
    searchQuery = "",
    onSelectTask = null,
    onToggleComplete = null,
    onToggleImportant = null,
    onReorderTasks = null,
    onRefresh = null,
    onFilteredChange = null,
  }) {
    this.container = container;
    this.tasks = tasks;
    this.activeListId = activeListId;
    this.activeTaskId = activeTaskId;
    this.sortBy = sortBy || "time";
    this.onlyImportant = onlyImportant;
    this.timeFilter = timeFilter;
    this.tagFilter = tagFilter;
    Object.assign(this, { dateFrom, dateTo });
    this.searchQuery = searchQuery;
    this.onSelectTask = onSelectTask;
    this.onToggleComplete = onToggleComplete;
    this.onToggleImportant = onToggleImportant;
    this.onReorderTasks = onReorderTasks;
    this.onRefresh = onRefresh;
    this.onFilteredChange = onFilteredChange;

    this.isCompletedCollapsed = false;
    this.tasksBodyContainer = null;
  }

  setProps(props = {}) {
    Object.entries(props).forEach(([k, v]) => {
      if (v !== undefined) this[k] = v;
    });
    this.render();
  }

  getFilterState() {
    return Object.fromEntries(
      [
        "sortBy",
        "onlyImportant",
        "timeFilter",
        "tagFilter",
        "dateFrom",
        "dateTo",
        "searchQuery",
      ].map((key) => [key, this[key]]),
    );
  }

  isTaskOverdue(t, todayStr, nowTimeStr) {
    if (t.is_completed) return false;
    if (!t.due_date) return false;
    const dStr = String(t.due_date).slice(0, 10);
    const now = new Date(
      `${todayStr}T${nowTimeStr.length === 5 ? nowTimeStr + ":00" : nowTimeStr}`,
    );
    let end = new Date(`${dStr}T00:00:00`);
    if (!t.is_all_day && (t.end_time || t.start_time || t.due_time)) {
      const clock = String(t.end_time || t.start_time || t.due_time);
      end = new Date(`${dStr}T${clock.length === 5 ? clock + ":00" : clock}`);
      if (!t.end_time)
        end = new Date(end.getTime() + (t.duration_minutes || 60) * 60000);
    } else {
      end.setDate(end.getDate() + 1);
    }
    return end <= now;
  }

  sortTasks(list, isCompletedCol = false) {
    const sorted = [...list];
    if (this.sortBy === "title") {
      sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      return sorted;
    }
    if (this.sortBy === "time_desc") {
      sorted.sort((a, b) => {
        const da = a.due_date ? String(a.due_date).slice(0, 10) : "0000-00-00";
        const db = b.due_date ? String(b.due_date).slice(0, 10) : "0000-00-00";
        if (da !== db) return db.localeCompare(da);
        const ta = String(a.start_time || a.due_time || "00:00:00");
        const tb = String(b.start_time || b.due_time || "00:00:00");
        return tb.localeCompare(ta);
      });
      return sorted;
    }
    if (this.sortBy === "time_asc") {
      sorted.sort((a, b) => {
        const da = a.due_date ? String(a.due_date).slice(0, 10) : "9999-12-31";
        const db = b.due_date ? String(b.due_date).slice(0, 10) : "9999-12-31";
        if (da !== db) return da.localeCompare(db);
        const ta = String(a.start_time || a.due_time || "23:59:59");
        const tb = String(b.start_time || b.due_time || "23:59:59");
        return ta.localeCompare(tb);
      });
      return sorted;
    }

    if (isCompletedCol) {
      sorted.sort((a, b) => {
        const ca = a.completed_at || a.updated_at || a.created_at || "";
        const cb = b.completed_at || b.updated_at || b.created_at || "";
        return String(cb).localeCompare(String(ca));
      });
      return sorted;
    }

    // Mặc định: Sắp xếp theo thời gian tăng dần
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

    // Lọc theo list_id nếu không phải board
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

    // Lọc theo Thời gian
    if (this.timeFilter && this.timeFilter !== "all") {
      const now = businessNow();
      const todayStr = formatDate(now, "YYYY-MM-DD");
      const nowTimeStr = `${formatDate(now, "HH:mm")}:${String(now.getSeconds()).padStart(2, "0")}`;

      if (this.timeFilter === "today") {
        filtered = filtered.filter(
          (t) => t.due_date && String(t.due_date).slice(0, 10) === todayStr,
        );
      } else if (this.timeFilter === "week") {
        const next7 = new Date(now);
        next7.setDate(now.getDate() + 6);
        const next7Str = formatDate(next7, "YYYY-MM-DD");
        filtered = filtered.filter((t) => {
          if (!t.due_date) return false;
          const dStr = String(t.due_date).slice(0, 10);
          return dStr >= todayStr && dStr <= next7Str;
        });
      } else if (this.timeFilter === "tomorrow") {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        filtered = filtered.filter(
          (t) =>
            String(t.due_date || "").slice(0, 10) ===
            formatDate(tomorrow, "YYYY-MM-DD"),
        );
      } else if (this.timeFilter === "range") {
        filtered = filtered.filter((t) => {
          const date = String(t.due_date || "").slice(0, 10);
          return (
            date &&
            (!this.dateFrom || date >= this.dateFrom) &&
            (!this.dateTo || date <= this.dateTo)
          );
        });
      } else if (this.timeFilter === "overdue") {
        filtered = filtered.filter((t) =>
          this.isTaskOverdue(t, todayStr, nowTimeStr),
        );
      } else if (this.timeFilter === "unscheduled") {
        filtered = filtered.filter((t) => !t.due_date);
      }
    }

    // Lọc theo Thẻ / Phân loại
    if (this.tagFilter && this.tagFilter !== "all") {
      if (this.tagFilter === "none") {
        filtered = filtered.filter((t) => !resolveCategoryForTask(t));
      } else {
        const tagLow = this.tagFilter.toLowerCase();
        filtered = filtered.filter((t) => {
          const cat = resolveCategoryForTask(t);
          return Boolean(cat && cat.name.toLowerCase() === tagLow);
        });
      }
    }

    return filtered;
  }

  createTableHeaderBar() {
    const bar = createElement("div", { className: "todo-table-header-bar" });

    // 1. Cột Tìm kiếm
    const searchCol = createElement("div", { className: "todo-th-search" });
    const searchInput = createElement("input", {
      type: "text",
      className: "todo-filter-search-input",
      placeholder: "🔍 Tìm kiếm việc cần làm...",
      value: this.searchQuery || "",
      oninput: (e) => {
        this.searchQuery = e.target.value;
        if (clearBtn)
          clearBtn.style.display = this.searchQuery ? "block" : "none";
        this.renderTaskListBody();
      },
    });

    const clearBtn = createElement("button", {
      type: "button",
      className: "todo-filter-search-clear",
      style: { display: this.searchQuery ? "block" : "none" },
      textContent: "✕",
      title: "Xóa tìm kiếm",
      onclick: () => {
        this.searchQuery = "";
        searchInput.value = "";
        clearBtn.style.display = "none";
        this.renderTaskListBody();
      },
    });

    searchCol.appendChild(searchInput);
    searchCol.appendChild(clearBtn);

    // 2. Cột Lọc Thời gian
    const timeCol = createElement("div", { className: "todo-th-time" });
    let timeBtnLabel = "Thời gian ▾";
    if (this.timeFilter === "today") timeBtnLabel = "Hôm nay ▾";
    else if (this.timeFilter === "week") timeBtnLabel = "7 ngày tới ▾";
    else if (this.timeFilter === "tomorrow") timeBtnLabel = "Ngày mai ▾";
    else if (this.timeFilter === "range") timeBtnLabel = "Khoảng ngày ▾";
    else if (this.timeFilter === "overdue") timeBtnLabel = "Quá hạn ▾";
    else if (this.timeFilter === "unscheduled") timeBtnLabel = "Chưa đặt giờ ▾";
    else if (this.sortBy === "time_asc") timeBtnLabel = "Sớm nhất ▾";
    else if (this.sortBy === "time_desc") timeBtnLabel = "Muộn nhất ▾";
    else if (this.sortBy === "title") timeBtnLabel = "Tên A-Z ▾";

    const timeBtn = createElement("button", {
      type: "button",
      className: `todo-filter-dropdown-btn ${(this.timeFilter && this.timeFilter !== "all") || this.sortBy !== "time" ? "active" : ""}`,
      title: "Lọc hoặc sắp xếp theo thời gian",
      textContent: timeBtnLabel,
      onclick: (e) => {
        e.stopPropagation();
        Dropdown.show({
          triggerEl: timeBtn,
          items: [
            {
              label: "Tất cả thời gian",
              icon: "🕒",
              active:
                (!this.timeFilter || this.timeFilter === "all") &&
                this.sortBy === "time",
              onClick: () => {
                this.timeFilter = "all";
                this.sortBy = "time";
                this.render();
              },
            },
            {
              label: "Hôm nay",
              icon: "☀️",
              active: this.timeFilter === "today",
              onClick: () => {
                this.timeFilter = "today";
                this.render();
              },
            },
            {
              label: "7 ngày tới (kể cả hôm nay)",
              icon: "📅",
              active: this.timeFilter === "week",
              onClick: () => {
                this.timeFilter = "week";
                this.render();
              },
            },
            {
              label: "Quá hạn",
              icon: "⚠️",
              active: this.timeFilter === "overdue",
              onClick: () => {
                this.timeFilter = "overdue";
                this.render();
              },
            },
            {
              label: "Chưa đặt giờ",
              icon: "📌",
              active: this.timeFilter === "unscheduled",
              onClick: () => {
                this.timeFilter = "unscheduled";
                this.render();
              },
            },
            {
              label: "Ngày mai",
              active: this.timeFilter === "tomorrow",
              onClick: () => {
                this.timeFilter = "tomorrow";
                this.render();
              },
            },
            {
              label: "Khoảng ngày…",
              active: this.timeFilter === "range",
              onClick: () => {
                const from = createElement("input", {
                  type: "date",
                  className: "input",
                  "aria-label": "Từ ngày",
                  value: this.dateFrom,
                });
                const to = createElement("input", {
                  type: "date",
                  className: "input",
                  "aria-label": "Đến ngày",
                  value: this.dateTo,
                });
                Modal.open({
                  title: "Lọc theo khoảng ngày",
                  confirmText: "Áp dụng",
                  guardUnsaved: true,
                  content: createElement(
                    "div",
                    { className: "flex flex-col gap-sm" },
                    [
                      createElement("label", {}, ["Từ ngày", from]),
                      createElement("label", {}, ["Đến ngày", to]),
                    ],
                  ),
                  onConfirm: () => {
                    if (from.value && to.value && from.value > to.value) {
                      Toast.error("Đến ngày phải bằng hoặc sau Từ ngày.");
                      return false;
                    }
                    this.dateFrom = from.value;
                    this.dateTo = to.value;
                    this.timeFilter = "range";
                    this.render();
                    return true;
                  },
                });
              },
            },
            { divider: true },
            {
              label: "Sắp xếp: Sớm nhất trước",
              icon: "⬆️",
              active: this.sortBy === "time_asc",
              onClick: () => {
                this.sortBy = "time_asc";
                this.render();
              },
            },
            {
              label: "Sắp xếp: Muộn nhất trước",
              icon: "⬇️",
              active: this.sortBy === "time_desc",
              onClick: () => {
                this.sortBy = "time_desc";
                this.render();
              },
            },
            {
              label: "Sắp xếp: Tên A-Z",
              icon: "🔤",
              active: this.sortBy === "title",
              onClick: () => {
                this.sortBy = "title";
                this.render();
              },
            },
          ],
        });
      },
    });
    timeCol.appendChild(timeBtn);

    // 3. Cột Lọc Thẻ
    const tagCol = createElement("div", { className: "todo-th-tag" });
    const availableCats = getAvailableCategories();
    const activeCat = availableCats.find(
      (c) => c.name.toLowerCase() === (this.tagFilter || "").toLowerCase(),
    );

    const tagBtn = createElement("button", {
      type: "button",
      className: `todo-filter-dropdown-btn ${this.tagFilter && this.tagFilter !== "all" ? "active" : ""}`,
      title: "Lọc theo thẻ phân loại",
      onclick: (e) => {
        e.stopPropagation();
        const currentCats = getAvailableCategories();
        const items = [
          {
            label: "Tất cả thẻ",
            icon: "🏷️",
            active: !this.tagFilter || this.tagFilter === "all",
            onClick: () => {
              this.tagFilter = "all";
              this.render();
            },
          },
          { divider: true },
        ];

        if (currentCats.length === 0) {
          items.push({
            label: "(Chưa tạo thẻ trong Cài đặt)",
            disabled: true,
          });
        } else {
          currentCats.forEach((c) => {
            items.push({
              tagBadge: { name: c.name, color: c.color },
              active: this.tagFilter === c.name,
              onClick: () => {
                this.tagFilter = c.name;
                this.render();
              },
            });
          });
        }

        items.push({ divider: true });
        items.push({
          label: "Chưa gắn thẻ",
          icon: "-",
          active: this.tagFilter === "none",
          onClick: () => {
            this.tagFilter = "none";
            this.render();
          },
        });

        Dropdown.show({
          triggerEl: tagBtn,
          items,
        });
      },
    });

    if (activeCat) {
      tagBtn.replaceChildren(
        createElement(
          "span",
          {
            className: "task-tag-badge",
            style: {
              backgroundColor: `${activeCat.color}20`,
              color: activeCat.color,
              border: `1px solid ${activeCat.color}60`,
              padding: "1px 6px",
              fontSize: "11px",
              gap: "4px",
            },
          },
          [
            createElement("span", {
              style: { display: "inline-flex", alignItems: "center" },
              innerHTML: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
            }),
            createElement("span", { textContent: activeCat.name }),
          ],
        ),
        createElement("span", {
          style: { marginLeft: "4px" },
          textContent: "▾",
        }),
      );
    } else if (this.tagFilter === "none") {
      tagBtn.textContent = "Chưa gắn thẻ ▾";
    } else {
      tagBtn.textContent = "🏷️ Thẻ ▾";
    }
    tagCol.appendChild(tagBtn);

    // 4. Cột Lọc Sao Quan trọng
    const starCol = createElement("div", { className: "todo-th-star" });
    const starBtn = createElement("button", {
      type: "button",
      className: `todo-filter-star-btn ${this.onlyImportant ? "active" : ""}`,
      title: this.onlyImportant
        ? "Đang lọc: Chỉ việc Quan trọng (Bấm để xem tất cả)"
        : "Lọc việc Quan trọng (Hiện việc có ⭐)",
      innerHTML: "&#9733;",
      onclick: () => {
        this.onlyImportant = !this.onlyImportant;
        this.render();
      },
    });
    starCol.appendChild(starBtn);

    bar.appendChild(searchCol);
    bar.appendChild(timeCol);
    bar.appendChild(tagCol);
    bar.appendChild(starCol);
    bar.appendChild(
      createElement("button", {
        type: "button",
        className: "btn btn-secondary btn-xs",
        textContent: "Đặt lại",
        title: "Đặt lại bộ lọc",
        onclick: () => {
          Object.assign(this, {
            searchQuery: "",
            onlyImportant: false,
            timeFilter: "all",
            tagFilter: "all",
            dateFrom: "",
            dateTo: "",
            sortBy: "time",
          });
          this.render();
        },
      }),
    );

    return bar;
  }

  render() {
    this.container.innerHTML = "";
    this.tasksBodyContainer = null;

    // 1. Bảng quản lý chung -> Kanban 4 cột
    if (String(this.activeListId) === "board") {
      this.renderGeneralKanbanBoard();
      return;
    }

    // 2. Danh sách của tôi -> Dạng bảng đồng bộ
    this.renderCustomListView();
  }

  renderGeneralKanbanBoard({ preserveHeader = false } = {}) {
    if (!preserveHeader)
      this.container.appendChild(this.createTableHeaderBar());

    const allFiltered = this.filterTasks();
    this.onFilteredChange?.(allFiltered);
    const now = businessNow();
    const todayStr = formatDate(now, "YYYY-MM-DD");
    const nowTimeStr = `${formatDate(now, "HH:mm")}:${String(now.getSeconds()).padStart(2, "0")}`;

    const listMap = (store.get("taskLists") || []).reduce((acc, l) => {
      acc[l.id] = l.name;
      return acc;
    }, {});

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
        colTodoItems.push(t);
      }
    });

    const columns = [
      {
        id: "todo",
        title: "📌 Cần làm",
        subtitle: "Chưa đặt giờ & tương lai",
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
          const clearDate = !dStr || dStr <= todayStr;
          await api.put(
            `/tasks/${taskId}`,
            {
              is_completed: false,
              ...(clearDate
                ? {
                    due_date: null,
                    due_time: null,
                    start_time: null,
                    end_time: null,
                    is_all_day: true,
                  }
                : {}),
            },
            revisionOptions(targetTask),
          );
        },
      },
      {
        id: "today",
        title: "☀️ Hôm nay",
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
          const targetTask = this.tasks.find((x) => x.id === taskId);
          await api.put(
            `/tasks/${taskId}`,
            {
              due_date: todayStr,
              is_completed: false,
              is_in_my_day: true,
            },
            revisionOptions(targetTask),
          );
        },
      },
      {
        id: "overdue",
        title: "⚠️ Quá hạn",
        subtitle: "Đã quá thời gian quy định",
        color: "#EF4444",
        items: this.sortTasks(colOverdueItems, false),
        headerAction:
          colOverdueItems.length > 0
            ? {
                label: "Dời sang hôm nay",
                onClick: async () => {
                  const count = colOverdueItems.length;
                  try {
                    const result = await api.post("/tasks/batch", {
                      action: "reschedule_overdue",
                      task_ids: colOverdueItems.map((task) => task.id),
                      due_date: todayStr,
                    });
                    Toast.success(
                      `Đã dời ${result.affected} công việc quá hạn sang Hôm nay`,
                    );
                    window.dispatchEvent(
                      new CustomEvent("planify:data-changed"),
                    );
                    if (this.onRefresh) this.onRefresh();
                  } catch (err) {
                    if (!isScheduleDismissal(err))
                      Toast.error(err.message || "Không thể dời lịch");
                    if (this.onRefresh) this.onRefresh();
                  }
                },
              }
            : null,
        onDropTask: async (taskId) => {
          const targetTask = this.tasks.find((x) => x.id === taskId);
          const yesterday = businessNow();
          yesterday.setDate(yesterday.getDate() - 1);
          await api.put(
            `/tasks/${taskId}`,
            {
              due_date: formatDate(yesterday, "YYYY-MM-DD"),
              is_completed: false,
            },
            revisionOptions(targetTask),
          );
        },
      },
      {
        id: "completed",
        title: "✅ Hoàn thành",
        subtitle: "Các việc đã xong",
        color: "#10B981",
        items: this.sortTasks(colCompletedItems, true),
        headerAction:
          colCompletedItems.length > 0
            ? {
                label: "Dọn dẹp",
                onClick: async () => {
                  const count = colCompletedItems.length;
                  const details = colCompletedItems
                    .map(
                      (task) =>
                        `- ${task.title}${task.due_date ? ` (${String(task.due_date).slice(0, 10)}${task.start_time ? ` ${String(task.start_time).slice(0, 5)}` : ""})` : ""}`,
                    )
                    .join("\n");
                  if (
                    confirm(
                      `Xóa ${count} công việc đã hoàn thành đang hiển thị?\n${details}\nPhạm vi: chỉ các mục liệt kê, không xóa các lần lặp khác.`,
                    )
                  ) {
                    try {
                      const result = await api.post("/tasks/batch", {
                        action: "clear_completed",
                        task_ids: colCompletedItems.map((task) => task.id),
                      });
                      Toast.success(
                        `Đã xóa ${result.affected} công việc đã hoàn thành`,
                      );
                      window.dispatchEvent(
                        new CustomEvent("planify:data-changed"),
                      );
                      if (this.onRefresh) this.onRefresh();
                    } catch (err) {
                      Toast.error(err.message || "Lỗi khi xóa công việc");
                      if (this.onRefresh) this.onRefresh();
                    }
                  }
                },
              }
            : null,
        onDropTask: async (taskId) => {
          const targetTask = this.tasks.find((x) => x.id === taskId);
          await api.patch(
            `/tasks/${taskId}/complete`,
            { is_completed: true },
            revisionOptions(targetTask),
          );
        },
      },
    ];

    const board = createElement("div", {
      className: "todo-kanban-board",
      style: { flex: "1", minHeight: "0" },
    });

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
            if (!isScheduleDismissal(err))
              Toast.error(err.message || "Không thể chuyển công việc.");
            if (this.onRefresh) this.onRefresh();
          }
        },
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
            textContent: "Trống - Kéo thả việc vào đây",
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
    // Đặt cả Table Header Bar và Task Items bên trong cùng 1 container
    // để đồng bộ 100% về chiều rộng và lề với tiêu đề và ô nhập công việc
    const wrapper = createElement("div", {
      className: "todo-list-scroll",
      style: {
        paddingBottom: "28px",
        flex: "1",
        display: "flex",
        flexDirection: "column",
      },
    });

    // 1. Table Header Bar
    wrapper.appendChild(this.createTableHeaderBar());

    // 2. Container chứa các dòng công việc
    this.tasksBodyContainer = createElement("div");
    wrapper.appendChild(this.tasksBodyContainer);

    this.renderTaskListBody();
    this.container.appendChild(wrapper);
  }

  renderTaskListBody() {
    if (String(this.activeListId) === "board") {
      this.container.querySelector(".todo-kanban-board")?.remove();
      this.renderGeneralKanbanBoard({ preserveHeader: true });
      return;
    }
    if (!this.tasksBodyContainer) return;
    this.tasksBodyContainer.innerHTML = "";

    const allFiltered = this.filterTasks();
    this.onFilteredChange?.(allFiltered);
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
      this.tasksBodyContainer.appendChild(
        createElement("div", {
          style: {
            padding: "48px 16px",
            textAlign: "center",
            color: "var(--color-text-secondary)",
            background: "var(--color-surface)",
            borderRadius: "14px",
            border: "1px dashed var(--color-border)",
          },
          textContent:
            this.searchQuery ||
            this.timeFilter !== "all" ||
            this.tagFilter !== "all" ||
            this.onlyImportant
              ? "Không tìm thấy công việc nào phù hợp với bộ lọc!"
              : "Chưa có công việc nào trong danh sách này!",
        }),
      );
      return;
    }

    if (activeTasks.length > 0) {
      const activeContainer = createElement("div", {
        className: "flex flex-col gap-xs",
      });
      activeTasks.forEach((task) => {
        activeContainer.appendChild(createItemEl(task));
      });
      this.tasksBodyContainer.appendChild(activeContainer);
    }

    // Mục xổ xuống "Đã hoàn thành (X)"
    if (completedTasks.length > 0) {
      const completedSection = createElement("div", {
        className: "flex flex-col gap-xs",
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
            padding: "6px 12px",
            fontSize: "12.5px",
            width: "fit-content",
          },
          onclick: () => {
            this.isCompletedCollapsed = !this.isCompletedCollapsed;
            this.renderTaskListBody();
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
          className: "flex flex-col gap-xs",
          style: { marginTop: "6px" },
        });
        completedTasks.forEach((task) => {
          completedList.appendChild(createItemEl(task));
        });
        completedSection.appendChild(completedList);
      }

      this.tasksBodyContainer.appendChild(completedSection);
    }
  }
}
