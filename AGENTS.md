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
- `docs/ROADMAP.md`
- `docs/PROGRESS.md`
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
- Conflict detection áp dụng khi tạo task và khi đổi thời gian task.
- Dashboard/Statistics/Notification/Recommendation là phần nâng cao; không ưu tiên hơn MVP.

---

## 4. Architecture Rules

Stack đã chốt:
- Frontend: HTML, CSS, JavaScript, React.js
- Backend: Node.js, Express.js
- Database: PostgreSQL
- Calendar: FullCalendar
- AI provider: Google Gemini API
- AI model: Gemini 2.5 Flash
- AI integration: Gemini API + Structured Output / Function Calling
- Authentication: JWT access token trong HttpOnly cookie + bcrypt
- Testing: Vitest + React Testing Library + Supertest
- Deployment: Render (frontend/backend) + Neon PostgreSQL

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

---

## 7. Completion Rule

Không tuyên bố một task/tuần đã hoàn thành chỉ vì code đã được viết.

Definition of Done phải dựa trên file tuần tương ứng và tối thiểu gồm:
- chức năng chạy theo acceptance criteria;
- API/UI liên quan hoạt động;
- dữ liệu user được cách ly đúng;
- test/check liên quan đã chạy nếu project đã có;
- `docs/PROGRESS.md` được cập nhật.
