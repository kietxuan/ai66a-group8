# WEEK 10 - RELEASE, DOCUMENTATION & DEMO

## Objective

Bàn giao MVP online đã kiểm thử, có hướng dẫn chạy và kịch bản demo. Đây là release cuối sau rehearsal Week 5 và online MVP Week 8.

## Prerequisites

Week 9 regression/CI/build pass; Render/Neon và provider thật đã được xác minh; không blocker core/security/data.

## Tasks theo thứ tự

### 1. Release

- [ ] Review diff/secrets/config, xác định release commit thực tế; không commit .env/key/database credentials.
- [ ] Xác minh runtime pinned, dependency lock, build/start commands của service.
- [ ] Build React và FastAPI trong một Render Web Service, một worker; không tạo Static Site riêng.
- [ ] Neon TLS, production secret/model, Secure cookie, Origin allowlist đúng URL HTTPS.
- [ ] Backup dữ liệu nếu migration rủi ro; Alembic upgrade head một lần trước rollout. Không downgrade/xóa DB để sửa nhanh.
- [ ] Kiểm tra liveness /health, migration/database qua auth/task smoke, Gemini bằng một request thật.
- [ ] Kiểm tra deep links và /api 404 JSON, không để SPA fallback nuốt routes.
- [ ] Smoke hai user: Register/Login/me/reload -> Todo CRUD -> Calendar -> 5 chat action -> clarification/delete/conflict -> Logout.
- [ ] Restart service/context expiry yêu cầu gửi lại đúng, không thực hiện pending action cũ.
- [ ] Xác minh data task còn sau restart, không lưu vào local filesystem thay PostgreSQL.

### 2. Documentation và demo

- [ ] README: prerequisites/version, setup/migration/run/test/build commands đã chạy, URL online và limitations.
- [ ] API_SPEC/DATABASE/ARCHITECTURE phản ánh code thực; deviation ghi PROGRESS, không sửa docs để che test fail.
- [ ] Chuẩn bị tài khoản/demo tasks bằng dữ liệu không nhạy cảm; category IDs không hardcode.
- [ ] Kịch bản demo ngắn: auth, task all-day/timed, Todo/Calendar đồng bộ, chatbot, trùng lịch, confirmation, hai user isolation.
- [ ] Chuẩn bị ảnh/video hoặc bản local làm phương án demo khi mạng/provider gián đoạn; không coi fallback là đã deploy online thành công.
- [ ] Kiểm tra yêu cầu báo cáo/presentation theo rubric nếu đã nhận; không tự tạo thêm artifact ngoài yêu cầu.
- [ ] Kiểm tra tài khoản/gói/cold start trước buổi demo, không đảm bảo uptime/free tier theo giả định.
- [ ] Cập nhật PROGRESS: final URL/checks, known limitations, files/modules, release checkpoint thực tế.

## Acceptance và Definition of Done

- Hệ thống online HTTPS, auth/cookie/reload/ownership đúng.
- Migration, tests/CI/build và smoke core chạy trên đúng release.
- Gemini thật khả dụng theo account/model đã được phép; errors có fallback quản lý thủ công.
- Clarification/confirmation/conflict không mất ngữ cảnh bất ngờ ngoài TTL/restart đã được giải thích; replay không ghi thêm.
- Không secrets trong repo/build/logs; không reset production data bằng test.
- README/setup và hạn chế RAM context/single worker/no refresh token/no chat history được mô tả.
- Demo/bàn giao đủ rubric đã biết; không nói hoàn thành chỉ vì trang chủ mở được.

## Do Not Implement Yet

Không feature mới/optional lớn, không nâng cấp dependencies hàng loạt, không tự thay model nếu provider ngừng hỗ trợ; báo user để xử lý quyết định.
