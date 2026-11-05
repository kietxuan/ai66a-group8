import { AuthManager } from '../auth.js';
import { Toast } from './toast.js';

export class Sidebar {
  static init() {
    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('btn-mobile-menu');
    const closeMobileBtn = document.getElementById('btn-close-sidebar-mobile');
    const backdrop = document.getElementById('mobile-sidebar-backdrop');
    const sidebarEl = document.getElementById('sidebar');

    const closeMobileSidebar = () => {
      if (window.innerWidth <= 768 && sidebarEl?.contains(document.activeElement)) mobileMenuBtn?.focus();
      if (sidebarEl) sidebarEl.classList.remove('mobile-open');
      if (backdrop) backdrop.classList.add('hidden');
      document.getElementById('todo-sub-sidebar')?.classList.remove('mobile-open');
      document.getElementById('calendar-sub-sidebar')?.classList.remove('mobile-open');
      mobileMenuBtn?.setAttribute('aria-expanded', 'false');
      if (sidebarEl) sidebarEl.inert = window.innerWidth <= 768;
    };

    const openMobileSidebar = () => {
      if (sidebarEl) sidebarEl.inert = false;
      if (sidebarEl) sidebarEl.classList.add('mobile-open');
      if (backdrop) backdrop.classList.remove('hidden');
      mobileMenuBtn?.setAttribute('aria-expanded', 'true');
      closeMobileBtn?.focus();
    };

    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', openMobileSidebar);
    }
    if (closeMobileBtn) {
      closeMobileBtn.addEventListener('click', closeMobileSidebar);
    }
    if (backdrop) {
      backdrop.addEventListener('click', closeMobileSidebar);
    }
    closeMobileSidebar();
    document.addEventListener('keydown', event => {
      if (!sidebarEl?.classList.contains('mobile-open')) return;
      if (event.key === 'Escape') {
        event.preventDefault(); closeMobileSidebar(); mobileMenuBtn?.focus();
      } else if (event.key === 'Tab') {
        const items = [...sidebarEl.querySelectorAll('a, button')].filter(item => item.getClientRects().length && !item.disabled);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });

    // Clean up mobile drawers automatically when resizing between desktop and mobile viewports
    window.addEventListener('resize', () => {
      closeMobileSidebar();
    });

    // Close mobile sidebar when clicking any nav item
    document.querySelectorAll('.sidebar .nav-item').forEach(link => {
      link.addEventListener('click', () => {
        closeMobileSidebar();
      });
    });

    // Logout handling
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        AuthManager.logout();
        Toast.info('Đã đăng xuất khỏi tài khoản.');
      });
    }
  }
}
