import { store } from '../store.js';
import { AiDemoAccess } from '../ai/demo-access.js';
import { Toast } from './toast.js';

export function initHeaderChat() {
  const button = document.getElementById('btn-header-chat-ai');
  if (!button) return;

  const available = () => store.get('user')?.id != null && ['todo', 'calendar'].includes(store.get('currentRoute'));
  const update = () => {
    button.classList.toggle('hidden', !available());
    const open = !!store.get('isAiPanelOpen');
    button.setAttribute('aria-expanded', String(open));
    button.title = open ? 'Đóng chatbot AI' : 'Mở chatbot AI';
  };
  store.on('currentRoute', update);
  store.on('user', update);
  store.on('isAiPanelOpen', update);
  update();

  button.addEventListener('click', async () => {
    if (button.disabled || !available()) return;
    if (store.get('isAiPanelOpen')) {
      store.set('isAiPanelOpen', false);
      return;
    }

    const route = store.get('currentRoute');
    const userId = store.get('user')?.id;
    button.disabled = true;
    try {
      const accepted = await AiDemoAccess.request();
      if (accepted && available() && route === store.get('currentRoute') && userId === store.get('user')?.id) {
        store.set('isAiPanelOpen', true);
      }
    } catch (_) {
      Toast.error('Không thể mở Chat AI. Vui lòng thử lại.');
    } finally {
      button.disabled = false;
    }
  });
}
