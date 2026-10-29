# LOCAL SETUP & DEPLOY HANDOFF

## Clone mới / thành viên nhóm — bổ sung 2026-10-29

Theo [README: clone và chạy lần đầu](../README.md#clone-và-chạy-lần-đầu-trên-máy-thành-viên--windows). Máy mới phải tự cài Python 3.11/Node/PostgreSQL, tạo database development, tạo `.env` từ mẫu và thay DB URL/JWT secret/Groq key, tạo venv/cài requirements, chạy npm ci. Sau đó dùng `scripts/dev.ps1 -Build` từ root, **không -StartLocalDatabase**. Launcher tự migrate bảng, không tự tạo database/cài dependencies. `.env.example` nay có đủ exact Origins cho local8000 và Vite5173; JWT secret mẫu vẫn cố ý bị từ chối để người clone phải tạo random riêng. Database test chỉ cần khi chạy tests, phải tách biệt và tên kết thúc `_test`.

Git không mang tài khoản/task/database dump hoặc các thư mục .local/.venv/node_modules/dist. Các phiên bản và bằng chứng local cũ bên dưới giữ nguyên ngày kiểm tra, không tự chứng minh fresh install/remote CI đã pass. Không commit credentials; dữ liệu mới nằm trong PostgreSQL riêng của từng máy.

## 1. Môi trường đã kiểm tra

Launcher `scripts/dev.ps1` dùng thông báo ASCII để tương thích cả Windows PowerShell 5.1 và PowerShell 7. Không thêm tiếng Việt UTF-8 không BOM vào launcher: PowerShell 5.1 có thể đọc sai thành dấu ngoặc kép/nháy và báo ParserError trước khi chạy. Không cần đổi execution policy hoặc reset DB để sửa lỗi mã hóa này.

Đợt cải thiện 21/10: [trạng thái 107 mục + AI](IMPROVEMENT_STATUS_2026-10-21.md) và [PROGRESS](PROGRESS.md) là nguồn kết quả mới. Python 3.11.9/Node 24.19.0 là baseline đã kiểm tra; backend/.python-version `3.11` chọn cùng minor, không thay thế root pin khi release. Runtime cài requirements.txt; môi trường phát triển/test cài requirements-dev.txt.

Ngày 2026-10-05: Windows, Python 3.11.9, Node 24.19.0, npm 11.17.0, PostgreSQL 18. Backend/frontend/migrations/tests đã tồn tại; không còn placeholder Hello world. Docker không bắt buộc; các Dockerfile/compose rỗng đã bỏ.

Python/Node pinned bằng .python-version/.node-version và render.yaml. Backend requirements.txt dùng requirements.lock.txt constraints; frontend npm ci dùng package-lock.json. Không nâng hàng loạt dependency. CI Linux đã cấu hình, chưa chạy trên GitHub/Render.

Amendment auth 22/10: requirements đã pin Passlib 1.7.4 + bcrypt 4.3.0. Máy clone/update source cài lại `backend/requirements-dev.txt` (runtime/deploy dùng `backend/requirements.txt`), chạy `pip check`, rồi restart backend. Không cần migration, reset DB, đổi password hay build lại frontend chỉ vì thay đổi này. Venv backend trên máy implementation đã được cài Passlib; kết quả test tại [PROGRESS](PROGRESS.md).

## 2. Cấu hình .env

Từ root repository, copy .env.example thành .env rồi sửa bằng editor. Settings resolve .env theo project root, không phụ thuộc terminal cwd. Không đưa secrets vào VITE_* hoặc commit .env.

| Biến | Giá trị / quy tắc |
|---|---|
| DATABASE_URL | postgresql+psycopg://USER:PASSWORD@HOST:PORT/todo_app |
| TEST_DATABASE_URL | PostgreSQL riêng, tên kết thúc _test và khác database chính |
| JWT_SECRET_KEY | Random >=32 ký tự; placeholder bị từ chối |
| JWT_EXPIRE_MINUTES | 60; hết phiên đăng nhập lại, không refresh token |
| CORS_ORIGINS | CSV origins chính xác, không trailing slash, không wildcard |
| COOKIE_SECURE | false local HTTP, true HTTPS production |
| GROQ_API_KEY | Server-side; bỏ trống -> AI_UNAVAILABLE, manual UI vẫn chạy |
| GROQ_MODEL | openai/gpt-oss-20b; không tự thay nếu access/model lỗi |
| AI_MAX_COMPLETION_TOKENS | 1024; giới hạn 256–4096, bị cắt output -> không mutation |
| AI_TIMEOUT_SECONDS | 20; không tự retry mutation |
| CHAT_EXECUTION_ENABLED | true chạy action; false dry-run read-only |
| DB_CONNECT_TIMEOUT | 5 giây, giới hạn 1–30 |
| DB_STATEMENT_TIMEOUT_MS / DB_LOCK_TIMEOUT_MS | 15000 / 5000; tránh query/row lock chờ vô hạn |
| MAX_REQUEST_BYTES | 32768 (32KiB), không thay validation field; body đọc tối đa 10s |
| RATE_LIMIT_ENABLED | true; RAM một process, auth 12/IP/phút, chat 10/user/phút |

Secret có thể tạo bằng Python secrets.token_urlsafe(48), lưu trực tiếp vào .env bằng editor; không gửi key/token/connection string lên chat hoặc logs. Connection string có ký tự đặc biệt phải URL-encode password; Neon giữ sslmode=require theo URL nhà cung cấp.

Ví dụ origins local:

~~~dotenv
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:8000
COOKIE_SECURE=false
~~~

Write API yêu cầu X-Requested-With: todo-app; Origin nếu có phải nằm allowlist; body không rỗng phải application/json. CORS không thay CSRF protection.

## 3. PostgreSQL

Chọn đúng một mode: PostgreSQL có sẵn thường dùng 5432 và user của máy; cụm implementation bên dưới là 127.0.0.1:55432/todo_local. Không copy ví dụ 5432 đè .env đang chạy đúng, không initdb lại cụm đã có.

Ưu tiên PostgreSQL local có sẵn hoặc Neon development database riêng. Tạo database development và test tách biệt, không chỉ schema khác nhau trong cùng database:

~~~sql
CREATE DATABASE todo_app;
CREATE DATABASE todo_app_test;
~~~

Ví dụ SQL chỉ chạy trên server development bằng account được phép; không tạo/reset database production tự động. App cần quyền schema/migration của database chính. Test cần quyền reset schema public của test database.

### Cụm local của phiên implementation

Đã tạo riêng .local/pgdata bằng PostgreSQL 18, user todo_local, host 127.0.0.1, port 55432, database todo_app và todo_app_test. Thư mục này ignored, dữ liệu không commit. Không thay đổi service PostgreSQL khác của máy.

Nếu cụm này đã dừng, từ root PowerShell:

~~~powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D '.local/pgdata' -l '.local/postgres.log' -o '-h 127.0.0.1 -p 55432' start
~~~

Cụm này auth trust và chỉ bind loopback, dành riêng development của phiên này; không dùng để host public/production. Không chạy initdb lại hoặc xóa pgdata vì sẽ mất demo data. Máy khác dùng PostgreSQL của mình và cập nhật .env, không copy database binary.

Dừng có kiểm soát sau khi đã dừng app:

~~~powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D '.local/pgdata' stop -m fast
~~~

Không cần để database test chứa dữ liệu muốn giữ: pytest cố ý DROP/CREATE schema public và truncate bảng trong database test đã xác minh.

## 4. Backend

Từ root:

~~~powershell
python --version
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install pip==26.2.1 setuptools==83.0.0
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
Set-Location backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m alembic check
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
~~~

Không cần activate venv hoặc đổi execution policy toàn máy. Migrations: 0001_users -> 0002_tasks_categories, defaults backfill idempotent. Không dùng create_all. Nếu sai configuration, app fail-fast trước phục vụ request.

GET /health chỉ liveness. Kiểm tra database thật bằng register/login/tasks hoặc scripts/smoke.py. /docs cung cấp OpenAPI; unknown /api vẫn JSON 404, không bị SPA fallback nuốt.

GET /ready kiểm tra SELECT 1 qua DB có timeout, không gọi Groq. Auth/task/chat có no-store; request ID giúp đối chiếu log không cần gửi password/cookie/key.

### Chạy lại bằng một lệnh trên máy đã cài

Từ root PowerShell:

~~~powershell
& .\scripts\dev.ps1 -StartLocalDatabase -Build
~~~

`-StartLocalDatabase` chỉ dùng cụm .local/pgdata khi DATABASE_URL đúng loopback:55432. Máy dùng PostgreSQL khác bỏ switch này. Script kiểm tra DB, migrate head, build nếu yêu cầu/chưa có dist và chạy Uvicorn loopback một worker. Không reset/initdb, không tự mở firewall/LAN, không tự điền key. `-Build` cần sau sửa frontend; nếu build hiện tại đã mới có thể bỏ. Nếu policy máy chặn .ps1, dùng lệnh thủ công ở trên; không đổi policy toàn máy.

## 5. Frontend

Amendment giờ trống 22/10: Chat thêm ví dụ “Gợi ý 90 phút trống ngày mai từ 08:00 đến 18:00”, chỉ đọc lịch và không tự đặt. Backend cần restart cho prompt/schema mới, frontend cần build lại một lần (`scripts/dev.ps1 -StartLocalDatabase -Build`). Không env/dependency/migration mới. Cách dùng/12 bước test thủ công tại [AVAILABILITY](AVAILABILITY.md).

Giao diện amendment 22/10 có Sáng/Tối trên màn tài khoản/topbar/dialog; lần đầu theo hệ thống, sau đó nhớ trên trình duyệt. Thay đổi theme không đổi dữ liệu hoặc session. `theme-init.js` phải đi cùng `dist/index.html` sau build; không copy riêng index/asset cũ. Sau cập nhật source giao diện cần `npm run build` hoặc launcher `-Build`; nếu build mới đã có thì chạy launcher không `-Build` được. Không cần migration/dependency mới cho redesign. Bản mobile có thanh điều hướng ở đáy; kiểm tra thêm bàn phím/safe area trên điện thoại thật trước demo.

Terminal thứ hai từ root:

~~~powershell
Set-Location frontend
npm ci
npm run dev
~~~

Dev Vite port 5173 strictPort, proxy /api và /health -> 127.0.0.1:8000. Browser localhost:5173 phải có origin tương ứng trong .env. API client relative, credentials include; JWT không lưu localStorage. FullCalendar v6.1.19 cần Luxon adapter để named timezone hoạt động đúng; không copy hướng dẫn v7 vào bản này.

Đăng ký rồi đăng nhập. Todo/Calendar dùng cùng nguồn dữ liệu; chat chỉ gửi current-user context. Khi logout/401, frontend unmount task/chat state. Không lưu lịch sử chat vào database/localStorage.

## 6. Tests — database test duy nhất được reset

Từ backend:

~~~powershell
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m pip check
~~~

Fixture fail-fast nếu thiếu TEST_DATABASE_URL, driver sai, tên không kết thúc _test, hoặc tên giống DATABASE_URL, kể cả alias host khác. Đây là safety guard, không thay trách nhiệm cấu hình DB test đúng.

Tests chạy Alembic + PostgreSQL thật; provider mock cho logic và HTTPX transport/schema offline tests. Không có Groq request thật trong CI. Hai warning deprecation HTTPX/TestClient/AnyIO được ghi ở PROGRESS; không phải assertion failure và chưa đổi sang HTTPX2 vì ngoài compatibility baseline.

Provider/schema unit không còn bị fixture database autouse kéo vào PostgreSQL. Chạy `python -X utf8 -m pytest tests/test_provider.py` không cần DB khả dụng; integration vẫn phải dùng TEST_DATABASE_URL riêng có guard. Không dùng điều này để bỏ database khỏi integration tests.

Từ frontend:

~~~powershell
npm test -- --run
npm run build
npm audit
~~~

Dependency security scan Python dùng pip-audit ở venv audit riêng khi cần, không thêm công cụ audit vào runtime app. Kết quả hiện tại không bảo đảm không có advisory mới trong tương lai.

CI: .github/workflows/ci.yml, PostgreSQL 18 riêng + pytest, npm ci/tests/build. Trigger push/PR sau khi nhóm review/commit; local pass chưa chứng minh remote CI pass.

## 7. Production-mode local và HTTP smoke

Build frontend trước; FastAPI phục vụ dist hiện hữu khi khởi động. Không dùng Vite cho production:

~~~powershell
# Từ frontend
npm run build
# Từ backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1
# Từ root, terminal khác
.\backend\.venv\Scripts\python.exe scripts/smoke.py --base-url http://127.0.0.1:8000
~~~

Nếu port đang được dùng, kiểm tra terminal/process do bạn tạo; không kill process hoặc DB service không liên quan. Có thể dùng npm run dev -- --host 127.0.0.1 cho demo local.

Smoke tạo hai tài khoản synthetic bằng email ngẫu nhiên @example.com, không reset DB, chỉ xóa task của chính run; tài khoản giữ lại vì MVP không có account-delete. Không chạy trên production nếu không muốn thêm tài khoản test. Cleanup qua ExitStack kể cả assertion lỗi, có progress/cleanup_errors; nếu mất kết nối thì vẫn có thể cleanup chưa hết. Mặc định **không gọi Groq**.

Sau khi thêm key backend hợp lệ và restart app, chạy riêng:

~~~powershell
.\backend\.venv\Scripts\python.exe scripts/smoke.py --live-ai
~~~

Script --live-ai thử create/query/update/complete/delete thật, mặc định giãn cách 25 giây. Dùng thêm `scripts/ai_acceptance.py --report .local/ai-run-new.json` để kiểm tra clarification/ambiguity/conflict/confirmation/isolation thật; `--dry-run` chỉ khi backend CHAT_EXECUTION_ENABLED=false. Scripts không tự retry, report không overwrite; không chạy song song vì chung quota. Cách chạy và kết quả tại [RELEASE_HANDOFF](RELEASE_HANDOFF.md); nếu model trả flow khác kỳ vọng, giữ báo cáo fail, sửa/rerun và không báo pass trước. Không tự chuyển model.

Đánh giá ngôn ngữ read-only, không cần app/DB đang chạy nhưng tiêu quota model thật:

~~~powershell
.\backend\.venv\Scripts\python.exe -X utf8 scripts/nlu_eval.py --live --report .local/nlu-new.json
# Chạy sau run trên, không chạy song song dùng cùng quota:
.\backend\.venv\Scripts\python.exe -X utf8 scripts/nlu_eval.py --live --suite holdout --report .local/nlu-holdout-new.json
~~~

40 tình huống regression và 12 cách nói bổ sung, báo action/field sai, model reported/usage và prompt fingerprint; không in key/password/raw provider body. Không overwrite evidence, không tự retry khi quota/provider lỗi. Kết quả này đánh giá parse + deterministic guards, không thay execution/ownership/confirmation tests hoặc bảo đảm hiểu mọi câu.

### Backup/restore rehearsal local

~~~powershell
.\backend\.venv\Scripts\python.exe -X utf8 scripts/backup_check.py --local-rehearsal
~~~

Chỉ nhận DB loopback, cần role được CREATE DATABASE và PostgreSQL tools. Dump lưu .local/backups ignored; phục hồi vào database **mới ngẫu nhiên**, so số bản ghi users/categories/tasks rồi xóa đúng database thử vừa tạo. Không restore/drop database chính. Chạy lúc ít thay đổi dữ liệu để so count ổn định. Dump chứa dữ liệu nhạy cảm: giữ local, không commit/upload. Đây là rehearsal local, không thay backup production được quản lý.

## 8. Render + Neon — cấu hình sẵn, chưa deploy

render.yaml: một Python Web Service tại root repository; build bash scripts/build.sh; start bash scripts/start.sh; health /health; một instance.

Build cài backend locked requirements và npm ci/build. Start cd backend, alembic upgrade head rồi exec uvicorn host 0.0.0.0 port PORT workers 1. Migration chạy trong startup đơn service để không phụ thuộc paid pre-deploy hook. Không start hai rollout/migrations song song; backup trước migration rủi ro.

Nhóm cần thực hiện khi có tài khoản/quyền:

1. Tạo Neon database production riêng, giữ TLS trong DATABASE_URL; không dùng DB đó cho pytest.
2. Kết nối repository đã review/commit vào Render, chọn Blueprint hoặc nhập build/start trên dashboard.
3. Chọn gói/account thực tế; không giả định miễn phí/uptime/cold start. Không scale nhiều instances/workers vì RAM context.
4. Điền DATABASE_URL, server-side GROQ_API_KEY, GROQ_MODEL, generated JWT_SECRET_KEY, COOKIE_SECURE=true, CORS_ORIGINS đúng HTTPS origin Render.
5. Xác nhận Python/Node versions còn được platform hỗ trợ, build và migrations thành công, không chỉ health 200.
6. Chạy scripts/smoke.py --base-url https://YOUR-SERVICE và smoke thật --live-ai có chủ đích; kiểm tra cookie Secure/reload/CSRF/deep link/ownership trên browser HTTPS.
7. Restart service: task vẫn còn PostgreSQL, pending context cũ bị từ chối. Ghi URL, release commit, CI và kết quả vào PROGRESS/ACCEPTANCE.

Không có credentials trong phiên hiện tại, nên các bước online chưa được chạy. Không đánh dấu Week 5/8/10 DoD pass hoặc invent URL/SHA.

## 9. Troubleshooting và giới hạn

- Passlib có thể log `(trapped) error reading bcrypt version`/`AttributeError: module 'bcrypt' has no attribute '__about__'` một lần khi khởi tạo backend bcrypt. Với cặp pin 1.7.4/4.3.0, đây là exception đã bị bắt khi đọc metadata; tests xác nhận hash/verify và login tiếp tục chạy. Không hạ bcrypt/monkeypatch/suppress warning. Nếu process thực sự exit hoặc login lỗi, kiểm tra traceback cuối và versions/`pip check`, không coi mọi lỗi bcrypt là warning vô hại. Giữ Python 3.11 và test lại trước khi nâng phiên bản. [Known upstream issue](https://github.com/pyca/bcrypt/issues/684).
- 401: phiên hết hạn hoặc JWT secret đổi; đăng nhập lại. Không retry pending confirmation.
- 403: Origin/header sai; sửa exact allowlist/request, không tắt guard.
- 409 TASK_CONFLICT: sửa giờ/hủy/explicit tiếp tục. Confirmation chat không chấp nhận action tự khai.
- 409 CONTEXT_EXPIRED/TASK_CHANGED: gửi lại yêu cầu; restart/TTL không được reconstruct pending.
- 503 DATABASE_UNAVAILABLE: kiểm tra PostgreSQL/network/config, không reset DB chính.
- 429/502/503 AI_*: kiểm tra account/quota/key/model; Todo/Calendar vẫn sử dụng được. Không tự fallback model.
- REQUEST_TIMEOUT phía browser: có thể request đã commit nhưng response chưa đến; kiểm tra Todo và nút Kiểm tra yêu cầu đang chờ trong Chat, không bấm gửi lặp nhiều lần.
- TASK_CHANGED từ form: dữ liệu đã đổi ở tab/thiết bị khác. Đóng và mở lại task mới để đối chiếu, không bỏ expected_version để ép ghi đè.
- Build chậm trên Windows: có thể mất vài phút; chờ kết quả exit code, không coi transforming là pass.
- npm ci trên Windows có thể EPERM esbuild.exe nếu dev server đang giữ file: dừng terminal Vite của project trước npm ci, chạy lại rồi restart. Không kill service khác hoặc tắt security policy. npm warnings transitive deprecated/install-script approval chưa phải build failure; chỉ kết luận pass sau tests/build exit0.
- Google Fonts cần mạng; system font fallback không ảnh hưởng chức năng.
- Chat một flow/user; tab thứ hai có thể thay draft, pending phải confirm/cancel trước. TTL 10 phút từ lần tương tác hợp lệ.
- Điện thoại: dùng HTTPS release cùng origin khi có URL. Thử LAN chỉ trên Wi-Fi tin cậy, bind đúng interface, thêm exact Origin IP:port và firewall Private tối thiểu; không mở PostgreSQL/router, không tắt firewall. 127.0.0.1 trên điện thoại không phải PC; xem hướng dẫn chi tiết trong [audit](AUDIT_IMPROVEMENTS_2026-10-21.md).
- Rubric/deadline/chia việc nhóm chưa cung cấp; không tự tạo thêm presentation/report ngoài scope.

Không commit .env/key/cookies/connection strings. Nếu credential đã lộ, rotate/revoke; chỉ xóa khỏi working tree không đủ.
