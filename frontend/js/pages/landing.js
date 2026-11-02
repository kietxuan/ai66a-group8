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

    const featureCard = ({ number, icon, label, title, description, highlights, image, imageAlt }) => createElement('article', {
      className: `landing-feature-card landing-feature-${image}`
    }, [
      createElement('div', { className: 'landing-feature-copy' }, [
        createElement('div', { className: 'landing-feature-label' }, [
          createElement('span', { className: 'landing-feature-icon', textContent: icon, 'aria-hidden': 'true' }),
          createElement('span', { textContent: `${number} / ${label}` })
        ]),
        createElement('h3', { textContent: title }),
        createElement('p', { textContent: description }),
        createElement('ul', { className: 'landing-feature-list' }, highlights.map(highlight =>
          createElement('li', { textContent: highlight })
        ))
      ]),
      createElement('figure', { className: 'landing-feature-visual' }, [
        createElement('div', { className: 'landing-feature-frame' }, [
          createElement('img', {
            className: 'landing-feature-image',
            src: `/assets/landing/feature-${image}.png`,
            alt: imageAlt,
            width: '940', height: '550', loading: 'lazy', decoding: 'async'
          })
        ]),
        createElement('figcaption', {}, [
          createElement('span', { textContent: 'Giao diện minh họa · Dữ liệu mẫu' }),
          createElement('a', {
            href: `/assets/landing/feature-${image}.png`,
            target: '_blank', rel: 'noopener noreferrer',
            textContent: 'Xem ảnh lớn ↗',
            'aria-label': `Xem ảnh lớn: ${title}`
          })
        ])
      ])
    ]);

    const about = createElement('section', { className: 'landing-about', id: 'about' }, [
      createElement('div', { className: 'landing-section-heading' }, [
        createElement('p', { className: 'landing-section-kicker', textContent: 'MỘT NƠI CHO MỌI KẾ HOẠCH' }),
        createElement('h2', { textContent: 'Giới thiệu về Planify Pro' }),
        createElement('p', { textContent: 'Từ việc cần làm đến lịch trình và trợ lý AI, mọi kế hoạch được sắp xếp trong cùng một không gian.' })
      ]),
      createElement('div', { className: 'landing-feature-grid' }, [
        featureCard({
          number: '01', icon: '☑', label: 'CÔNG VIỆC', image: 'todo',
          title: 'Quản lý công việc',
          description: 'Tập hợp việc cần làm vào bảng chung hoặc từng danh sách. Ghi việc nhanh, chia thành bước nhỏ và theo dõi tiến độ mỗi ngày.',
          highlights: [
            'Bảng Kanban chia việc thành Cần làm, Hôm nay, Quá hạn và Đã xong.',
            'Đặt ngày giờ, đánh dấu quan trọng, thêm bước nhỏ và nhắc việc.',
            'Việc có lịch cũng xuất hiện trong Calendar.'
          ],
          imageAlt: 'Bảng To Do của Planify Pro với danh sách công việc và các cột Kanban'
        }),
        featureCard({
          number: '02', icon: '▦', label: 'LỊCH BIỂU', image: 'calendar',
          title: 'Lịch biểu cá nhân',
          description: 'Xem công việc và sự kiện trong một lịch chung để biết ngày nào bận, ngày nào còn chỗ cho kế hoạch mới.',
          highlights: [
            'Chuyển giữa chế độ Tháng, Tuần, Ngày và Lịch biểu.',
            'Tạo sự kiện hoặc kéo công việc chưa xếp lịch vào ngày phù hợp.',
            'Thay đổi công việc được phản ánh ở cả To Do và Calendar.'
          ],
          imageAlt: 'Calendar Planify Pro ở chế độ tuần, hiển thị công việc, sự kiện và khay việc chưa xếp lịch'
        }),
        featureCard({
          number: '03', icon: '✧', label: 'TRỢ LÝ AI', image: 'ai',
          title: 'Trợ lý AI',
          description: 'Diễn đạt điều bạn muốn bằng tiếng Việt. Trợ lý hỗ trợ tìm thông tin trong kế hoạch và thao tác với công việc, lịch biểu.',
          highlights: [
            'Hỏi lịch hôm nay hoặc các việc quan trọng cần làm.',
            'Tìm khung giờ trống theo thời lượng bạn cần.',
            'Yêu cầu tạo hoặc dời công việc, sự kiện bằng câu lệnh.'
          ],
          imageAlt: 'Giao diện trợ lý AI Planify Pro với các câu hỏi mẫu về kế hoạch, lịch và việc cần làm'
        })
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
