import { createElement } from "../utils/dom.js";
import { store } from "../store.js";
import { ThemeManager } from "../theme.js";
import { AuthManager } from "../auth.js";
import { ReminderNotifier } from "../components/reminder-notifier.js";
import { Toast } from "../components/toast.js";
import { api } from "../api.js";
import { buildCalendarIcs } from "../utils/ical.js";

export const settingsPage = {
  container: null,
  otpCountdownInterval: null,

  async render(container) {
    const generation = (this.generation = (this.generation || 0) + 1);
    this.container = container;
    container.innerHTML = "";

    const page = createElement("div", { className: "settings-page" });
    const inner = createElement("div", { className: "settings-inner" });

    const currentTheme = ThemeManager.getSavedTheme();

    let user = store.get("user");
    const userId = user?.id;
    const isCurrent = () => generation === this.generation && this.container === container && store.get('user')?.id === userId;
    try {
      const response = await api.get("/users/me");
      if (!isCurrent())
        return;
      user = response?.data || response;
      store.set("user", user);
    } catch (_) {
      if (generation !== this.generation || !AuthManager.isAuthenticated())
        return;
      user = user || {};
    }

    let categories = [];
    try {
      const catRes = await api.get("/categories");
      if (!isCurrent())
        return;
      categories = Array.isArray(catRes)
        ? catRes
        : Array.isArray(catRes?.data)
          ? catRes.data
          : [];
      store.set("categories", categories);
    } catch (_) {
      if (generation !== this.generation || !AuthManager.isAuthenticated())
        return;
      categories = store.get("categories") || [];
    }

    // 0. Cài đặt màu thẻ & Phân loại công việc
    function makeTagSvg(color, size = 16) {
      return createElement("span", {
        style: {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: color || "#4F46E5",
          flexShrink: "0",
          lineHeight: "1",
        },
        innerHTML: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" fill="currentColor" fill-opacity="0.22"></path><circle cx="7" cy="7" r="1.5" fill="currentColor"></circle></svg>`,
      });
    }

    let editingCategoryId = null;

    const categoryTagsContainer = createElement("div", {
      className: "category-tags-list",
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        alignItems: "center",
        marginBottom: "12px",
      },
    });

    const newTagNameInput = createElement("input", {
      id: "settings-new-tag-name",
      type: "text",
      className: "input",
      placeholder: "Tên thẻ (ví dụ: Khẩn cấp, Cá nhân...)",
      maxLength: 50,
      style: { flex: "1", minWidth: "180px" },
    });

    const newTagColorInput = createElement("input", {
      id: "settings-new-tag-color",
      type: "color",
      className: "input",
      value: "#4F46E5",
      style: {
        width: "44px",
        height: "38px",
        padding: "2px",
        cursor: "pointer",
        borderRadius: "8px",
      },
    });

    const formTagIconPreview = makeTagSvg(newTagColorInput.value, 20);

    const presetColors = [
      "#EF4444", "#F97316", "#F59E0B", "#10B981", "#06B6D4",
      "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899", "#64748B",
    ];

    const swatchesContainer = createElement("div", {
      style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" },
    });

    const updateColorState = (hex) => {
      newTagColorInput.value = hex;
      formTagIconPreview.style.color = hex;
      swatchesContainer.querySelectorAll("button").forEach((btn) => {
        const btnTitle = btn.getAttribute("title") || btn.title || "";
        btn.style.border = btnTitle.toLowerCase() === (hex || "").toLowerCase()
          ? "2px solid var(--color-text-primary)"
          : "2px solid transparent";
      });
    };

    presetColors.forEach((hex) => {
      const swatch = createElement("button", {
        type: "button",
        style: {
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          backgroundColor: hex,
          border: newTagColorInput.value.toLowerCase() === hex.toLowerCase() ? "2px solid var(--color-text-primary)" : "2px solid transparent",
          cursor: "pointer",
          padding: "0",
          outline: "none",
        },
        title: hex,
        onclick: () => updateColorState(hex),
      });
      swatchesContainer.appendChild(swatch);
    });

    newTagColorInput.addEventListener("input", () => {
      updateColorState(newTagColorInput.value);
    });

    const formHeading = createElement("div", {
      style: {
        fontSize: "13px",
        fontWeight: "700",
        marginBottom: "10px",
        color: "var(--color-text-primary)",
      },
      textContent: "+ Tạo thẻ phân loại mới",
    });

    const addTagForm = createElement("div", {
      style: {
        display: "none",
        padding: "14px",
        borderRadius: "12px",
        backgroundColor: "var(--color-bg-secondary)",
        border: "1px solid var(--color-border-light)",
        marginTop: "10px",
      },
    });

    const showAddTagBtn = createElement("button", {
      type: "button",
      className: "btn btn-secondary",
      textContent: "+ Thêm tag",
      style: {
        padding: "6px 14px",
        fontSize: "13px",
        border: "1px dashed var(--color-border)",
      },
      onclick: () => {
        editingCategoryId = null;
        formHeading.textContent = "+ Tạo thẻ phân loại mới";
        newTagNameInput.value = "";
        updateColorState("#4F46E5");
        saveTagBtn.textContent = "Lưu thẻ";
        addTagForm.style.display = "block";
        newTagNameInput.focus();
      },
    });

    const cancelTagBtn = createElement("button", {
      type: "button",
      className: "btn btn-secondary",
      textContent: "Hủy",
      style: { padding: "6px 14px", fontSize: "13px" },
      onclick: () => {
        addTagForm.style.display = "none";
        newTagNameInput.value = "";
        editingCategoryId = null;
      },
    });

    const saveTagBtn = createElement("button", {
      type: "button",
      className: "btn btn-primary",
      textContent: "Lưu thẻ",
      style: { padding: "6px 14px", fontSize: "13px" },
      onclick: async () => {
        if (saveTagBtn.disabled) return;
        const name = newTagNameInput.value.trim();
        const color = newTagColorInput.value;
        if (!name) {
          Toast.error("Vui lòng nhập tên thẻ.");
          newTagNameInput.focus();
          return;
        }
        saveTagBtn.disabled = true;
        saveTagBtn.textContent = editingCategoryId ? "Đang cập nhật..." : "Đang lưu...";
        try {
          if (editingCategoryId) {
            const res = await api.put(`/categories/${editingCategoryId}`, { name, color });
            if (!isCurrent()) return;
            const updatedCat = res?.data || res;
            const idx = categories.findIndex((c) => c.id === editingCategoryId);
            if (idx !== -1) {
              categories[idx] = { ...categories[idx], ...updatedCat, name, color };
            }
            store.set("categories", [...categories]);
            Toast.success(`Đã cập nhật thẻ "${name}" thành công!`);
          } else {
            const res = await api.post("/categories", { name, color });
            if (!isCurrent()) return;
            const createdCat = res?.data || res;
            categories.push(createdCat);
            store.set("categories", [...categories]);
            Toast.success(`Đã tạo thẻ phân loại "${name}" thành công!`);
          }
          renderTagsList();
          addTagForm.style.display = "none";
          newTagNameInput.value = "";
          editingCategoryId = null;
          window.dispatchEvent(new CustomEvent("planify:data-changed"));
        } catch (err) {
          Toast.error(err.message || "Không thể lưu thẻ phân loại.");
        } finally {
          saveTagBtn.disabled = false;
          saveTagBtn.textContent = editingCategoryId ? "Cập nhật thẻ" : "Lưu thẻ";
        }
      },
    });

    const startEditTag = (cat) => {
      editingCategoryId = cat.id;
      formHeading.textContent = `✏️ Chỉnh sửa thẻ: ${cat.name}`;
      newTagNameInput.value = cat.name;
      updateColorState(cat.color || "#4F46E5");
      saveTagBtn.textContent = "Cập nhật thẻ";
      addTagForm.style.display = "block";
      newTagNameInput.focus();
    };

    const renderTagsList = () => {
      categoryTagsContainer.innerHTML = "";
      if (categories.length === 0) {
        categoryTagsContainer.appendChild(
          createElement("span", {
            style: {
              fontSize: "13px",
              color: "var(--color-text-secondary)",
              fontStyle: "italic",
            },
            textContent: "Chưa có thẻ phân loại nào. Bấm \"+ Thêm tag\" để bắt đầu.",
          }),
        );
      } else {
        categories.forEach((cat) => {
          const pill = createElement("div", {
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "16px",
              backgroundColor: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border-light)",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "transform 0.1s ease, border-color 0.15s ease",
            },
            title: "Bấm để đổi tên hoặc sửa màu thẻ này",
            onclick: () => startEditTag(cat),
          }, [
            makeTagSvg(cat.color || "#4F46E5", 15),
            createElement("span", { textContent: cat.name }),
            createElement("button", {
              type: "button",
              style: {
                border: "none",
                background: "transparent",
                color: "var(--color-text-muted)",
                cursor: "pointer",
                padding: "0 2px",
                marginLeft: "2px",
                fontSize: "14px",
                lineHeight: "1",
              },
              title: "Xóa thẻ này",
              textContent: "×",
              onclick: async (e) => {
                e.stopPropagation();
                if (!confirm(`Bạn có chắc chắn muốn xóa thẻ \"${cat.name}\" không?`)) return;
                try {
                  await api.delete(`/categories/${cat.id}`);
                  if (!isCurrent()) return;
                  categories = categories.filter((c) => c.id !== cat.id);
                  store.set("categories", [...categories]);
                  if (editingCategoryId === cat.id) {
                    addTagForm.style.display = "none";
                    editingCategoryId = null;
                  }
                  renderTagsList();
                  window.dispatchEvent(new CustomEvent("planify:data-changed"));
                  Toast.success(`Đã xóa thẻ \"${cat.name}\".`);
                } catch (err) {
                  Toast.error(err.message || "Không thể xóa thẻ.");
                }
              },
            }),
          ]);
          categoryTagsContainer.appendChild(pill);
        });
      }
    };

    addTagForm.appendChild(
      createElement("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } }, [
        formHeading,
        createElement("div", { style: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" } }, [
          formTagIconPreview,
          newTagNameInput,
          newTagColorInput,
          swatchesContainer,
        ]),
        createElement("div", { style: { display: "flex", gap: "8px" } }, [
          saveTagBtn,
          cancelTagBtn,
        ]),
      ]),
    );

    renderTagsList();

    const categorySection = createElement("div", { className: "settings-section" }, [
      createElement("h2", {
        className: "settings-section-title",
        textContent: "🏷️ Cài đặt màu thẻ & Phân loại công việc",
      }),
      createElement("p", {
        style: {
          fontSize: "13px",
          color: "var(--color-text-secondary)",
          margin: "-6px 0 12px 0",
        },
        textContent: "Tạo các nhãn thẻ màu sắc để phân loại và nhận diện công việc trên lịch biểu dễ dàng hơn.",
      }),
      categoryTagsContainer,
      createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
        showAddTagBtn,
      ]),
      addTagForm,
    ]);

    // 1. Appearance Section (2 opciones: Light & Dark — đã bỏ Tự động theo hệ thống)
    const themeSection = createElement(
      "div",
      { className: "settings-section" },
      [
        createElement("h2", {
          className: "settings-section-title",
          textContent: "🎨 Giao diện & Chủ đề",
        }),
        createElement("div", { className: "theme-options-grid" }, [
          createElement(
            "div",
            {
              className: `theme-card ${currentTheme !== "dark" ? "active" : ""}`,
              onclick: () => {
                ThemeManager.apply("light", true);
                store.set("theme", "light");
                settingsPage.render(container);
              },
            },
            [
              createElement("span", {
                style: { fontSize: "26px" },
                textContent: "☀",
              }),
              createElement("span", {
                style: { fontWeight: "700" },
                textContent: "Chủ đề Sáng (Light)",
              }),
              createElement("span", {
                style: {
                  fontSize: "12px",
                  color: "var(--color-text-secondary)",
                  textAlign: "center",
                },
                textContent: "Giao diện sáng sủa, độ tương phản cao",
              }),
            ],
          ),
          createElement(
            "div",
            {
              className: `theme-card ${currentTheme === "dark" ? "active" : ""}`,
              onclick: () => {
                ThemeManager.apply("dark", true);
                store.set("theme", "dark");
                settingsPage.render(container);
              },
            },
            [
              createElement("span", {
                style: { fontSize: "26px" },
                textContent: "☾",
              }),
              createElement("span", {
                style: { fontWeight: "700" },
                textContent: "Chủ đề Tối (Dark)",
              }),
              createElement("span", {
                style: {
                  fontSize: "12px",
                  color: "var(--color-text-secondary)",
                  textAlign: "center",
                },
                textContent:
                  "Dịu mắt khi làm việc ban đêm, làm nổi bật Hôm nay",
              }),
            ],
          ),
        ]),
      ],
    );

    // 2. Notification Settings Section (Có thông báo hay không & Thông báo trước bao nhiêu phút)
    const initialNotifyEnabled =
      user.notify_enabled !== undefined
        ? Boolean(user.notify_enabled)
        : localStorage.getItem("planify_notify_enabled") !== "false";
    const initialNotifyMinutes =
      user.notify_minutes_before !== undefined &&
      user.notify_minutes_before !== null
        ? Number(user.notify_minutes_before)
        : Number(localStorage.getItem("planify_notify_minutes_before")) || 15;

    const notifyToggleCheck = createElement("input", {
      type: "checkbox",
      checked: initialNotifyEnabled,
      style: {
        width: "18px",
        height: "18px",
        accentColor: "var(--color-primary)",
        cursor: "pointer",
      },
    });

    const notifyMinutesInput = createElement("input", {
      id: "settings-notify-minutes",
      type: "number",
      className: "input",
      min: 1,
      max: 1440,
      value: String(initialNotifyMinutes),
      style: { width: "110px", fontWeight: "700", textAlign: "center" },
    });

    const saveNotifyBtn = createElement("button", {
      type: "button",
      className: "btn btn-primary",
      textContent: "Lưu",
      style: { minWidth: "70px", padding: "7px 16px", fontWeight: "600" },
      onclick: async () => {
        if (saveNotifyBtn.disabled) return;
        const enabled = notifyToggleCheck.checked;
        const mins = Math.max(
          1,
          Math.min(1440, parseInt(notifyMinutesInput.value, 10) || 15),
        );
        notifyMinutesInput.value = String(mins);

        saveNotifyBtn.disabled = true;
        try {
          const updated = await api.put("/users/me", {
            notify_enabled: enabled,
            notify_minutes_before: mins,
          });
          if (!isCurrent()) return;
          const updatedUser = updated?.data || updated;
          localStorage.setItem(
            "planify_notify_enabled",
            enabled ? "true" : "false",
          );
          localStorage.setItem("planify_notify_minutes_before", String(mins));
          store.set("user", {
            ...store.get("user"),
            ...updatedUser,
            notify_enabled: enabled,
            notify_minutes_before: mins,
          });
          Toast.success(
            enabled
              ? `Đã bật thông báo nhắc lịch (Báo trước ${mins} phút qua Email & Trình duyệt)!`
              : "Đã tắt thông báo nhắc lịch.",
          );
        } catch (err) {
          Toast.error(err.message || "Không thể lưu cài đặt thông báo.");
        } finally {
          saveNotifyBtn.disabled = false;
        }
      },
    });

    const testNotifyBtn = createElement("button", {
      type: "button",
      className: "btn btn-secondary",
      textContent: "Test",
      style: {
        minWidth: "60px",
        padding: "7px 14px",
        fontWeight: "500",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-secondary)",
      },
      title: "Gửi thử thông báo qua Email & Trình duyệt",
      onclick: async () => {
        testNotifyBtn.disabled = true;
        testNotifyBtn.textContent = "Đang gửi...";
        try {
          ReminderNotifier.notify(
            "🔔 Thông báo thử nghiệm Planify Pro",
            "Hệ thống chuông báo & thông báo trình duyệt đang hoạt động tốt!",
          );
          const res = await api.post("/users/me/test-reminder", {});
          Toast.success(
            res?.message ||
              `Đã gửi email nhắc lịch thử nghiệm tới ${user.email}!`,
          );
        } catch (err) {
          Toast.error(err.message || "Lỗi khi gửi thông báo thử nghiệm.");
        } finally {
          testNotifyBtn.disabled = false;
          testNotifyBtn.textContent = "Test";
        }
      },
    });

    const notifySubtext = createElement("span", {
      style: {
        fontSize: "12px",
        color: "var(--color-text-secondary)",
      },
      textContent: `Tự động gửi Email tới ${user.email || "hộp thư của bạn"} và phát chuông báo trên trình duyệt`,
    });

    const notificationSection = createElement(
      "div",
      { className: "settings-section" },
      [
        createElement("h2", {
          className: "settings-section-title",
          textContent: "🔔 Cài đặt Thông báo Lịch hẹn",
        }),
        createElement(
          "label",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderRadius: "12px",
              backgroundColor: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border-light)",
              cursor: "pointer",
            },
          },
          [
            createElement(
              "div",
              {
                style: { display: "flex", flexDirection: "column", gap: "2px" },
              },
              [
                createElement("span", {
                  style: {
                    fontWeight: "700",
                    fontSize: "14px",
                    color: "var(--color-text-primary)",
                  },
                  textContent: "Bật nhận thông báo nhắc lịch khi tới giờ",
                }),
                notifySubtext,
              ],
            ),
            notifyToggleCheck,
          ],
        ),
        createElement("div", { className: "form-group" }, [
          createElement("label", {
            for: "settings-notify-minutes",
            className: "form-label",
            textContent: "Thông báo trước bao nhiêu phút?",
          }),
          createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
              },
            },
            [
              createElement(
                "div",
                {
                  style: { display: "flex", alignItems: "center", gap: "10px" },
                },
                [
                  notifyMinutesInput,
                  createElement("span", {
                    style: {
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "var(--color-text-secondary)",
                    },
                    textContent: "phút trước khi bắt đầu",
                  }),
                ],
              ),
              createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginLeft: "auto",
                  },
                },
                [testNotifyBtn, saveNotifyBtn],
              ),
            ],
          ),
        ]),
      ],
    );

    // 3. Profile Section
    const nicknameInput = createElement("input", {
      id: "settings-nickname",
      type: "text",
      className: "input",
      value: user.nickname || "",
    });

    let currentSavedEmail = (user.email || "").trim().toLowerCase();

    // OTP block for email change
    const otpSection = createElement("div", {
      id: "settings-email-otp-group",
      style: {
        display: "none",
        marginTop: "10px",
        padding: "12px",
        borderRadius: "10px",
        backgroundColor: "var(--color-bg-secondary)",
        border: "1px solid var(--color-border-light)",
      },
    });

    const emailInput = createElement("input", {
      id: "settings-email",
      type: "email",
      className: "input",
      value: user.email || "",
      oninput: () => {
        const emailVal = emailInput.value.trim().toLowerCase();
        const changed = emailVal !== currentSavedEmail && emailVal.length > 0;
        otpSection.style.display = changed ? "block" : "none";
      },
    });
    emailInput.addEventListener("input", () => {
      const emailVal = emailInput.value.trim().toLowerCase();
      const changed = emailVal !== currentSavedEmail && emailVal.length > 0;
      otpSection.style.display = changed ? "block" : "none";
    });

    const otpInput = createElement("input", {
      id: "settings-email-otp",
      type: "text",
      className: "input",
      placeholder: "Mã OTP 6 số",
      maxLength: 6,
      style: {
        width: "140px",
        letterSpacing: "3px",
        fontWeight: "700",
        textAlign: "center",
      },
    });

    const sendOtpBtn = createElement("button", {
      type: "button",
      className: "btn btn-secondary",
      textContent: "Gửi mã OTP",
      style: { minWidth: "110px", padding: "7px 14px", fontWeight: "600" },
      onclick: async () => {
        if (sendOtpBtn.disabled) return;
        const targetEmail = emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!targetEmail || !emailRegex.test(targetEmail)) {
          Toast.error("Vui lòng nhập địa chỉ email mới hợp lệ.");
          emailInput.focus();
          return;
        }
        if (targetEmail.toLowerCase() === currentSavedEmail) {
          Toast.info("Địa chỉ email chưa thay đổi so với email hiện tại.");
          return;
        }

        sendOtpBtn.disabled = true;
        sendOtpBtn.textContent = "Đang gửi...";
        try {
          await api.post("/otp/send", {
            email: targetEmail,
            reason: "verify-email",
          });
          if (!isCurrent()) return;
          Toast.success(`Mã OTP đã được gửi đến ${targetEmail}!`);
          let cd = 60;
          sendOtpBtn.textContent = `Gửi lại (${cd}s)`;
          if (this.otpCountdownInterval) clearInterval(this.otpCountdownInterval);
          this.otpCountdownInterval = setInterval(() => {
            cd--;
            if (cd <= 0) {
              clearInterval(this.otpCountdownInterval);
              this.otpCountdownInterval = null;
              sendOtpBtn.disabled = false;
              sendOtpBtn.textContent = "Gửi mã OTP";
            } else {
              sendOtpBtn.textContent = `Gửi lại (${cd}s)`;
            }
          }, 1000);
          otpInput.focus();
        } catch (err) {
          Toast.error(err.message || "Lỗi khi gửi mã OTP.");
          sendOtpBtn.disabled = false;
          sendOtpBtn.textContent = "Gửi mã OTP";
        }
      },
    });

    otpSection.appendChild(
      createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } }, [
        createElement("span", {
          style: {
            fontSize: "12px",
            color: "var(--color-text-secondary)",
            lineHeight: "1.4",
          },
          textContent: "ℹ️ Bạn đang thay đổi email. Vui lòng bấm \"Gửi mã OTP\" và nhập mã xác thực 6 chữ số gửi về hộp thư mới để xác nhận.",
        }),
        createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px" } }, [
          otpInput,
          sendOtpBtn,
        ]),
      ]),
    );

    const currentTimezone = user.timezone || "Asia/Ho_Chi_Minh";
    const timezoneSelect = createElement(
      "select",
      { id: "settings-timezone", className: "select" },
      [
        createElement("option", {
          value: "Asia/Ho_Chi_Minh",
          textContent: "Hà Nội, TP.HCM (GMT+7)",
          selected: currentTimezone === "Asia/Ho_Chi_Minh",
        }),
        createElement("option", {
          value: "Asia/Tokyo",
          textContent: "Tokyo (GMT+9)",
          selected: currentTimezone === "Asia/Tokyo",
        }),
        createElement("option", {
          value: "UTC",
          textContent: "Giờ phối hợp quốc tế (UTC)",
          selected: currentTimezone === "UTC",
        }),
      ],
    );
    timezoneSelect.value = currentTimezone;

    const saveProfileBtn = createElement("button", {
      type: "button",
      className: "btn btn-primary",
      textContent: "Lưu thay đổi",
      onclick: async () => {
        if (saveProfileBtn.disabled) return;
        const newEmail = emailInput.value.trim();
        const emailChanged = newEmail.toLowerCase() !== currentSavedEmail;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (emailChanged) {
          if (!newEmail || !emailRegex.test(newEmail)) {
            Toast.error("Vui lòng nhập địa chỉ email mới hợp lệ.");
            emailInput.focus();
            return;
          }
          const otpVal = otpInput.value.trim();
          if (!otpVal || !/^\d{6}$/.test(otpVal)) {
            Toast.error("Vui lòng nhập mã OTP gồm 6 chữ số để xác thực thay đổi email.");
            otpInput.focus();
            return;
          }
        }

        try {
          saveProfileBtn.disabled = true;
          const payload = {
            nickname: nicknameInput.value.trim(),
            timezone: timezoneSelect.value,
          };
          if (emailChanged) {
            payload.email = newEmail;
            payload.otp = otpInput.value.trim();
          }

          const updated = await api.put("/users/me", payload);
          if (!isCurrent()) return;
          const updatedUser = updated?.data || updated;
          user = { ...user, ...updatedUser };
          store.set("user", user);
          currentSavedEmail = (user.email || newEmail).trim().toLowerCase();
          emailInput.value = user.email || newEmail;
          otpInput.value = "";
          otpSection.style.display = "none";
          if (this.otpCountdownInterval) {
            clearInterval(this.otpCountdownInterval);
            this.otpCountdownInterval = null;
            sendOtpBtn.disabled = false;
            sendOtpBtn.textContent = "Gửi mã OTP";
          }
          if (updatedUser?.timezone) {
            timezoneSelect.value = updatedUser.timezone;
          }
          if (notifySubtext && user.email) {
            notifySubtext.textContent = `Tự động gửi Email tới ${user.email} và phát chuông báo trên trình duyệt`;
          }
          Toast.success("Cập nhật thông tin thành công!");
        } catch (err) {
          Toast.error(err.message || "Lỗi cập nhật.");
        } finally {
          saveProfileBtn.disabled = false;
        }
      },
    });

    const accountSection = createElement(
      "div",
      { className: "settings-section" },
      [
        createElement("h2", {
          className: "settings-section-title",
          textContent: "👤 Thông tin cá nhân",
        }),
        createElement("div", { className: "form-group" }, [
          createElement("label", {
            for: "settings-email",
            className: "form-label",
            textContent: "Email",
          }),
          emailInput,
          otpSection,
        ]),
        createElement("div", { className: "form-group" }, [
          createElement("label", {
            for: "settings-nickname",
            className: "form-label",
            textContent: "Tên hiển thị",
          }),
          nicknameInput,
        ]),
        createElement("div", { className: "form-group" }, [
          createElement("label", {
            for: "settings-timezone",
            className: "form-label",
            textContent: "Múi giờ",
          }),
          timezoneSelect,
        ]),
        createElement("div", { style: { marginTop: "4px" } }, [saveProfileBtn]),
      ],
    );

    // 4. Export Backup Section (.ICS & .JSON)
    const exportSection = createElement(
      "div",
      { className: "settings-section" },
      [
        createElement("h2", {
          className: "settings-section-title",
          textContent: "📦 Sao lưu & Xuất dữ liệu (Google/Outlook .ICS & JSON)",
        }),
        createElement("div", { className: "flex gap-sm flex-wrap" }, [
          createElement("button", {
            type: "button",
            className: "btn btn-secondary",
            textContent: "📅 Xuất Lịch chuẩn .ICS (iCalendar)",
            onclick: async () => {
              try {
                const [tasks, events] = await Promise.all([
                  api.get("/tasks"),
                  api.get("/events", {
                    start: "0001-01-01T00:00:00Z",
                    end: "9999-12-31T23:59:59Z",
                  }),
                ]);
                const blob = new Blob([buildCalendarIcs(tasks, events)], {
                  type: "text/calendar;charset=utf-8",
                });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "planify-calendar.ics";
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                Toast.success("Đã xuất file lịch planify-calendar.ics!");
              } catch (err) {
                Toast.error("Không thể xuất file .ics");
              }
            },
          }),
          createElement("button", {
            type: "button",
            className: "btn btn-secondary",
            textContent: "📋 Xuất Toàn bộ Công việc (.JSON)",
            onclick: async () => {
              try {
                const [tasks, events] = await Promise.all([
                  api.get("/tasks"),
                  api.get("/events", {
                    start: "0001-01-01T00:00:00Z",
                    end: "9999-12-31T23:59:59Z",
                  }),
                ]);
                const blob = new Blob(
                  [
                    JSON.stringify(
                      { timezone: "Asia/Ho_Chi_Minh", tasks, events },
                      null,
                      2,
                    ),
                  ],
                  { type: "application/json" },
                );
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "planify-tasks.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                Toast.success("Đã tải về file planify-tasks.json!");
              } catch (err) {
                Toast.error("Không thể xuất danh sách công việc");
              }
            },
          }),
        ]),
      ],
    );

    // 5. Security Section (Password Change)
    const currentPassInput = createElement("input", {
      id: "settings-current-password",
      type: "password",
      autocomplete: "current-password",
      className: "input",
      placeholder: "••••••••",
    });
    const newPassInput = createElement("input", {
      id: "settings-new-password",
      type: "password",
      autocomplete: "new-password",
      className: "input",
      placeholder: "••••••••",
    });
    const changePassBtn = createElement("button", {
      type: "button",
      className: "btn btn-secondary",
      textContent: "Đổi mật khẩu",
      onclick: async () => {
        if (changePassBtn.disabled) return;
        if (!currentPassInput.value || !newPassInput.value) {
          Toast.error("Vui lòng điền đủ mật khẩu cũ và mới.");
          return;
        }
        if (
          newPassInput.value.length < 8 ||
          new TextEncoder().encode(newPassInput.value).length > 72
        ) {
          Toast.error(
            "Mật khẩu mới phải có ít nhất 8 ký tự và không quá 72 bytes UTF-8.",
          );
          return;
        }
        try {
          changePassBtn.disabled = true;
          await api.put("/users/me/password", {
            current_password: currentPassInput.value,
            new_password: newPassInput.value,
          });
          if (!isCurrent()) return;
          Toast.success("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.");
          currentPassInput.value = "";
          newPassInput.value = "";
          AuthManager.logout();
        } catch (err) {
          Toast.error(err.message || "Mật khẩu cũ không chính xác.");
        } finally {
          changePassBtn.disabled = false;
        }
      },
    });

    const securitySection = createElement(
      "div",
      { className: "settings-section" },
      [
        createElement("h2", {
          className: "settings-section-title",
          textContent: "🔒 Bảo mật & Mật khẩu",
        }),
        createElement("div", { className: "form-group" }, [
          createElement("label", {
            for: "settings-current-password",
            className: "form-label",
            textContent: "Mật khẩu hiện tại",
          }),
          currentPassInput,
        ]),
        createElement("div", { className: "form-group" }, [
          createElement("label", {
            for: "settings-new-password",
            className: "form-label",
            textContent: "Mật khẩu mới",
          }),
          newPassInput,
        ]),
        createElement("div", { style: { marginTop: "4px" } }, [changePassBtn]),
      ],
    );

    // 6. Logout Section
    const logoutSection = createElement(
      "div",
      { className: "settings-section" },
      [
        createElement("h2", {
          className: "settings-section-title",
          textContent: "🚪 Phiên làm việc",
        }),
        createElement("div", {}, [
          createElement("button", {
            type: "button",
            className: "btn btn-danger",
            textContent: "Đăng xuất khỏi thiết bị này",
            onclick: () => {
              AuthManager.logout();
              Toast.info("Đã đăng xuất.");
            },
          }),
        ]),
      ],
    );

    inner.appendChild(categorySection);
    inner.appendChild(themeSection);
    inner.appendChild(notificationSection);
    inner.appendChild(accountSection);
    inner.appendChild(exportSection);
    inner.appendChild(securitySection);
    inner.appendChild(logoutSection);
    page.appendChild(inner);
    container.appendChild(page);
  },

  destroy() {
    this.generation = (this.generation || 0) + 1;
    if (this.otpCountdownInterval) {
      clearInterval(this.otpCountdownInterval);
      this.otpCountdownInterval = null;
    }
    if (this.container) {
      this.container.innerHTML = "";
      this.container = null;
    }
  },
};
