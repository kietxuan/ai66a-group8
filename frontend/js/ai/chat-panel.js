import { createElement } from '../utils/dom.js';
import { api } from '../api.js';
import { Toast } from '../components/toast.js';
import { store } from '../store.js';
import { ChatMessage } from './message.js';
import { ChatInput } from './chat-input.js';
import { notifyAiDataChanges } from './sync.js';

export class ChatPanel {
  static instance = null;

  static init() {
    if (!ChatPanel.instance) {
      ChatPanel.instance = new ChatPanel();
    }
    return ChatPanel.instance;
  }

  constructor() {
    this.panelEl = document.getElementById('ai-chat-panel');
    this.messagesListEl = document.getElementById('ai-messages-list');
    this.inputEl = document.getElementById('ai-message-input');
    this.sendBtnEl = document.getElementById('btn-send-ai');
    this.closeBtnEl = document.getElementById('btn-close-ai');

    this.currentConversationId = null;
    this.conversations = [];
    this.chatInput = null;
    this.generation = 0;
    this.sending = false;
    store.on('session-reset', () => {
      this.generation++;
      this.currentConversationId = null;
      this.conversations = [];
      this.sending = false;
      if (this.messagesListEl) this.messagesListEl.innerHTML = '';
      if (this.inputEl) this.inputEl.value = '';
      this.chatInput?.setDisabled(false);
    });

    if (this.panelEl) {
      this.setup();
    }
  }

