# Nhịp — Todo List Calendar tích hợp AI Chatbot

Project môn Web Design and Programming: quản lý công việc cá nhân bằng Todo List, Calendar và ngôn ngữ tự nhiên.

## Trạng thái bàn giao — 2026-10-22

Đợt cải thiện toàn web và trợ lý: xem [trạng thái đủ 107 mục + nhóm AI bắt buộc](docs/IMPROVEMENT_STATUS_2026-10-21.md). [PROGRESS](docs/PROGRESS.md) ghi kết quả mới theo từng lần chạy; không dùng số test baseline bên dưới thay kết quả của bản mới. Ngữ cảnh có chọn lọc, phục hồi pending, deadline, chống stale edit, mobile, accessibility và kiểm thử đã được bổ sung; online/thiết bị thật vẫn là gate riêng.

MVP local đã triển khai và kiểm thử: Authentication, REST API/PostgreSQL, Todo, FullCalendar, conflict detection và chatbot 5 action với clarification/confirmation. Theo yêu cầu 22/10 thêm **gợi ý giờ trống chỉ đọc**: “Gợi ý 90 phút trống ngày mai từ 08:00 đến 18:00”; xem [cách dùng và kiểm tra](docs/AVAILABILITY.md). Bằng chứng và gate từng tuần nằm trong [PROGRESS](docs/PROGRESS.md) và [ACCEPTANCE](docs/ACCEPTANCE.md).

Đã cấu hình key backend local theo ủy quyền và gọi Groq `openai/gpt-oss-20b` thật. Bản cải thiện: **170 backend +41 frontend tests pass**, production build pass; HTTP smoke 25 checks (không AI), real execution 23 checks/14 calls pass. NLU regression 39/40, holdout 12/12; đây là các bộ đã đo của parser + backend guard, không bảo đảm mọi câu tự nhiên. Xem bằng chứng/cách hoàn thành phần còn lại trong [RELEASE_HANDOFF](docs/RELEASE_HANDOFF.md). Render/Neon, GitHub CI, điện thoại vật lý và release HTTPS chưa được xác minh; chưa có URL online. Key không nằm trong source/Git/frontend; cần chủ key rotate trước public.

Auth amendment 22/10 theo yêu cầu: đã áp dụng Passlib 1.7.4 + bcrypt 4.3.0; **200 backend tests pass**. Hash/tài khoản cũ giữ nguyên, không migration/reset DB; có known warning metadata không chặn hash/verify. Frontend không đổi nên không rerun build/tests; xem [chi tiết và evidence](docs/PROGRESS.md).

UI amendment 22/10 tiếp theo: đã redesign Auth/Todo/Calendar/Chat theo bố cục ZIP, giảm trang trí/khoảng trống, thêm Sáng/Tối nhớ trên trình duyệt và hỗ trợ responsive/viewport ngắn. **53 frontend +200 backend tests pass**, final build pass, HTTP smoke25/25 không AI. Giữ nguyên nghiệp vụ/API/DB/model, không thêm các tính năng ngoài scope có trong mockup. [Ảnh giao diện sáng](docs/screenshots/redesign-todo-light-2026-10-22.png), [tối](docs/screenshots/redesign-todo-dark-2026-10-22.png), [biên bản](docs/evidence/ui-redesign-2026-10-22.json). Điện thoại vật lý/remote CI/HTTPS vẫn cần kiểm tra riêng; user cần khởi động app local theo phần bên dưới.

