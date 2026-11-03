import { createElement } from '../utils/dom.js';
import { api } from '../api.js';
import { Toast } from '../components/toast.js';
import { ChatMessage } from '../ai/message.js';
import { ChatInput } from '../ai/chat-input.js';
import { store } from '../store.js';
import { notifyAiDataChanges } from '../ai/sync.js';

const PROMPT_CATEGORIES = [
  {
    title: '✨ Lập kế hoạch thông minh',
    prompts: [
      'Tự động lập kế hoạch hôm nay giúp tôi',
      'Tìm khung giờ trống 60 phút hôm nay',
      'Hôm nay tôi có những sự kiện và công việc gì?',
      'Xem báo cáo thống kê năng suất của tôi'
    ]
  },
  {
    title: '📅 Điều khiển Lịch biểu',
    prompts: [
      "Tạo sự kiện 'Họp chiến lược sản phẩm' từ 09:00 đến 10:30 hôm nay",
      "Lên lịch 'Tập thể dục buổi chiều' lúc 17:30 lặp lại hàng ngày",
      "Tạo nhóm lịch mới tên là 'Dự án Khởi nghiệp'"
    ]
  },
  {
    title: '✅ Quản lý Việc cần làm (To Do)',
    prompts: [
      "Tạo việc cần làm 'Hoàn thiện báo cáo Q4' hạn hôm nay lúc 14:00 đến 15:30 và đánh dấu quan trọng",
      'Liệt kê các việc quan trọng cần làm',
      'Dời toàn bộ việc quá hạn sang hôm nay',
      'Dọn dẹp các việc đã hoàn thành'
    ]
  }
];

