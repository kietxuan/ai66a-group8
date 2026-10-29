# SYSTEM ARCHITECTURE

## 1. Kiến trúc và phạm vi

```text
React (Todo / Calendar / Chat)
              |
        /api - REST JSON
              |
       FastAPI - services
          |          |
     PostgreSQL   Groq
```

Giữ monolith nhỏ. Router xử lý HTTP; schema validate payload; service xử lý nghiệp vụ; CRUD truy vấn qua SQLAlchemy. Không tạo hai bộ logic task riêng cho REST và chatbot.

## 2. Module boundaries

Giữ cấu trúc skeleton hiện có, bổ sung dần trong tuần tương ứng:

```text
backend/
  main.py                 # app entrypoint, routers, static build khi deploy
  app/
    api/                  # health, auth, categories, tasks, chat; dependency current_user
    core/                 # settings, JWT/cookie, password, error handling
    models/               # SQLAlchemy models
    schemas/              # Pydantic request/response + structured action
    crud/                 # truy vấn scoped theo user
    services/             # auth, tasks/conflicts, chat orchestration, Groq
  alembic/                # migrations; thêm Week 2
  tests/
frontend/
  src/
    api/                  # một HTTP client, error/401 handling
    auth/
    tasks/                # shared form, filter, task data refresh
    calendar/
    chat/
```

Các file rỗng hiện có chưa được xem là module đã hoạt động. Không bắt buộc giữ file placeholder không có trách nhiệm; đổi tên/xóa placeholder khi implement tuần liên quan, không redesign toàn repo.

SQLAlchemy dùng synchronous Session + psycopg. Route/service database sync hoặc offload thích hợp, không gọi SQLAlchemy sync trực tiếp trên async event loop. Groq là lời gọi mạng có timeout; không giữ transaction/row lock trong thời gian chờ AI.

## 3. Authentication và bảo vệ request ghi

