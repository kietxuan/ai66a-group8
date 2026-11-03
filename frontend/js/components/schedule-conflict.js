import { createElement } from '../utils/dom.js';
import { Modal } from './modal.js';

export function chooseScheduleConflict(items, requested = null) {
  return new Promise(resolve => {
    let choice = 'cancel';
    const format = value => value.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' });
    const chosenStart = requested?.start ? new Date(requested.start) : null;
    const chosenEnd = requested?.end ? new Date(requested.end) : null;
    const chosenRange = chosenStart && chosenEnd && !Number.isNaN(chosenStart.getTime()) && !Number.isNaN(chosenEnd.getTime())
      ? createElement('p', { textContent: `Bạn đang chọn: ${format(chosenStart)} – ${format(chosenEnd)}` })
      : null;
    const list = createElement('ul', { style: { paddingLeft: '20px' } }, items.map(item => {
      const start = new Date(item.start);
      const end = new Date(item.end);
      return createElement('li', { textContent: `${item.title}: ${format(start)} – ${format(end)}` });
    }));
    const content = createElement('div', {}, [
      createElement('p', { textContent: `Lịch bạn chọn trùng với ${items.length} mục sau. Bạn muốn làm gì?` }),
      ...(chosenRange ? [chosenRange] : []),
      list
    ]);
    const modal = Modal.open({
      title: 'Cảnh báo trùng lịch', content, allowStack: true,
      onClose: () => resolve(choice),
      footerButtons: [
        { label: 'Đổi giờ', className: 'btn btn-primary', onClick: () => { choice = 'change'; modal.close(); } },
        { label: 'Hủy', className: 'btn btn-secondary', onClick: () => modal.close() },
        { label: 'Vẫn tiếp tục', className: 'btn btn-danger', onClick: () => { choice = 'continue'; modal.close(); } }
      ]
    });
  });
}
