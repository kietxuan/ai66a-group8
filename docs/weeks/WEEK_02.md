# WEEK 02 — BACKEND & DATABASE FOUNDATION

## Objective
Có backend + database chạy được và CRUD API cơ bản cho task.

## Prerequisites
- Week 1 complete.
- Database engine đã chốt.

## Tasks
- [ ] Initialize Python + FastAPI backend.
- [ ] Thiết lập Uvicorn để chạy development server.
- [ ] Thiết lập cấu hình môi trường.
- [ ] Kết nối database.
- [ ] Tạo schema/migration cho dữ liệu cần thiết để task CRUD chạy.
- [ ] Implement task CRUD API theo `API_SPEC.md`.
- [ ] Validate dữ liệu task cơ bản.
- [ ] Chuẩn bị query filter nền tảng nếu phù hợp.

## Backend

- FastAPI application và router structure.
- POST /api/tasks
- GET /api/tasks
- GET /api/tasks/:id
- PUT /api/tasks/:id
- DELETE /api/tasks/:id
- PATCH /api/tasks/:id/status

## Database
Ưu tiên schema từ `DATABASE.md`.
Nếu authentication chưa implement ở roadmap hiện tại, không giả vờ đã có authenticated user; ghi rõ temporary development strategy nếu cần và không để nó trở thành design cuối cùng.

## Tests / Validation
- Kiểm tra CRUD bằng Postman hoặc REST Client.
- Kiểm tra invalid input cơ bản.
- Kiểm tra database update đúng.

## Definition of Done
- Backend chạy.
- DB kết nối.
- CRUD task API hoạt động.
- API behavior được ghi nhận.
- `PROGRESS.md` cập nhật.

## Do Not Implement Yet
- Không làm Calendar.
- Không làm AI Chatbot.
- Không làm Dashboard.
