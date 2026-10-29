# DEMO & RELEASE CHECKLIST

## 1. Bản có thể demo hiện tại

Local: http://127.0.0.1:5173 (Vite + API) hoặc http://127.0.0.1:8000 sau build (FastAPI same-origin). Chạy theo 01_SETUP nếu processes đã dừng.

Dữ liệu demo được tạo bằng UI, không hardcode category IDs. Tài khoản local synthetic email demo-local@example.com; password do phiên này đặt chỉ dành demo local, không đưa vào repository. Có thể đăng ký tài khoản mới qua UI thay vì dùng tài khoản đó. Không dùng thông tin thật hoặc mật khẩu đang dùng ở dịch vụ khác.

Hai task synthetic ngày 2026-10-05: “Đọc sách buổi sáng” cả ngày; “Học React và hoàn thiện giao diện” 19:00–20:30, ưu tiên cao, Học tập. Ngày cố định này chỉ là dữ liệu demo, code không hardcode hôm nay. Chuyển Calendar về tháng 10/2026 nếu demo ngày khác hoặc tạo tasks mới theo ngày hiện tại.

Ngày 2026-10-21 đã cấu hình Groq và smoke thật đủ 5 action ở local. Khởi động backend với GROQ_API_KEY và GROQ_MODEL=openai/gpt-oss-20b. Demo nên chừa khoảng 25 giây giữa các câu AI; quota là của tổ chức Groq, không cam kết không bị 429. Nếu key/quota lỗi, giao diện quản lý thủ công vẫn sử dụng được. Xem bằng chứng và gate còn mở trong [RELEASE_HANDOFF](RELEASE_HANDOFF.md).

## 2. Kịch bản demo 7–10 phút

1. **Auth:** đăng ký tài khoản A -> trở về Login -> đăng nhập. Reload còn phiên; backend lưu bcrypt, cookie HttpOnly. Không show JWT/key.
2. **Todo:** thêm all-day và timed tasks với ngày cụ thể, priority/category. Tìm kiếm/filter/presets, edit ghi chú, complete và reopen. Đổi filter nhanh không stale data.
3. **Calendar:** Month -> Week -> Day; task all-day đúng hàng, timed đúng 19:00. Click event mở cùng form; chọn ngày prefill create form; đổi status rồi về Todo thấy dữ liệu mới.
4. **Conflict:** tạo task timed chồng khoảng đã có. Preview conflict -> hủy/sửa giờ thì chưa ghi; chỉ “Vẫn tiếp tục” mới override. Reopen completed có overlap cũng dùng policy đó. Giờ sát nhau 20:30 không conflict với task kết thúc 20:30.
5. **Delete:** mở xác nhận và “Giữ lại” để chứng minh chưa xóa. Nếu muốn demo xóa, chọn task disposable của chính mình rồi confirm; không xóa task cần giữ.
6. **AI thật nếu đã cấu hình:** năm câu dưới; kiểm tra kết quả trên Todo/Calendar, không chỉ bot nói “xong”. Xóa luôn pending preview, confirm/cancel do backend.
7. **Clarification:** thiếu ngày; follow-up với context. Hai task cùng title -> danh sách choices, không chọn arbitrary. Trùng lịch -> hỏi override; thay blocker ở tab khác -> phải hỏi lại.
8. **Isolation:** logout A, đăng ký/login B -> không thấy task/category/context A. Hoặc hai browser profile tách cookies. Hai tab cùng profile không là hai user khác nhau.
9. **Failure/restart:** model unavailable không làm Todo/Calendar hỏng; context quá 10 phút/restart -> gửi lại, không replay ghi. Restart API giữ task PostgreSQL.
10. **Handoff:** chỉ ra tests/matrix/gates thật, không claim online khi đang localhost.

### Câu AI — thay NGÀY bằng ngày YYYY-MM-DD thực tế

