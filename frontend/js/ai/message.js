import { createElement } from '../utils/dom.js';
import { formatDate } from '../utils/date.js';

export class ChatMessage {
  /**
   * Simple markdown parser for basic formatting (bold, italic, code, bullets, newlines)
   */
  static parseMarkdown(text) {
    if (!text) return '';

    let html = text
      // Escape HTML chars
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Bold **text**
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic *text*
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Inline code `code`
      .replace(/`([^`]+)`/g, '<code style="background:var(--color-bg-tertiary);padding:1px 4px;border-radius:3px;font-size:0.9em;">$1</code>')
      // Bullet points
      .replace(/^[\*\-]\s+(.*)$/gm, '<li style="margin-left:16px;">$1</li>')
      // Newlines to <br>
      .replace(/\n/g, '<br>');

    return html;
  }

  static create({ role, content, toolCalls = [], createdAt = new Date() }) {
    const isUser = role === 'user';

    const msgEl = createElement('div', {
      className: `ai-message ${isUser ? 'user' : 'assistant'}`
    });

    const avatar = createElement('div', {
      className: 'ai-avatar',
      textContent: isUser ? '👤' : '🤖'
    });

    const bubbleWrapper = createElement('div', { className: 'flex flex-col gap-xs' });

    const bubble = createElement('div', {
      className: 'ai-bubble',
      innerHTML: ChatMessage.parseMarkdown(content)
    });

    bubbleWrapper.appendChild(bubble);

    // If there are tool calls, display execution badges
    if (toolCalls && toolCalls.length > 0) {
      const toolBadgesContainer = createElement('div', {
        className: 'flex flex-col gap-xs',
        style: { marginTop: '4px' }
      });

      toolCalls.forEach(tc => {
        const toolName = tc.name || tc.tool || 'Công cụ';
        const badge = createElement('div', {
          className: 'ai-tool-badge cursor-pointer',
          title: tc.args ? JSON.stringify(tc.args, null, 2) : 'Đã thực thi công cụ thành công',
          innerHTML: `<span>⚙️</span> <span>Đã gọi: <strong>${toolName}</strong></span>`
        });
        toolBadgesContainer.appendChild(badge);
      });

      bubbleWrapper.appendChild(toolBadgesContainer);
    }

    // Timestamp
    const timeEl = createElement('span', {
      style: {
        fontSize: '10px',
        color: 'var(--color-text-tertiary)',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        padding: '0 4px'
      },
      textContent: formatDate(createdAt, 'HH:mm')
    });
    bubbleWrapper.appendChild(timeEl);

    msgEl.appendChild(avatar);
    msgEl.appendChild(bubbleWrapper);

    return msgEl;
  }
}

