import test from 'node:test';
import assert from 'node:assert/strict';
import { businessNow, isEventCompleted } from '../js/utils/date.js';
import { RRuleParser } from '../js/calendar/rrule.js';

test('events finish at the exclusive end, including all-day and multi-day events', () => {
  const event = { end_at: '2026-11-15T00:00:00+07:00' };
  assert.equal(isEventCompleted(event, businessNow(new Date('2026-11-14T16:59:59Z'))), false);
  assert.equal(isEventCompleted(event, businessNow(new Date('2026-11-14T17:00:00Z'))), true);
  assert.equal(isEventCompleted({ ...event, is_cancelled: true }, businessNow(new Date('2026-11-16T00:00:00Z'))), false);
  assert.equal(isEventCompleted({ end_at: 'invalid' }), false);
});

test('each recurrence finishes independently even when the master is already completed', () => {
  const events = RRuleParser.expandAll([{
    id: 1, start_at: '2026-11-14T09:00:00', end_at: '2026-11-14T10:00:00',
    recurrence_rule: 'FREQ=DAILY;COUNT=3', is_completed: true
  }], new Date('2026-11-14T00:00:00'), new Date('2026-11-17T00:00:00'));
  const now = businessNow(new Date('2026-11-14T03:00:00Z'));
  assert.deepEqual(events.map(event => isEventCompleted(event, now)), [true, false, false]);
});