  setup() {
    // 1. Close button
    if (this.closeBtnEl) {
      this.closeBtnEl.addEventListener('click', () => {
        store.set('isAiPanelOpen', false);
      });
    }

    // 2. Chat input handler
    this.chatInput = new ChatInput({
      inputEl: this.inputEl,
      sendBtnEl: this.sendBtnEl,
      onSend: (text) => this.sendMessage(text)
    });

    // 3. Quick action chips
    const chips = this.panelEl.querySelectorAll('.ai-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.getAttribute('data-prompt');
        if (prompt) {
          this.chatInput.setPrompt(prompt);
          this.sendMessage(prompt);
        }
      });
    });

    // 4. Conversation selector in header
    this.enhanceHeader();

    // 5. Watch for panel opening to load conversation
    store.on('isAiPanelOpen', async (isOpen) => {
      if (isOpen) {
        await this.loadConversations();
      }
    });
  }

  enhanceHeader() {
    const headerTitle = this.panelEl.querySelector('.ai-header-title');
    if (!headerTitle) return;

    // Add "+ Mới" button in header
    const newChatBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      style: { marginLeft: 'auto', marginRight: '8px', fontSize: '11px', padding: '2px 8px' },
      textContent: '+ Hội thoại mới',
      onclick: async () => {
        await this.startNewConversation();
      }
    });

    // Insert before close button
    const header = this.panelEl.querySelector('.ai-header');
    if (header && this.closeBtnEl) {
      header.insertBefore(newChatBtn, this.closeBtnEl);
    }
  }

  async loadConversations() {
    if (!store.get('user')) return;
    const generation = this.generation;
    try {
      const conversations = await api.get('/ai/conversations');
      if (generation !== this.generation) return;
      this.conversations = conversations;
      if (this.conversations && this.conversations.length > 0) {
        if (!this.currentConversationId) {
          // Select most recent conversation
          this.selectConversation(this.conversations[0].id);
        }
      } else {
        // Create initial default conversation
        await this.startNewConversation();
      }
    } catch (err) {
      console.warn('Could not load AI conversations:', err);
    }
  }

  async startNewConversation() {
    const generation = ++this.generation;
    try {
      const conv = await api.post('/ai/conversations', { title: 'Cuộc trò chuyện mới' });
      if (generation !== this.generation) return;
      this.conversations.unshift(conv);
      this.selectConversation(conv.id);
    } catch (err) {
      if (generation !== this.generation) return;
      console.warn('Failed to start new conversation, fallback to quick chat mode');
      this.currentConversationId = null;
    }
  }

  async selectConversation(conversationId) {
    const generation = ++this.generation;
    this.sending = false;
    this.chatInput?.setDisabled(false);
    this.currentConversationId = conversationId;
    if (!this.messagesListEl) return;

    this.messagesListEl.innerHTML = '';

    try {
      const conv = await api.get(`/ai/conversations/${conversationId}`);
      if (generation !== this.generation) return;
      if (conv && conv.messages && conv.messages.length > 0) {
        conv.messages.forEach(msg => {
          let toolCalls = [];
          if (msg.tool_calls) {
            try {
              toolCalls = typeof msg.tool_calls === 'string' ? JSON.parse(msg.tool_calls) : msg.tool_calls;
            } catch (e) {
              toolCalls = [];
            }
          }
          const msgEl = ChatMessage.create({
            role: msg.role,
            content: msg.content,
            toolCalls,
            createdAt: msg.created_at
          });
          this.messagesListEl.appendChild(msgEl);
        });
      } else {
        this.renderWelcomeMessage();
      }
      this.scrollToBottom();
    } catch (err) {
      if (generation !== this.generation) return;
      console.error('Failed to load conversation messages:', err);
      this.renderWelcomeMessage();
    }
  }

  renderWelcomeMessage() {
    this.messagesListEl.innerHTML = '';
    const welcomeEl = ChatMessage.create({
      role: 'assistant',
      content: 'Xin chào! 👋 Tôi là Planify AI. Tôi có thể giúp bạn quản lý sự kiện trên lịch, tạo công việc cần làm, đặt lời nhắc và tối ưu hóa thời gian.\n\nBạn có thể thử các nút gợi ý phía dưới hoặc nhập câu hỏi trực tiếp!',
      toolCalls: []
    });
    this.messagesListEl.appendChild(welcomeEl);
  }

  showTypingIndicator() {
    const existing = document.getElementById('ai-typing-indicator');
    if (existing) existing.remove();

    const indicator = createElement('div', {
      id: 'ai-typing-indicator',
      className: 'ai-message assistant'
    }, [
      createElement('div', { className: 'ai-avatar', textContent: '🤖' }),
      createElement('div', { className: 'ai-bubble ai-typing-indicator' }, [
        createElement('div', { className: 'ai-typing-dot' }),
        createElement('div', { className: 'ai-typing-dot' }),
        createElement('div', { className: 'ai-typing-dot' })
      ])
    ]);

    this.messagesListEl.appendChild(indicator);
    this.scrollToBottom();
  }

  hideTypingIndicator() {
    const indicator = document.getElementById('ai-typing-indicator');
    if (indicator) indicator.remove();
  }

  scrollToBottom() {
    if (this.messagesListEl) {
      this.messagesListEl.scrollTop = this.messagesListEl.scrollHeight;
    }
  }

  async sendMessage(content) {
    if (!content.trim() || this.sending || !store.get('user')) return;
    this.sending = true;
    const generation = this.generation;
    const userId = store.get('user').id;

    // 1. Render user message in chat
    const userMsgEl = ChatMessage.create({
      role: 'user',
      content,
      createdAt: new Date()
    });
    this.messagesListEl.appendChild(userMsgEl);
    this.scrollToBottom();

    // 2. Disable input & show typing indicator
    this.chatInput.setDisabled(true);
    this.showTypingIndicator();

    try {
      let resp;
      if (this.currentConversationId) {
        resp = await api.post(`/ai/conversations/${this.currentConversationId}/messages`, { content });
      } else {
        resp = await api.post('/ai/chat', { content });
        if (generation === this.generation && resp && resp.conversation_id) {
          this.currentConversationId = resp.conversation_id;
        }
      }

      if (store.get('user')?.id === userId) notifyAiDataChanges(resp.tool_calls);
      if (generation !== this.generation) return;
      this.hideTypingIndicator();

      // 3. Render Assistant Response
      let toolCalls = [];
      if (resp.tool_calls) {
        try {
          toolCalls = typeof resp.tool_calls === 'string' ? JSON.parse(resp.tool_calls) : resp.tool_calls;
        } catch (e) {
          toolCalls = [];
        }
      }

      const assistantMsgEl = ChatMessage.create({
        role: 'assistant',
        content: resp.content,
        toolCalls,
        createdAt: resp.created_at || new Date()
      });
      this.messagesListEl.appendChild(assistantMsgEl);
      this.scrollToBottom();

    } catch (err) {
      if (generation !== this.generation) return;
      this.hideTypingIndicator();

      let errorMsg = 'Xin lỗi, đã xảy ra lỗi trong quá trình xử lý yêu cầu của bạn. Vui lòng thử lại sau.';
      if (err.status === 429 || err.message?.includes('30 tin nhắn')) {
        errorMsg = '⚠️ Bạn đã gửi quá 30 tin nhắn trong vòng 1 phút. Vui lòng đợi một chút trước khi tiếp tục trò chuyện nhé!';
      }

      const errorEl = ChatMessage.create({
        role: 'assistant',
        content: errorMsg,
        createdAt: new Date()
      });
      this.messagesListEl.appendChild(errorEl);
      this.scrollToBottom();
      Toast.error(err.message || 'Lỗi kết nối AI');
    } finally {
      if (generation === this.generation) {
        this.sending = false;
        this.chatInput.setDisabled(false);
      }
    }
  }
}

