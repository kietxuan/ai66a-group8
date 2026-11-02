import { soundManager } from '../utils/sound.js';
import { Toast } from './toast.js';

export class PomodoroManager {
  static MODES = {
    focus: { label: 'Tập trung', minutes: 25, color: '#4F46E5' },
    short: { label: 'Nghỉ ngắn', minutes: 5, color: '#10B981' },
    long: { label: 'Nghỉ dài', minutes: 15, color: '#06B6D4' }
  };

  static mode = 'focus';
  static remainingSeconds = 25 * 60;
  static totalSeconds = 25 * 60;
  static isRunning = false;
  static intervalId = null;
  static activeTaskTitle = null;
  static sessionsCompleted = parseInt(localStorage.getItem('planify_pomo_sessions') || '0', 10);
  static listeners = new Set();

  static init() {
    const toggleBtn = document.getElementById('sidebar-pomo-toggle');
    const resetBtn = document.getElementById('sidebar-pomo-reset');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggle());
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.reset());
    }
    this.notify();
  }

  static subscribe(cb) {
    this.listeners.add(cb);
    cb(this.getState());
    return () => this.listeners.delete(cb);
  }

  static getState() {
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const progress = this.totalSeconds > 0
      ? ((this.totalSeconds - this.remainingSeconds) / this.totalSeconds) * 100
      : 0;
    return {
      mode: this.mode,
      modeInfo: this.MODES[this.mode],
      remainingSeconds: this.remainingSeconds,
      totalSeconds: this.totalSeconds,
      formatted,
      progress,
      isRunning: this.isRunning,
      activeTaskTitle: this.activeTaskTitle,
      sessionsCompleted: this.sessionsCompleted
    };
  }

  static notify() {
    const state = this.getState();

    // Update sidebar mini widget
    const timeEl = document.getElementById('sidebar-pomo-time');
    const modeEl = document.getElementById('sidebar-pomo-mode');
    const toggleEl = document.getElementById('sidebar-pomo-toggle');

    if (timeEl) timeEl.textContent = state.formatted;
    if (modeEl) modeEl.textContent = state.modeInfo.label;
    if (toggleEl) {
      toggleEl.textContent = state.isRunning ? '⏸ Tạm dừng' : '▶ Bắt đầu';
    }

    this.listeners.forEach(cb => {
      try { cb(state); } catch (_) {}
    });
  }

  static setMode(newMode) {
    if (!this.MODES[newMode]) return;
    this.pause();
    this.mode = newMode;
    this.totalSeconds = this.MODES[newMode].minutes * 60;
    this.remainingSeconds = this.totalSeconds;
    this.notify();
  }

  static startForTask(taskTitle) {
    this.activeTaskTitle = taskTitle;
    this.setMode('focus');
    this.start();
    Toast.info(`⏱️ Bắt đầu Pomodoro 25 phút cho: "${taskTitle}"`);
  }

  static toggle() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  }

  static start() {
    if (this.isRunning) return;
    this.isRunning = true;
    soundManager.playActionTap();
    this.intervalId = setInterval(() => {
      if (this.remainingSeconds > 0) {
        this.remainingSeconds--;
        this.notify();
      } else {
        this.completeSession();
      }
    }, 1000);
    this.notify();
  }

  static pause() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.notify();
  }

  static reset() {
    this.pause();
    this.remainingSeconds = this.MODES[this.mode].minutes * 60;
    this.totalSeconds = this.remainingSeconds;
    this.notify();
  }

  static completeSession() {
    this.pause();
    soundManager.playTaskComplete();
    if (this.mode === 'focus') {
      this.sessionsCompleted++;
      try {
        localStorage.setItem('planify_pomo_sessions', String(this.sessionsCompleted));
      } catch (_) {}
      Toast.success('🎉 Hoàn thành phiên tập trung Pomodoro! Hãy nghỉ ngắn 5 phút nhé.');
      this.setMode('short');
    } else {
      Toast.info('⚡ Hết giờ nghỉ! Sẵn sàng cho phiên tập trung tiếp theo.');
      this.setMode('focus');
    }
  }
}
