import test from 'node:test';
import assert from 'node:assert/strict';
import { parseApiError } from '../js/utils/api-error.js';

const conflict = {
  code: 'SCHEDULE_CONFLICT',
  message: 'Khung giờ này trùng lịch.',
  requested: { start: '2026-11-04T08:00:00+07:00', end: '2026-11-04T09:00:00+07:00' },
  items: [{ title: 'Business Analytic', start: '2026-11-04T07:15:00+07:00', end: '2026-11-04T09:30:00+07:00' }]
};

test('nested HTTP error opens the conflict flow without exposing JSON text', () => {
  const error = parseApiError({ success: false, error: { code: 'HTTP_EXCEPTION', message: conflict } }, 409);
  assert.equal(error.code, 'SCHEDULE_CONFLICT');
  assert.equal(error.message, conflict.message);
  assert.deepEqual(error.items, conflict.items);
  assert.deepEqual(error.requested, conflict.requested);
});

test('flattened and direct conflict responses retain their choices', () => {
  for (const body of [{ success: false, error: conflict }, { detail: conflict }]) {
    const error = parseApiError(body, 409);
    assert.equal(error.code, 'SCHEDULE_CONFLICT');
    assert.equal(error.items.length, 1);
  }
});
