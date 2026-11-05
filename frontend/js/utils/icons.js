// Official Lucide 1.69.0 SVG assets, self-hosted with their ISC/MIT license.
// This adapter changes presentation only: task titles, notes and chat content
// are never scanned or rewritten as icons.
const glyphs = new Map(Object.entries({
  '📊':'chart-column','✅':'circle-check','📅':'calendar-days','🤖':'bot','📖':'book-open',
  '⚙️':'settings','⚙':'settings','🚪':'log-out','☰':'menu','×':'x','✕':'x','✖':'x',
  '🔍':'search','🔎':'search','☀️':'sun','☀':'sun','☾':'moon','🌙':'moon','✨':'sparkles',
  '🏠':'house','∞':'infinity','📁':'folder','📂':'folder','📋':'list','📝':'file-text',
  '📄':'file-text','🗂️':'folder','🏷️':'tag','🏷':'tag','⭐':'star','🌟':'star','★':'star','☆':'star',
  '🗑️':'trash-2','🗑':'trash-2','✏️':'pencil','✎':'pencil','✓':'check','✔':'check','✔️':'check',
  '☑':'circle-check','☐':'circle','⏰':'clock','🕒':'clock','⏱️':'clock','⚠️':'triangle-alert',
  '⚠':'triangle-alert','❗':'circle-alert','❌':'x','💾':'save','📤':'upload','📥':'download',
  '👤':'user','✉️':'mail','📧':'mail','🔑':'key-round','🔒':'lock-keyhole','🔓':'key-round',
  '🔄':'refresh-cw','💻':'monitor','🖥️':'monitor','❓':'circle-help','📈':'chart-column',
  '📌':'pin','🎯':'target','🔔':'bell','📍':'map-pin','←':'arrow-left','→':'arrow-right',
  '↪':'arrow-right','↩️':'undo-2','⬆️':'arrow-up','⬇️':'arrow-down','⇅':'arrow-up-down',
  '◀':'chevron-left','▶':'chevron-right','▲':'chevron-up','▼':'chevron-down','▾':'chevron-down',
  '⋮':'more-vertical','＋':'plus','➕':'plus','💳':'credit-card','💼':'briefcase',
  '🎓':'graduation-cap','📚':'book-open','🚀':'rocket','🎨':'palette','☕':'coffee',
  '🎧':'headphones','🎵':'music','📷':'camera','✈️':'plane','🚗':'car','🎁':'gift',
  '🎉':'party-popper','🔥':'flame','⚡':'zap','❤️':'heart','🌱':'leaf','📦':'package',
  '🌐':'globe','🏆':'trophy','🛠️':'wrench','🛒':'shopping-cart','🏋️':'dumbbell',
  '📞':'phone','🐾':'paw-print','🧹':'brush','💰':'banknote','🏥':'hospital','💊':'pill','🎬':'film',
  '💡':'lightbulb','🍔':'hamburger','🏃':'person-standing','💬':'message-circle','🖱️':'mouse',
  'ℹ':'info','ℹ️':'info','🔤':'arrow-down-a-z','☀/☾':'sun','+':'plus','−':'minus',
  '✋':'hand','▣':'credit-card','▤':'landmark','‹':'chevron-left','›':'chevron-right','▸':'chevron-right'
}));
const iconNames = new Set([...glyphs.values(), 'layout-dashboard','loader-circle','folder-plus','send','wallet','landmark','list-filter','check-check','panel-left','history','calendar','eye','eye-off']);
const iconUrl = name => new URL(`../../assets/icons/lucide/${name}.svg`, import.meta.url).href;

export function createIcon(name, { size = 18, spin = false } = {}) {
  if (!iconNames.has(name)) name = 'circle-help';
  const icon = document.createElement('span');
  icon.className = `app-icon${spin ? ' icon-spin' : ''}`;
  icon.dataset.iconName = name;
  icon.setAttribute('aria-hidden', 'true');
  icon.style.setProperty('--icon-url', `url("${iconUrl(name)}")`);
  icon.style.setProperty('--icon-size', `${size}px`);
  return icon;
}

