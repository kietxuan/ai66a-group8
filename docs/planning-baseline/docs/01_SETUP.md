# LOCAL SETUP

## 1. Trạng thái và thứ tự

Repository hiện là planning baseline: backend/main.py và frontend entrypoints là placeholder. Chưa có React package.json, Alembic hoặc test suite thực sự. Không coi các lệnh run app dưới đây là đang chạy được ngay.

Week 1 chỉ cần Git, đọc tài liệu và kiểm tra hướng môi trường; không bắt buộc code. Week 2 thực hiện setup/backend/auth/frontend shell; Week 3 thêm Tasks/Categories; Week 6 thêm Gemini SDK.

## 2. Requirements

- Git, Python 3.11, Node.js/npm phiên bản được Vite đang chọn hỗ trợ.
- PostgreSQL local hoặc Neon development database riêng.
- Một PostgreSQL test database riêng, tuyệt đối không dùng development/production để reset test.
- Tài khoản Gemini/Render/Neon: kiểm tra khả dụng ở Week 2, chưa cần deploy app hay tích hợp chatbot lúc đó.

Ghi phiên bản đã kiểm tra vào README khi setup; pin backend dependencies và commit frontend/package-lock.json. Không chọn phiên bản chỉ dựa vào “latest” mà bỏ kiểm tra compatibility.

Docker không bắt buộc. Các Dockerfile/docker-compose hiện rỗng không phải hướng dẫn chạy được.

## 3. Backend environment - thực hiện Week 2

PowerShell, từ project root:

```powershell
Set-Location backend
python --version
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Nếu activation bị policy chặn, dùng trực tiếp .\.venv\Scripts\python.exe cho các lệnh Python; không cần đổi execution policy toàn máy.

Copy .env.example thành .env ở project root, giữ secrets local. Settings phải load đúng file .env ở root bằng đường dẫn resolve theo module/project, không phụ thuộc thư mục hiện tại của terminal.

| Setting | Quy tắc triển khai |
|---|---|
| DATABASE_URL | postgresql+psycopg://..., PostgreSQL development |
| TEST_DATABASE_URL | Bổ sung Week 2: URL PostgreSQL riêng dành test |
| JWT_SECRET_KEY | Random secret dài, không dùng placeholder trong .env.example |
| JWT_EXPIRE_MINUTES | 60 mặc định |
| CORS_ORIGINS | CSV explicit origins; local http://localhost:5173; production origin HTTPS thực tế |
| COOKIE_SECURE | Bổ sung Week 2: false local HTTP, true production HTTPS |
| GEMINI_API_KEY | Server-side; kiểm tra quyền account Week 2, dùng tích hợp Week 6 |
| GEMINI_MODEL | Bổ sung khi tích hợp: gemini-2.5-flash baseline |
| AI_TIMEOUT_SECONDS | Bổ sung Week 6: 20 |

Các setting chưa có trong .env.example chỉ là kế hoạch, phải bổ sung cùng code đọc chúng ở tuần tương ứng. Frontend không nhận JWT secret/database URL/Gemini key qua VITE_*.

requirements.txt hiện chưa pin version. Week 2 xác nhận phiên bản tương thích Python 3.11, bổ sung validator nếu thực sự dùng, rồi pin; google-genai chỉ bổ sung Week 6. Nếu ZoneInfo trên Windows thiếu timezone database, thêm tzdata trong dependency phù hợp.

## 4. PostgreSQL và Alembic - Week 2–3

- Tạo database development và test riêng; xác nhận quyền kết nối.
- Week 2 cấu hình Alembic đọc DATABASE_URL, migration Users.
- Week 3 thêm migration Categories/Tasks + backfill category idempotent.
- Không tự tạo schema bằng create_all thay Alembic.
- Khi test, fixture chỉ reset database đã xác nhận tên/mục đích test và URL khác database chính; fail-fast nếu thiếu/sai TEST_DATABASE_URL.
- Neon URL production dùng TLS theo connection string nhà cung cấp; không bỏ sslmode để “cho dễ chạy”.

Sau khi Alembic/app thực sự được tạo, từ backend với venv:

```powershell
python -m alembic upgrade head
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Kiểm tra GET /health, /docs và auth theo API_SPEC. Health chỉ liveness; cần auth/migration smoke để xác nhận database.

## 5. Frontend - Week 2

Kiểm tra frontend placeholder trước scaffold, tránh overwrite file không liên quan. Khởi tạo React/Vite bằng template JavaScript, không tự đổi TypeScript hoặc thêm framework.

Tạo scripts dev/build/test; Vitest + React Testing Library; Vite proxy /api và /health tới http://127.0.0.1:8000. Dev server dùng localhost:5173, strict port hoặc cập nhật explicit origin nếu đổi port.

Sau khi package.json/package-lock.json tồn tại, terminal thứ hai từ frontend:

```powershell
npm ci
npm run dev
```

API client dùng relative /api, credentials: include; request ghi có X-Requested-With: todo-app. Qua proxy, Origin của browser vẫn là frontend origin; allowlist phải có origin đó.

Production frontend build được FastAPI phục vụ, không cần VITE_API_URL khác origin và không deploy Static Site riêng.

## 6. Checks - sau khi test harness được tạo

Backend, từ backend/venv:

```powershell
python -m pytest
```

Frontend, từ frontend:

```powershell
npm test -- --run
npm run build
```

Week 2 phải tạo test thực tế trước khi kết luận các lệnh này pass. backend/tests/test.py chỉ print Hello world hiện tại không được tính là test suite.

CI nhỏ từ Week 2: backend với PostgreSQL service test, frontend tests/build. Gemini mocked, không dùng production secrets. Sau mỗi tuần ghi commands/results vào PROGRESS.

## 7. Deploy rehearsal - Week 5

Một Render Web Service, root repository; Python runtime (có Node/npm). Pin runtime versions phù hợp; build frontend/dist + backend dependencies. Start từ backend với Uvicorn bind 0.0.0.0 và PORT do Render cung cấp, một worker.

- Chạy Alembic upgrade head trước khi phục vụ bản mới; chọn cơ chế migration thực tế tài khoản Render hỗ trợ, không giả định mọi gói đều có pre-deploy hook.
- Không chạy migration nhiều lần song song; nếu gói chưa có hook, chạy một lần qua workflow release/manual có kiểm soát trước rollout.
- FastAPI serve static build và SPA fallback đúng phạm vi; /api sai route vẫn JSON 404, không HTML.
- Cookie Secure=true, CORS_ORIGINS/Origin allowlist theo URL production, DATABASE_URL Neon TLS.
- Kiểm tra auth reload/logout, task CRUD và Todo/Calendar online, không chỉ thấy trang chủ.

Tài liệu tham khảo: [Render runtime](https://render.com/docs/native-runtimes), [FastAPI deployment](https://render.com/docs/deploy-fastapi). Xác minh dashboard/gói/giới hạn tại thời điểm triển khai.

## 8. Secrets và handoff

Không commit .env, API key, cookies, connection strings, .venv/node_modules/dist. .env.example chỉ dùng placeholder.

Nếu key/secret đã bị commit hoặc gửi lên log, phải rotate/revoke; xóa file ở commit mới không đủ. Không tự thao tác database production để sửa test.

Đầu tuần mới đọc ROADMAP/PROGRESS, chạy check hiện có và xử lý prerequisite trước.
