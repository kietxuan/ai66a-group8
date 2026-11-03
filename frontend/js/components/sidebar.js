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
      if (sidebarEl) sidebarEl.classList.remove('mobile-open');
      if (backdrop) backdrop.classList.add('hidden');
      document.getElementById('todo-sub-sidebar')?.classList.remove('mobile-open');
      document.getElementById('calendar-sub-sidebar')?.classList.remove('mobile-open');
    };

    const openMobileSidebar = () => {
      if (sidebarEl) sidebarEl.classList.add('mobile-open');
      if (backdrop) backdrop.classList.remove('hidden');
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

    // Clean up mobile drawers automatically when resizing between desktop and mobile viewports
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        closeMobileSidebar();
      }
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
