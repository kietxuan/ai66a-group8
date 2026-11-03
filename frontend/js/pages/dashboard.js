import { businessNow } from "../utils/date.js";
import { createElement } from "../utils/dom.js";
import { api } from "../api.js";
import { store } from "../store.js";
import { Toast } from "../components/toast.js";
import { EventForm } from "../calendar/event-form.js";
import { formatVietnameseDate } from "../utils/date.js";
import { soundManager } from "../utils/sound.js";
import { revisionOptions } from "../utils/revision.js";

const DASHBOARD_FALLBACK_CSS = `
.dashboard-page { width:100%; height:100%; overflow-y:auto; overflow-x:hidden; padding:22px 26px 48px; display:flex; flex-direction:column; gap:20px; background-color:var(--color-bg-primary); }
.dashboard-page > * { flex-shrink: 0; }
.dash-hero-banner { background:linear-gradient(135deg,#4F46E5 0%,#2563EB 55%,#0EA5E9 100%); border-radius:18px; padding:24px 28px; color:#fff; display:flex; align-items:center; justify-content:space-between; gap:24px; box-shadow:0 12px 28px -8px rgba(37,99,235,0.38); }
.dash-hero-left { display:flex; flex-direction:column; gap:6px; max-width:860px; flex:1; }
.dash-hero-greeting { font-size:24px; font-weight:800; color:#fff; margin:0; }
.dash-hero-subtitle { font-size:13.5px; color:rgba(255,255,255,0.92); line-height:1.55; margin:0; text-wrap:pretty; }
.dash-hero-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:10px; }
.btn-dash-white { background:#fff; color:#1E40AF; font-weight:700; font-size:13px; padding:9px 16px; border-radius:10px; border:none; cursor:pointer; }
.btn-dash-glass { background:rgba(255,255,255,0.18); color:#fff; font-weight:600; font-size:13px; padding:9px 15px; border-radius:10px; border:1px solid rgba(255,255,255,0.32); cursor:pointer; }
.dash-score-card { display:flex; align-items:center; gap:16px; background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.28); border-radius:16px; padding:14px 20px; flex-shrink:0; }
.dash-score-ring-wrap { width:72px; height:72px; display:flex; align-items:center; justify-content:center; }
.dash-score-info { display:flex; flex-direction:column; gap:3px; }
.dash-score-title { font-size:11px; font-weight:700; text-transform:uppercase; opacity:0.9; }
.dash-score-status { font-size:17px; font-weight:800; color:#fff; }
.dash-kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(175px,1fr)); gap:14px; }
.dash-kpi-card { background:var(--color-surface); border:1px solid var(--color-border-light); border-radius:14px; padding:16px 18px; display:flex; flex-direction:column; gap:8px; }
.dash-kpi-top { display:flex; align-items:center; justify-content:space-between; }
.dash-kpi-badge { font-size:11px; font-weight:700; padding:3px 8px; border-radius:999px; }
.dash-kpi-value { font-size:24px; font-weight:800; color:var(--color-text-primary); }
.dash-kpi-label { font-size:12.5px; font-weight:600; color:var(--color-text-secondary); }
.dash-charts-grid { display:grid; grid-template-columns:1.55fr 1fr; gap:18px; }
.dash-secondary-grid { display:grid; grid-template-columns:1.35fr 1fr; gap:18px; }
.dash-bottom-grid { display:grid; grid-template-columns:1fr; gap:18px; }
.dash-panel-card { background:var(--color-surface); border:1px solid var(--color-border-light); border-radius:16px; padding:20px 22px; display:flex; flex-direction:column; gap:16px; min-width:0; }
.dash-panel-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.dash-panel-title { font-size:15.5px; font-weight:800; color:var(--color-text-primary); margin:0; }
.dash-panel-subtitle { font-size:12px; color:var(--color-text-secondary); margin:3px 0 0; }
.dash-bar-legend { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.dash-legend-item { display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; color:var(--color-text-secondary); }
.dash-legend-dot { width:10px; height:10px; border-radius:3px; display:inline-block; }
.dash-canvas-box { width:100%; min-height:215px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
.dash-donut-layout { display:flex; align-items:center; justify-content:space-around; gap:20px; flex-wrap:wrap; }
.dash-donut-legend { display:flex; flex-direction:column; gap:8px; flex:1; min-width:170px; }
.dash-donut-legend-row { display:flex; align-items:center; justify-content:space-between; padding:7px 10px; border-radius:8px; background:var(--color-bg-secondary); font-size:12.5px; }
.eisenhower-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
.eisenhower-quadrant { background:var(--color-bg-secondary); border:1px solid var(--color-border-light); border-radius:12px; padding:12px 14px; display:flex; flex-direction:column; gap:8px; min-height:110px; }
.eisenhower-q-header { display:flex; align-items:center; justify-content:space-between; font-size:12.5px; font-weight:800; }
.eisenhower-q-list { display:flex; flex-direction:column; gap:6px; }
.eisenhower-task-pill { display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:8px; background:var(--color-surface); border:1px solid var(--color-border-light); font-size:12.5px; transition:all 0.25s ease; }
.eisenhower-task-pill.dash-completing { opacity:0; transform:scale(0.96); }
.eisenhower-task-pill.dash-completing .dash-task-title { text-decoration:line-through; color:var(--color-text-tertiary); }
.dash-kpi-badge { font-size:13px; font-weight:700; padding:4px 10px; border-radius:8px; }
.dash-task-complete { width:22px; height:22px; border:1.5px solid var(--color-text-tertiary); border-radius:50%; background:transparent; cursor:pointer; flex-shrink:0; }
.dash-task-complete:hover, .dash-task-complete:focus-visible { border-color:var(--color-primary); outline:2px solid var(--color-primary); outline-offset:2px; }
.dash-task-complete:disabled { cursor:wait; opacity:0.5; }
.dash-list-progress-items { display:flex; flex-direction:column; gap:12px; }
.dash-list-prog-row { display:flex; flex-direction:column; gap:6px; padding:8px 10px; border-radius:10px; background:var(--color-bg-secondary); }
.dash-list-prog-top { display:flex; align-items:center; justify-content:space-between; font-size:13px; font-weight:700; }
.dash-list-prog-track { width:100%; height:8px; border-radius:999px; background:var(--color-border-light); overflow:hidden; }
.dash-list-prog-fill { height:100%; border-radius:999px; }
.dash-timeline-list { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:10px; }
.dash-timeline-item { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 14px; border-radius:10px; background:var(--color-bg-secondary); border:1px solid var(--color-border-light); border-left:4px solid var(--color-primary); cursor:pointer; }
@media (max-width: 1080px) { .dash-charts-grid, .dash-secondary-grid { grid-template-columns:1fr; } }
@media (max-width: 768px) { .dashboard-page { padding:14px 14px 84px; } .dash-hero-banner { flex-direction:column; align-items:flex-start; } .eisenhower-grid { grid-template-columns:1fr; } }
`;

