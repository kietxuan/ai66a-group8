import { businessNow } from "../utils/date.js";
/**
 * Background Reminder & Notification Service
 * Polls upcoming tasks/events every 30 seconds, triggers Email reminders via Backend SMTP,
 * and shows Browser/Toast notifications according to user settings (notify_enabled & notify_minutes_before).
 */
import { api } from "../api.js";
import { store } from "../store.js";
import { Toast } from "./toast.js";

export class ReminderNotifier {
  static intervalId = null;
  static notifiedSet = new Set();
  static isRunning = false;

  static isEnabled() {
    const user = store.get("user");
    if (user && user.notify_enabled !== undefined) {
      return Boolean(user.notify_enabled);
    }
    const saved = localStorage.getItem("planify_notify_enabled");
    return saved === null ? true : saved === "true";
  }

  static getMinutesBefore() {
    const user = store.get("user");
    if (
      user &&
      user.notify_minutes_before !== undefined &&
      user.notify_minutes_before !== null
    ) {
      return Number(user.notify_minutes_before);
    }
    const saved = localStorage.getItem("planify_notify_minutes_before");
    return saved !== null && Number.isFinite(Number(saved))
      ? Number(saved)
      : 15;
  }

  static start() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const cached = sessionStorage.getItem("planify_notified_reminders");
      if (cached) {
        JSON.parse(cached).forEach((id) => this.notifiedSet.add(id));
      }
    } catch (_) {}

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    setTimeout(() => this.check(), 3000);
    this.intervalId = setInterval(() => this.check(), 30000);
  }

  static stop() {
    this.notifiedSet.clear();
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  static playChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18);

      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (_) {}
  }

  static notify(title, body) {
    if (!this.isEnabled()) return;
    this.playChime();
    Toast.warning(`${title}: ${body}`, 8500);

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "/favicon.ico",
        });
      } catch (_) {}
    }
  }

  static markNotified(key) {
    this.notifiedSet.add(key);
    try {
      sessionStorage.setItem(
        "planify_notified_reminders",
        JSON.stringify(Array.from(this.notifiedSet)),
      );
    } catch (_) {}
  }

  static async check() {
    const user = store.get("user");
    if (!user) return;
    if (!this.isEnabled()) return;

    const now = businessNow();
    const nowMs = now.getTime();
    const defaultRemindMins = this.getMinutesBefore();

    try {
      // 1. Trigger backend check-reminders (sends Email notification via SMTP if due & auto-completes expired events)
      const serverCheck = await api
        .post("/users/me/check-reminders", {})
        .catch(() => null);
      if (serverCheck && Array.isArray(serverCheck.triggered)) {
        for (const item of serverCheck.triggered) {
          const key = item.notification_key || `srv-rem-${item.id}-${now.toISOString().slice(0, 10)}`;
          if (!this.notifiedSet.has(key)) {
            this.markNotified(key);
            const emailTag = item.email_sent ? " (Đã gửi Email nhắc lịch)" : "";
            this.notify(
              "⏰ Nhắc lịch hẹn / công việc",
              `"${item.title}" - ${item.time_display}${emailTag}`,
            );
          }
        }
      }

      // 2. Local browser check for tasks/events happening today within notify_minutes_before
      const tasks = await api.get("/tasks");
      if (Array.isArray(tasks)) {
        for (const t of tasks) {
          if (t.is_completed) continue;

          if (t.due_date && (t.start_time || t.due_time) && !t.is_all_day) {
            const dateStr =
              typeof t.due_date === "string" ? t.due_date.split("T")[0] : "";
            const rawTime = String(t.start_time || t.due_time).substring(0, 5);
            const startAt = new Date(`${dateStr}T${rawTime}:00`).getTime();
            const itemMins =
              t.reminder_minutes !== undefined && t.reminder_minutes !== null
                ? Number(t.reminder_minutes)
                : defaultRemindMins;
            const alertWindowStart = startAt - itemMins * 60 * 1000;
            const key = `task-start-${t.id}-${dateStr}-${rawTime}`;

            if (
              !this.notifiedSet.has(key) &&
              nowMs >= alertWindowStart &&
              nowMs <= startAt + 5 * 60 * 1000
            ) {
              this.markNotified(key);
              this.notify(
                "⏰ Sắp đến giờ công việc",
                `"${t.title}" lúc ${rawTime} (nhắc trước ${itemMins} phút)`,
              );
            }
          }

        }

      }
    } catch (_) {}
  }
}
