# WEEK 02 — AUTHENTICATION & BACKEND FOUNDATION

## Objective
Có backend FastAPI và authentication hoạt động trước khi triển khai Task CRUD.

## Prerequisites
- Week 1 complete.
- PostgreSQL đã được chốt.
- Authentication design đã được thống nhất: JWT access token trong HttpOnly cookie và bcrypt.

## Tasks
- [ ] Initialize Python + FastAPI backend.
- [ ] Thiết lập Uvicorn để chạy development server.
- [ ] Thiết lập cấu hình môi trường.
- [ ] Kết nối database.
- [ ] Tạo schema/migration cho Users.
- [ ] Implement Register.
- [ ] Implement Login.
- [ ] Implement Logout.
- [ ] Hash password bằng bcrypt.
- [ ] Tạo JWT access token và lưu trong HttpOnly cookie.
- [ ] Tạo authentication dependency/middleware cho protected routes.
- [ ] Cấu hình CORS và credentials cho frontend-backend.
- [ ] Setup frontend shell tối thiểu cho authentication.
- [ ] Implement Register/Login UI cơ bản.
- [ ] Kết nối auth UI với backend bằng credentials.
- [ ] Không triển khai refresh token trong MVP.

## Backend
- FastAPI application và router structure.
- POST `/api/auth/register`
- POST `/api/auth/login`
- POST `/api/auth/logout`
- Authentication dependency dùng lại cho các task route ở Week 3.

## Database
- Tạo bảng Users theo `DATABASE.md`.
- Chốt các constraint cần cho authentication, gồm email unique và password field.
- Không tạo giả authenticated user cho thiết kế cuối cùng.

## Tests / Validation
- Register thành công.
- Không cho đăng ký email trùng.
- Login đúng credentials.
- Từ chối sai credentials.
- Logout clear authentication cookie.
- Protected request không có credentials bị từ chối.
- Password không được lưu plain text.

## Definition of Done
- Backend FastAPI chạy được.
- User có thể Register/Login/Logout end-to-end.
- JWT được xử lý bằng HttpOnly cookie.
- Authentication dependency sẵn sàng để bảo vệ Task CRUD ở Week 3.
- `PROGRESS.md` cập nhật.

## Do Not Implement Yet
- Không làm Task CRUD.
- Không làm Todo List.
- Không làm Calendar.
- Không làm AI Chatbot.
- Không làm Dashboard.
