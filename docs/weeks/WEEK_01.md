# WEEK 01 — PLANNING

## Objective

Chốt MVP, nguồn dữ liệu, auth/API/time/conflict/chat/deploy contract để Week 2 implement được. Week 1 là planning, không bắt buộc app chạy hoặc viết feature code.

## Prerequisites

- Đọc toàn bộ blueprint và AGENTS.
- Đối chiếu đề bài/rubric nếu giảng viên cung cấp; không tự tuyên bố đã đáp ứng rubric chưa nhận.

## Tasks — planning baseline đã hoàn thành

- [x] Chốt MVP Todo + Calendar + Chatbot, không Dashboard/Statistics bắt buộc.
- [x] Chốt Authentication Week 2 trước Task CRUD Week 3.
- [x] Ghi UI direction, shared task form và auth reload flow.
- [x] Chốt Users/Categories/Tasks; category read-only, defaults per user.
- [x] Chốt date/time cả ngày, timezone, status và ownership.
- [x] Chốt API/error envelope, me/categories/date-range endpoints, PUT/status semantics.
- [x] Chốt conflict pending-only, reopen, user override và check/write transaction.
- [x] Chốt Structured Output (Gemini ở baseline; Groq được user phê duyệt ngày 2026-10-21), backend execution; không AI trực tiếp ghi DB.
- [x] Chốt context tạm cho clarification/confirmation, không chat history database.
- [x] Chốt test từ Week 2 và PostgreSQL test database riêng.
- [x] Chốt deploy một Render Web Service cùng origin + Neon; rehearsal Week 5.
- [x] Ghi rủi ro account/model vào PLAN_REVIEW và gate kiểm tra Week 2.
- [x] Đồng bộ roadmap 10 tuần, PROGRESS và source of truth.

## Chuẩn bị tối thiểu

- Git repository và tài liệu đã commit/checkpoint; không yêu cầu commit code rỗng để đánh dấu hoàn thành.
- Xác định ai phụ trách frontend/backend/tests/demo và lịch môn học nếu làm nhóm; ghi phân công thực tế khi nhóm thống nhất, không tự gán người.
- Biết môi trường cần Python 3.11, Node/npm, PostgreSQL; cài và xác minh chạy ở Week 2.
- Có danh sách các tài khoản cần kiểm tra AI provider/Render/Neon; không coi key chưa thử là đã sẵn sàng.

## Validation

- Đối chiếu PROJECT_SPEC/ARCHITECTURE/DATABASE/API_SPEC/UI_DIRECTION/ROADMAP và toàn bộ tuần.
- Kiểm tra prerequisite, acceptance criteria, tên route/field, links và scope optional.
- Phân biệt quyết định thiết kế với thực trạng code; không có app/test/deploy verification ở Week 1.

## Definition of Done

- MVP/contract đủ cụ thể, không còn lựa chọn thiết kế chặn Week 2.
- Những điều phụ thuộc tài khoản/rubric ghi thành risk/checkpoint có thời điểm kiểm tra, không giấu dưới “đã xong”.
- Các tài liệu và PROGRESS nhất quán; Week 2 có checklist setup/auth/test rõ.
- Không dùng DoD implementation (API/UI đã chạy) để đánh giá tuần planning.

## Do Not Implement Yet

Không Task CRUD, chatbot, Dashboard hoặc deployment hoàn chỉnh. Không bắt buộc tạo code feature trong Week 1.
