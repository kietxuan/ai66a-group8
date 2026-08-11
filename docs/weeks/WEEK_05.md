# WEEK 05 — AUTHENTICATION

## Objective
Có tài khoản người dùng và cách ly dữ liệu theo user.

## Prerequisites
- Backend, database và core task flow đã hoạt động.

## Tasks
- [ ] Register.
- [ ] Login.
- [ ] Logout.
- [ ] Hash password.
- [ ] JWT access-token authentication middleware.
- [ ] Lưu JWT trong HttpOnly cookie.
- [ ] Cấu hình CORS/credentials đúng cho frontend-backend.
- [ ] Task queries scope theo current user.
- [ ] Category/conversation data scope theo current user khi có.
- [ ] Frontend auth state và protected flow.

## Security Checks
- Không lưu password plain text.
- Không lưu JWT access token vào localStorage trong thiết kế chính của project.
- User A không đọc/update/delete task của User B.
- Unauthenticated request bị xử lý đúng.

## Tests / Validation
- Register/login/logout.
- Wrong credentials.
- Cross-user authorization.
- Protected task endpoints.

## Definition of Done
- Mỗi user chỉ thấy/quản lý dữ liệu của mình.
- Authentication flow hoạt động end-to-end.
- `PROGRESS.md` cập nhật.

## Do Not Implement Yet
- Không làm AI destructive actions trước khi backend auth/ownership ổn định.