export const aiPage = {
  container: null,
  conversations: [],
  currentConversationId: null,
  messagesListEl: null,
  convListEl: null,
  chatInput: null,

  async render(container) {
    const renderGeneration = this.renderGeneration = (this.renderGeneration || 0) + 1;
    this.generation = (this.generation || 0) + 1;
    this.sending = false;
    this.container = container;
    container.innerHTML = '';

    const page = createElement('div', { className: 'ai-workspace-page' });

    // 1. Left Sidebar (Conversations + Prompt Library)
    const sidebar = createElement('aside', { className: 'ai-workspace-sidebar' });

    const newConvBtn = createElement('button', {
      className: 'btn btn-primary',
      style: { width: '100%' },
      textContent: '＋ Cuộc trò chuyện mới',
      onclick: () => this.startNewConversation()
    });

    const convSectionTitle = createElement('div', {
      style: { fontSize: '11px', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' },
      textContent: 'Lịch sử trò chuyện'
    });

    this.convListEl = createElement('div', {
      className: 'flex flex-col gap-xs',
      style: { maxHeight: '180px', overflowY: 'auto' }
    });

    // Prompt Library Section
    const promptSection = createElement('div', {
      className: 'flex flex-col gap-md',
      style: { borderTop: '1px solid var(--color-border-light)', paddingTop: '12px', marginTop: '4px' }
    });

    PROMPT_CATEGORIES.forEach(cat => {
      const catBlock = createElement('div', { className: 'flex flex-col gap-xs' }, [
        createElement('div', { style: { fontSize: '12px', fontWeight: '700', color: 'var(--color-text-primary)' }, textContent: cat.title }),
        ...cat.prompts.map(p => createElement('button', {
          className: 'ai-chip',
          style: { textAlign: 'left', whiteSpace: 'normal', lineHeight: '1.35', padding: '7px 10px', borderRadius: '8px' },
          textContent: p,
          onclick: () => this.sendMessage(p)
        }))
      ]);
      promptSection.appendChild(catBlock);
    });

    sidebar.appendChild(newConvBtn);
    sidebar.appendChild(convSectionTitle);
    sidebar.appendChild(this.convListEl);
    sidebar.appendChild(promptSection);

    // 2. Main Chat Area
    const main = createElement('div', { className: 'ai-workspace-main' });

    const header = createElement('div', {
      style: {
        padding: '12px 24px',
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, [
      createElement('div', { className: 'flex items-center gap-sm' }, [
        createElement('span', { style: { fontSize: '22px' }, textContent: '🤖' }),
        createElement('div', {}, [
          createElement('div', { style: { fontWeight: '700', fontSize: '15px' }, textContent: 'Planify AI Agent — Trung tâm Điều phối Thông minh' }),
          createElement('div', { style: { fontSize: '12px', color: 'var(--color-text-secondary)' }, textContent: 'Công cụ quản lý Lịch biểu, To Do, Subtasks & Thống kê. Kiểm tra kết quả trước khi tiếp tục.' })
        ])
      ])
    ]);

    this.messagesListEl = createElement('div', {
      className: 'ai-messages-container',
      style: { maxWidth: '920px', width: '100%', margin: '0 auto' }
    });

    const inputEl = createElement('input', {
      type: 'text',
      className: 'ai-input',
      placeholder: 'Nhập yêu cầu bằng tiếng Việt tự nhiên (VD: "Tự động lập kế hoạch hôm nay", "Tạo lịch họp 9h sáng mai")...'
    });

    const sendBtnEl = createElement('button', {
      className: 'btn btn-primary btn-sm',
      textContent: 'Gửi lệnh 🚀'
    });

    const inputFooter = createElement('div', {
      className: 'ai-input-area',
      style: { maxWidth: '920px', width: '100%', margin: '0 auto', backgroundColor: 'transparent', borderTop: 'none' }
    }, [
      createElement('div', { className: 'ai-input-box', style: { padding: '8px 14px', boxShadow: 'var(--shadow-sm)' } }, [
        inputEl,
        sendBtnEl
      ])
    ]);

    main.appendChild(header);
    main.appendChild(this.messagesListEl);
    main.appendChild(inputFooter);

    page.appendChild(sidebar);
    page.appendChild(main);
    container.appendChild(page);

    this.chatInput = new ChatInput({
      inputEl,
      sendBtnEl,
      onSend: (text) => this.sendMessage(text)
    });

    await this.loadConversations();
    if (renderGeneration !== this.renderGeneration || !this.container) return;

    // Check if there is a pre-queued prompt from Guide or Dashboard
    const pendingPrompt = sessionStorage.getItem('planify_ai_pending_prompt');
    if (pendingPrompt) {
      sessionStorage.removeItem('planify_ai_pending_prompt');
      this.sendMessage(pendingPrompt);
    }
  },

  async loadConversations() {
    const generation = this.generation;
    try {
      const conversations = await api.get('/ai/conversations');
      if (generation !== this.generation || !this.container) return;
      this.conversations = conversations;
      this.renderConversationList();
      if (this.conversations && this.conversations.length > 0) {
        await this.selectConversation(this.conversations[0].id);
      } else {
        await this.startNewConversation();
      }
    } catch (err) {
      this.renderWelcomeMessage();
    }
  },

  renderConversationList() {
    if (!this.convListEl) return;
    this.convListEl.innerHTML = '';
    (this.conversations || []).forEach(c => {
      const isAct = c.id === this.currentConversationId;
      const item = createElement('div', {
        className: `ai-conv-item ${isAct ? 'active' : ''}`,
        onclick: () => this.selectConversation(c.id)
      }, [
        createElement('span', { className: 'truncate flex-1', textContent: `💬 ${c.title || 'Hội thoại'}` }),
        createElement('button', {
          className: 'btn-icon',
          style: { width: '20px', height: '20px', fontSize: '12px' },
          innerHTML: '&times;',
          title: 'Xóa hội thoại',
          onclick: async (e) => {
            e.stopPropagation();
            try {
              await api.delete(`/ai/conversations/${c.id}`);
              this.conversations = this.conversations.filter(x => x.id !== c.id);
              if (this.currentConversationId === c.id) {
                this.currentConversationId = null;
              }
              await this.loadConversations();
            } catch (_) {}
          }
        })
      ]);
      this.convListEl.appendChild(item);
    });
  },

  async startNewConversation() {
    const generation = ++this.generation;
    try {
      const conv = await api.post('/ai/conversations', { title: 'Cuộc trò chuyện mới' });
      if (generation !== this.generation || !this.container) return;
      this.conversations.unshift(conv);
      await this.selectConversation(conv.id);
    } catch (_) {
      this.currentConversationId = null;
      this.renderWelcomeMessage();
    }
  },

  async selectConversation(convId) {
    const generation = ++this.generation;
    this.sending = false;
    this.chatInput?.setDisabled(false);
    this.currentConversationId = convId;
    this.renderConversationList();
    if (!this.messagesListEl) return;
    this.messagesListEl.innerHTML = '';

    try {
      const conv = await api.get(`/ai/conversations/${convId}`);
      if (generation !== this.generation || !this.container) return;
      if (conv && conv.messages && conv.messages.length > 0) {
        conv.messages.forEach(msg => {
          let toolCalls = [];
          if (msg.tool_calls) {
            try {
              toolCalls = typeof msg.tool_calls === 'string' ? JSON.parse(msg.tool_calls) : msg.tool_calls;
            } catch (_) {}
          }
          this.messagesListEl.appendChild(ChatMessage.create({
            role: msg.role,
            content: msg.content,
            toolCalls,
            createdAt: msg.created_at
          }));
        });
      } else {
        this.renderWelcomeMessage();
      }
      this.scrollToBottom();
    } catch (_) {
      this.renderWelcomeMessage();
    }
  },

  renderWelcomeMessage() {
    if (!this.messagesListEl) return;
    this.messagesListEl.innerHTML = '';
    this.messagesListEl.appendChild(ChatMessage.create({
      role: 'assistant',
      content: (
        'Xin chào! 👋 Tôi là **Planify AI Agent**.\n\n' +
        'Tôi hỗ trợ các tác vụ dưới đây. Hãy kiểm tra kết quả; yêu cầu chưa rõ có thể cần bổ sung thông tin. Không xử lý mật khẩu hoặc tác vụ bảo mật.\n' +
        '- ✨ **Lập kế hoạch tự động**: *"Tự động lập kế hoạch hôm nay giúp tôi"*\n' +
        '- 📅 **Quản lý Lịch biểu**: Tạo sự kiện đơn/lặp lại, dời lịch, kiểm tra trùng lịch, tìm khung giờ trống.\n' +
        '- ✅ **Quản lý To Do**: Tạo việc cần làm gắn khung giờ Time-Blocking, đánh dấu quan trọng, thêm bước nhỏ (subtasks), dời việc quá hạn hàng loạt.\n\n' +
        'Hãy chọn một kịch bản mẫu ở cột bên trái hoặc nhập yêu cầu của bạn vào ô bên dưới nhé!'
      ),
      toolCalls: []
    }));
  },

  scrollToBottom() {
    if (this.messagesListEl) {
      this.messagesListEl.scrollTop = this.messagesListEl.scrollHeight;
    }
  },

  async sendMessage(content) {
    if (!content || !content.trim() || !this.messagesListEl || this.sending || !store.get('user')) return;
    this.sending = true;
    const generation = this.generation;
    const userId = store.get('user').id;

    this.messagesListEl.appendChild(ChatMessage.create({
      role: 'user',
      content,
      createdAt: new Date()
    }));
    this.scrollToBottom();

    this.chatInput.setDisabled(true);

    const typingEl = createElement('div', { className: 'ai-message assistant' }, [
      createElement('div', { className: 'ai-avatar', textContent: '🤖' }),
      createElement('div', { className: 'ai-bubble ai-typing-indicator' }, [
        createElement('div', { className: 'ai-typing-dot' }),
        createElement('div', { className: 'ai-typing-dot' }),
        createElement('div', { className: 'ai-typing-dot' })
      ])
    ]);
    this.messagesListEl.appendChild(typingEl);
    this.scrollToBottom();

    try {
      let resp;
      if (this.currentConversationId) {
        resp = await api.post(`/ai/conversations/${this.currentConversationId}/messages`, { content });
      } else {
        resp = await api.post('/ai/chat', { content });
        if (generation === this.generation && resp?.conversation_id) {
          this.currentConversationId = resp.conversation_id;
        }
      }
      if (store.get('user')?.id === userId) notifyAiDataChanges(resp.tool_calls);
      if (generation !== this.generation || !this.container) return;
      typingEl.remove();

      let toolCalls = [];
      if (resp.tool_calls) {
        try {
          toolCalls = typeof resp.tool_calls === 'string' ? JSON.parse(resp.tool_calls) : resp.tool_calls;
        } catch (_) {}
      }

      this.messagesListEl.appendChild(ChatMessage.create({
        role: 'assistant',
        content: resp.content,
        toolCalls,
        createdAt: resp.created_at || new Date()
      }));
      this.scrollToBottom();

    } catch (err) {
      typingEl.remove();
      if (generation !== this.generation || !this.container) return;
      Toast.error(err.message || 'Lỗi kết nối AI');
    } finally {
      if (generation === this.generation) {
        this.sending = false;
        this.chatInput.setDisabled(false);
      }
    }
  },

  destroy() {
    this.renderGeneration = (this.renderGeneration || 0) + 1;
    this.generation = (this.generation || 0) + 1;
    this.currentConversationId = null;
    this.conversations = [];
    this.messagesListEl = null;
    this.sending = false;
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
};
store.on('session-reset', () => aiPage.destroy());
