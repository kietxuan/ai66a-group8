import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.window = { location: { hash: '' } };
const attrs = new Map();
globalThis.document = { documentElement: { setAttribute: (key, value) => attrs.set(key, value), getAttribute: key => attrs.get(key) }, getElementById: () => null };
const { RRuleParser, recurrenceContext, eventDeleteUrl } = await import('../js/calendar/rrule.js');
const { formatDate, businessWallTime, overlapsDay, businessNow } = await import('../js/utils/date.js');
const { isValidPassword } = await import('../js/utils/validator.js');
const { api } = await import('../js/api.js');
const { store } = await import('../js/store.js');
const { ThemeManager } = await import('../js/theme.js');
const { adaptTaskForCalendar } = await import('../js/calendar/task-adapter.js');
const { buildCalendarIcs } = await import('../js/utils/ical.js');

function event(rule, start = '2025-01-01T09:00:00', end = '2025-01-01T10:00:00') {
  return { id: 1, title: 'Series', start_at: start, end_at: end, recurrence_rule: rule };
}

test('date-only values never shift to the previous day', () => {
  assert.equal(formatDate('2026-11-04'), '2026-11-04');
});
test('business midnight uses Vietnam date even in a different browser timezone', () => {
  assert.equal(formatDate(businessNow(new Date('2026-11-02T18:00:00Z'))), '2026-11-03');
});
test('absolute event times become Vietnam wall time, independently of browser timezone', () => {
  assert.equal(businessWallTime('2030-01-01T02:00:00Z'), '2030-01-01T09:00:00');
  assert.equal(businessWallTime('2030-01-01T04:00:00+02:00'), '2030-01-01T09:00:00');
});
test('old daily series survives the old 500-occurrence cutoff', () => {
  const rows = RRuleParser.expand(event('FREQ=DAILY'), new Date('2026-11-01T00:00'), new Date('2026-11-04T00:00'));
  assert.equal(rows.length, 3);
  assert.equal(rows[0].start_at, '2026-11-01T09:00:00');
});
test('monthly 31st skips invalid dates and never drifts to the 3rd', () => {
  const rows = RRuleParser.expand(event('FREQ=MONTHLY;COUNT=3', '2026-01-31T09:00:00', '2026-01-31T10:00:00'), new Date('2026-01-01'), new Date('2026-06-01'));
  assert.deepEqual(rows.map(r => r.start_at.slice(0, 10)), ['2026-01-31', '2026-03-31', '2026-05-31']);
});
test('leap-day recurrence skips non-leap years', () => {
  const rows = RRuleParser.expand(event('FREQ=YEARLY;COUNT=2', '2024-02-29T09:00', '2024-02-29T10:00'), new Date('2024-01-01'), new Date('2030-01-01'));
  assert.deepEqual(rows.map(r => r.start_at.slice(0, 10)), ['2024-02-29', '2028-02-29']);
});
test('unsorted BYDAY values obey chronological COUNT and INTERVAL', () => {
  const rows = RRuleParser.expand(event('FREQ=WEEKLY;BYDAY=FR,MO;COUNT=3', '2026-11-02T09:00', '2026-11-02T10:00'), new Date('2026-11-01'), new Date('2026-12-01'));
  assert.deepEqual(rows.map(r => r.start_at.slice(0, 10)), ['2026-11-02', '2026-11-06', '2026-11-09']);
});
test('monthly ordinal weekdays and BYMONTHDAY are honored', () => {
  const rows = RRuleParser.expand(event('FREQ=MONTHLY;BYDAY=2MO;COUNT=2', '2026-11-09T09:00', '2026-11-09T10:00'), new Date('2026-11-01'), new Date('2027-01-01'));
  assert.deepEqual(rows.map(r => r.start_at.slice(0, 10)), ['2026-11-09', '2026-12-14']);
});
test('cancelled and moved exceptions suppress exactly their original instance', () => {
  const master = event('FREQ=DAILY;COUNT=3', '2030-01-01T09:00', '2030-01-01T10:00');
  const child = { id: 2, parent_event_id: 1, is_exception: true, is_cancelled: true, original_start: '2030-01-02T09:00', start_at: '2030-01-02T11:00', end_at: '2030-01-02T12:00' };
  const rows = RRuleParser.expandAll([master, child], new Date('2030-01-01'), new Date('2030-01-05'));
  assert.deepEqual(rows.map(r => r.start_at.slice(0, 10)), ['2030-01-01', '2030-01-03']);
});
test('occurrence anchors survive edit/delete and do not become the master start', () => {
  const occurrence = RRuleParser.expand(event('FREQ=DAILY'), new Date('2026-11-01T00:00'), new Date('2026-11-02T00:00'))[0];
  assert.equal(recurrenceContext(occurrence).original_start, '2026-11-01T09:00:00');
  assert.match(eventDeleteUrl(occurrence), /occurrence_date=2026-11-01T09%3A00%3A00%2B07%3A00/);
});
test('multi-day events overlap each actual day but not an exclusive midnight end', () => {
  const row = event(null, '2030-01-01T22:00', '2030-01-03T00:00');
  assert.equal(overlapsDay(row, new Date('2030-01-02T12:00')), true);
  assert.equal(overlapsDay(row, new Date('2030-01-03T12:00')), false);
});
test('all-day adapter ignores stale legacy time values', () => {
  assert.equal(adaptTaskForCalendar({ id: 1, due_date: '2030-01-01', is_all_day: true, start_time: '09:00:00' }).is_all_day, true);
});
test('password validation uses UTF-8 bytes, not just JS character count', () => {
  assert.equal(isValidPassword('short'), false);
  assert.equal(isValidPassword('ậ'.repeat(25)), false);
  assert.equal(isValidPassword('valid-password'), true);
});
test('switching users clears private store and reminder/chat preferences', () => {
  store.set('user', {id: 1});
  store.set('tasks', [{title: 'Private A'}]);
  sessionStorage.setItem('planify_ai_pending_prompt', 'Private prompt');
  store.set('user', {id: 2});
  assert.deepEqual(store.get('tasks'), []);
  assert.equal(sessionStorage.getItem('planify_ai_pending_prompt'), null);
  assert.equal(store.get('isAiPanelOpen'), false);
});
test('theme toggles once per call', () => {
  ThemeManager.apply('light', false); ThemeManager.toggle();
  assert.equal(attrs.get('data-theme'), 'dark');
  ThemeManager.toggle(); assert.equal(attrs.get('data-theme'), 'light');
});
test('API converts event times at the boundary and retains structured HTTP status', async () => {
  api.setToken('test');
  let body;
  globalThis.fetch = async (_, config) => { body = JSON.parse(config.body); return new Response(JSON.stringify({start_at:'2030-01-01T02:00Z'})); };
  const result = await api.put('/events/1', {start_at: '2030-01-01T09:00:00'});
  assert.equal(body.start_at, '2030-01-01T09:00:00+07:00');
  assert.equal(result.start_at, '2030-01-01T09:00:00');
  globalThis.fetch = async () => new Response(JSON.stringify({detail:'Busy'}), {status:429});
  await assert.rejects(api.get('/tasks'), error => error.status === 429);
});
test('invalid JSON never looks like a successful empty response', async () => {
  globalThis.fetch = async () => new Response('<html>proxy error</html>');
  await assert.rejects(api.get('/tasks'), /không hợp lệ/);
});
test('late response from the previous session cannot update the new user', async () => {
  let resolve;
  globalThis.fetch = () => new Promise(r => { resolve = r; });
  api.setToken('A'); const pending = api.get('/tasks'); api.setToken('B');
  resolve(new Response(JSON.stringify([{title:'Private A'}])));
  await assert.rejects(pending, /đã thay đổi/);
});

