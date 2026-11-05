import { createElement } from '../utils/dom.js';
import { createIcon } from '../utils/icons.js';
import { formatDate } from '../utils/date.js';

const labels = {
  create_task: 'Đã tạo công việc', create_event: 'Đã tạo lịch hẹn',
  update_task: 'Đã cập nhật công việc', update_event: 'Đã cập nhật lịch hẹn',
  delete_task: 'Đã xóa công việc', delete_event: 'Đã xóa lịch hẹn',
  search_events: 'Đã tìm lịch hẹn', list_tasks: 'Đã tìm công việc',
  find_free_slots: 'Đã tìm khung giờ trống', auto_plan_my_day: 'Đã sắp xếp công việc',
  create_task_list: 'Đã tạo danh sách', update_task_list: 'Đã cập nhật danh sách',
  delete_task_list: 'Đã xóa danh sách', get_productivity_stats: 'Đã lấy thống kê',
};

export function createToolResult(call) {
  let result = call?.result;
  if (typeof result === 'string') { try { result = JSON.parse(result); } catch (_) { result = {}; } }
  result = result && typeof result === 'object' ? result : {};
  const name = String(call?.name || call?.tool || 'Công cụ');
  const conflict = result.code === 'SCHEDULE_CONFLICT' || /SCHEDULE_CONFLICT/.test(String(result.error || ''));
  const pending = !!result.requires_confirmation;
  const success = result.success === true && !conflict && !pending;
  const label = conflict ? 'Trùng lịch' : pending ? 'Chờ xác nhận' : result.success === false ? 'Chưa thực hiện' : success ? (labels[name] || 'Đã thực hiện yêu cầu') : 'Đã nhận phản hồi công cụ';
  const wrapper = createElement('div', { className: 'ai-tool-result', dataset: { status: success ? 'success' : conflict || pending ? 'pending' : result.success === false ? 'error' : 'neutral' } });
  const data = result.data?.task || result.data?.event || result.data;
  if (success && data && typeof data.title === 'string' && data.title.trim()) {
    const times = [data.start_at, data.end_at].filter(value => typeof value === 'string' && !Number.isNaN(new Date(value).getTime()));
    wrapper.appendChild(createElement('div', { className: 'ai-result-card' }, [
      createIcon('circle-check'),
      createElement('div', { className: 'ai-result-content' }, [
        createElement('div', { className: 'ai-result-title', textContent: data.title }),
        times.length ? createElement('div', { className: 'ai-result-time', textContent: times.map(value => formatDate(value, 'DD/MM/YYYY HH:mm')).join(' – ') }) : null,
      ]),
    ]));
  }
  wrapper.appendChild(createElement('details', { className: 'ai-tool-details' }, [
    createElement('summary', {}, [createIcon(success ? 'check' : conflict || pending || result.success === false ? 'circle-alert' : 'settings', { size: 14 }), createElement('span', { textContent: label })]),
    createElement('div', { className: 'ai-tool-technical', textContent: 'Công cụ: ' + name }),
    typeof result.error === 'string' ? createElement('div', { className: 'ai-tool-technical', textContent: result.error }) : null,
  ]));
  return wrapper;
}
