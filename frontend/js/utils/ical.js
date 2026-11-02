import { businessWallTime, toLocalISOString } from './date.js';
import { RRuleParser } from '../calendar/rrule.js';

export function escapeIcal(value = '') {
  return String(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}
function utc(value) {
  const aware = /(Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}+07:00`;
  return new Date(aware).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
function nextDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
function fold(line) {
  const encoder = new TextEncoder();
  let result = '', width = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (width + bytes > 75) { result += '\r\n '; width = 1; }
    result += char; width += bytes;
  }
  return result;
}
export function buildCalendarIcs(tasks = [], events = [], now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Planify Pro//VN', 'CALSCALE:GREGORIAN'];
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const records = [
    ...tasks.filter(t => t.due_date).map(t => {
      const day = String(t.due_date).slice(0, 10), clock = t.start_time || t.due_time;
      const allDay = t.is_all_day !== false || !clock;
      const start = allDay ? `${day}T00:00:00` : `${day}T${String(clock).slice(0, 8)}`;
      const end = allDay ? `${nextDate(day)}T00:00:00` : t.end_time ? `${day}T${t.end_time}` : new Date(new Date(`${start}+07:00`).getTime() + (t.duration_minutes || 60) * 60000).toISOString();
      // A recurring Task is stored once per completion cycle: exporting RRULE on every copy creates duplicates.
      return {id: t.id, title: t.title, description: t.note, location: t.location, start_at: start, end_at: end, is_all_day: allDay, _task: true};
    }), ...events
  ];
  for (const row of records) {
    if (row.recurrence_rule && row.recurrence_end && new Date(row.recurrence_end) < new Date(row.start_at)) continue;
    lines.push('BEGIN:VEVENT', `UID:planify-${row._task ? 'task' : 'event'}-${row.parent_event_id || row.id}@planify.local`, `DTSTAMP:${stamp}`);
    if (row.parent_event_id && row.original_start) lines.push(`RECURRENCE-ID:${utc(row.original_start)}`);
    if (row.is_all_day) {
      const start = businessWallTime(row.start_at).slice(0, 10);
      let end = businessWallTime(row.end_at).slice(0, 10);
      if (end <= start) end = nextDate(start);
      else if (!businessWallTime(row.end_at).endsWith('T00:00:00')) end = nextDate(end);
      lines.push(`DTSTART;VALUE=DATE:${start.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${end.replace(/-/g, '')}`);
    } else {
      lines.push(`DTSTART:${utc(row.start_at)}`, `DTEND:${utc(row.end_at)}`);
    }
    lines.push(`SUMMARY:${escapeIcal(row.title)}`);
    if (row.description) lines.push(`DESCRIPTION:${escapeIcal(row.description)}`);
    if (row.location) lines.push(`LOCATION:${escapeIcal(row.location)}`);
    if (row.is_cancelled) lines.push('STATUS:CANCELLED');
    if (row.recurrence_rule && !row.parent_event_id) {
      let rule = row.recurrence_rule;
      if (row.recurrence_end) {
        if (/COUNT=/i.test(rule)) {
          const count = RRuleParser.expand(row, new Date(row.start_at), new Date(new Date(row.recurrence_end).getTime() + 1000)).length;
          rule = rule.replace(/COUNT=\d+/i, `COUNT=${count}`).replace(/;?UNTIL=[^;]+/i, '');
        } else {
          const original = RRuleParser.parse(rule)?.until;
          const end = new Date(row.recurrence_end);
          const bound = original && original < end ? original : end;
          rule = rule.replace(/;?UNTIL=[^;]+/i, '') + `;UNTIL=${utc(toLocalISOString(bound))}`;
        }
      }
      lines.push(`RRULE:${rule}`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