- Tạo công việc cả ngày tên “Demo đọc tài liệu” vào NGÀY.
- Tìm công việc có tiêu đề “Demo đọc tài liệu”.
- Sửa công việc “Demo đọc tài liệu”: thêm ghi chú “Chuẩn bị cho buổi demo”.
- Đánh dấu hoàn thành công việc “Demo đọc tài liệu”.
- Xóa công việc “Demo đọc tài liệu”. (Record còn đến khi confirm.)
- Tạo công việc “Thiếu ngày”. -> trả lời “NGÀY” sau clarification.
- Thêm “Học Python” vào NGÀY từ 19:30 đến 20:00. -> overlap với timed task cùng ngày.
- “Ngày mai từ 8h học React trong 2 giờ” -> kiểm tra đúng ngày Việt Nam/duration, chỉ sau real-provider smoke.

AI có thể diễn giải sai: xem preview/result và dữ liệu thật, không demo bulk/recurring/reopen chat ngoài scope. Nếu 2.5 Flash không khả dụng, báo user quyết định trước thay model.

## 3. Fallback khi mạng/provider gián đoạn

Demo manual Todo/Calendar/Auth trên local PostgreSQL; mở docs/ACCEPTANCE.md và test outputs để giải thích flow chat mock. Dùng ảnh local, không pretend recording/mock là API real-time. Không có demo online fallback thì nói rõ; không cam kết free-tier/cold-start/uptime.

Ảnh desktop/mobile nằm trong screenshots/. Chỉ synthetic tasks. Mobile screenshot chứng minh layout, không phải kiểm thử thiết bị vật lý hay mọi browser.

## 4. Checklist release — chỉ tick sau khi chạy thật

### Trước khi publish

- [ ] Nhóm review diff, không .env/secrets/database files; git diff --check.
- [ ] Chốt commit thực tế và ghi SHA; chưa commit/push trong phiên implementation này.
- [ ] GitHub CI Linux pass, npm ci/build và locked backend install pass trên cùng candidate.
- [ ] Render/Neon account/gói/quota/cold start được xác minh bởi người có quyền.
- [ ] Neon production riêng, TLS, backup nếu cần; không TEST_DATABASE_URL trỏ production.
- [ ] Một Render Web Service, Python/Node pins, React dist + FastAPI, workers=1/instances=1.
- [ ] Origin đúng HTTPS origin, cookie Secure=true, random secret; Groq key chỉ server-side.
- [ ] Alembic head một lần, không chạy parallel rollout/migration.

### Sau khi publish

- [ ] Ghi URL HTTPS thực và candidate commit vào PROGRESS.
- [ ] /health liveness và register/login/task smoke xác minh DB, không chỉ 200 health.
- [ ] Cookie HttpOnly/Secure/Lax/Path, reload/me/logout trên browser HTTPS.
- [ ] Task/category ownership hai users; CRUD/filter/conflict/reopen/explicit override.
- [ ] Month/Week/Day/timezone/selection/edit và Todo refresh.
- [ ] --live-ai thật + clarification/ambiguity/delete cancel/confirm/conflict manual.
- [ ] AI failure rõ ràng, manual tasks vẫn chạy, không stacktrace/key.
- [ ] /calendar deep link hoạt động; /api/missing JSON404, /assets/missing không SPA.
- [ ] Restart giữ PostgreSQL tasks; pending context cũ ->409, không mutation/replay.
- [ ] Kiểm tra desktop/mobile/keyboard với exact deployed build.
- [ ] Rubric/deadline/báo cáo/presentation nếu giảng viên cung cấp; không tự thêm artifact khác.
- [ ] Final evidence/known issues/URL/model/checks cập nhật, không invent success.

## 5. Bàn giao source

- backend/app: auth/security/errors/models/schemas/CRUD/services/context/provider/static.
- backend/alembic: migrations, không create_all.
- backend/tests: PostgreSQL/API/ownership/conflict/chat/concurrency/SDK/static regression.
- frontend/src: auth/shared tasks/Todo/Calendar/chat/responsive UI + tests.
- scripts: build/start + synthetic HTTP smoke.
- render.yaml, .github/workflows/ci.yml, runtime pins, dependency locks.
- README/01_SETUP/ACCEPTANCE/PROGRESS/weeks: trạng thái và hướng dẫn thật.

Không phụ thuộc placeholder Docker. Những file rỗng/print Hello world đã bỏ, không dữ liệu chức năng. Không git reset, không ghi đè các thay đổi documentation ban đầu ngoài nội dung cập nhật trạng thái/setup được yêu cầu.
