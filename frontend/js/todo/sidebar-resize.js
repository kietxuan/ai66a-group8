const STORAGE_KEY = 'planify_todo_sidebar_width';
const MIN_WIDTH = 200;
const MAX_WIDTH = 520;

export function initTodoSidebarResize({ page, handle }) {
  let preferredWidth = 216;
  let drag = null;
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(saved) && saved >= MIN_WIDTH) preferredWidth = Math.min(saved, MAX_WIDTH);
  } catch (_) {}

  const maxWidth = () => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, page.clientWidth - 360));
  const apply = width => {
    const actual = Math.round(Math.max(MIN_WIDTH, Math.min(maxWidth(), width)));
    page.style.setProperty('--todo-sidebar-width', `${actual}px`);
    handle.setAttribute('aria-valuemax', String(maxWidth()));
    handle.setAttribute('aria-valuenow', String(actual));
    return actual;
  };
  const save = () => { try { localStorage.setItem(STORAGE_KEY, String(preferredWidth)); } catch (_) {} };
  const stop = () => {
    if (!drag) return;
    const pointerId = drag.id;
    drag = null;
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    page.classList.remove('todo-sidebar-resizing');
    save();
  };
  const down = event => {
    if (event.button !== 0 || window.innerWidth <= 768 || page.classList.contains('todo-sidebar-collapsed')) return;
    event.preventDefault();
    drag = { id: event.pointerId, x: event.clientX, width: apply(preferredWidth) };
    handle.setPointerCapture(event.pointerId);
    handle.focus();
    page.classList.add('todo-sidebar-resizing');
  };
  const move = event => {
    if (!drag || drag.id !== event.pointerId) return;
    preferredWidth = apply(drag.width + event.clientX - drag.x);
  };
  const keydown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = Number(handle.getAttribute('aria-valuenow'));
    preferredWidth = apply(event.key === 'Home' ? MIN_WIDTH : event.key === 'End' ? maxWidth() : current + (event.key === 'ArrowRight' ? 16 : -16));
    save();
  };
  const resize = () => apply(preferredWidth);
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', 'Điều chỉnh chiều rộng danh sách công việc');
  handle.setAttribute('aria-controls', 'todo-sub-sidebar');
  handle.setAttribute('aria-valuemin', String(MIN_WIDTH));
  handle.tabIndex = 0;
  handle.title = 'Kéo để mở rộng danh sách';
  const listeners = { pointerdown: down, pointermove: move, pointerup: stop, pointercancel: stop, lostpointercapture: stop, keydown };
  Object.entries(listeners).forEach(([name, fn]) => handle.addEventListener(name, fn));
  const observer = new ResizeObserver(resize);
  observer.observe(page);
  resize();
  return () => {
    stop();
    observer.disconnect();
    Object.entries(listeners).forEach(([name, fn]) => handle.removeEventListener(name, fn));
  };
}
