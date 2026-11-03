// Accept the current API envelope and FastAPI's direct `detail` envelope.
export function parseApiError(data, status) {
  const outer = data?.error && typeof data.error === 'object' ? data.error : null;
  const nested = outer?.message && typeof outer.message === 'object' ? outer.message : null;
  const detail = data?.detail && typeof data.detail === 'object' ? data.detail : null;
  const structured = nested || detail || outer;
  const message = typeof structured?.message === 'string' ? structured.message
    : typeof outer?.message === 'string' ? outer.message
      : typeof data?.detail === 'string' ? data.detail
        : typeof data?.message === 'string' ? data.message
          : `Lỗi yêu cầu: ${status}`;
  const error = new Error(message);
  error.status = status;
  error.code = structured?.code || outer?.code;
  error.items = Array.isArray(structured?.items) ? structured.items : [];
  error.requested = structured?.requested || null;
  return error;
}

export function isScheduleDismissal(error) {
  return error?.code === 'SCHEDULE_CANCEL' || error?.code === 'SCHEDULE_CHANGE';
}
