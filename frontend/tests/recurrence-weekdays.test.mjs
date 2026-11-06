import test from 'node:test';
import assert from 'node:assert/strict';
import { RRuleParser } from '../js/calendar/rrule.js';

test('calendar shows exactly nine Monday/Wednesday/Friday lessons in three weeks', () => {
  const rows = RRuleParser.expand({
    id: 1, title: 'Học bài', start_at: '2026-11-09T19:50:00', end_at: '2026-11-09T21:20:00',
    recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261129',
  }, '2026-11-01T00:00:00', '2027-01-01T00:00:00');
  assert.deepEqual(rows.map(row => row.start_at.slice(0, 10)), [
    '2026-11-09', '2026-11-11', '2026-11-13', '2026-11-16', '2026-11-18',
    '2026-11-20', '2026-11-23', '2026-11-25', '2026-11-27',
  ]);
  assert.ok(rows.every(row => row.start_at.includes('T19:50') && row.end_at.includes('T21:20')));
});

test('calendar starts on Wednesday when Monday was not requested', () => {
  const rows = RRuleParser.expand({
    id: 1, title: 'Học bài', start_at: '2026-11-11T19:50:00', end_at: '2026-11-11T21:20:00',
    recurrence_rule: 'FREQ=WEEKLY;BYDAY=WE,FR;UNTIL=20261129',
  }, '2026-11-01T00:00:00', '2027-01-01T00:00:00');
  assert.deepEqual(rows.map(row => row.start_at.slice(0, 10)), [
    '2026-11-11', '2026-11-13', '2026-11-18', '2026-11-20', '2026-11-25', '2026-11-27',
  ]);
});
