import { createIcon } from '../utils/icons.js';

const STORAGE_KEY = 'planify_todo_sidebar_collapsed';

export function initTodoSidebarToggle({ page, sidebar, button }) {
  try {
    page.classList.toggle('todo-sidebar-collapsed', localStorage.getItem(STORAGE_KEY) === 'true');
  } catch (_) {}

  const sync = () => {
    const mobile = window.innerWidth <= 768;
    const expanded = mobile ? sidebar.classList.contains('mobile-open') : !page.classList.contains('todo-sidebar-collapsed');
    if (!expanded && sidebar.contains(document.activeElement)) button.focus();
    sidebar.inert = !expanded;
    sidebar.setAttribute('aria-hidden', String(!expanded));
    button.setAttribute('aria-expanded', String(expanded));
    const label = expanded ? (mobile ? 'Đóng danh sách To Do' : 'Thu gọn danh sách To Do') : 'Mở danh sách To Do';
    button.title = label;
    button.setAttribute('aria-label', label);
    const icon = expanded ? 'chevron-left' : 'panel-left';
    if (button.querySelector('.app-icon')?.dataset.iconName !== icon) button.replaceChildren(createIcon(icon));
  };

  const toggle = () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('mobile-open');
    } else {
      const collapsed = page.classList.toggle('todo-sidebar-collapsed');
      try { localStorage.setItem(STORAGE_KEY, String(collapsed)); } catch (_) {}
    }
    sync();
  };
  button.addEventListener('click', toggle);
  window.addEventListener('resize', sync);
  // List selection and the main mobile menu can also close this drawer.
  const observer = new MutationObserver(sync);
  observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
  sync();

  return () => {
    button.removeEventListener('click', toggle);
    window.removeEventListener('resize', sync);
    observer.disconnect();
  };
}
