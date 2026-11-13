import { createElement } from "../utils/dom.js";
import { Modal } from "./modal.js";
import { api } from "../api.js";
import { ThemeManager } from "../theme.js";
import { EventForm } from "../calendar/event-form.js";

export class CommandPalette {
  static modalRef = null;

  static init() {
    const triggerBtn = document.getElementById("btn-command-palette");
    if (triggerBtn) {
      triggerBtn.addEventListener("click", () => this.open());
    }
  }

  static async open() {
    const searchInput = createElement("input", {
      type: "text",
      className: "input",
      placeholder:
        "Gõ tên công việc hoặc lệnh nhanh (VD: tạo việc, lịch, AI, giao diện)...",
      style: { fontSize: "14px", padding: "10px 14px" },
    });

    const resultsList = createElement("div", {
      className: "flex flex-col gap-xs",
      style: { maxHeight: "340px", overflowY: "auto", marginTop: "10px" },
    });

    let tasks = [];
    try {
      tasks = (await api.get("/tasks")) || [];
    } catch (_) {}

    const baseCommands = [
      {
        icon: "📊",
        label: "Mở trang Dashboard (Biểu đồ thống kê)",
        action: () => {
          window.location.hash = "#dashboard";
        },
      },
      {
        icon: "📋",
        label: "Mở Bảng quản lý chung (Kanban 4 cột)",
        action: () => {
          window.location.hash = "#todo";
        },
      },
      {
        icon: "📅",
        label: "Mở trang Calendar (Lịch Tháng mặc định)",
        action: () => {
          window.location.hash = "#calendar";
        },
      },
      {
        icon: "🤖",
        label: "Mở trang AI Assistant (Trợ lý thông minh)",
        action: () => {
          window.location.hash = "#ai";
        },
      },
      {
        icon: "📖",
        label: "Mở trang Hướng dẫn sử dụng",
        action: () => {
          window.location.hash = "#guide";
        },
      },
      {
        icon: "⚙️",
        label: "Mở Cài đặt Thông báo & Giao diện",
        action: () => {
          window.location.hash = "#settings";
        },
      },
      {
        icon: "➕",
        label: "Tạo Công việc (Biểu mẫu thống nhất)",
        action: () => {
          EventForm.showFullModal({ hasDate: false });
        },
      },
      {
        icon: "☀/☾",
        label: "Chuyển đổi giao diện Sáng / Tối (Light/Dark Mode)",
        action: () => {
          ThemeManager.toggle();
        },
      },
    ];

    const renderItems = (query = "") => {
      resultsList.innerHTML = "";
      const q = query.trim().toLowerCase();

      const matchedCmds = baseCommands.filter(
        (c) => !q || c.label.toLowerCase().includes(q),
      );
      const matchedTasks = (tasks || [])
        .filter((t) => q && (t.title || "").toLowerCase().includes(q))
        .slice(0, 6);

      const addRow = (icon, title, badgeText, onClick) => {
        const row = createElement(
          "div",
          {
            className:
              "flex items-center justify-between p-sm rounded cursor-pointer",
            style: {
              padding: "9px 12px",
              borderRadius: "8px",
              backgroundColor: "var(--color-bg-primary)",
              border: "1px solid var(--color-border-light)",
            },
            onclick: () => {
              if (this.modalRef) this.modalRef.close();
              onClick();
            },
          },
          [
            createElement(
              "div",
              { className: "flex items-center gap-sm truncate" },
              [
                createElement("span", { className: "command-result-icon", textContent: icon }),
                createElement("span", {
                  className: "truncate",
                  style: { fontSize: "13px", fontWeight: "600" },
                  textContent: title,
                }),
              ],
            ),
            createElement("span", {
              style: {
                fontSize: "11px",
                color: "var(--color-text-tertiary)",
                flexShrink: 0,
              },
              textContent: badgeText,
            }),
          ],
        );
        resultsList.appendChild(row);
      };

      matchedTasks.forEach((t) => {
        const icon = t.is_completed ? "✅" : "📌";
        const label = t.due_date
          ? `Lịch: ${t.due_date}`
          : "Cột Cần làm (Vĩnh viễn)";
        addRow(icon, t.title, label, () => {
          EventForm.showFullModal({ task: t });
        });
      });

      matchedCmds.forEach((cmd) => {
        addRow(cmd.icon, cmd.label, "Lệnh nhanh", cmd.action);
      });

      if (resultsList.children.length === 0) {
        resultsList.appendChild(
          createElement("div", {
            style: {
              padding: "24px",
              textAlign: "center",
              color: "var(--color-text-tertiary)",
              fontSize: "13px",
            },
            textContent: "Không tìm thấy kết quả phù hợp.",
          }),
        );
      }
    };

    searchInput.addEventListener("input", (e) => renderItems(e.target.value));
    renderItems("");

    const content = createElement("div", { className: "flex flex-col" }, [
      searchInput,
      resultsList,
    ]);

    this.modalRef = Modal.open({
      title: "🔍 Tìm kiếm & Lệnh nhanh (Command Palette)",
      content,
      width: "560px",
    });

    setTimeout(() => searchInput.focus(), 60);
  }
}
