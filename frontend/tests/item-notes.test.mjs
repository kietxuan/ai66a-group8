import test from 'node:test';
import assert from 'node:assert/strict';
import { combinedItemNotes, buildNotesUpdate } from '../js/utils/item-notes.js';

test('the unified editor preserves existing Task notes and Event descriptions with locations', () => {
  assert.equal(combinedItemNotes({ location: 'Phòng A', note: 'Chuẩn bị slide\nMang laptop' }), 'Phòng A\n\nChuẩn bị slide\nMang laptop');
  assert.equal(combinedItemNotes({ location: 'https://meet.example/room', description: 'Họp nhóm' }), 'https://meet.example/room\n\nHọp nhóm');
  assert.equal(combinedItemNotes({ location: 'Phòng A' }), 'Phòng A');
  assert.equal(combinedItemNotes({ note: 'Ghi chú' }), 'Ghi chú');
  assert.equal(combinedItemNotes(), '');
});

test('saving and reopening keeps both values without duplicating an old location', () => {
  const original = { location: 'Phòng A', note: 'Nội dung' };
  const text = combinedItemNotes(original);
  const update = buildNotesUpdate(text);
  assert.deepEqual(update, { note: 'Phòng A\n\nNội dung', location: null });
  assert.equal(combinedItemNotes({ ...original, ...update }), text);
  assert.deepEqual(buildNotesUpdate(' \n '), { note: null, location: null });
  assert.equal(combinedItemNotes({ location: 'Cùng nội dung', note: 'Cùng nội dung' }), 'Cùng nội dung');
});

test('notes retain Unicode, literal markup and links, respecting the server character limit', () => {
  const text = '📍 https://meet.example/room\n<script>literal text</script>';
  assert.equal(buildNotesUpdate(`  ${text}  `).note, text);
  assert.equal(buildNotesUpdate('🙂'.repeat(5000)).note, '🙂'.repeat(5000));
  assert.throws(() => buildNotesUpdate('🙂'.repeat(5001)), /5.000/);
  const legacy = combinedItemNotes({ location: 'x'.repeat(300), note: 'y'.repeat(5000) });
  assert.equal(legacy.length, 5302);
  assert.throws(() => buildNotesUpdate(legacy), /5.000/);
});
