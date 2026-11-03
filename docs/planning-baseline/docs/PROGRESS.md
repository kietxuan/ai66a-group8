# PROJECT PROGRESS

> Cập nhật sau mỗi tuần/session; ghi trạng thái thực tế, không đánh dấu planned work thành completed.

## 1. Current status

- Current week: WEEK_02.
- Overall status: PLANNING_READY; implementation chưa bắt đầu.
- Baseline Git checkpoint: 45cf886 - finalize week 1 planning baseline.
- Latest session: review/đồng bộ kế hoạch ngày 2026-10-02, chưa commit/push trong session này.
- Next action: Week 2 foundation/auth/test harness, không Task CRUD trước auth.

## 2. Technology decisions

Đã chốt ở mức thiết kế, không phải mọi thành phần đã setup:

- React/Vite JavaScript, FullCalendar; Python 3.11/FastAPI/Uvicorn.
- PostgreSQL; SQLAlchemy 2 + Alembic + psycopg.
- JWT HttpOnly cookie + bcrypt, /auth/me, request-write CSRF checks; không refresh token.
- Gemini Structured Output, baseline gemini-2.5-flash; phải kiểm tra account access.
- pytest/HTTPX/TestClient, Vitest/React Testing Library; PostgreSQL test riêng, Gemini mocked.
- Một Render Web Service phục vụ frontend build + backend same-origin; Neon.
- Context chat RAM scoped user, TTL 10 phút, một worker/instance; không chat history database.
- Category 3 defaults/user, GET only; conflict pending-only, mở lại phải check.
- 10 tuần/10 phase, tests từ Week 2, deploy rehearsal Week 5, online MVP Week 8.

## 3. Weekly progress

| Tuần | Phạm vi | Trạng thái |
|---|---|---|
| WEEK_01 | Planning | COMPLETED (tài liệu/decisions, không phải app) |
| WEEK_02 | Authentication & Backend Foundation | NOT STARTED |
| WEEK_03 | Task API, Categories & Conflict Core | NOT STARTED |
| WEEK_04 | Todo List | NOT STARTED |
| WEEK_05 | Calendar & Deploy Rehearsal | NOT STARTED |
| WEEK_06 | AI Chatbot Foundation | NOT STARTED |
| WEEK_07 | Chatbot Task Management | NOT STARTED |
| WEEK_08 | MVP Integration & Hardening | NOT STARTED |
| WEEK_09 | Regression Testing & Fixes | NOT STARTED |
| WEEK_10 | Release, Documentation & Demo | NOT STARTED |

Checklist [x] trong Week 1 chỉ ghi planning đã hoàn thành. Checklist implementation Week 2–10 vẫn [ ].

## 4. Latest handoff - plan review 2026-10-02

### Completed - documentation only

- Đọc toàn bộ project plan và đối chiếu source/config/dependencies hiện có.
- Giữ Authentication trước Task CRUD; giữ core MVP/stack và roadmap 10 tuần.
- Bổ sung me/categories/date-range endpoints, input/output/error/PUT/status contract.
- Làm rõ all-day/timed, timezone, category defaults, ownership và conflict/reopen transaction.
- Bổ sung ngữ cảnh chat/confirmation/version/replay/expiry và giới hạn RAM/single worker.
- Đơn giản hóa deploy same-origin và optional; đưa tests/feasibility/rehearsal vào checkpoint sớm.
- Đồng bộ từng tuần với prerequisites/tasks/acceptance/DoD/do-not-implement.
- Thêm audit log và rủi ro ngoài repo trong [PLAN_REVIEW](PLAN_REVIEW.md).

### Files / modules changed

Chỉ Markdown:

- AGENTS.md, README.md.
- docs/PROJECT_SPEC.md, ARCHITECTURE.md, DATABASE.md, API_SPEC.md, UI_DIRECTION.md.
- docs/01_SETUP.md, ROADMAP.md, PROGRESS.md; thêm docs/PLAN_REVIEW.md.
- docs/weeks/WEEK_01.md tới WEEK_10.md.

Không sửa source backend/frontend, requirements, .env.example, Docker/config; không chạy install/migration/seed hoặc thao tác tài khoản/dữ liệu ngoài.

### Checks / tests run

- Đọc và đối chiếu scope/stack/ownership/route/field/time/conflict/chat/deploy giữa tất cả tài liệu.
- Git diff --check: pass, không whitespace/conflict-marker errors.
- Kiểm tra 21 file Markdown, 45 local links tồn tại, code fences cân bằng, 12 JSON examples parse được: pass.
- Kiểm tra đủ prerequisites/Objective/DoD/scope boundary ở 10 tuần; không checklist implementation nào bị đánh dấu completed: pass.
- Git diff chỉ gồm 20 file Markdown sửa và 1 file Markdown mới; không source/config/dependency changes: pass.
- Rà references kế hoạch cũ/TBD/Express và thứ tự tuần để loại mismatch còn sót.

Không chạy application/pytest/frontend build/migration/LLM/deploy tests: code vẫn là skeleton và chưa có test harness thực tế. Các check tài liệu không chứng minh MVP hoạt động.

### Known issues / gates còn mở

- backend/main.py và phần lớn modules rỗng; backend/tests/test.py chỉ print Hello world.
- Frontend chưa có React package.json/test/build scripts; Alembic và CI chưa được tạo.
- Dependencies chưa pin; .env.example chưa có TEST_DATABASE_URL/COOKIE_SECURE/model/timeout settings. Bổ sung cùng implementation đúng tuần.
- Dockerfile/docker-compose placeholders chưa runnable; Docker không bắt buộc.
- Account access gemini-2.5-flash chưa kiểm chứng. Google có giới hạn access dòng 2.5; xem nguồn trong PLAN_REVIEW.
- Tài khoản/gói Render/Neon, deadline/rubric và phân công nhóm chưa được xác minh.
- Không được đánh dấu các gate trên pass bằng mock hoặc chỉ đọc tài liệu.

### Deviations / plan refinements

- Deploy frontend/backend chung Render Web Service thay hai service để tránh cookie cross-site.
- Chọn một Structured Output flow thay “Structured Output / Function Calling” song song.
- Không lưu chat history nhưng có ngữ cảnh tạm backend để đáp ứng hỏi tiếp/xác nhận.
- Test/CI từ Week 2; rehearsal Week 5; Week 8 MVP hardening trước optional.
- Category giản lược default read-only; conflict chỉ pending, bổ sung reopen/concurrency.
- Đây là thay đổi kế hoạch do yêu cầu review của user, chưa là feature implementation.

## 5. Handoff template cho tuần implementation

Mỗi lần cập nhật ghi:

- Tuần/mục tiêu và prerequisite đã kiểm tra.
- Đã thực hiện, files/modules/migration IDs thay đổi.
- Exact commands/checks và pass/fail; manual/provider/online smoke riêng.
- Known issues, mức ảnh hưởng và gate chưa đạt.
- Deviation so với plan và lý do.
- Next action; không invent release commit/URL hoặc tuyên bố completed khi DoD chưa đạt.
