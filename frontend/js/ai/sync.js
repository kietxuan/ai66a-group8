// Both chat surfaces invalidate data, even when the user changes conversations mid-request.
export function notifyAiDataChanges(rawCalls) {
  let calls = rawCalls;
  if (typeof calls === 'string') {
    try { calls = JSON.parse(calls); } catch (_) { return; }
  }
  if (!Array.isArray(calls)) return;
  const mutations = calls.filter(call =>
    call?.result?.success === true &&
    /^(create_|update_|delete_|complete_|toggle_|add_|batch_|schedule_|reschedule_|auto_plan_)/.test(call.name || call.tool || '')
  );
  if (mutations.length) {
    // The pages already listen to this canonical event; sending task-changed too doubles requests.
    window.dispatchEvent(new CustomEvent('planify:data-changed', {
      detail: { source: 'ai', action: 'tool-executed', type: 'all', toolCalls: mutations }
    }));
  }
}
