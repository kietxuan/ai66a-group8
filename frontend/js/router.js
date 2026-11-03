import { AuthManager } from './auth.js';
import { store } from './store.js';
import { AiDemoAccess } from './ai/demo-access.js';

const PAGE_META = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Biểu đồ thống kê & tổng quan tiến độ công việc",
  },
  todo: {
    title: "To Do",
    subtitle: "Bảng quản lý chung các công việc & dự án",
  },
  calendar: {
    title: "Calendar",
    subtitle: "Lịch biểu đồng bộ toàn bộ Công việc",
  },
  ai: {
    title: "Trợ lý AI Agent",
    subtitle: "Điều phối toàn bộ công việc & lịch trình bằng ngôn ngữ tự nhiên",
  },
  guide: {
    title: "Hướng dẫn sử dụng",
    subtitle: "Cẩm nang thao tác & mẹo sử dụng Planify",
  },
  settings: {
    title: "Cài đặt hệ thống",
    subtitle:
      "Giao diện Sáng/Tối, thông báo nhắc lịch Email & bảo mật tài khoản",
  },
};

export class Router {
  constructor() {
    this.routes = {};
    this.currentController = null;
    window.addEventListener("hashchange", () => this.handleRoute());
  }

  register(path, controller) {
    this.routes[path] = controller;
  }

  navigate(path) {
    window.location.hash = path.startsWith("#") ? path : `#${path}`;
  }

  async handleRoute() {
    const navigation = this.navigation = (this.navigation || 0) + 1;
    const rawHash = window.location.hash.slice(1).trim();
    const isAuthenticated = AuthManager.isAuthenticated();

    const savedRoute =
      localStorage.getItem("planify_last_route") || "dashboard";
    let targetPath = rawHash || (isAuthenticated ? savedRoute : "landing");
    if (targetPath === "home" || targetPath === "/")
      targetPath = isAuthenticated ? savedRoute : "landing";

    const [path, ...params] = targetPath.split('/');
    if (path !== 'ai') {
      // Approval lasts only for the current AI visit, never across other pages.
      AiDemoAccess.reset();
      if (store.get('isAiPanelOpen')) store.set('isAiPanelOpen', false);
    }

    const publicRoutes = ["landing", "login", "register"];
    const isPublic = publicRoutes.includes(path);

    // 1. Unauthenticated user trying to access protected route
    if (!isAuthenticated && !isPublic) {
      sessionStorage.setItem("planify_redirect_after_login", path);
      window.location.hash = "#login";
      return;
    }

    // 2. Authenticated user visiting login/register -> redirect to dashboard (or saved route)
    if (isAuthenticated && (path === "login" || path === "register")) {
      const redirectPath =
        sessionStorage.getItem("planify_redirect_after_login") ||
        savedRoute ||
        "dashboard";
      sessionStorage.removeItem("planify_redirect_after_login");
      window.location.hash = `#${redirectPath}`;
      return;
    }

    // Demo acknowledgement applies to direct links, sidebar/mobile links and queued prompts.
    if (path === 'ai' && isAuthenticated) {
      const userId = store.get('user')?.id;
      const accepted = await AiDemoAccess.request();
      if (navigation !== this.navigation || userId !== store.get('user')?.id || !AuthManager.isAuthenticated()) return;
      if (!accepted) {
        sessionStorage.removeItem('planify_ai_pending_prompt');
        const previous = store.get('currentRoute');
        this.navigate(['dashboard', 'todo', 'calendar', 'guide', 'settings'].includes(previous) ? previous : 'dashboard');
        return;
      }
    }

    // 3. Toggle containers visibility
    const landingContainer = document.getElementById("landing-container");
    const authContainer = document.getElementById("auth-container");
    const appContainer = document.getElementById("app-container");

    if (path === "landing") {
      if (landingContainer) landingContainer.classList.remove("hidden");
      if (authContainer) authContainer.classList.add("hidden");
      if (appContainer) appContainer.classList.add("hidden");
    } else if (path === "login" || path === "register") {
      if (landingContainer) landingContainer.classList.add("hidden");
      if (authContainer) authContainer.classList.remove("hidden");
      if (appContainer) appContainer.classList.add("hidden");
    } else {
      if (landingContainer) landingContainer.classList.add("hidden");
      if (authContainer) authContainer.classList.add("hidden");
      if (appContainer) appContainer.classList.remove("hidden");
    }

    // 4. Teardown previous controller
    if (
      this.currentController &&
      typeof this.currentController.destroy === "function"
    ) {
      try {
        this.currentController.destroy();
      } catch (err) {
        console.error("Error destroying controller:", err);
      }
    }

    // 5. Lookup controller
    const controller =
      this.routes[path] ||
      (isAuthenticated ? this.routes["dashboard"] : this.routes["landing"]);
    if (controller) {
      this.currentController = controller;
      store.set("currentRoute", path);

      // Update header title & subtitle
      const meta = PAGE_META[path] || PAGE_META.dashboard;
      const titleEl = document.getElementById("app-header-title");
      const subEl = document.getElementById("app-header-subtitle");
      if (titleEl) titleEl.textContent = meta.title;
      if (subEl) subEl.textContent = meta.subtitle;

      // Update desktop sidebar & mobile bottom nav active state
      document.querySelectorAll(".nav-item, .mobile-nav-item").forEach((el) => {
        el.classList.toggle("active", el.dataset.page === path);
      });

      let container = document.getElementById("page-container");
      if (path === "landing") {
        container = document.getElementById("landing-page");
      } else if (path === "login" || path === "register") {
        container = document.getElementById("auth-page");
      }

      if (container && typeof controller.render === "function") {
        await controller.render(container, params);
      }
    }
  }

  start() {
    this.handleRoute();
  }
}

export const router = new Router();
