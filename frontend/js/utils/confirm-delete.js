import { businessWallTime, formatDate } from './date.js';

export function confirmDeleteItem(item, { count = 1, scope = null } = {}) {
  const date = item.due_date || item.start_at;
  const clock = item.start_time || item.due_time;
  const allDayEvent = item.start_at && item.end_at && item.is_all_day && !item.due_date;
  const when = date ? `\nThời gian: ${String(date).slice(0, 10)}${allDayEvent ? ' (cả ngày)' : clock ? ` ${String(clock).slice(0, 5)}` : item.start_at ? ` ${String(item.start_at).slice(11, 16)}` : ''}` : '';
  const end = allDayEvent
    ? `${formatDate(new Date(new Date(businessWallTime(item.end_at)).getTime() - 1))} (hết ngày)`
    : item.end_time ? String(item.end_time).slice(0, 5) : item.end_at ? `${String(item.end_at).slice(0, 10)} ${String(item.end_at).slice(11, 16)}` : '';
  const scopeText = scope === 'all' ? 'toàn bộ chuỗi lặp' : scope === 'following' ? 'lần này và các lần sau' : scope === 'this' ? 'lần này' : null;
  return confirm(`Xóa ${count} mục: "${item.title || item.name}"?${when}${end ? ` – ${end}` : ''}${scopeText ? `\nPhạm vi: ${scopeText}` : item.recurrence_rule ? '\nPhạm vi: mục hiện tại trong chuỗi lặp' : ''}`);
}
