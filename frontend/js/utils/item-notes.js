export const NOTES_LIMIT = 5000;

// Existing records can have both fields; retain both when editing in one box.
export function combinedItemNotes(item = {}) {
  const location = item.location || '';
  const notes = item.note ?? item.description ?? '';
  if (location === notes) return notes;
  return [location, notes].filter(Boolean).join('\n\n');
}

export function buildNotesUpdate(value) {
  const note = value.trim();
  if ([...note].length > NOTES_LIMIT) throw new Error('Ghi chú và địa điểm tối đa 5.000 ký tự.');
  // Once edited, the unified text lives in note/description, avoiding duplicate locations.
  return { note: note || null, location: null };
}
