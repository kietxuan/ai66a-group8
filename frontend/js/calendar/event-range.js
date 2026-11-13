import { businessWallTime } from '../utils/date.js';

export function shiftEventDate(value, days = 0) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('Vui lòng chọn ngày hợp lệ.');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1 || date.toISOString().slice(0, 10) !== value) throw new Error('Ngày không hợp lệ.');
  date.setUTCDate(date.getUTCDate() + days);
  if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) throw new Error('Ngày nằm ngoài phạm vi hỗ trợ.');
  return date.toISOString().slice(0, 10);
}

export function buildEventRange({ startDate, endDate, startTime, endTime, allDay }) {
  shiftEventDate(startDate);
  shiftEventDate(endDate);
  if (endDate < startDate) throw new Error('Ngày kết thúc không được trước ngày bắt đầu.');
  if (allDay) return {
    start_at: `${startDate}T00:00:00+07:00`,
    end_at: `${shiftEventDate(endDate, 1)}T00:00:00+07:00`,
  };
  const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!clock.test(startTime || '') || !clock.test(endTime || '')) throw new Error('Vui lòng nhập đầy đủ giờ bắt đầu và giờ kết thúc.');
  const start_at = `${startDate}T${startTime}:00+07:00`;
  const end_at = `${endDate}T${endTime}:00+07:00`;
  if (end_at <= start_at) throw new Error('Thời điểm kết thúc phải sau thời điểm bắt đầu.');
  return { start_at, end_at };
}

export function readEventRange(event) {
  const start = businessWallTime(event.start_at);
  const end = businessWallTime(event.end_at);
  const endDate = event.is_all_day && end.slice(11, 19) === '00:00:00'
    ? shiftEventDate(end.slice(0, 10), -1) : end.slice(0, 10);
  return { startDate: start.slice(0, 10), endDate,
    startTime: start.slice(11, 16), endTime: end.slice(11, 16) };
}
