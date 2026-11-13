import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEventRange, readEventRange, shiftEventDate } from '../js/calendar/event-range.js';
import { overlapsDay } from '../js/utils/date.js';
import { confirmDeleteItem } from '../js/utils/confirm-delete.js';

test('three inclusive all-day dates map to an exclusive end and round-trip unchanged', () => {
  const range = buildEventRange({ startDate: '2026-11-20', endDate: '2026-11-22', allDay: true });
  assert.equal(range.start_at, '2026-11-20T00:00:00+07:00');
  assert.equal(range.end_at, '2026-11-23T00:00:00+07:00');
  const displayed = readEventRange({ ...range, is_all_day: true });
  assert.equal(displayed.startDate, '2026-11-20');
  assert.equal(displayed.endDate, '2026-11-22');
  assert.deepEqual(buildEventRange({ ...displayed, allDay: true }), range);
  const wall = { start_at: '2026-11-20T00:00:00', end_at: '2026-11-23T00:00:00' };
  assert.deepEqual([19,20,21,22,23].filter(day => overlapsDay(wall, new Date(2026, 10, day))), [20,21,22]);
});

test('timed multi-day events allow end clock earlier than start clock on a later date', () => {
  const range = buildEventRange({ startDate: '2026-11-20', endDate: '2026-11-22', startTime: '18:00', endTime: '08:00', allDay: false });
  assert.equal(range.end_at, '2026-11-22T08:00:00+07:00');
  assert.deepEqual(readEventRange({ ...range, is_all_day: false }), {
    startDate: '2026-11-20', endDate: '2026-11-22', startTime: '18:00', endTime: '08:00'
  });
});

test('UTC API values are edited as Vietnam wall time rather than browser timezone', () => {
  assert.deepEqual(readEventRange({ start_at: '2026-11-19T17:00:00Z', end_at: '2026-11-22T17:00:00Z', is_all_day: true }), {
    startDate: '2026-11-20', endDate: '2026-11-22', startTime: '00:00', endTime: '00:00'
  });
});

test('date shifting handles month, year and leap-day boundaries', () => {
  assert.equal(shiftEventDate('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftEventDate('2028-02-28', 1), '2028-02-29');
  assert.equal(shiftEventDate('2028-03-01', -1), '2028-02-29');
  assert.throws(() => shiftEventDate('0000-01-01'));
  assert.throws(() => shiftEventDate('9999-12-31', 1));
});

test('delete confirmation shows inclusive final date for an all-day event', () => {
  const oldConfirm = globalThis.confirm;
  let message;
  globalThis.confirm = text => { message = text; return false; };
  try {
    assert.equal(confirmDeleteItem({ title: 'Hội thảo', start_at: '2026-11-20T00:00:00', end_at: '2026-11-23T00:00:00', is_all_day: true }), false);
    assert.match(message, /2026-11-20 \(cả ngày\)/);
    assert.match(message, /2026-11-22 \(hết ngày\)/);
    assert.doesNotMatch(message, /2026-11-23/);
  } finally {
    globalThis.confirm = oldConfirm;
  }
});

test('invalid dates, reversed ranges and missing or reversed same-day times are rejected', () => {
  for (const endDate of ['', '2026-02-30', '2026-11-19']) {
    assert.throws(() => buildEventRange({ startDate: '2026-11-20', endDate, allDay: true }));
  }
  for (const [startTime, endTime] of [['18:00','08:00'], ['09:00','09:00'], ['', '10:00'], ['25:00','26:00']]) {
    assert.throws(() => buildEventRange({ startDate: '2026-11-20', endDate: '2026-11-20', startTime, endTime, allDay: false }));
  }
});
