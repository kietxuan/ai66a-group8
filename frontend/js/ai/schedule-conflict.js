import { chooseScheduleConflict } from '../components/schedule-conflict.js';

export function showAiScheduleConflict(toolCalls, onChoice) {
  const conflict = Array.isArray(toolCalls)
    ? toolCalls.find(call => call.result?.code === 'SCHEDULE_CONFLICT')
    : null;
  if (!conflict) return;
  chooseScheduleConflict(conflict.result.items || []).then(onChoice);
}
