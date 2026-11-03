import { Modal } from '../components/modal.js';
import { createElement } from '../utils/dom.js';
import { store } from '../store.js';

// A playful acknowledgement only: no billing, checkout, or payment API.
export class AiDemoAccess {
  static acceptedUserId = null;
  static pending = null;

  static isAccepted() {
    const userId = store.get('user')?.id;
    return userId != null && this.acceptedUserId === userId;
  }

  static cancel() {
    this.pending?.finish(false);
  }

  static reset() {
    this.acceptedUserId = null;
    this.cancel();
  }

  static request() {
    const userId = store.get('user')?.id;
    if (userId == null) return Promise.resolve(false);
    if (this.isAccepted()) return Promise.resolve(true);
    if (this.pending?.userId === userId) return this.pending.promise;
    this.reset();

    let resolve;
    const promise = new Promise(done => { resolve = done; });
    const pending = { userId, promise, modal: null, settled: false, switching: false, stage: 'offer' };
    pending.finish = (accepted) => {
      if (pending.settled) return;
      pending.settled = true;
      const granted = accepted && store.get('user')?.id === userId;
      if (granted) {
        this.acceptedUserId = userId;
      }
      if (this.pending === pending) this.pending = null;
      pending.modal?.close();
      resolve(Boolean(granted));
    };
    this.pending = pending;

    const onClose = () => {
      if (!pending.switching) pending.finish(false);
    };
    const showConfirmation = () => {
      if (pending.settled || pending.stage !== 'offer') return;
      pending.stage = 'confirmation';
      pending.switching = true;
      pending.modal.close();
      pending.switching = false;
      pending.modal = Modal.open({
        title: 'Xác nhận thanh toán',
        width: '480px',
        content: createElement('div', { className: 'flex flex-col gap-md' }, [
          createElement('p', { style: { margin: '0', fontWeight: '600', lineHeight: '1.6' }, textContent: 'Bạn có muốn thanh toán 20$ để sử dụng AI không?' })
        ]),
        footerButtons: [
          { label: 'Hủy', onClick: () => pending.finish(false) },
          { label: 'Xác nhận thanh toán', className: 'btn btn-primary', onClick: () => pending.finish(true) }
        ],
        onClose
      });
    };

    pending.modal = Modal.open({
      title: 'Tiếp tục sử dụng Planify AI',
      width: '1100px',
      content: this.createPaymentContent(showConfirmation),
      onClose
    });
    pending.modal.backdrop.classList.add('ai-payment-overlay');
    return promise;
  }

  static createPaymentContent(onPay) {
    const art = createElement('div', { className: 'ai-payment-art', 'aria-hidden': 'true' }, [
      createElement('div', { className: 'ai-payment-halo' }),
      createElement('div', { className: 'ai-payment-shadow' }),
      createElement('div', { className: 'ai-payment-card' }, [
        createElement('div', { className: 'ai-payment-chip' }),
        createElement('span', { className: 'ai-payment-contactless', textContent: ')))' }),
        createElement('div', { className: 'ai-payment-card-lines' }, [
          ...Array.from({ length: 3 }, () => createElement('span'))
        ]),
        createElement('div', { className: 'ai-payment-card-name' })
      ]),
      createElement('div', { className: 'ai-payment-ticket', textContent: '$20' }),
      createElement('div', { className: 'ai-payment-sparks' }, [createElement('i'), createElement('i'), createElement('i')])
    ]);

    const methods = createElement('fieldset', { className: 'ai-payment-methods' }, [
      createElement('legend', { textContent: 'Chọn phương thức thanh toán' })
    ]);
    const options = [
      { value: 'card', icon: '▣', label: 'Thẻ tín dụng / Ghi nợ', brands: 'VISA  ●●  AMEX' },
      { value: 'paypal', icon: 'P', label: 'PayPal' },
      { value: 'bank', icon: '▤', label: 'Chuyển khoản ngân hàng' }
    ];
    const rows = [];
    options.forEach((option, index) => {
      const radio = createElement('input', {
        type: 'radio', name: 'ai-payment-method', value: option.value, checked: index === 0,
        onchange: () => rows.forEach(({ row, input }) => row.classList.toggle('is-selected', input.checked))
      });
      const row = createElement('label', { className: `ai-payment-option${index === 0 ? ' is-selected' : ''}` }, [
        radio,
        createElement('span', { className: 'ai-payment-radio', 'aria-hidden': 'true' }),
        createElement('span', { className: `ai-payment-method-icon ai-payment-method-${option.value}`, 'aria-hidden': 'true', textContent: option.icon }),
        createElement('span', { className: 'ai-payment-method-label', textContent: option.label }),
        ...(option.brands ? [createElement('span', { className: 'ai-payment-brands', 'aria-hidden': 'true', textContent: option.brands })] : [])
      ]);
      rows.push({ row, input: radio });
      methods.appendChild(row);
    });

    const details = createElement('div', { className: 'ai-payment-details' }, [
      createElement('h2', { className: 'ai-payment-heading', textContent: 'Tiếp tục sử dụng Planify AI' }),
      createElement('p', { className: 'ai-payment-description', textContent: 'Hoàn tất thanh toán để tiếp tục trải nghiệm toàn bộ tính năng cao cấp.' }),
      createElement('div', { className: 'ai-payment-price' }, [
        createElement('strong', { textContent: '$20.00' }), createElement('span', { textContent: '/ tháng' })
      ]),
      methods,
      createElement('button', { type: 'button', className: 'ai-payment-pay', onclick: onPay }, [
        createElement('span', { textContent: 'Thanh toán $20.00' }),
        createElement('span', { 'aria-hidden': 'true', textContent: '→' })
      ]),
      createElement('p', { className: 'ai-payment-signature', textContent: 'PLANIFY PRO · AI PREMIUM' })
    ]);
    return createElement('div', { className: 'ai-payment-layout' }, [art, details]);
  }
}

store.on('session-reset', () => AiDemoAccess.reset());