test('ICS all-day end is exclusive and timed tasks retain Vietnam times in UTC', () => {
  const output = buildCalendarIcs([
    {id:1, title:'All day', due_date:'2030-01-01', is_all_day:true},
    {id:2, title:'Timed', due_date:'2030-01-01', is_all_day:false, start_time:'09:00:00', end_time:'10:00:00'}
  ]);
  assert.match(output, /DTSTART;VALUE=DATE:20300101\r\nDTEND;VALUE=DATE:20300102/);
  assert.match(output, /DTSTART:20300101T020000Z\r\nDTEND:20300101T030000Z/);
});
test('ICS text is escaped and UTF-8 lines are folded without splitting characters', () => {
  const output = buildCalendarIcs([{id:1, title:'QA;Title,\\x\nBEGIN:VEVENT' + 'ậ'.repeat(100), due_date:'2030-01-01'}]);
  assert.match(output, /QA\\;Title\\,\\\\x\\nBEGIN:VEVENT/);
  for (const line of output.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75);
  assert.equal(output.split('\r\nBEGIN:VEVENT\r\n').length, 2);
});
test('ICS recurring exceptions retain master UID and cancellation anchor', () => {
  const output = buildCalendarIcs([], [{id:2, parent_event_id:1, is_cancelled:true, original_start:'2030-01-02T09:00:00', start_at:'2030-01-02T11:00:00', end_at:'2030-01-02T12:00:00', title:'Cancelled'}]);
  assert.match(output, /UID:planify-event-1@planify.local/);
  assert.match(output, /RECURRENCE-ID:20300102T020000Z/);
  assert.match(output, /STATUS:CANCELLED/);
});