- Password dùng Passlib 1.7.4 `CryptContext(schemes=["bcrypt"])` với pyca/bcrypt 4.3.0, hash mới `$2b$`, cost 12 và salt ngẫu nhiên. Đây là amendment theo user ngày 22/10, không thay thuật toán hoặc schema/hash của tài khoản cũ; không auto-rehash khi login.
- Giữ input 8 ký tự đến 72 byte UTF-8, không trim/pre-hash/cắt. Helper cũng reject quá 72 byte khi hash/verify; hash lưu sai định dạng trả verify false. Passlib không nhận NUL, trong khi bcrypt/API cũ nhận: chỉ password chứa NUL dùng trực tiếp pyca/bcrypt cùng cost 12 để không làm mất tương thích; mọi password thông thường dùng CryptContext. Có test riêng cho cả hai nhánh.
- Known compatibility warning: Passlib 1.7.4 có thể log `(trapped) error reading bcrypt version` do bcrypt 4.3.0 không có `__about__`. Exception này được thư viện bắt, không phải hash/verify thất bại; đã chạy test hash cũ/mới và auth thật với PostgreSQL test. Không monkeypatch metadata, suppress logger hoặc hạ bcrypt để che warning. Giữ Python 3.11; đổi runtime/dependency cần chạy lại compatibility suite. [Passlib bcrypt](https://passlib.readthedocs.io/en/stable/lib/passlib.hash.bcrypt.html), [upstream issue](https://github.com/pyca/bcrypt/issues/684).
- JWT HS256: sub là user ID dạng string, iat/exp; hạn mặc định 60 phút. Xác minh signature, algorithm, expiry và user còn tồn tại.
- Cookie access_token: HttpOnly, Path=/, host-only (không Domain), SameSite=Lax; Secure=true trên HTTPS production, false cho localhost HTTP.
- Login set cookie; logout clear với cùng Path/thuộc tính. Không trả JWT cho JavaScript, không lưu localStorage.
- GET /api/auth/me phục hồi phiên. Register không auto-login.
- Logout xóa cookie và chat context của user; không có denylist, token đã sao chép vẫn có hiệu lực tới expiry.
- Các POST/PUT/PATCH/DELETE /api yêu cầu header X-Requested-With: todo-app. Kiểm tra Origin nếu header có mặt, chỉ chấp nhận origin trong allowlist. Body có dữ liệu chỉ nhận application/json, không form/text.
- Áp dụng cả register/login/logout/chat để tránh bỏ sót request ghi. OPTIONS preflight không yêu cầu auth/header này.
- Kết hợp header, Origin check và SameSite để bảo vệ JSON API khỏi CSRF cơ bản; CORS không tự thay thế CSRF check.
- Dev ưu tiên Vite proxy. Nếu gọi khác origin, chỉ allow origin cụ thể, credentials=true và methods/headers cụ thể, không dùng wildcard.

Tham khảo: [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/), [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## 4. Task service và transaction

- current_user là nguồn ownership duy nhất. Query task/category luôn scoped theo user, kể cả get-by-ID và resolve task cho chatbot.
- Category của user khác trả 404; foreign key tồn tại không có nghĩa là được phép dùng.
- Một task service phục vụ create/update/delete/status cho REST và chat.
- Kiểm tra pending timed tasks theo [database contract](DATABASE.md).
- Khi create, update task hoặc mở lại pending: trong transaction khóa hàng User hiện tại bằng SELECT ... FOR UPDATE, đọc conflict rồi ghi/commit. Các đường ghi liên quan lịch đều đi qua service này.
- Cách khóa đơn giản này serialize thay đổi lịch theo user; không xây hệ thống distributed locking.
- Rollback khi validation/conflict lỗi; allow_conflict không bỏ qua kiểm tra schema/ownership.
- Delete/complete không tạo overlap mới; vẫn xử lý nhất quán trong transaction service.
- Email unique có constraint database, xử lý race đăng ký thành 409, không chỉ check trước rồi tin rằng insert luôn thành công.

## 5. Chatbot pipeline

```text
message + optional context_id
  -> auth / input validation
  -> load backend-owned context (nếu có)
  -> Groq Structured Output (không quyền ghi DB)
  -> Pydantic + business validation
  -> resolve task/category trong dữ liệu của user
  -> thiếu dữ liệu / nhiều kết quả -> clarification
  -> xóa / trùng lịch -> pending confirmation
  -> shared task service -> commit -> result + refresh UI
```

Week 6 chỉ parse/clarify/dry-run, không ghi task. Week 7 bật thực thi qua shared service và endpoint xác nhận.

AI chỉ trả action/fields/filters theo API_SPEC. Không cho AI quyết định user_id, allow_conflict hoặc confirmed. Không đưa password/cookie/key vào prompt. Chỉ gửi phần context/dữ liệu task tối thiểu của current user, coi nội dung task là dữ liệu không phải chỉ dẫn hệ thống.

Backend gửi ngày hiện tại và timezone Asia/Ho_Chi_Minh cho mỗi lần parse; category_name phải resolve trong danh sách category của user. Unsupported request không tự biến thành action khác.

Amendment user 22/10: `suggest_free_slots` đi qua nhánh read-only trước task execution. Groq chỉ trích `availability` (ngày, phút, hai giờ); `availability_service` dùng lại CRUD conflicts scoped user, hợp nhất/clip khoảng bận và tính ba slot sớm nhất. Backend kiểm tra tiêu chí thiếu, ngày đã qua, thứ tự giờ, thời lượng vừa khung; clock theo VN bỏ thời gian đã qua. Không User row lock, reservation, write transaction hoặc AI-generated slots. Lúc tạo task sau đó vẫn recheck conflict trong task service như cũ. Nhánh này đọc được cả khi CHAT_EXECUTION_ENABLED=false, giống query, không phải draft mutation.

## 6. Ngữ cảnh tạm thời, không chat history database

- Context trong RAM, keyed theo (current_user.id, random context_id), không global context chung cho các user.
- TTL 10 phút tính từ lần tương tác hợp lệ cuối; một active flow/user. Bắt đầu yêu cầu mới không có context_id thay flow cũ.
- Lưu draft, câu hỏi/missing fields, các lựa chọn ID được phép, hoặc pending action cần xác nhận; không lưu toàn bộ lịch sử hội thoại.
- Bổ sung memory RAM theo user, TTL 600s riêng: tối đa 6 bản ghi lượt nói, 400 ký tự/bản ghi, 12 ID task vừa hiển thị và last_task_id. Trước parse, đọc lại ID theo owner; chỉ gửi title/date/time/status/priority/category cần thiết, không dump toàn DB/description/history. Logout xóa cả memory. Một flow/user vẫn giữ nguyên.
- Memory không có pending action/quyền override/confirmation. Result/confirm tiêu thụ flow ID cũ nhưng có thể nhớ task cho câu tiếp theo; không biến result context thành quyền replay.
- Gợi ý giờ trống chỉ nhớ `last_availability` gồm bốn tiêu chí đã kiểm tra, không giữ slots/ID task/quyền đặt lịch. Result gợi ý xóa task referent cũ để không hiểu “khung đó” thành task không liên quan; kết quả task mới bỏ tiêu chí gợi ý cũ. Dùng cùng TTL/user/logout, không bảng/history mới.
- Với clarification giờ trống còn hiệu lực, backend merge bản nháp hiện tại trước; không bỏ những tiêu chí user vừa cung cấp chỉ vì model gán nhầm reference của một tìm kiếm đã hoàn tất. last_availability chỉ resolve khi không tiếp tục bản nháp đó; expired/khác owner không được lấy lại tiêu chí từ lời model.
- `reference=last_task/recent_results` chỉ giải quyết trong recent IDs hiện còn hợp lệ. Không match thì hỏi lại, không fallback toàn database. Ordinal rõ ràng được phân giải theo thứ tự danh sách backend; trường hợp khác vẫn hỏi/parse.
- Frontend hiển thị message của phiên hiện tại trong memory. Khi reload/logout/401 thì xóa message/context phía client.
- Restart server/context hết hạn/context user khác: 409 CONTEXT_EXPIRED, yêu cầu gửi lại; không thực hiện pending action.
- Confirm đọc pending action từ backend, không nhận lại action/allow_conflict tùy ý từ client.
- Khi chuẩn bị update/delete/complete, lưu updated_at của task; confirm re-read và trả 409 TASK_CHANGED nếu task đã đổi, không thực thi bản cũ.
- Confirm/cancel thành công tiêu thụ context; gửi lại không được thực hiện action lần hai. Trong một process, dùng lock theo flow để chống confirm đồng thời.
- Khi confirm trùng lịch, kiểm tra lại conflict; chỉ override những conflict user đã thấy. Có conflict mới thì trả preview mới để xác nhận lại.
- Nếu đang có pending confirmation, frontend chỉ cho confirm/cancel; muốn yêu cầu mới phải cancel flow cũ.
- GET /api/chat/context chỉ trả flow hiện còn hiệu lực cho owner, không touch TTL/ghi DB. Dùng sau reload/mất response để xem lại hoặc hủy; expired/restart trả flow null, không tái tạo action.
- MVP chạy Uvicorn một worker/một instance. Không tuyên bố hỗ trợ nhiều worker/replica với RAM context; nếu cần mới thiết kế shared store.

## 7. Frontend task data

- UI amendment 22/10: theme là preference browser-local (`nhip-theme` light/dark) với bootstrap cùng origin trước React/CSS; không token/task/chat history trong storage, không API/DB mới. Các component đổi màu bằng CSS tokens, không đổi key hoặc remount TaskProvider/Calendar/chat. Native dialog dùng chung, chỉ đổi layout thành panel trên desktop; không duplicate business logic. Xem UI_DIRECTION.
- Một API client dùng relative /api, credentials: include và header chống CSRF cho request ghi.
- Task data/refresh dùng chung cho Todo, Calendar, Chat; không giữ hai bản task độc lập không đồng bộ.
- Sau mutation thành công, re-fetch các view đang dùng và đánh dấu view chưa mở cần refresh. Không cập nhật UI thành công trước khi backend commit.
- Search có debounce ngắn; bỏ qua/cancel response cũ khi filter đổi nhanh.
- Deadline bao cả fetch và JSON (20s thông thường, 45s chat); timeout mutation có kết quả chưa rõ nên không tự retry. API client auth epoch chặn 401 trễ từ phiên trước.
- Category cache tách revision task; giữ snapshot cùng query khi refresh, cache/view-state RAM bị hủy khi đổi user. Refresh khi quay lại tab có throttle; ngày hiện tại tính lại theo VN.
- UI gửi expected_version khi edit/status/delete; backend so updated_at trong cùng transaction đã khóa user. Không có version vẫn giữ tương thích REST cũ; UI mới không bỏ version để vượt TASK_CHANGED.
- 401: clear user/task/chat cache, chuyển Login. Không auto-retry mutation.
- Calendar query date_from/date_to theo range hiển thị; FullCalendar end là exclusive, chuyển date_to về ngày cuối inclusive.
- Task cả ngày dùng ngày YYYY-MM-DD, không ép UTC qua toISOString gây lệch ngày. Task có giờ dùng named timezone Asia/Ho_Chi_Minh như UI_DIRECTION, không phụ thuộc timezone máy người dùng.

## 8. AI reliability và tests

- Groq model lấy từ cấu hình, baseline openai/gpt-oss-20b. Kiểm tra account access Week 2, integration Week 6; không tự thay model.
- Structured Output là một đường tích hợp duy nhất; không thêm Function Calling/streaming trong MVP.
- Timeout lời gọi AI mặc định 20 giây; không auto-retry request mutation. Trả error rõ khi provider timeout/rate-limit/output sai.
- Mock Groq trong automated tests. Test thật chỉ smoke có chủ đích, không bắt buộc API key trong CI.
- Test backend bằng PostgreSQL riêng, không dùng SQLite để tuyên bố đã kiểm tra migration/row locks PostgreSQL.

## 9. Deployment cùng origin

Đợt hardening thêm request body cap 32KiB/deadline đọc 10s, rate limit RAM một process (auth 12/IP/phút, chat 10/user/phút), security/no-store headers và request ID/duration không body/secrets. Database có connect/statement/lock/pool timeout. `/ready` là DB readiness tách `/health`; không health-check Groq. Proxy/IP, CSP và cookie vẫn cần smoke trên hosting HTTPS thật.

```text
Browser --HTTPS--> Render Web Service (Python runtime)
                      |-- /api, /health: FastAPI
                      |-- React build: static files + SPA fallback
                      |-- PostgreSQL: Neon (TLS)
                      |-- Groq: server-side API key
```

Một service tránh phụ thuộc cookie bên thứ ba giữa frontend và backend. Không deploy Render Static Site riêng trong MVP.

- Build từ root repository: cài backend dependencies, npm ci và npm run build trong frontend.
- Render Python runtime có Node.js/npm; pin phiên bản tương thích khi implement, không giả định bản mặc định luôn đúng.
- Uvicorn main:app chạy từ backend, bind 0.0.0.0 và port Render cung cấp; một worker.
- FastAPI phục vụ frontend/dist. Đăng ký API trước SPA fallback; /api/*, /health, /docs, /openapi.json không được biến thành HTML fallback khi sai route.
- Alembic upgrade head trước phục vụ phiên bản mới. Không chạy create_all để thay migrations.
- Week 5 deploy rehearsal auth/tasks/calendar; Week 8 online MVP; Week 10 release/demo.
- Không giả định gói free, cold start hoặc uptime của nhà cung cấp đáp ứng demo; kiểm tra tài khoản/gói thực tế Week 2 và trước buổi demo.

Tham khảo: [Render Python runtime](https://render.com/docs/native-runtimes), [deploy FastAPI](https://render.com/docs/deploy-fastapi), [FastAPI static files](https://fastapi.tiangolo.com/tutorial/static-files/).