Bản local của phiên này: [Ứng dụng](http://127.0.0.1:8000), [FastAPI API docs](http://127.0.0.1:8000/docs). Khi khởi động lại máy cần chạy các bước dưới đây.

## Stack và phiên bản đã kiểm tra

| Thành phần | Phiên bản |
|---|---|
| Python / Node / npm | 3.11.9 / 24.19.0 / 11.17.0 |
| Database | PostgreSQL 18 local; Neon khi deploy |
| Backend | FastAPI 0.142.2, Starlette 1.3.1, Uvicorn 0.34.3 |
| Persistence / Auth | SQLAlchemy 2.0.41, Alembic 1.16.2, psycopg 3.2.9; PyJWT + Passlib 1.7.4/bcrypt 4.3.0 |
| Frontend | React 19.1.0, Vite 6.4.4, FullCalendar 6.1.19 + Luxon |
| AI | HTTPX 0.28.1; openai/gpt-oss-20b; Structured Output |
| Tests | pytest 9.0.3 + HTTPX/TestClient; Vitest 4.1.12 + React Testing Library |

Các bản vá advisory được kiểm tra tương thích, không đổi framework; model đổi theo yêu cầu user ngày 2026-10-21. Backend khóa direct dependencies + constraints trong requirements.lock.txt; frontend dùng package-lock.json. Linux-only uvloop/Render runtime vẫn cần CI/deploy xác nhận.

## Clone và chạy lần đầu trên máy thành viên — Windows

Bàn giao Git 29/10/2026: source-only snapshot đã chạy 247 backend tests và npm ci/57 frontend tests; venv Python dùng packages đã kiểm tra, không coi đây là cài mới Python/Linux. Khi chuẩn bị push phát hiện advisory Vitest, chỉ nâng bản vá 4.1.11 → 4.1.12, cập nhật lockfile và chạy lại 57 tests; npm audit sau vá báo 0 tại thời điểm kiểm tra. Các evidence 22/10 phía trên vẫn là lịch sử, không xác nhận remote CI/deploy mới. Xem [PROGRESS](docs/PROGRESS.md).

Cài Python 3.11, Node.js/npm và PostgreSQL (baseline phiên bản ở bảng trên). Git chỉ mang source, không mang API key, dữ liệu database, .venv, node_modules hay dist.

1. Clone repository rồi mở PowerShell tại thư mục vừa clone:

~~~powershell
git clone https://github.com/kietxuan/ai66a-group8.git
Set-Location ai66a-group8
python --version
node --version
~~~

2. Khởi động PostgreSQL của máy bạn. Trong pgAdmin Query Tool/psql, tạo database development mới bằng `CREATE DATABASE todo_app;` (không tạo lại nếu đã có). Chỉ cần thêm `todo_app_test` riêng nếu chạy backend tests; tests reset database đó, không dùng database chính.
3. Copy `.env.example` thành `.env` ở root. Sửa DATABASE_URL theo username/password/host/port PostgreSQL máy bạn; nếu password có ký tự đặc biệt, URL-encode phần password. Thay JWT_SECRET_KEY bằng chuỗi random >=32 ký tự, không dùng giá trị mẫu. Tạo chuỗi bằng `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Điền GROQ_API_KEY riêng ở backend, giữ GROQ_MODEL=openai/gpt-oss-20b. Key trống thì Todo/Calendar vẫn dùng được nhưng AI chưa kết nối. Giữ CORS_ORIGINS gồm http://127.0.0.1:8000 như mẫu, COOKIE_SECURE=false chỉ cho local HTTP. TEST_DATABASE_URL chỉ cần sửa đúng khi chạy tests.
4. Cài dependencies rồi chạy từ root (python phải là 3.11.x):

~~~powershell
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install pip==26.2.1 setuptools==83.0.0
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
Push-Location frontend
npm ci
Pop-Location
.\scripts\dev.ps1 -Build
~~~

Launcher kiểm tra DB, chạy Alembic migrations tạo/cập nhật bảng, build frontend rồi chạy một Uvicorn worker. Nó không cài dependencies hoặc tạo database. Chờ `Uvicorn running` rồi mở http://127.0.0.1:8000, đăng ký và đăng nhập; máy dùng DB riêng không có tài khoản/task từ máy khác. Giữ terminal chạy, Ctrl+C để dừng app.

**Máy clone mới không thêm `-StartLocalDatabase`:** switch đó chỉ dùng cụm `.local/pgdata` riêng của máy implementation, không được push lên Git. Không copy pgdata/database binary giữa máy. Nếu máy chặn .ps1, dùng lệnh thủ công ở [01_SETUP](docs/01_SETUP.md), không tắt policy toàn máy.

Lần sau chỉ cần PostgreSQL đang chạy và `.\scripts\dev.ps1`. Sau pull, dùng `-Build` nếu giao diện đổi; cài lại requirements hoặc `npm ci` nếu dependencies/lockfile tương ứng đổi. Không reset database để cập nhật code. Xem [01_SETUP](docs/01_SETUP.md) cho môi trường Vite hai terminal, tests và deployment.

## Chạy nhanh trên máy implementation đã cài — PowerShell, từ root repository

Với môi trường đã cài của máy hiện tại, chạy một lệnh (không reset DB):

~~~powershell
& .\scripts\dev.ps1 -StartLocalDatabase -Build
~~~

Script chỉ khởi động cụm riêng 127.0.0.1:55432 khi cấu hình khớp; máy dùng PostgreSQL khác bỏ `-StartLocalDatabase`. `-Build` cần khi frontend thay đổi; có thể bỏ nếu đã có build mới. Nếu PowerShell chặn script, dùng các lệnh thủ công trong setup, không đổi security policy toàn máy.

Cần PostgreSQL đang chạy, database development và **database test riêng tên kết thúc bằng _test**. Không chạy pytest trên database có dữ liệu cần giữ.

1. Copy .env.example thành .env ở root; cấu hình DATABASE_URL, TEST_DATABASE_URL, JWT_SECRET_KEY random ít nhất 32 ký tự và explicit CORS_ORIGINS. COOKIE_SECURE=false chỉ cho HTTP local. GROQ_API_KEY chỉ ở backend; để trống vẫn dùng Todo/Calendar được.
2. Tạo môi trường và migrate:

~~~powershell
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install pip==26.2.1 setuptools==83.0.0
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
Set-Location backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
~~~

3. Terminal thứ hai:

~~~powershell
Set-Location frontend
npm ci
npm run dev
~~~

Mở http://localhost:5173, đăng ký rồi đăng nhập; register không auto-login. Nếu dùng 127.0.0.1:5173, thêm origin đó vào .env. Setup chi tiết, local PostgreSQL của phiên này và production config: [01_SETUP](docs/01_SETUP.md).

## Kiểm thử và build

~~~powershell
# Từ backend — fixture chỉ reset database test đã kiểm tra
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m alembic check
# Từ frontend
npm test -- --run
npm run build
npm audit
# Từ root — API đang chạy, chỉ dữ liệu synthetic, không reset DB
.\backend\.venv\Scripts\python.exe scripts/smoke.py
~~~

Sau build, FastAPI phục vụ frontend/dist cùng origin ở http://127.0.0.1:8000. Smoke tạo hai tài khoản synthetic, xóa task do nó tạo; tài khoản được giữ lại. Tùy chọn --live-ai gọi model thật và không được chạy trong CI. [Acceptance](docs/ACCEPTANCE.md) ghi kết quả/giới hạn; [Demo](docs/DEMO.md) có kịch bản trình bày và checklist online.

## Kiến trúc và giới hạn

Frontend -> REST API -> Backend -> PostgreSQL. Todo/Calendar/chat dùng chung task service và UI refresh. AI chỉ trả structured action, không SQL/DB; backend resolve task/user/category, validate và thực thi. Xóa hoặc tiếp tục lịch trùng cần pending confirmation backend-owned.

- Mỗi user chỉ quản lý dữ liệu của mình; password Passlib/bcrypt, JWT HttpOnly/SameSite cookie, kiểm tra Origin/header/JSON cho request ghi. Hash/tài khoản cũ giữ nguyên; known warning đọc metadata bcrypt và nhánh tương thích NUL được ghi tại [ARCHITECTURE](docs/ARCHITECTURE.md).
- Task date/time là giờ nghiệp vụ Asia/Ho_Chi_Minh; pending có đủ hai giờ mới chặn lịch. All-day/completed không chặn; reopen có conflict check.
- Chat RAM scoped user, một flow/user, TTL 10 phút; restart/expiry/replay không thực thi pending. Không chat history database, refresh token, multi-worker/replica.
- Memory hội thoại ngắn hạn độc lập quyền xác nhận: tối đa 6 bản ghi lượt nói và 12 task gần nhất, đọc lại task theo owner. Task vừa tạo/kết quả vừa hiện có thể được tham chiếu; hết context thì hỏi lại, không tự chọn gần giống.
- Chỉ ba category defaults/user và GET; không CRUD category, drag/drop, bulk actions, notification/recommendation tổng quát. Gợi ý giờ trống là nhánh chỉ đọc theo yêu cầu riêng, không tự đặt/dời việc.
- Dashboard/Statistics optional đã bỏ để giữ ưu tiên MVP.
- Không hardcode secrets/category IDs; không commit .env/.local/.venv/node_modules/dist.

## Triển khai

render.yaml + scripts/build.sh + scripts/start.sh chuẩn bị một Render Python Web Service, React build/FastAPI cùng origin, một worker/instance. Start migrate head trước Uvicorn; chỉ phù hợp rollout đơn service, không chạy migration đồng thời. DATABASE_URL Neon TLS, COOKIE_SECURE=true, CORS_ORIGINS là URL HTTPS thực và GROQ_API_KEY server-side. Chưa publish hoặc tạo tài khoản cloud trong phiên này.

## Roadmap và tài liệu

| Tuần | Phạm vi |
|---|---|
| 1–3 | Planning -> Foundation/Auth -> Categories/Task API/Conflict |
| 4–5 | Todo/shared form -> Calendar/deploy rehearsal |
| 6–7 | AI dry-run/context -> 5 actions/confirmation |
| 8–10 | Integration/hardening -> Regression -> Release/docs/demo |

[AGENTS](AGENTS.md), [PROJECT_SPEC](docs/PROJECT_SPEC.md), [ARCHITECTURE](docs/ARCHITECTURE.md), [DATABASE](docs/DATABASE.md), [API_SPEC](docs/API_SPEC.md), [UI_DIRECTION](docs/UI_DIRECTION.md), [ROADMAP](docs/ROADMAP.md), [PROGRESS](docs/PROGRESS.md), [PLAN_REVIEW](docs/PLAN_REVIEW.md), [checklist từng tuần](docs/weeks/WEEK_01.md).

Không tuyên bố tất cả 10 tuần hoàn thành trước khi các gate provider/online/CI được chạy thật.
