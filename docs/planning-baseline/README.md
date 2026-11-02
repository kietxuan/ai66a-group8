# Todo List Calendar tích hợp AI Chatbot

Project môn Web Design and Programming: quản lý task cá nhân bằng Todo List, Calendar và chatbot.

## Trạng thái hiện tại

Week 1 planning đã hoàn thành; Week 2 implementation chưa bắt đầu. Backend/frontend hiện là skeleton, chưa có app hoặc test suite chạy được. Chi tiết trong [PROGRESS](docs/PROGRESS.md).

## Stack và scope

- Frontend: React + Vite, HTML/CSS/JavaScript, FullCalendar.
- Backend: Python 3.11, FastAPI, Uvicorn; SQLAlchemy 2 + Alembic + psycopg.
- Database: PostgreSQL, Neon khi deploy.
- Auth: JWT access token trong HttpOnly cookie + bcrypt; không refresh token.
- AI: Google Gemini API, baseline Gemini 2.5 Flash, Structured Output; backend validate và thực thi.
- Tests: pytest + HTTPX/TestClient, Vitest + React Testing Library; PostgreSQL test riêng, Gemini mocked trong CI.
- Deploy: một Render Web Service phục vụ FastAPI + React build cùng origin, một worker; không Static Site riêng trong MVP.

MVP: Register/Login/Logout/me, task CRUD/complete/reopen/filter, category mặc định, Todo, Calendar, chatbot 5 action, clarification/confirmation và conflict detection.

Không CRUD category, chat history database, multi-timezone, refresh token, notification/recommendation. Dashboard/Statistics optional sau khi MVP pass, có thể bỏ hoàn toàn.

## Thứ tự công việc

| Tuần | Công việc |
|---|---|
| 1 | Planning |
| 2 | Foundation + Authentication + test harness |
| 3 | Categories + Task API + conflict core |
| 4 | Todo List |
| 5 | Calendar + deploy rehearsal |
| 6 | Chat foundation/dry-run/context |
| 7 | Chat task execution/confirmation |
| 8 | MVP integration/hardening, optional sau gate |
| 9 | Regression testing/fixes |
| 10 | Release/docs/demo |

Authentication trước Task CRUD; tests từ Week 2, không dồn tới cuối. Xem [ROADMAP](docs/ROADMAP.md) và checklist từng tuần.

## Tài liệu cần đọc

- [AGENTS](AGENTS.md): quy tắc làm việc và giới hạn scope.
- [PROJECT_SPEC](docs/PROJECT_SPEC.md): yêu cầu/MVP/product rules.
- [ARCHITECTURE](docs/ARCHITECTURE.md): module/auth/chat context/deploy.
- [DATABASE](docs/DATABASE.md): schema/ownership/time/conflict transaction.
- [API_SPEC](docs/API_SPEC.md): endpoints, payloads, errors, confirmation.
- [UI_DIRECTION](docs/UI_DIRECTION.md): auth/Todo/Calendar/chat UI và shared data.
- [01_SETUP](docs/01_SETUP.md): setup theo đúng trạng thái implementation.
- [ROADMAP](docs/ROADMAP.md): dependencies/gates 10 tuần.
- [PROGRESS](docs/PROGRESS.md): trạng thái thật và handoff.
- [PLAN_REVIEW](docs/PLAN_REVIEW.md): các conflict đã xử lý, rủi ro chưa xác minh.
- [Week 1](docs/weeks/WEEK_01.md), [Week 2](docs/weeks/WEEK_02.md), [Week 3](docs/weeks/WEEK_03.md), [Week 4](docs/weeks/WEEK_04.md), [Week 5](docs/weeks/WEEK_05.md), [Week 6](docs/weeks/WEEK_06.md), [Week 7](docs/weeks/WEEK_07.md), [Week 8](docs/weeks/WEEK_08.md), [Week 9](docs/weeks/WEEK_09.md), [Week 10](docs/weeks/WEEK_10.md).

## Bắt đầu implementation

Theo [Week 2](docs/weeks/WEEK_02.md) và [setup](docs/01_SETUP.md). Run/test commands chỉ có hiệu lực sau khi app, migrations và React scripts được tạo. Không chạy fixture trên database development/production.

Gemini 2.5 Flash phải kiểm tra quyền truy cập thực tế sớm; nếu không khả dụng, báo trước khi thay model. Không giả định tài khoản/gói deploy hoặc provider luôn sẵn sàng. Không commit .env/secrets.
