# AGENTS.md

## 1. Project Purpose

Đây là project môn Web Design: **Todo List Calendar tích hợp AI Chatbot**.

Mục tiêu là xây dựng ứng dụng web quản lý task cá nhân có:
- Todo List
- Calendar
- Authentication
- REST API
- Database
- AI Chatbot quản lý task bằng ngôn ngữ tự nhiên
- Conflict detection cho task bị trùng thời gian

Không biến project thành một hệ thống production-scale nếu không có yêu cầu mới từ người dùng/giảng viên.

---

## 2. Source of Truth

Trước khi code, đọc các file liên quan:
- `docs/PROJECT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/API_SPEC.md`
- `docs/UI_DIRECTION.md`
- `docs/01_SETUP.md`
- `docs/ROADMAP.md`
- `docs/PROGRESS.md`
- `docs/PLAN_REVIEW.md` (audit decisions và rủi ro bên ngoài)
- file tuần hiện tại trong `docs/weeks/`

Nếu code hiện tại và tài liệu mâu thuẫn:
1. Xác minh trạng thái thực tế của repository.
2. Không tự ý redesign lớn.
3. Ghi rõ conflict/deviation vào `docs/PROGRESS.md`.

---

## 3. Permanent Product Rules

- Mỗi user chỉ được xem và quản lý dữ liệu task của chính mình.
- Password phải được hash trước khi lưu database.
- Todo List và Calendar dùng chung nguồn dữ liệu task.
- AI **không trực tiếp thao tác database**.
- AI chỉ hiểu yêu cầu, xác định action và trả structured data cho backend.
- Backend chịu trách nhiệm:
  - xác thực user;
  - validate dữ liệu;
  - tìm task phù hợp;
  - kiểm tra conflict khi cần;
  - thực hiện action;
  - ghi database;
  - trả kết quả.
- Nếu yêu cầu chatbot thiếu thông tin quan trọng, không tự đoán; phải hỏi lại.
- Nếu có nhiều task phù hợp, không tự chọn; phải yêu cầu user làm rõ.
- Với thao tác xóa, cần confirmation phù hợp trước khi thực hiện.
- Conflict detection áp dụng khi tạo task, đổi ngày/giờ task pending và mở lại completed thành pending.
- Chỉ task pending có đủ hai giờ chặn lịch; task cả ngày/completed không chặn.
- Amendment user 2026-10-22: chat có `suggest_free_slots` chỉ đọc, backend tính tối đa ba khung trống trong một ngày/khung giờ/thời lượng được user nêu. Thiếu tiêu chí phải hỏi, không tự đặt/dời lịch hoặc coi gợi ý là giữ chỗ; vẫn dùng cùng policy conflict.
- Category MVP chỉ ba defaults/user và GET danh sách; không CRUD category.
- Todo/Calendar/chat dùng cùng task service/refresh flow, không duplicate business logic.
- Chat không có history database nhưng có context RAM scoped user, TTL 10 phút; confirmation do backend quản lý, không AI/client tự khai.
- Context hết hạn/restart/replay không được thực thi pending action.
- Request ghi bằng cookie phải theo Origin/header/JSON checks trong ARCHITECTURE; CORS không thay thế CSRF protection.
- Dashboard/Statistics/Notification/Recommendation tổng quát là phần nâng cao; ngoại lệ được user yêu cầu riêng là gợi ý giờ trống chỉ đọc ở trên.

---

## 4. Architecture Rules

Stack đã chốt (provider/model đổi theo yêu cầu trực tiếp của user ngày 2026-10-21):
- Frontend: HTML, CSS, JavaScript, React.js + Vite
- Backend: Python 3.11, FastAPI, Uvicorn
- Persistence: SQLAlchemy 2, Alembic, psycopg
- Database: PostgreSQL
- Calendar: FullCalendar
- AI provider: Groq API
- AI model: openai/gpt-oss-20b
- AI integration: Groq API + Structured Output; không triển khai thêm Function Calling song song trong MVP
- Authentication: JWT access token trong HttpOnly cookie + Passlib CryptContext/bcrypt (user amendment 2026-10-22; giữ tương thích hash cũ)
- Testing: Vitest + React Testing Library + pytest + HTTPX/FastAPI TestClient
- Deployment: một Render Web Service phục vụ React build + FastAPI cùng origin, Neon PostgreSQL
- Uvicorn một worker/instance cho context RAM; không tuyên bố hỗ trợ multi-worker
- Timezone nghiệp vụ: Asia/Ho_Chi_Minh; Calendar dùng named timezone, task date/time không đổi thành UTC date

Giữ kiến trúc chính:
`Frontend -> REST API -> Backend -> Database`

Chatbot:
`User -> Chat UI -> POST /api/chat -> AI -> Structured Action -> Backend validation/execution -> Database -> UI refresh`

---

## 5. Weekly Work Rules

- Chỉ implement phạm vi của tuần hiện tại, trừ dependency bắt buộc.
- Không tự kéo feature của tuần sau vào tuần hiện tại chỉ vì “tiện”.
- Trước khi implement tuần mới:
  1. đọc roadmap;
  2. đọc progress;
  3. kiểm tra code hiện tại;
  4. chạy test/check hiện có nếu có;
  5. xác minh prerequisites.
- Test/validation đi cùng từng tuần từ Week 2; Week 9 là regression, không phải bắt đầu test.
- Kiểm tra feasibility Groq/Render/Neon ở Week 2; deploy rehearsal ở Week 5, MVP online ở Week 8.
- Backend tests dùng PostgreSQL test database riêng, fixture không được reset development/production.
- Optional chỉ làm sau gate MVP Week 8; bỏ optional trước nếu core chưa đạt.
- Khi hoàn thành tuần:
  - cập nhật `docs/PROGRESS.md`;
  - ghi files/modules đã thay đổi;
  - ghi test/check đã chạy;
  - ghi known issues;
  - ghi deviation khỏi plan nếu có.

---

## 6. Dependency / Scope Discipline

- Không thêm dependency lớn nếu project hiện tại đã có cách giải quyết tương đương.
- Không đổi database, framework hoặc API architecture chỉ vì preference của agent.
- Không tự thay đổi các technology decisions đã chốt trong repository.
- Nếu một service/model bị deprecated hoặc không còn khả dụng, dừng lại và báo rõ trước khi thay thế.
- Không thêm refresh-token flow vào MVP nếu không có yêu cầu mới.
- Pin/lock dependencies sau compatibility checks, không upgrade hàng loạt vì preference.
- Không coi file rỗng, print Hello world, health 200 hoặc mock provider pass là bằng chứng app/LLM thật đã chạy.
- Không giữ DB transaction/row lock khi chờ Groq; conflict check + write nằm trong cùng transaction task service.

---

## 7. Completion Rule

Không tuyên bố một task/tuần đã hoàn thành chỉ vì code đã được viết.

Week 1 là ngoại lệ planning: hoàn thành dựa trên tài liệu/decisions được review, không yêu cầu API/UI chạy. Không dùng ngoại lệ này cho các tuần implementation.

Definition of Done cho tuần implementation phải dựa trên file tuần tương ứng và tối thiểu gồm:
- chức năng chạy theo acceptance criteria;
- API/UI liên quan hoạt động;
- dữ liệu user được cách ly đúng;
- test/check liên quan đã chạy nếu project đã có;
- `docs/PROGRESS.md` được cập nhật.
