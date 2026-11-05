export class ChatInput {
  constructor({ inputEl, sendBtnEl, onSend = null }) {
    this.inputEl = inputEl;
    this.sendBtnEl = sendBtnEl;
    this.onSend = onSend;
    this.isSending = false;

    this.bindEvents();
  }

  bindEvents() {
    if (this.inputEl) {
      this.inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.submit();
        }
      });
    }

    if (this.sendBtnEl) {
      this.sendBtnEl.addEventListener('click', () => {
        this.submit();
      });
    }
  }

  setPrompt(text) {
    if (this.inputEl) {
      this.inputEl.value = text;
      this.inputEl.focus();
    }
  }

  setDisabled(disabled) {
    this.isSending = disabled;
    if (this.inputEl) {
      this.inputEl.disabled = disabled;
      if (disabled) {
        this.inputEl.placeholder = 'AI đang suy nghĩ và thực thi...';
      } else {
        this.inputEl.placeholder = 'Hỏi AI hoặc yêu cầu tạo lịch/task...';
        this.inputEl.focus();
      }
    }
    if (this.sendBtnEl) {
      this.sendBtnEl.disabled = disabled;
      this.sendBtnEl.textContent = disabled ? 'Đang gửi...' : 'Gửi';
    }
  }

  submit() {
    if (this.isSending || !this.inputEl) return;
    const text = this.inputEl.value.trim();
    if (!text) return;

    this.inputEl.value = '';
    if (this.onSend) {
      this.onSend(text);
    }
  }
}

