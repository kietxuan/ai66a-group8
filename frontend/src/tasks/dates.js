export const TIMEZONE = 'Asia/Ho_Chi_Minh';
export function today(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function addDays(value, days) {
  // Date-only arithmetic: UTC used solely to avoid browser DST/local timezone.
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0,10);
}
export function dateLabel(value, full = false) {
  return new Intl.DateTimeFormat('vi-VN', {day:'numeric',month:full ? 'long' : '2-digit',year:full || value?.slice(0,4)!==today().slice(0,4) ? 'numeric' : undefined,timeZone:TIMEZONE}).format(new Date(`${value}T12:00:00+07:00`));
}
export const priorityLabels = {low:'Thấp',medium:'Vừa',high:'Cao'};
export const timeLabel = task => task.start_time ? `${task.start_time} – ${task.end_time}` : 'Cả ngày';
