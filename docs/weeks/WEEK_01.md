# WEEK 01 — PLANNING

## Objective
Chuyển project description hiện tại thành specification đủ rõ để bắt đầu implementation mà không tự thêm requirement.

## Prerequisites
- Đọc toàn bộ blueprint.
- Có đề bài/rubric môn học nếu giảng viên cung cấp.

## Tasks
- [x] Review project scope và MVP.
- [x] Xác nhận Todo List + Calendar + Chatbot là core.
- [x] Review wireframe/UI direction trong `docs/UI_DIRECTION.md`.
- [x] Review database entities và chốt schema MVP.
- [x] Review REST API và chốt response/error contract.
- [x] Xác nhận PostgreSQL, SQLAlchemy, Alembic và psycopg cho Week 2.
- [x] Xác nhận FastAPI + Uvicorn setup cho Week 2.
- [x] Xác nhận auth design: JWT access token + HttpOnly cookie + bcrypt.
- [x] Ghi nhận Gemini API access sẽ chuẩn bị ở Week 6.
- [x] Xác nhận test stack: Vitest + React Testing Library + pytest + HTTPX/FastAPI TestClient.
- [x] Xác nhận deployment targets: Render + Neon.
- [x] Xác nhận roadmap 10 tuần = 10 phase.

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
- Các constraint MVP đã được chốt trong `DATABASE.md`.

## Tests / Validation
- Kiểm tra consistency giữa PROJECT_SPEC, ARCHITECTURE, DATABASE, API_SPEC và ROADMAP.

## Definition of Done
- Không còn quyết định quan trọng nào chặn Week 2.
- Roadmap phù hợp lịch môn học.
- Scope MVP được hiểu thống nhất.
- UI direction, database schema và API contract đã được ghi thành tài liệu.
- `PROGRESS.md` được cập nhật.

## Do Not Implement Yet
- Không làm chatbot đầy đủ.
- Không làm Dashboard/Statistics.
- Không kéo task của tuần sau vào nếu chưa cần.