export function iconMarkup(name, size = 18) {
  return createIcon(name, { size }).outerHTML;
}

const uiSelector = 'button, h1, h2, h3, h4, [role="status"], [data-icon], [aria-hidden="true"], .nav-icon, .logo-icon, .auth-brand-icon, .landing-brand-icon, .dropdown-icon, .toast-icon, .sidebar-icon-wrap, .theme-icon-light, .theme-icon-dark, .landing-theme-icon-light, .landing-theme-icon-dark, .ai-avatar, .ai-suggestion-icon, .ai-tool-badge, .ai-payment-method-icon, .ai-prompt-category, .guide-icon, .guide-col-title, .guide-box-badge, .guide-card-title > span, .guide-hero a, .command-result-icon, .settings-section-icon, .dash-kpi-icon, .kanban-col-header span, .calendar-view-btn, .ai-header-title > span, .command-search-trigger > span';
const userContent = '.task-title, .task-tag-text, .list-item-title, .todo-title, .ai-bubble, .ai-message-content, .markdown-content, [contenteditable="true"], pre, code';

export function decorateUiElement(element) {
  if (!(element instanceof Element) || element.classList.contains('app-icon') || element.closest(userContent)) return;
  const explicit = element.getAttribute('data-icon');
  if (explicit) {
    const name = iconNames.has(explicit) ? explicit : 'circle-help';
    if (element.querySelector('.app-icon')?.dataset.iconName !== name) element.replaceChildren(createIcon(name));
    return;
  }
  if (!element.matches(uiSelector)) return;
  // A text-only loading state keeps its accessible label while showing a spinner.
  const label = element.textContent.trim();
  if (element.childNodes.length === 1 && element.firstChild.nodeType === 3 && /^Đang (tải|gửi|lưu|đăng nhập|xử lý|tạo|xóa|cập nhật)/i.test(label) && label.length < 150) {
    const accessible = document.createElement('span');
    accessible.className = 'visually-hidden'; accessible.textContent = label;
    element.replaceChildren(createIcon('loader-circle', { spin: true }), accessible);
    return;
  }
  // Only direct text in UI chrome is transformed, never descendants containing user text.
  for (const node of [...element.childNodes]) {
    if (node.nodeType !== 3) continue;
    const text = node.nodeValue;
    const trimmed = text.trim();
    const token = [...glyphs.keys()].find(glyph => trimmed === glyph || trimmed.startsWith(glyph + ' '));
    if (!token) {
      const tail = element.tagName === 'BUTTON' && ['▾', '▼', '→', '←'].find(glyph => trimmed.endsWith(' ' + glyph));
      if (tail) node.replaceWith(document.createTextNode(trimmed.slice(0, -tail.length)), createIcon(glyphs.get(tail)));
      continue;
    }
    const remainder = trimmed.slice(token.length).trimStart();
    if (!remainder && element.tagName === 'BUTTON' && !element.hasAttribute('aria-label')) {
      element.setAttribute('aria-label', element.getAttribute('title') || ({'x':'Đóng','menu':'Mở menu','plus':'Thêm mới','chevron-left':'Trước','chevron-right':'Tiếp','more-vertical':'Tùy chọn'}[glyphs.get(token)] || 'Thao tác'));
    }
    node.replaceWith(createIcon(glyphs.get(token)), ...(remainder ? [document.createTextNode(' ' + remainder)] : []));
  }
}

export function initUiIcons(root = document.body) {
  const render = node => {
    if (!(node instanceof Element)) return;
    decorateUiElement(node);
    node.querySelectorAll(uiSelector).forEach(decorateUiElement);
  };
  render(root);
  const observer = new MutationObserver(records => {
    const roots = new Set();
    for (const record of records) {
      if (record.type === 'characterData') roots.add(record.target.parentElement);
      else { roots.add(record.target); record.addedNodes.forEach(node => { if (node instanceof Element) roots.add(node); }); }
    }
    roots.forEach(render);
  });
  observer.observe(root, { childList: true, characterData: true, subtree: true });
  return () => observer.disconnect();
}
