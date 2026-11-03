import { toLocalISOString } from '../utils/date.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { Toast } from '../components/toast.js';
import { isScheduleDismissal } from '../utils/api-error.js';
import { revisionOptions } from '../utils/revision.js';

/**
 * Adapts Unified Tasks (with due_date) into Calendar items.
 * Tasks without due_date (permanent / vĩnh viễn) stay only in the "Cần làm" column and the Calendar's unscheduled tray.
 */
export function adaptTaskForCalendar(task) {
  if (!task || !task.due_date) return null;

  const dateStr = typeof task.due_date === 'string' ? task.due_date.split('T')[0] : '';
  if (!dateStr) return null;

  const startTimeRaw = task.start_time || task.due_time;
  const isAllDay = task.is_all_day !== false || !startTimeRaw;
  const defaultColor = task.color || (task.auto_complete ? '#4F46E5' : '#0B8043');

  if (isAllDay) {
    return {
      id: task.id,
      title: task.title,
      start_at: `${dateStr}T00:00:00`,
      end_at: `${dateStr}T23:59:59`,
      is_all_day: true,
      is_task: true,
      is_completed: !!task.is_completed,
      auto_complete: !!task.auto_complete,
      color: defaultColor,
      raw_task: task
    };
  }

  const timeStr = String(startTimeRaw).substring(0, 5);
  const startAt = new Date(`${dateStr}T${timeStr}:00`);

  let endAt;
  if (task.end_time) {
    const endStr = String(task.end_time).substring(0, 5);
    endAt = new Date(`${dateStr}T${endStr}:00`);
    if (isNaN(endAt.getTime()) || endAt <= startAt) {
      const dur = task.duration_minutes || 60;
      endAt = new Date(startAt.getTime() + dur * 60000);
    }
  } else {
    const dur = task.duration_minutes || 60;
    endAt = new Date(startAt.getTime() + dur * 60000);
  }

  return {
    id: task.id,
    title: task.title,
    start_at: toLocalISOString(startAt),
    end_at: toLocalISOString(endAt),
    is_all_day: false,
    is_task: true,
    is_completed: !!task.is_completed,
    auto_complete: !!task.auto_complete,
    color: defaultColor,
    raw_task: task
  };
}

export function adaptTasksForCalendar(tasks = []) {
  return (tasks || []).map(adaptTaskForCalendar).filter(Boolean);
}

export async function toggleCalendarTaskComplete(taskId, currentStatus, task = null) {
  try {
    const nextStatus = !currentStatus;
    const updated = await api.patch(`/tasks/${taskId}/complete`, { is_completed: nextStatus }, revisionOptions(task));

    const tasks = store.get('tasks') || [];
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], is_completed: nextStatus };
      store.set('tasks', [...tasks]);
    }

    window.dispatchEvent(new CustomEvent('planify:data-changed', {
      detail: { source: 'calendar', action: 'toggle-task', type: 'task', id: taskId, is_completed: nextStatus }
    }));
    document.dispatchEvent(new CustomEvent('task-changed', {
      detail: { action: 'update', taskId, is_completed: nextStatus }
    }));

    Toast.success(nextStatus ? 'Đã hoàn thành!' : 'Đã mở lại công việc.');
    return updated;
  } catch (err) {
    if (!isScheduleDismissal(err)) Toast.error(err.message || 'Lỗi khi cập nhật trạng thái');
    throw err;
  }
}
