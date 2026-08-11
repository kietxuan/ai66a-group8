# WEEK 01 — PLANNING

## Objective
Chuyển project description hiện tại thành specification đủ rõ để bắt đầu implementation mà không tự thêm requirement.

## Prerequisites
- Đọc toàn bộ blueprint.
- Có đề bài/rubric môn học nếu giảng viên cung cấp.

## Tasks
- [ ] Review project scope và MVP.
- [ ] Xác nhận Todo List + Calendar + Chatbot là core.
- [ ] Review wireframe/UI direction.
- [ ] Review database entities: Users, Categories, Tasks, Conversations, Messages.
- [ ] Review REST API.
- [ ] Xác nhận PostgreSQL setup cho Week 2.
- [ ] Xác nhận auth design: JWT access token + HttpOnly cookie + bcrypt.
- [ ] Chuẩn bị Google Gemini API project/key cho chatbot ở Week 6.
- [ ] Xác nhận test stack: Vitest + React Testing Library + Supertest.
- [ ] Xác nhận deployment targets: Render + Neon.
- [ ] Xác nhận roadmap 10 tuần = 10 phase.

## Frontend
- Xác định màn hình tối thiểu:
  - Login/Register
  - Todo List
  - Calendar
  - Chatbot
- Dashboard chỉ optional.

## Backend
- Xác định route/module boundaries.
- Không implement production code trong tuần planning nếu chưa được yêu cầu.

## Database
- Review fields và relationships.
- Ghi các constraint còn thiếu thành TBD thay vì tự đoán.

## Tests / Validation
- Kiểm tra consistency giữa PROJECT_SPEC, ARCHITECTURE, DATABASE, API_SPEC và ROADMAP.

## Definition of Done
- Không còn quyết định quan trọng nào chặn Week 2.
- Roadmap phù hợp lịch môn học.
- Scope MVP được hiểu thống nhất.
- `PROGRESS.md` được cập nhật.

## Do Not Implement Yet
- Không làm chatbot đầy đủ.
- Không làm Dashboard/Statistics.
- Không kéo task của tuần sau vào nếu chưa cần.
