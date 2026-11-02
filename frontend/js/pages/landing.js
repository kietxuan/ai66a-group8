import { createElement } from '../utils/dom.js';
import { AuthManager } from '../auth.js';
import { ThemeManager } from '../theme.js';

const PROJECT_GITHUB_URL = 'https://github.com/kietxuan/ai66a-group8';
const CONTACT_EMAIL = 'planify.appvn@gmail.com';

export const landingPage = {
  container: null,

  render(container) {
    this.container = container;
    container.innerHTML = '';

    const isAuthenticated = AuthManager.isAuthenticated();
    const page = createElement('div', { className: 'landing-container' });
    const scroller = container.parentElement;
    const scrollBehavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    const scrollTo = (sectionId) => {
      if (sectionId === 'home') {
        scroller?.scrollTo({ top: 0, behavior: scrollBehavior });
      } else {
        page.querySelector(`#${sectionId}`)?.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
      }
    };
    const sectionButton = (label, sectionId, className = 'landing-text-link') => createElement('button', {
      type: 'button',
      className,
      textContent: label,
      onclick: () => scrollTo(sectionId)
    });

    const brand = (className) => createElement('div', { className }, [
      createElement('span', { className: 'landing-brand-icon', textContent: '✦', 'aria-hidden': 'true' }),
      createElement('span', { textContent: 'Planify Pro' })
    ]);

    const themeButton = createElement('button', {
      type: 'button',
      className: 'landing-theme-toggle',
      title: 'Đổi giao diện sáng/tối',
      'aria-label': 'Đổi giao diện sáng/tối',
      'aria-pressed': ThemeManager.getSavedTheme() === 'dark' ? 'true' : 'false',
      onclick: () => {
        ThemeManager.toggle();
        themeButton.setAttribute('aria-pressed', ThemeManager.getSavedTheme() === 'dark' ? 'true' : 'false');
      }
    }, [
      createElement('span', { className: 'landing-theme-icon-light', textContent: '☾', 'aria-hidden': 'true' }),
      createElement('span', { className: 'landing-theme-icon-dark', textContent: '☀', 'aria-hidden': 'true' })
    ]);

    const header = createElement('header', { className: 'landing-navbar' }, [
      createElement('div', { className: 'landing-navbar-inner' }, [
        createElement('a', {
          href: '#landing',
          className: 'landing-logo',
          'aria-label': 'Planify Pro — về đầu trang',
          onclick: (event) => {
            event.preventDefault();
            scrollTo('home');
          }
        }, [brand('landing-brand')]),
        createElement('nav', { className: 'landing-nav-links', 'aria-label': 'Điều hướng trang chủ' }, [
          sectionButton('Trang chủ', 'home', 'landing-nav-link'),
          sectionButton('Giới thiệu', 'about', 'landing-nav-link')
        ]),
        createElement('div', { className: 'landing-nav-actions' }, isAuthenticated
          ? [
              themeButton,
              createElement('a', { href: '#dashboard', className: 'landing-button landing-button-primary', textContent: 'Vào ứng dụng' })
            ]
          : [
              themeButton,
              createElement('a', { href: '#login', className: 'landing-login-link', textContent: 'Đăng nhập' }),
              createElement('a', { href: '#register', className: 'landing-button landing-button-primary', textContent: 'Đăng ký' })
            ])
      ])
    ]);

    const hero = createElement('section', { className: 'landing-hero', id: 'home' }, [
      createElement('div', { className: 'landing-hero-glow', 'aria-hidden': 'true' }),
      createElement('div', { className: 'landing-hero-content' }, [
        createElement('p', { className: 'landing-eyebrow', textContent: 'SẮP XẾP NGÀY CỦA BẠN, THEO CÁCH DỄ DÀNG HƠN' }),
        createElement('h1', { className: 'landing-title' }, [
          createElement('span', { textContent: 'Planify Pro' }),
          createElement('span', { className: 'landing-title-highlight', textContent: 'Mọi kế hoạch trong tầm tay.' })
        ]),
        createElement('p', {
          className: 'landing-subtitle',
          textContent: 'Quản lý công việc, sắp xếp lịch cá nhân và nhận hỗ trợ từ trợ lý AI trong cùng một không gian.'
        }),
        createElement('a', {
          href: isAuthenticated ? '#dashboard' : '#register',
          className: 'landing-button landing-button-primary landing-hero-cta',
          textContent: isAuthenticated ? 'Vào ứng dụng  →' : 'Bắt đầu miễn phí  →'
        }),
        createElement('div', { className: 'landing-hero-points', 'aria-label': 'Các chức năng chính' }, [
          createElement('span', { textContent: '✓ Công việc' }),
          createElement('span', { textContent: '✓ Lịch biểu' }),
          createElement('span', { textContent: '✓ Trợ lý AI' })
        ])
      ])
    ]);

    const featureCard = (icon, title, description, className) => createElement('article', {
      className: `landing-feature-card ${className}`
    }, [
      createElement('div', { className: 'landing-feature-icon', textContent: icon, 'aria-hidden': 'true' }),
      createElement('h3', { textContent: title }),
      createElement('p', { textContent: description })
    ]);

    const about = createElement('section', { className: 'landing-about', id: 'about' }, [
      createElement('div', { className: 'landing-section-heading' }, [
        createElement('p', { className: 'landing-section-kicker', textContent: 'MỘT NƠI CHO MỌI KẾ HOẠCH' }),
        createElement('h2', { textContent: 'Giới thiệu về Planify Pro' }),
        createElement('p', { textContent: 'Ba công cụ thiết yếu giúp bạn lên kế hoạch và theo dõi mỗi ngày.' })
      ]),
      createElement('div', { className: 'landing-feature-grid' }, [
        featureCard('☑', 'Quản lý công việc', 'Tạo công việc, đặt hạn hoàn thành và theo dõi tiến độ.', 'landing-feature-todo'),
        featureCard('▦', 'Lịch biểu cá nhân', 'Xem và sắp xếp công việc, sự kiện theo ngày, tuần hoặc tháng.', 'landing-feature-calendar'),
        featureCard('✧', 'Trợ lý AI', 'Hỏi về lịch trình, tìm khung giờ trống và hỗ trợ quản lý công việc bằng ngôn ngữ tự nhiên.', 'landing-feature-ai')
      ])
    ]);

    const footerLinks = (items) => createElement('div', { className: 'landing-footer-links' }, items);
    const supportItems = [
      createElement('a', {
        href: '#guide',
        textContent: 'Hướng dẫn sử dụng',
        title: 'Đăng nhập để xem hướng dẫn trong ứng dụng'
      }),
      createElement('span', { className: 'landing-footer-pending', textContent: 'Điều khoản sử dụng · Đang cập nhật' }),
      createElement('span', { className: 'landing-footer-pending', textContent: 'Chính sách bảo mật · Đang cập nhật' })
    ];
    const contactItems = CONTACT_EMAIL
      ? [createElement('a', { href: `mailto:${CONTACT_EMAIL}`, textContent: CONTACT_EMAIL })]
      : [createElement('span', { className: 'landing-footer-pending', textContent: 'Email liên hệ đang cập nhật' })];
    contactItems.push(createElement('a', {
      href: PROJECT_GITHUB_URL,
      target: '_blank',
      rel: 'noopener noreferrer',
      textContent: 'GitHub của dự án ↗'
    }));

    const footer = createElement('footer', { className: 'landing-footer' }, [
      createElement('div', { className: 'landing-footer-inner' }, [
        createElement('div', { className: 'landing-footer-grid' }, [
          createElement('div', { className: 'landing-footer-brand-column' }, [
            brand('landing-footer-brand'),
            createElement('p', { textContent: 'Lên kế hoạch rõ ràng hơn với công việc, lịch biểu và trợ lý AI trong một nơi.' })
          ]),
          createElement('div', {}, [
            createElement('h2', { textContent: 'Khám phá' }),
            footerLinks([
              sectionButton('Trang chủ', 'home'),
              sectionButton('Giới thiệu', 'about'),
              createElement('a', { href: '#login', textContent: 'Đăng nhập' }),
              createElement('a', { href: '#register', textContent: 'Đăng ký' })
            ])
          ]),
          createElement('div', {}, [
            createElement('h2', { textContent: 'Hỗ trợ' }),
            footerLinks(supportItems)
          ]),
          createElement('div', {}, [
            createElement('h2', { textContent: 'Liên hệ' }),
            footerLinks(contactItems)
          ])
        ]),
        createElement('div', { className: 'landing-footer-bottom', textContent: '© 2026 Planify Pro. All rights reserved.' })
      ])
    ]);

    page.appendChild(header);
    page.appendChild(hero);
    page.appendChild(about);
    page.appendChild(footer);
    container.appendChild(page);
  },

  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
};
