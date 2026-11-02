# WEEK 02 — AUTHENTICATION & BACKEND FOUNDATION

## Objective

Tạo nền backend/database/test và React auth shell; Register/Login/Logout/me chạy thật trước Task CRUD.

## Prerequisites

- Week 1 planning completed; đọc AGENTS, PROJECT_SPEC, ARCHITECTURE, DATABASE, API_SPEC, 01_SETUP, ROADMAP, PROGRESS.
- Kiểm tra Git/code hiện tại. Placeholder main.py và print Hello world không phải app/tests.
- Chạy checks đã có nếu có; ghi rõ check nào chưa tồn tại, không báo pass giả.

## Tasks theo thứ tự

### 1. Môi trường và feasibility

- [ ] Xác minh Python 3.11, PostgreSQL dev + test riêng, Node/npm tương thích Vite.
- [ ] Tạo venv; xác nhận dependencies chạy được, pin phiên bản; tạo frontend lockfile sau scaffold.
- [ ] Settings load .env ở root; validation fail-fast với secret/URL thiếu hoặc placeholder.
- [ ] Bổ sung TEST_DATABASE_URL/COOKIE_SECURE vào .env.example cùng code đọc setting; không commit secrets.
- [ ] Kiểm tra tài khoản Gemini và quyền dùng gemini-2.5-flash bằng request nhỏ nếu có quyền/key; nếu chưa thể thử ghi unresolved.
- [ ] Kiểm tra tài khoản/gói Render + Neon, khả năng build Python + Node; chưa implement chatbot hoặc deploy đầy đủ.

### 2. Backend, schema và contract

- [ ] FastAPI entrypoint backend/main.py; settings, SQLAlchemy sync Session, current_user dependency.
- [ ] Alembic migration Users; database unique email và timestamp rules.
- [ ] GET /health; error handlers cùng envelope kể cả Pydantic validation.
- [ ] Register validate name/email/password, bcrypt hash, duplicate/race -> 409; không auto-login.
- [ ] Login generic credential error, JWT HS256 sub/iat/exp, cookie theo ARCHITECTURE.
- [ ] GET /api/auth/me xác minh token và user tồn tại.
- [ ] Logout clear cookie đúng Path/flags; không refresh token/denylist.
- [ ] Request-write security: custom header, Origin allowlist, JSON content-type, CORS explicit credentials, OPTIONS đúng.
- [ ] Không user_id từ client để chọn user; không token/password trong response/log.

### 3. Frontend tối thiểu

- [ ] Khởi tạo React/Vite JavaScript, xét placeholder trước overwrite; API client relative /api.
- [ ] Vite proxy /api và /health; credentials và X-Requested-With đúng contract.
- [ ] Register/Login forms + validation/loading/error; Login thành công vào protected shell.
- [ ] App startup /me, reload giữ phiên; 401/logout clear cache và về Login.
- [ ] Shell chỉ navigation/placeholder khu task; chưa kéo Todo CRUD vào tuần này.

### 4. Tests và CI nền

- [ ] Backend pytest + HTTPX/TestClient chạy với PostgreSQL test database, fixture fail-fast nếu URL không riêng.
- [ ] Frontend Vitest + React Testing Library; scripts test/build.
- [ ] CI nhỏ: PostgreSQL test service + backend tests, frontend tests/build; không production secrets/Gemini key.
- [ ] Migration smoke database test rỗng; pin dependencies sau checks.

## Acceptance tests

- Register hợp lệ -> 201, hash không bằng plaintext; duplicate email khác case -> 409.
- Name/email/password sai -> 422; password >72 byte UTF-8 bị từ chối, không truncate.
- Login đúng set HttpOnly/SameSite/Path; local Secure=false, production config Secure=true.
- Login sai -> 401 cùng message cho sai email hoặc password.
- /me thiếu/sai/hết hạn token -> 401; token đúng -> user sans password.
- Logout -> 204, reload không còn phiên. No-refresh-token flow đúng.
- Request ghi thiếu header/sai Origin -> 403; sai content type -> 415; hợp lệ/proxy/preflight chạy được.
- User A/B auth state/cache không lẫn; route protected không mở khi chưa đăng nhập.
- Frontend loading/error/register->login/reload/logout; tests và build pass.
- Alembic upgrade head chạy trên PostgreSQL rỗng; không có create_all thay migration.

## Definition of Done

Auth end-to-end chạy local, /me sau reload đúng; automated tests có assert thực tế và pass; migration + frontend build pass. Không báo task ownership đã được kiểm chứng trước khi Task API tồn tại.

PROGRESS ghi files/modules, commands/results, account/model feasibility chưa xác minh nếu có, known issues, deviation, next action Week 3.

## Do Not Implement Yet

Không Categories/Task CRUD/Calendar/chatbot execution; kiểm tra account chỉ là chuẩn bị dependency. Không reset-password/OAuth/refresh token.
