import { businessNow } from "../utils/date.js";
import { createElement } from "../utils/dom.js";
import { store } from "../store.js";
import { api } from "../api.js";
import { Toast } from "../components/toast.js";
import { Modal } from "../components/modal.js";
import {
  formatVietnameseDate,
  getMonthName,
  addDays,
  getStartOfWeek,
  toLocalISOString,
  formatDate,
} from "../utils/date.js";
import { MiniCalendar } from "../calendar/mini-calendar.js";
import { DayView } from "../calendar/day-view.js";
import { WeekView } from "../calendar/week-view.js";
import { MonthView } from "../calendar/month-view.js";
import { AgendaView } from "../calendar/agenda-view.js";
import { EventForm } from "../calendar/event-form.js";
import { RRuleParser } from "../calendar/rrule.js";
import { adaptTasksForCalendar } from "../calendar/task-adapter.js";

export const calendarPage = {
  container: null,
  activeView: null,
  miniCalendar: null,
  unscheduledContainer: null,
  calendarListFilter: 'all',
  calendarStatusFilter: 'all',

  async render(container) {
    this.drawerCleanup?.();
    const renderGeneration = (this.renderGeneration =
      (this.renderGeneration || 0) + 1);
    this.container = container;
    container.innerHTML = "";

    // Đảm bảo mặc định lúc vào là Lịch Tháng ('month') nếu chưa lưu hoặc đang ở chế độ cũ 'workweek'
    const currentView = store.get("calendarView");
    if (!currentView || currentView === "workweek") {
      store.set("calendarView", "month");
    }

    const page = createElement("div", { className: "calendar-page" });

    // 1. Sidebar (Nút tạo mới + Mini Calendar + Việc chưa xếp lịch để kéo thả vào lịch)
    const sidebar = createElement("aside", {
      className: "calendar-sidebar",
      id: "calendar-sub-sidebar",
      'aria-label': 'Lịch nhỏ và công việc chưa xếp lịch',
    });

    const createBigBtn = createElement("button", {
      type: "button",
      className: "btn btn-primary",
      style: {
        width: "100%",
        padding: "10px 12px",
        fontWeight: "700",
        boxShadow: "var(--shadow-sm)",
      },
      textContent: "＋ Tạo Công việc",
      onclick: () => {
        EventForm.showFullModal({
          hasDate: false,
          onCreated: () => this.updateView(),
        });
      },
    });

    const miniCalContainer = createElement("div", { id: "mini-calendar" });
    this.unscheduledContainer = createElement("div", {
      className: "cal-unscheduled-tray",
    });

    sidebar.appendChild(createElement('div', { className: 'cal-drawer-heading mobile-only' }, [
      createElement('span', { textContent: 'Lịch cá nhân' }),
      createElement('button', {
        type: 'button', className: 'btn-icon', id: 'btn-cal-drawer-close',
        'aria-label': 'Đóng lịch nhỏ', title: 'Đóng lịch nhỏ', 'data-icon': 'x',
        onclick: () => this.setDrawerOpen?.(false),
      }),
    ]));
    sidebar.appendChild(createBigBtn);
    sidebar.appendChild(miniCalContainer);
    sidebar.appendChild(this.unscheduledContainer);

    // 2. Main Calendar Area (Đã xóa hoàn toàn thanh Mẹo / GuideCard theo yêu cầu)
    const main = createElement("div", { className: "calendar-main" });
    const toolbar = createElement("div", { className: "calendar-toolbar" });
    const viewContainer = createElement("div", {
      className: "calendar-view-container",
      id: "calendar-view-body",
    });

    main.appendChild(toolbar);
    main.appendChild(viewContainer);

    page.appendChild(sidebar);
    page.appendChild(main);
    container.appendChild(page);

    // The opener sits behind the mobile drawer, so provide an internal close
    // control and keep hidden drawer controls out of the keyboard tab order.
    const syncDrawer = () => {
      const mobile = window.innerWidth <= 768;
      if (!mobile) sidebar.classList.remove('mobile-open');
      const open = mobile && sidebar.classList.contains('mobile-open');
      sidebar.inert = mobile && !open;
      sidebar.setAttribute('aria-hidden', String(mobile && !open));
      const opener = page.querySelector('#btn-cal-mobile-drawer');
      if (opener) {
        opener.setAttribute('aria-expanded', String(open));
        opener.setAttribute('aria-label', open ? 'Đóng lịch nhỏ & khay việc chưa xếp lịch' : 'Mở lịch nhỏ & khay việc chưa xếp lịch');
      }
    };
    this.setDrawerOpen = (open, focus = true) => {
      sidebar.classList.toggle('mobile-open', Boolean(open));
      syncDrawer();
      if (focus && window.innerWidth <= 768) {
        page.querySelector(open ? '#btn-cal-drawer-close' : '#btn-cal-mobile-drawer')?.focus();
      }
    };
    this.syncDrawer = syncDrawer;
    const escapeDrawer = (event) => {
      if (event.key === 'Escape' && sidebar.classList.contains('mobile-open') && !Modal.activeModal) {
        event.preventDefault();
        this.setDrawerOpen(false);
      }
    };
    const outsideDrawer = (event) => {
      if (sidebar.classList.contains('mobile-open') && !sidebar.contains(event.target) && !event.target.closest('#btn-cal-mobile-drawer')) {
        this.setDrawerOpen(false, false);
      }
    };
    window.addEventListener('resize', syncDrawer);
    document.addEventListener('keydown', escapeDrawer);
    page.addEventListener('pointerdown', outsideDrawer);
    this.drawerCleanup = () => {
      window.removeEventListener('resize', syncDrawer);
      document.removeEventListener('keydown', escapeDrawer);
      page.removeEventListener('pointerdown', outsideDrawer);
    };
    syncDrawer();

    // Initialize mini calendar
    this.miniCalendar = new MiniCalendar(miniCalContainer, {
      onDateSelect: (d) => {
        store.set("selectedDate", d);
        this.updateView();
      },
    });
    this.miniCalendar.render();

    await this.updateView();
    if (renderGeneration !== this.renderGeneration || !this.container) return;

    this.handleDataChanged = () => this.updateView();
    window.addEventListener("planify:data-changed", this.handleDataChanged);
    document.addEventListener("task-changed", this.handleDataChanged);
  },

  /**
   * Hiển thị khay "Việc chưa xếp lịch (Vĩnh viễn ở cột Cần làm)" để người dùng kéo thả trực tiếp vào Lịch
   */
  renderUnscheduledTray(tasks = []) {
    if (!this.unscheduledContainer) return;
    this.unscheduledContainer.innerHTML = "";

    // Những việc chưa có due_date (vĩnh viễn nằm ở cột Cần làm)
    const unscheduled = (tasks || []).filter(
      (t) => !t.is_completed && !t.due_date,
    );

    this.unscheduledContainer.appendChild(
      createElement(
        "div",
        {
          style: {
            fontSize: "12px",
            fontWeight: "800",
            color: "var(--color-text-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "4px",
          },
        },
        [
          createElement("span", {
            textContent: "Việc chưa xếp lịch",
          }),
          createElement("span", {
            className: "todo-list-badge",
            textContent: `${unscheduled.length}`,
          }),
        ],
      ),
    );

    this.unscheduledContainer.appendChild(
      createElement("div", {
        style: {
          fontSize: "11px",
          color: "var(--color-text-secondary)",
          marginBottom: "6px",
          lineHeight: "1.35",
        },
        textContent:
          "Các mục không đặt thời gian ở cột Cần làm. Kéo thả vào ô ngày/giờ bất kỳ trên Lịch để lên lịch!",
      }),
    );

    if (unscheduled.length === 0) {
      this.unscheduledContainer.appendChild(
        createElement("div", {
          style: {
            fontSize: "11.5px",
            color: "var(--color-text-muted)",
            fontStyle: "italic",
            padding: "8px 4px",
          },
          textContent:
            "Tất cả công việc đã được gắn ngày giờ hoặc chưa có việc vĩnh viễn.",
        }),
      );
      return;
    }

    const listWrap = createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        maxHeight: "260px",
        overflowY: "auto",
      },
    });

    unscheduled.forEach((t) => {
      const itemEl = createElement(
        "div",
        {
          className: "cal-tray-item",
          style: { borderLeft: `3px solid ${t.color || "#4F46E5"}` },
          draggable: "true",
          title:
            "Kéo thả vào một ngày trên Lịch để xếp lịch • Hoặc bấm để mở Form chỉnh sửa",
          ondragstart: (e) => {
            const payload = {
              id: t.id,
              updated_at: t.updated_at,
              created_at: t.created_at,
              is_task: true,
              durationMinutes: t.duration_minutes || 60,
              title: t.title,
              color: t.color || "#4F46E5",
            };
            e.dataTransfer.setData("text/plain", JSON.stringify(payload));
            e.dataTransfer.effectAllowed = "move";
          },
          onclick: () => {
            EventForm.showFullModal({
              task: t,
              hasDate: true,
              startAt: store.get("selectedDate") || businessNow(),
              onUpdated: () => this.updateView(),
              onDeleted: () => this.updateView(),
            });
          },
        },
        [
          t.is_important ? createElement("span", { textContent: "⭐", title: 'Quan trọng' }) : null,
          createElement("span", {
            className: "truncate flex-1",
            style: { fontWeight: "600" },
            textContent: t.title,
          }),
          t.color
            ? createElement("span", {
                className: "task-tag-dot",
                style: {
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: t.color,
                  display: "inline-block",
                  flexShrink: "0",
                  marginLeft: "6px",
                  marginRight: "2px",
                  boxShadow: 'none',
                },
                title: `Thẻ phân loại (${t.color})`,
              })
            : null,
        ],
      );
      listWrap.appendChild(itemEl);
    });

    this.unscheduledContainer.appendChild(listWrap);
  },

  async updateView() {
    const generation = (this.requestGeneration =
      (this.requestGeneration || 0) + 1);
    const curDate = store.get("selectedDate") || businessNow();
    let curMode = store.get("calendarView") || "month";
    if (curMode === "workweek") curMode = "month";

    const viewContainer = document.getElementById("calendar-view-body");
    const toolbar = document.querySelector(".calendar-toolbar");
    if (!viewContainer || !toolbar) return;

    let startDt, endDt;
    if (curMode === "day") {
      startDt = new Date(curDate);
      startDt.setHours(0, 0, 0, 0);
      endDt = new Date(curDate);
      endDt.setHours(23, 59, 59, 999);
    } else if (curMode === "week") {
      startDt = getStartOfWeek(curDate, true);
      endDt = addDays(startDt, 7);
    } else if (curMode === "agenda") {
      startDt = new Date(curDate);
      startDt.setHours(0, 0, 0, 0);
      endDt = addDays(startDt, 30);
    } else {
      startDt = new Date(curDate.getFullYear(), curDate.getMonth(), 1);
      endDt = new Date(
        curDate.getFullYear(),
        curDate.getMonth() + 1,
        0,
        23,
        59,
        59,
      );
      startDt = getStartOfWeek(startDt, true);
      endDt = addDays(getStartOfWeek(endDt, true), 7);
    }

    let displayTitle = "";
    if (curMode === "day") {
      displayTitle = formatVietnameseDate(curDate, true);
    } else if (curMode === "week") {
      const s = getStartOfWeek(curDate, true);
      const e = addDays(s, 6);
      displayTitle = `${s.getDate()} thg ${s.getMonth() + 1} - ${e.getDate()} thg ${e.getMonth() + 1}, ${s.getFullYear()}`;
    } else if (curMode === "agenda") {
      displayTitle = `Lịch biểu (từ ${curDate.getDate()} thg ${curDate.getMonth() + 1})`;
    } else {
      displayTitle = `${getMonthName(curDate.getMonth())}, ${curDate.getFullYear()}`;
    }

    // Đã xóa nút "💡 Mẹo" và nút "T2-T6", đặt "Tháng" lên đầu làm mặc định
    toolbar.innerHTML = `
      <div class="calendar-nav-group">
        <button class="btn-icon mobile-only" id="btn-cal-mobile-drawer" aria-controls="calendar-sub-sidebar" aria-expanded="false" title="Mở lịch nhỏ & khay việc chưa xếp lịch">📅</button>
        <button class="btn btn-secondary btn-sm" id="btn-cal-today" style="font-weight:700;">📍 Hôm nay</button>
        <button class="btn-icon" id="btn-cal-prev" title="Trước">&#9664;</button>
        <button class="btn-icon" id="btn-cal-next" title="Tiếp">&#9654;</button>
        <h2 class="calendar-title">${displayTitle}</h2>
      </div>
      <div class="view-toggle-group">
        <button class="view-toggle-btn ${curMode === "month" ? "active" : ""}" data-view="month">Tháng</button>
        <button class="view-toggle-btn ${curMode === "week" ? "active" : ""}" data-view="week">Tuần</button>
        <button class="view-toggle-btn ${curMode === "day" ? "active" : ""}" data-view="day">Ngày</button>
        <button class="view-toggle-btn ${curMode === "agenda" ? "active" : ""}" data-view="agenda">Lịch biểu</button>
      </div>
    `;
    const filters = createElement('div', { className: 'calendar-filters' });
    const listFilter = createElement('select', { className: 'input', 'aria-label': 'Lọc lịch theo danh sách', onchange: e => { this.calendarListFilter = e.target.value; this.updateView(); } }, [
      createElement('option', { value: 'all', textContent: 'Mọi danh sách và sự kiện' }),
      createElement('option', { value: 'events', textContent: 'Chỉ sự kiện' }),
      ...(store.get('taskLists') || []).map(list => createElement('option', { value: String(list.id), textContent: list.name }))
    ]);
    listFilter.value = this.calendarListFilter;
    const statusFilter = createElement('select', { className: 'input', 'aria-label': 'Lọc lịch theo trạng thái', onchange: e => { this.calendarStatusFilter = e.target.value; this.updateView(); } }, [
      createElement('option', { value: 'all', textContent: 'Mọi trạng thái' }),
      createElement('option', { value: 'open', textContent: 'Chưa hoàn thành' }),
      createElement('option', { value: 'completed', textContent: 'Đã hoàn thành' })
    ]);
    statusFilter.value = this.calendarStatusFilter;
    const resetFilters = createElement('button', { type: 'button', className: 'btn btn-secondary btn-sm', textContent: 'Đặt lại bộ lọc', onclick: () => {
      this.calendarListFilter = 'all'; this.calendarStatusFilter = 'all'; this.updateView();
    } });
    const countEl = createElement('span', { role: 'status', style: { fontSize: '12px' }, textContent: 'Đang tải…' });
    filters.append(listFilter, statusFilter, resetFilters, countEl);
    toolbar.appendChild(filters);

    document
      .getElementById("btn-cal-mobile-drawer")
      ?.addEventListener("click", () => {
        const subSidebar = document.getElementById("calendar-sub-sidebar");
        if (subSidebar) this.setDrawerOpen?.(!subSidebar.classList.contains('mobile-open'));
      });
    this.syncDrawer?.();

    document.getElementById("btn-cal-today")?.addEventListener("click", () => {
      store.set("selectedDate", businessNow());
      this.updateView();
      if (this.miniCalendar) this.miniCalendar.render();
    });

    document
      .getElementById("btn-cal-prev")
      ?.addEventListener("click", () => this.navigateDate(-1));
    document
      .getElementById("btn-cal-next")
      ?.addEventListener("click", () => this.navigateDate(1));

    toolbar.querySelectorAll(".view-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.setViewMode(btn.dataset.view);
      });
    });

    try {
      viewContainer.replaceChildren(createElement('div', { role: 'status', className: 'empty-state', textContent: 'Đang tải lịch…' }));
      const [events, allTasks, lists] = await Promise.all([
        api.get('/events', { start: `${toLocalISOString(startDt)}+07:00`, end: `${toLocalISOString(endDt)}+07:00` }),
        api.get('/tasks'),
        api.get('/task-lists')
      ]);
      if (generation !== this.requestGeneration || !this.container) return;
      if (!Array.isArray(events) || !Array.isArray(allTasks) || !Array.isArray(lists)) throw new Error('Dữ liệu lịch không hợp lệ.');
      store.set('taskLists', lists);
      listFilter.replaceChildren(
        createElement('option', { value: 'all', textContent: 'Mọi danh sách và sự kiện' }),
        createElement('option', { value: 'events', textContent: 'Chỉ sự kiện' }),
        ...lists.map(list => createElement('option', { value: String(list.id), textContent: list.name }))
      );
      if (this.calendarListFilter !== 'all' && this.calendarListFilter !== 'events' && !lists.some(list => String(list.id) === this.calendarListFilter)) this.calendarListFilter = 'all';
      listFilter.value = this.calendarListFilter;

      this.renderUnscheduledTray(allTasks.filter(task =>
        (this.calendarListFilter === 'all' || String(task.list_id) === this.calendarListFilter) &&
        (this.calendarStatusFilter === 'all' || (this.calendarStatusFilter === 'completed') === Boolean(task.is_completed))
      ));

      if (this.activeView && typeof this.activeView.destroy === "function") {
        this.activeView.destroy();
      }

      const expandedEvents = (this.calendarListFilter === 'all' || this.calendarListFilter === 'events') && this.calendarStatusFilter !== 'completed'
        ? RRuleParser.expandAll(events, startDt, endDt) : [];
      const firstDate = formatDate(startDt, 'YYYY-MM-DD');
      const lastDate = formatDate(endDt, 'YYYY-MM-DD');
      const adaptedTasks = this.calendarListFilter === 'events' ? [] : adaptTasksForCalendar(allTasks.filter(task =>
        task.due_date && String(task.due_date).slice(0, 10) >= firstDate && String(task.due_date).slice(0, 10) <= lastDate &&
        (this.calendarListFilter === 'all' || String(task.list_id) === this.calendarListFilter) &&
        (this.calendarStatusFilter === 'all' || (this.calendarStatusFilter === 'completed') === Boolean(task.is_completed))
      ));
      countEl.textContent = `${expandedEvents.length + adaptedTasks.length} mục khớp`;

      // Tránh trùng lặp nếu một sự kiện vừa nằm ở bảng events cũ vừa đã đồng bộ sang tasks

      const viewOptions = {
        date: curDate,
        events: expandedEvents,
        tasks: adaptedTasks,
        daysCount: 7,
        onNavigateMonth: (delta) => this.navigateDate(delta),
        onRefresh: () => this.updateView(),
      };

      if (curMode === "day") {
        this.activeView = new DayView(viewContainer, viewOptions);
      } else if (curMode === "month") {
        this.activeView = new MonthView(viewContainer, viewOptions);
      } else if (curMode === "agenda") {
        this.activeView = new AgendaView(viewContainer, viewOptions);
      } else {
        this.activeView = new WeekView(viewContainer, viewOptions);
      }

      this.activeView.render();
    } catch (err) {
      if (generation !== this.requestGeneration || !this.container) return;
      Toast.error(err.message || 'Không tải được lịch.');
      countEl.textContent = 'Không rõ số mục';
      viewContainer.replaceChildren(createElement('div', { className: 'empty-state', role: 'alert' }, [
        createElement('p', { textContent: `Không tải được lịch: ${err.message || 'Lỗi không xác định.'}` }),
        createElement('button', { type: 'button', className: 'btn btn-primary', textContent: 'Thử lại', onclick: () => this.updateView() })
      ]));
      if (this.unscheduledContainer) this.unscheduledContainer.replaceChildren(createElement('div', { role: 'alert', textContent: 'Không tải được khay công việc.' }));
      console.warn('Failed to load calendar items:', err);
    }
  },

  navigateDate(direction) {
    const curDate = store.get("selectedDate") || businessNow();
    const curMode = store.get("calendarView") || "month";
    let nextDate;

    if (curMode === "day") {
      nextDate = addDays(curDate, direction);
    } else if (curMode === "week") {
      nextDate = addDays(curDate, direction * 7);
    } else if (curMode === "agenda") {
      nextDate = addDays(curDate, direction * 30);
    } else {
      nextDate = new Date(
        curDate.getFullYear(),
        curDate.getMonth() + direction,
        1,
      );
    }

    store.set("selectedDate", nextDate);
    this.updateView();
    if (this.miniCalendar) this.miniCalendar.render();
  },

  setViewMode(mode) {
    store.set("calendarView", mode);
    this.updateView();
  },

  destroy() {
    this.drawerCleanup?.();
    this.drawerCleanup = null;
    this.setDrawerOpen = null;
    this.syncDrawer = null;
    this.renderGeneration = (this.renderGeneration || 0) + 1;
    this.requestGeneration = (this.requestGeneration || 0) + 1;
    if (this.handleDataChanged) {
      window.removeEventListener(
        "planify:data-changed",
        this.handleDataChanged,
      );
      document.removeEventListener("task-changed", this.handleDataChanged);
      this.handleDataChanged = null;
    }
    if (this.activeView && typeof this.activeView.destroy === "function") {
      this.activeView.destroy();
      this.activeView = null;
    }
    if (this.container) {
      this.container.innerHTML = "";
      this.container = null;
    }
  },
};
