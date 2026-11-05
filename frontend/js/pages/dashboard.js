import { businessNow } from "../utils/date.js";
import { createElement } from "../utils/dom.js";
import { api } from "../api.js";
import { store } from "../store.js";
import { Toast } from "../components/toast.js";
import { EventForm } from "../calendar/event-form.js";
import { formatVietnameseDate } from "../utils/date.js";
import { soundManager } from "../utils/sound.js";
import { revisionOptions } from "../utils/revision.js";

function uiColor(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#667085"; }

export const dashboardPage = {
  container: null,
  stats: null,
  dataChangedHandler: null,
  themeListener: null,
  resizeHandler: null,

  async render(container) {
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
    const size = 48;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const r = 18;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = uiColor("--color-border");
    ctx.lineWidth = 4;
    ctx.stroke();

    if (score != null) {
      const startAngle = -Math.PI / 2;
      const endAngle =
        startAngle + (Math.max(0, Math.min(100, score)) / 100) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.strokeStyle = uiColor("--color-primary");
      ctx.lineWidth = 6.5;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    ctx.fillStyle = uiColor("--color-text-primary");
    ctx.font =
      '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
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
        { val: item.due_tasks || 0, color: uiColor("--color-warning") },
        { val: item.overdue_tasks || 0, color: uiColor("--color-danger") },
        { val: item.completed_tasks || 0, color: uiColor("--color-success") },
      ];

      series.forEach((ser, sIdx) => {
        const bx = startX + sIdx * (barW + 3);
        const rawH = (ser.val / maxVal) * chartH;
        const bh = Math.max(0, rawH);
        const by = padTop + chartH - bh;
        if (bh > 0) drawRoundedTopBar(bx, by, barW, bh, ser.color);

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

    const scoreCard = createElement("div", { className: "dash-score-card" }, [
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
              style: { fontSize: "12px", color: "var(--color-text-secondary)" },
              textContent: `Hoàn thành hôm nay: ${s.completed_today_count || 0} mục`,
            }),
          ]),
        ]);

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
              textContent: "Mở Công việc",
              onclick: () => {
                store.set("activeTodoList", "board");
                window.location.hash = "#todo";
              },
            }),
            createElement("button", {
              className: "btn-dash-glass",
              textContent: "Mở Lịch",
              onclick: () => {
                store.set("calendarView", "month");
                window.location.hash = "#calendar";
              },
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
        title: "Cần làm",
        value: `${needToDoCount}`,
        label: "Việc cần làm sắp tới",
      },
      {
        title: "Hôm nay",
        value: `${todayColumnCount}`,
        label: "Công việc & sự kiện hôm nay",
      },
      {
        title: "Quá hạn",
        value: `${s.overdue_count || 0}`,
        label: s.overdue_count > 0 ? "Cần xử lý ngay" : "Không có việc quá hạn",
      },
      {
        title: "Đã hoàn thành",
        value: `${s.completed_tasks || 0}`,
        label: `Trên tổng số ${s.total_tasks || 0} việc (${s.completion_rate || 0}%)`,
      },
      {
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
                style: { backgroundColor: uiColor("--color-warning") },
              }),
              createElement("span", { textContent: "Việc trong ngày" }),
            ]),
            createElement("div", { className: "dash-legend-item" }, [
              createElement("span", {
                className: "dash-legend-dot",
                style: { backgroundColor: uiColor("--color-danger") },
              }),
              createElement("span", { textContent: "Quá hạn" }),
            ]),
            createElement("div", { className: "dash-legend-item" }, [
              createElement("span", {
                className: "dash-legend-dot",
                style: { backgroundColor: uiColor("--color-success") },
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
        color: uiColor("--color-primary"),
      },
      {
        key: "today",
        label: "Hôm nay",
        count: todayColumnCount,
        color: uiColor("--color-warning"),
      },
      {
        key: "overdue",
        label: "Quá hạn",
        count: s.overdue_count || 0,
        color: uiColor("--color-danger"),
      },
      {
        key: "completed",
        label: "Hoàn thành",
        count: breakdown.completed || 0,
        color: uiColor("--color-success"),
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
                  style: { fontWeight: "600" },
                  textContent: `${seg.count}`,
                }),
              ],
            ),
          ),
        ),
      ]),
    ]);

    // 4. SECONDARY ROW: PRIORITY OVERVIEW & CUSTOM LISTS PROGRESS
    const myDayTasks = data?.tasks_my_day || [];
    const impTasks = data?.tasks_important || [];
    const overdueTasks = data?.tasks_overdue || [];

    const quadrants = [
      {
        title: "Công việc & sự kiện hôm nay",
        color: uiColor("--color-warning"),
        items: myDayTasks.filter((t) => !t.is_completed).slice(0, 4),
      },
      {
        title: "Việc quan trọng",
        color: uiColor("--color-text-secondary"),
        items: impTasks.filter((t) => !t.is_completed).slice(0, 4),
      },
      {
        title: "Công việc quá hạn cần xử lý",
        color: uiColor("--color-danger"),
        items: overdueTasks.slice(0, 4),
      },
      {
        title: "Việc cần làm sắp tới",
        color: uiColor("--color-primary"),
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
                { className: "eisenhower-q-header", style: { color: q.title.includes("quá hạn") ? "var(--color-danger)" : "var(--color-text-primary)" } },
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
                            backgroundColor: lst.color || uiColor("--color-accent"),
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

    const chartsRow = createElement(
      "section",
      { className: "dash-overview-grid" },
      [eisenhowerCard, barChartCard],
    );

    const secondaryRow = createElement(
      "section",
      { className: "dash-secondary-grid" },
      [donutCard, listProgressCard],
    );

    pageEl.appendChild(heroBanner);
    pageEl.appendChild(kpiGrid);
    pageEl.appendChild(chartsRow);
    pageEl.appendChild(secondaryRow);
    pageEl.appendChild(scoreCard);

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