function ensureDashboardStyles() {
  if (!document.getElementById("planify-dashboard-inline-css")) {
    const styleEl = document.createElement("style");
    styleEl.id = "planify-dashboard-inline-css";
    styleEl.textContent = DASHBOARD_FALLBACK_CSS;
    document.head.appendChild(styleEl);
  }
}

export const dashboardPage = {
  container: null,
  stats: null,
  dataChangedHandler: null,
  themeListener: null,
  resizeHandler: null,

  async render(container) {
    ensureDashboardStyles();
    this.container = container;
    container.innerHTML = "";

    const page = createElement("div", {
      className: "dashboard-page",
      id: "dashboard-root",
    });
    container.appendChild(page);

    this.dataChangedHandler = (event) => {
      if (event?.detail?.source === "dashboard-complete") return;
      this.loadAndRender(page, { silent: true });
    };
    window.addEventListener("planify:data-changed", this.dataChangedHandler);
    document.addEventListener("task-changed", this.dataChangedHandler);
    this.themeListener = store.on("theme", () => {
      if (this.stats && this.container) {
        this.renderContent(page, this.stats);
      }
    });
    this.resizeHandler = () => {
      if (this.stats && this.container) {
        const barCanvas = page.querySelector("#dash-weekly-bar-canvas");
        if (barCanvas && this.stats.weekly_trend) {
          this.drawWeeklyTrendCanvas(barCanvas, this.stats.weekly_trend);
        }
      }
    };
    window.addEventListener("resize", this.resizeHandler);

    await this.loadAndRender(page);
  },

  getTrendSnapshotKey() {
    const userId = store.get("user")?.id || "default";
    return `planify_dashboard_trend_snapshot_${userId}`;
  },

  mergeWithSnapshot(weeklyTrend) {
    if (!Array.isArray(weeklyTrend) || weeklyTrend.length === 0) return weeklyTrend;
    const key = this.getTrendSnapshotKey();
    let snapshot = {};
    try {
      const raw = localStorage.getItem(key);
      if (raw) snapshot = JSON.parse(raw);
    } catch (_) {}

    const minDate = weeklyTrend[0]?.date;

    // 1. Cập nhật snapshot với dữ liệu hiện tại (bảo toàn giá trị max từng đạt được)
    weeklyTrend.forEach((item) => {
      const d = item.date;
      const prev = snapshot[d] || { due_tasks: 0, overdue_tasks: 0, completed_tasks: 0 };
      snapshot[d] = {
        due_tasks: Math.max(prev.due_tasks || 0, item.due_tasks || 0),
        overdue_tasks: Math.max(prev.overdue_tasks || 0, item.overdue_tasks || 0),
        completed_tasks: Math.max(prev.completed_tasks || 0, item.completed_tasks || 0),
      };
    });

    // 2. Tự động dọn dẹp sau 7 ngày: Xóa các ngày trong snapshot cũ hơn ngày đầu của biểu đồ
    Object.keys(snapshot).forEach((dateStr) => {
      if (minDate && dateStr < minDate) {
        delete snapshot[dateStr];
      }
    });

    try {
      localStorage.setItem(key, JSON.stringify(snapshot));
    } catch (_) {}

    // 3. Hợp nhất vào weeklyTrend để hiển thị biểu đồ
    return weeklyTrend.map((item) => {
      const snap = snapshot[item.date] || {};
      return {
        ...item,
        due_tasks: Math.max(item.due_tasks || 0, snap.due_tasks || 0),
        overdue_tasks: Math.max(item.overdue_tasks || 0, snap.overdue_tasks || 0),
        completed_tasks: Math.max(item.completed_tasks || 0, snap.completed_tasks || 0),
      };
    });
  },

  async loadAndRender(pageEl, { silent = false } = {}) {
    if (!pageEl) return;
    const generation = (this.generation = (this.generation || 0) + 1);
    if (!silent && !this.stats) {
      pageEl.replaceChildren(
        createElement("div", {
          className: "dash-panel-card",
          role: "status",
          textContent: "Đang tải thống kê…",
        }),
      );
    }
    try {
      const stats = await api.get("/dashboard/stats");
      if (generation !== this.generation || !this.container) return;
      if (
        !stats ||
        !stats.summary ||
        !stats.status_breakdown ||
        !["total_tasks", "completed_tasks", "overdue_count"].every((key) =>
          Number.isFinite(stats.summary[key]),
        ) ||
        !Array.isArray(stats.weekly_trend)
      )
        throw new Error("Dữ liệu thống kê không hợp lệ.");
      this.stats = stats;
    } catch (err) {
      if (generation !== this.generation || !this.container) return;
      if (!this.stats) {
        pageEl.innerHTML = "";
        pageEl.appendChild(
          createElement(
            "div",
            {
              className: "dash-panel-card",
              role: "alert",
              textContent: `Không tải được dữ liệu Dashboard: ${err.message || "Lỗi không xác định."}`,
            },
            [
              createElement("button", {
                type: "button",
                className: "btn btn-primary",
                textContent: "Thử lại",
                onclick: () => this.loadAndRender(pageEl),
              }),
            ],
          ),
        );
        return;
      }
    }
    if (generation !== this.generation || !this.container) return;
    const scrollPos = pageEl.scrollTop;
    this.renderContent(pageEl, this.stats);
    if (scrollPos > 0) {
      pageEl.scrollTop = scrollPos;
    }
  },

  drawScoreRingCanvas(canvas, score) {
    const dpr = window.devicePixelRatio || 1;
    const size = 72;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const r = 28;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 6.5;
    ctx.stroke();

    if (score != null) {
      const startAngle = -Math.PI / 2;
      const endAngle =
        startAngle + (Math.max(0, Math.min(100, score)) / 100) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 6.5;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    ctx.fillStyle = "#ffffff";
    ctx.font =
      '800 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(score == null ? "-" : String(score), cx, cy + 1);
  },

  drawWeeklyTrendCanvas(canvas, trendItems) {
    const dpr = window.devicePixelRatio || 1;
    const rectWidth = canvas.parentElement?.clientWidth || 560;
    const width = Math.max(320, rectWidth);
    const height = 215;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    const gridColor = isDark
      ? "rgba(148, 163, 184, 0.16)"
      : "rgba(100, 116, 139, 0.16)";
    const textColor = isDark ? "#94A3B8" : "#64748B";

    const padLeft = 34;
    const padRight = 16;
    const padTop = 24;
    const padBottom = 34;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const maxVal = Math.max(
      4,
      ...trendItems.map((i) =>
        Math.max(i.due_tasks || 0, i.overdue_tasks || 0, i.completed_tasks || 0),
      ),
    );

    const steps = 4;
    ctx.font =
      '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let s = 0; s <= steps; s++) {
      const yVal = Math.round((maxVal / steps) * s);
      const y = padTop + chartH - (s / steps) * chartH;

      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.fillText(String(yVal), padLeft - 8, y);
    }

    const colCount = trendItems.length || 7;
    const groupW = chartW / colCount;
    const barW = Math.min(14, Math.max(7, (groupW - 18) / 3));

    const drawRoundedTopBar = (x, y, w, h, fill) => {
      const r = Math.min(4, h / 2, w / 2);
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };

    trendItems.forEach((item, idx) => {
      const centerX = padLeft + idx * groupW + groupW / 2;
      const startX = centerX - (barW * 3 + 6) / 2;

      // Thứ tự lần lượt: Số công việc trong ngày -> Quá hạn (Màu đỏ) -> Đã làm xong (Xanh lá)
      const series = [
        { val: item.due_tasks || 0, color: "#F59E0B" },
        { val: item.overdue_tasks || 0, color: "#EF4444" },
        { val: item.completed_tasks || 0, color: "#10B981" },
      ];

      series.forEach((ser, sIdx) => {
        const bx = startX + sIdx * (barW + 3);
        const rawH = (ser.val / maxVal) * chartH;
        const bh = Math.max(5, rawH);
        const by = padTop + chartH - bh;
        drawRoundedTopBar(bx, by, barW, bh, ser.color);

        if (ser.val > 0) {
          ctx.fillStyle = isDark ? "#E2E8F0" : "#334155";
          ctx.font =
            '700 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          ctx.textAlign = "center";
          ctx.fillText(String(ser.val), bx + barW / 2, by - 8);
        }
      });

      ctx.fillStyle = textColor;
      ctx.font =
        '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(item.label, centerX, height - 14);
    });
  },

  drawDonutCanvas(canvas, segments, totalTasks) {
    const dpr = window.devicePixelRatio || 1;
    const size = 168;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    const cx = size / 2;
    const cy = size / 2;
    const r = 60;
    const thickness = 20;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = isDark ? "#334155" : "#E2E8F0";
    ctx.lineWidth = thickness;
    ctx.stroke();

    const sumSegs = segments.reduce((acc, s) => acc + (s.count || 0), 0);
    if (sumSegs > 0) {
      let curAngle = -Math.PI / 2;
      segments.forEach((seg) => {
        if (!seg.count) return;
        const sliceAngle = (seg.count / sumSegs) * (Math.PI * 2);
        ctx.beginPath();
        ctx.arc(cx, cy, r, curAngle, curAngle + sliceAngle);
        ctx.strokeStyle = seg.color;
        ctx.lineWidth = thickness;
        ctx.stroke();
        curAngle += sliceAngle;
      });
    }

    ctx.fillStyle = isDark ? "#F8FAFC" : "#0F172A";
    ctx.font =
      '800 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(totalTasks || 0), cx, cy - 7);

    ctx.fillStyle = isDark ? "#94A3B8" : "#64748B";
    ctx.font =
      '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText("Tổng mục", cx, cy + 14);
  },

  renderContent(pageEl, data) {
    pageEl.innerHTML = "";

    const user = store.get("user") || {};
    const s = data?.summary || {};
    const breakdown = data?.status_breakdown || {};
    const todayColumnCount = breakdown.in_my_day || 0;
    const hour = businessNow().getHours();
    const greeting =
      hour < 12
        ? "Chào buổi sáng"
        : hour < 18
          ? "Chào buổi chiều"
          : "Chào buổi tối";

    // 1. HERO BANNER
    const score = s.productivity_score;
    const scoreStatus =
      score == null
        ? "Chưa có dữ liệu"
        : score >= 80
          ? "Xuất sắc"
          : score >= 60
            ? "Tốt"
            : "Cần tăng tốc";
    const scoreCanvas = createElement("canvas");

    const heroBanner = createElement(
      "section",
      { className: "dash-hero-banner" },
      [
        createElement("div", { className: "dash-hero-left" }, [
          createElement("div", {
            style: { fontSize: "12px", fontWeight: "600", opacity: "0.9" },
            textContent: formatVietnameseDate(businessNow(), true),
          }),
          createElement("h1", {
            className: "dash-hero-greeting",
            textContent: `${greeting}, ${user.nickname || "bạn"}!`,
          }),
          createElement("p", {
            className: "dash-hero-subtitle",
            textContent: `Hôm nay bạn có ${todayColumnCount} công việc trong cột Hôm nay, ${s.overdue_count || 0} việc quá hạn và đã hoàn thành ${s.completion_rate || 0}% khối lượng công\u00A0việc.`,
          }),
          createElement("div", { className: "dash-hero-actions" }, [
            createElement("button", {
              className: "btn-dash-white",
              textContent: "＋ Tạo Công việc",
              onclick: () =>
                EventForm.showFullModal({
                  hasDate: false,
                  onCreated: () => this.loadAndRender(pageEl),
                }),
            }),
            createElement("button", {
              className: "btn-dash-glass",
              textContent: "📋 Mở Bảng Quản Lý Chung",
              onclick: () => {
                store.set("activeTodoList", "board");
                window.location.hash = "#todo";
              },
            }),
            createElement("button", {
              className: "btn-dash-glass",
              textContent: "📅 Mở Lịch Tháng",
              onclick: () => {
                store.set("calendarView", "month");
                window.location.hash = "#calendar";
              },
            }),
          ]),
        ]),
        createElement("div", { className: "dash-score-card" }, [
          createElement("div", { className: "dash-score-ring-wrap" }, [
            scoreCanvas,
          ]),
          createElement("div", { className: "dash-score-info" }, [
            createElement("span", {
              className: "dash-score-title",
              textContent: "Điểm Năng Suất",
            }),
            createElement("span", {
              className: "dash-score-status",
              textContent: scoreStatus,
            }),
            createElement("span", {
              style: { fontSize: "11px", opacity: "0.88" },
              textContent: `Hoàn thành hôm nay: ${s.completed_today_count || 0} mục`,
            }),
          ]),
        ]),
      ],
    );

    // 2. KPI METRIC CARDS (Aligned with the 4 Kanban Columns + Important)
    const needToDoCount =
      (breakdown.unscheduled || 0) + (breakdown.scheduled || 0);
    const kpiData = [
      {
        bg: "rgba(99, 102, 241, 0.15)",
        color: "#6366F1",
        title: "Cần làm",
        value: `${needToDoCount}`,
        label: "Việc cần làm sắp tới",
      },
      {
        bg: "rgba(245, 158, 11, 0.15)",
        color: "#F59E0B",
        title: "Hôm nay",
        value: `${todayColumnCount}`,
        label: "Công việc & sự kiện hôm nay",
      },
      {
        bg: "rgba(239, 68, 68, 0.15)",
        color: "#EF4444",
        title: "Quá hạn",
        value: `${s.overdue_count || 0}`,
        label: s.overdue_count > 0 ? "Cần xử lý ngay" : "Không có việc quá hạn",
      },
      {
        bg: "rgba(16, 185, 129, 0.15)",
        color: "#10B981",
        title: "Đã hoàn thành",
        value: `${s.completed_tasks || 0}`,
        label: `Trên tổng số ${s.total_tasks || 0} việc (${s.completion_rate || 0}%)`,
      },
      {
        bg: "rgba(236, 72, 153, 0.15)",
        color: "#EC4899",
        title: "Quan trọng",
        value: `${s.important_pending_count || 0}`,
        label: "Việc quan trọng chưa xong",
      },
    ];

    const kpiGrid = createElement(
      "section",
      { className: "dash-kpi-grid" },
      kpiData.map((k) =>
        createElement("div", { className: "dash-kpi-card" }, [
          createElement("div", { className: "dash-kpi-top" }, [
            createElement("span", {
              className: "dash-kpi-badge",
              style: { backgroundColor: k.bg, color: k.color },
              textContent: k.title,
            }),
          ]),
          createElement("div", {
            className: "dash-kpi-value",
            textContent: k.value,
          }),
          createElement("div", {
            className: "dash-kpi-label",
            textContent: k.label,
          }),
        ]),
      ),
    );

    // 3. CHARTS ROW
    const rawTrend = Array.isArray(data?.weekly_trend) ? data.weekly_trend : [];
    const trendItems = this.mergeWithSnapshot(rawTrend);

    const barCanvas = createElement("canvas", { id: "dash-weekly-bar-canvas" });
    const barChartCard = createElement(
      "div",
      { className: "dash-panel-card" },
      [
        createElement("div", { className: "dash-panel-header" }, [
          createElement("div", {}, [
            createElement("h3", {
              className: "dash-panel-title",
              textContent: "Hoạt động & năng suất 7 ngày",
            }),
            createElement("p", {
              className: "dash-panel-subtitle",
              textContent:
                "So sánh việc trong ngày, quá hạn và đã làm xong theo từng ngày",
            }),
          ]),
          createElement("div", { className: "dash-bar-legend" }, [
            createElement("div", { className: "dash-legend-item" }, [
              createElement("span", {
                className: "dash-legend-dot",
                style: { backgroundColor: "#F59E0B" },
              }),
              createElement("span", { textContent: "Việc trong ngày" }),
            ]),
            createElement("div", { className: "dash-legend-item" }, [
              createElement("span", {
                className: "dash-legend-dot",
                style: { backgroundColor: "#EF4444" },
              }),
              createElement("span", { textContent: "Quá hạn" }),
            ]),
            createElement("div", { className: "dash-legend-item" }, [
              createElement("span", {
                className: "dash-legend-dot",
                style: { backgroundColor: "#10B981" },
              }),
              createElement("span", { textContent: "Đã làm xong" }),
            ]),
          ]),
        ]),
        createElement(
          "div",
          { className: "dash-canvas-box" },
          trendItems.length
            ? [barCanvas]
            : [
                createElement("p", {
                  textContent: "Chưa có dữ liệu hoạt động 7 ngày.",
                }),
              ],
        ),
      ],
    );

    const donutSegments = [
      {
        key: "todo",
        label: "Cần làm",
        count: needToDoCount,
        color: "#6366F1",
      },
      {
        key: "today",
        label: "Hôm nay",
        count: todayColumnCount,
        color: "#F59E0B",
      },
      {
        key: "overdue",
        label: "Quá hạn",
        count: s.overdue_count || 0,
        color: "#EF4444",
      },
      {
        key: "completed",
        label: "Hoàn thành",
        count: breakdown.completed || 0,
        color: "#10B981",
      },
    ];

    const donutCanvas = createElement("canvas");
    const donutCard = createElement("div", { className: "dash-panel-card" }, [
      createElement("div", { className: "dash-panel-header" }, [
        createElement("div", {}, [
          createElement("h3", {
            className: "dash-panel-title",
            textContent: "Phân bổ trạng thái công việc",
          }),
          createElement("p", {
            className: "dash-panel-subtitle",
            textContent: "Tổng số mục theo từng cột trên bảng quản lý chung",
          }),
        ]),
      ]),
      createElement("div", { className: "dash-donut-layout" }, [
        createElement("div", { className: "dash-donut-canvas-wrap" }, [
          donutCanvas,
        ]),
        createElement(
          "div",
          { className: "dash-donut-legend" },
          donutSegments.map((seg) =>
            createElement(
              "div",
              {
                className: "dash-donut-legend-row",
              },
              [
                createElement(
                  "div",
                  { className: "flex items-center gap-xs" },
                  [
                    createElement("span", {
                      className: "dash-legend-dot",
                      style: { backgroundColor: seg.color },
                    }),
                    createElement("span", {
                      style: { fontWeight: "600" },
                      textContent: seg.label,
                    }),
                  ],
                ),
                createElement("span", {
                  style: { fontWeight: "800" },
                  textContent: `${seg.count}`,
                }),
              ],
            ),
          ),
        ),
      ]),
    ]);

    const chartsRow = createElement(
      "section",
      { className: "dash-charts-grid" },
      [barChartCard, donutCard],
    );

    // 4. SECONDARY ROW: PRIORITY OVERVIEW & CUSTOM LISTS PROGRESS
    const myDayTasks = data?.tasks_my_day || [];
    const impTasks = data?.tasks_important || [];
    const overdueTasks = data?.tasks_overdue || [];

    const quadrants = [
      {
        title: "Công việc & sự kiện hôm nay",
        color: "#F59E0B",
        items: myDayTasks.filter((t) => !t.is_completed).slice(0, 4),
      },
      {
        title: "Việc quan trọng",
        color: "#EC4899",
        items: impTasks.filter((t) => !t.is_completed).slice(0, 4),
      },
      {
        title: "Công việc quá hạn cần xử lý",
        color: "#EF4444",
        items: overdueTasks.slice(0, 4),
      },
      {
        title: "Việc cần làm sắp tới",
        color: "#6366F1",
        items: (data?.tasks_todo || []).slice(0, 4),
      },
    ];

    const eisenhowerCard = createElement(
      "div",
      { className: "dash-panel-card" },
      [
        createElement("div", { className: "dash-panel-header" }, [
          createElement("div", {}, [
            createElement("h3", {
              className: "dash-panel-title",
              textContent: "Tóm tắt công việc",
            }),
            createElement("p", {
              className: "dash-panel-subtitle",
              textContent: "Bấm ô tròn cạnh công việc để đánh dấu hoàn thành",
            }),
          ]),
        ]),
        createElement(
          "div",
          { className: "eisenhower-grid" },
          quadrants.map((q) =>
            createElement("div", { className: "eisenhower-quadrant" }, [
              createElement(
                "div",
                { className: "eisenhower-q-header", style: { color: q.color } },
                [
                  createElement("span", { textContent: q.title }),
                  createElement("span", { textContent: `${q.items.length}` }),
                ],
              ),
              q.items.length === 0
                ? createElement("div", {
                    style: {
                      fontSize: "12px",
                      color: "var(--color-text-muted)",
                      fontStyle: "italic",
                      marginTop: "8px",
                    },
                    textContent: "Không có mục tồn đọng",
                  })
                : createElement(
                    "div",
                    { className: "eisenhower-q-list" },
                    q.items.map((t) =>
                      createElement(
                        "div",
                        { className: "eisenhower-task-pill" },
                        [
                          createElement("button", {
                            type: "button",
                            className: "dash-task-complete",
                            "aria-label": `Hoàn thành công việc: ${t.title}`,
                            title: "Đánh dấu hoàn thành",
                            onclick: async (event) => {
                              const button = event.currentTarget;
                              if (button.disabled) return;
                              button.disabled = true;
                              const pill = button.closest(".eisenhower-task-pill");
                              if (pill) pill.classList.add("dash-completing");
                              try {
                                await api.patch(
                                  `/tasks/${t.id}/complete`,
                                  { is_completed: true },
                                  revisionOptions(t),
                                );
                                soundManager.playTaskComplete();
                                Toast.success(`Đã hoàn thành: "${t.title}"`);
                                await this.loadAndRender(pageEl, { silent: true });
                                window.dispatchEvent(
                                  new CustomEvent("planify:data-changed", { detail: { source: "dashboard-complete" } }),
                                );
                              } catch (err) {
                                if (pill) pill.classList.remove("dash-completing");
                                Toast.error(
                                  err.message ||
                                    "Không thể cập nhật công việc.",
                                );
                              } finally {
                                button.disabled = false;
                              }
                            },
                          }),
                          createElement("span", {
                            className: "dash-task-title truncate flex-1",
                            textContent: t.title,
                          }),
                        ],
                      ),
                    ),
                  ),
            ]),
          ),
        ),
      ],
    );

    const listBreakdown = data?.list_breakdown || [];
    const listProgressCard = createElement(
      "div",
      { className: "dash-panel-card" },
      [
        createElement("div", { className: "dash-panel-header" }, [
          createElement("div", {}, [
            createElement("h3", {
              className: "dash-panel-title",
              textContent: "Tiến độ danh sách của tôi",
            }),
            createElement("p", {
              className: "dash-panel-subtitle",
              textContent: "Tỷ lệ hoàn thành công việc trong từng danh sách",
            }),
          ]),
        ]),
        listBreakdown.length === 0
          ? createElement("div", {
              style: { fontSize: "13px", color: "var(--color-text-secondary)" },
              textContent: "Chưa có danh sách nào.",
            })
          : createElement(
              "div",
              { className: "dash-list-progress-items" },
              listBreakdown.map((lst) =>
                createElement(
                  "div",
                  {
                    className: "dash-list-prog-row",
                  },
                  [
                    createElement("div", { className: "dash-list-prog-top" }, [
                      createElement("span", { textContent: lst.name }),
                      createElement("span", {
                        style: {
                          fontSize: "12px",
                          color: "var(--color-text-secondary)",
                        },
                        textContent: `${lst.completed}/${lst.total} (${lst.completion_rate}%)`,
                      }),
                    ]),
                    createElement(
                      "div",
                      { className: "dash-list-prog-track" },
                      [
                        createElement("div", {
                          className: "dash-list-prog-fill",
                          style: {
                            width: `${lst.completion_rate}%`,
                            backgroundColor: lst.color || "#4F46E5",
                          },
                        }),
                      ],
                    ),
                  ],
                ),
              ),
            ),
      ],
    );

    const secondaryRow = createElement(
      "section",
      { className: "dash-secondary-grid" },
      [eisenhowerCard, listProgressCard],
    );

    pageEl.appendChild(heroBanner);
    pageEl.appendChild(kpiGrid);
    pageEl.appendChild(chartsRow);
    pageEl.appendChild(secondaryRow);

    requestAnimationFrame(() => {
      this.drawScoreRingCanvas(scoreCanvas, score);
      if (trendItems.length) this.drawWeeklyTrendCanvas(barCanvas, trendItems);
      this.drawDonutCanvas(donutCanvas, donutSegments, s.total_tasks || 0);
    });
  },

  destroy() {
    this.generation = (this.generation || 0) + 1;
    if (this.themeListener) {
      this.themeListener();
      this.themeListener = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.dataChangedHandler) {
      window.removeEventListener(
        "planify:data-changed",
        this.dataChangedHandler,
      );
      document.removeEventListener("task-changed", this.dataChangedHandler);
      this.dataChangedHandler = null;
    }
    if (this.container) {
      this.container.innerHTML = "";
      this.container = null;
    }
  },
};
