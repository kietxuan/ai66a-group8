/**
 * Date formatting and calculation utilities
 */

const VI_WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const VI_WEEKDAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const VI_MONTHS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

export function formatDate(date, format = 'YYYY-MM-DD') {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes);
}

export function formatVietnameseDate(date, includeWeekday = true) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const weekday = VI_WEEKDAYS[d.getDay()];
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();

  if (includeWeekday) {
    return `${weekday}, ${day} tháng ${month}, ${year}`;
  }
  return `${day} tháng ${month}, ${year}`;
}

export function getWeekdayName(dayIndex, short = false) {
  return short ? VI_WEEKDAYS_SHORT[dayIndex] : VI_WEEKDAYS[dayIndex];
}

export function getMonthName(monthIndex) {
  return VI_MONTHS[monthIndex];
}

export function isSameDay(d1, d2) {
  if (!d1 || !d2) return false;
  const a = new Date(d1);
  const b = new Date(d2);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date) {
  return isSameDay(date, new Date());
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function getStartOfWeek(date, startOnMonday = true) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 && startOnMonday ? -6 : (startOnMonday ? 1 - day : -day));
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getEndOfWeek(date, startOnMonday = true) {
  const start = getStartOfWeek(date, startOnMonday);
  return addDays(start, 6);
}

export function getMonthMatrix(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // Starting day index (Monday = 0, Sunday = 6)
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6;

  const matrix = [];
  let currentWeek = [];

  // Previous month trailing days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    currentWeek.push({
      date: new Date(year, month - 1, prevMonthLastDay - i),
      isCurrentMonth: false
    });
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    currentWeek.push({
      date: new Date(year, month, d),
      isCurrentMonth: true
    });
    if (currentWeek.length === 7) {
      matrix.push(currentWeek);
      currentWeek = [];
    }
  }

  // Next month leading days
  let nextDay = 1;
  while (currentWeek.length > 0 && currentWeek.length < 7) {
    currentWeek.push({
      date: new Date(year, month + 1, nextDay++),
      isCurrentMonth: false
    });
  }
  if (currentWeek.length === 7) {
    matrix.push(currentWeek);
  }

  return matrix;
}

export function toLocalISOString(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

export function formatLocalDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


