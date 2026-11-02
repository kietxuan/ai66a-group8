# PLAN REVIEW

## 1. Phạm vi rà soát

Ngày rà soát: 2026-10-02. Baseline Git: 45cf886 (finalize week 1 planning baseline).

Đã đối chiếu toàn bộ Markdown, checklist Week 1–10, AGENTS, README, cây source, requirements, .env.example, ignore rules và cấu hình placeholder. Chỉ sửa tài liệu kế hoạch, không implement source/dependencies/config hoặc commit/push.

## 2. Conflict và thiếu sót đã xử lý

| Vấn đề trước review | Quyết định / sửa ở đâu | Gate chứng minh |
|---|---|---|
| Auth trước CRUD nhưng thiếu khôi phục phiên | Thêm /auth/me, startup/reload/401; API/UI/Week 2 | Auth end-to-end Week 2 |
| Cookie giữa Static Site và backend khác origin chưa có chiến lược | Một Render Web Service same-origin; ARCHITECTURE/setup/Week 5/10 | HTTPS cookie smoke Week 5 |
| Cookie auth chỉ nhắc CORS, thiếu request-write protection | Header + Origin + JSON checks, SameSite; API/ARCHITECTURE/Week 2 | CSRF/preflight tests Week 2 |
| Category có trong schema/form nhưng không API/seed | 3 defaults/user, GET only, backfill/user registration transaction; DATABASE/API/Week 3 | Category ownership/seed tests |
| Calendar range fetch chưa có contract | date_from/date_to inclusive, FullCalendar end-exclusive conversion; API/UI/Week 3/5 | Range/adapter tests |
| Optional time mâu thuẫn với chat luôn hỏi start_time | Cả ngày hợp lệ; chỉ hỏi khi timed intent thiếu cặp giờ; SPEC/API/Week 6 | All-day/timed clarification |
| PUT/status/defaults chưa rõ | Full editable replacement, status endpoint riêng, chat merge delta; API/Week 3/7 | PUT/no-op/status tests |
| Conflict không phân biệt completed, thiếu reopen | Pending-only; reopen check; SPEC/DATABASE/API/Week 3–5/7–8 | Conflict matrix |
| Check overlap rồi write có race | User row lock trong transaction chung, không exclusion constraint; ARCHITECTURE/DATABASE/Week 3 | Concurrent PostgreSQL tests |
| Chat “stateless” nhưng cần hỏi tiếp/confirm | RAM user-scoped context TTL 10 phút, single worker; ARCHITECTURE/API/Week 6–7 | Follow-up/expiry/restart tests |
| AI output có vẻ cho phép tự override/xác nhận | Cấm user_id/allow_conflict/confirmed từ AI, backend-owned pending + confirm endpoint | Bypass/confirm/replay tests |
| Task/conflict có thể đổi giữa preview và confirm | Version recheck, new-conflict preview, flow lock; API/Week 7–8 | TASK_CHANGED/race tests |
| Todo/Calendar “đồng bộ” nhưng thiếu cơ chế | Shared form + service/refetch, 401 clear cache; UI/Week 4–5/7 | Cross-view/two-user tests |
| Timezone/date-only dễ lệch ngày ở browser | Local business date/time, UTC timestamps, named Calendar timezone; DATABASE/UI/Week 5 | Multi-browser timezone checks |
| Test/deploy quá muộn | Tests/CI Week 2, rehearsal Week 5, online MVP Week 8; ROADMAP/all weeks | Gates không dồn Week 9–10 |
| Week 8 chứa quá nhiều optional | Core integration trước, optional một summary nhỏ hoặc bỏ; SPEC/Week 8 | MVP acceptance matrix |
| Module plan khác skeleton và trạng thái “in progress” chưa rõ | Theo app/api/core/crud/services hiện có; PROGRESS phân biệt planning/implementation | Checks thật từng tuần |
| Dependencies/config placeholders bị hiểu là setup đã xong | Pin/lock sau compatibility, bổ sung settings theo tuần; setup/Week 2/6 | Install/test/build thực tế |

Không giảm các yêu cầu MVP bắt buộc: auth/isolation, Todo/Calendar, 5 chat action, clarification, delete confirmation và conflict vẫn giữ. Các phần bị bỏ/hoãn là scope phụ hoặc cách làm trùng lặp.

## 3. Rủi ro bên ngoài còn cần kiểm tra

### Gemini model access — ưu tiên cao

Tài liệu Google tại thời điểm review ghi Gemini 2.5 Flash chưa có ngày shutdown được công bố, nhưng quyền dùng dòng 2.5 bị giới hạn cho người dùng đã sử dụng trước đó. Đây là rủi ro cho project/tài khoản mới, không phải bằng chứng tài khoản của nhóm chắc chắn bị chặn. [Google model deprecations](https://ai.google.dev/gemini-api/docs/deprecations).

Giữ baseline gemini-2.5-flash; kiểm tra bằng account/key thực tế Week 2, lại Week 6. Nếu không dùng được, dừng tích hợp phụ thuộc model và báo user chọn model/provider thay thế, không tự thay. Mock tests không đóng được gate access thật.

### Render/Neon, network và demo

Chưa đăng nhập/kiểm chứng tài khoản hoặc gói deploy của nhóm. Không hứa free tier, uptime, cold-start hoặc pre-deploy hooks. Week 2 kiểm tra feasibility, Week 5 rehearsal, trước demo Week 10 kiểm tra lại.

Một Python service build được cả frontend/backend là phương án thiết kế dựa trên [Render runtime](https://render.com/docs/native-runtimes) và [hướng dẫn FastAPI](https://render.com/docs/deploy-fastapi); khả năng account/build thực tế vẫn phải smoke.

### Rubric và nhóm

Chưa có bằng chứng về deadline/rubric cụ thể hoặc phân công thành viên. 10 tuần là thứ tự phase; nhóm tự gắn lịch thực tế. Khi nhận rubric, đối chiếu MVP/report/demo và ghi deviation, không khẳng định compliance trước.

## 4. Nguồn kỹ thuật và ý nghĩa

- [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/): credentials cần explicit origin/method/header.
- [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html): request JSON/custom header/Origin + SameSite defense; không chỉ CORS.
- [bcrypt](https://pypi.org/project/bcrypt/): input hơn 72 byte bị lỗi; plan reject, không truncate.
- [Gemini Structured Output](https://ai.google.dev/gemini-api/docs/structured-output): schema output không thay backend business validation.
- [FastAPI static files](https://fastapi.tiangolo.com/tutorial/static-files/): phục vụ React build; SPA fallback là bước implementation cần test riêng.
- [FullCalendar timeZone](https://fullcalendar.io/docs/timeZone): browser local timezone và named timezone khác nhau; dùng Asia/Ho_Chi_Minh, đọc callback đúng timezone/version.

Các nguồn không chứng minh app hiện tại chạy được; chúng chỉ hỗ trợ quyết định thiết kế. Model/gói/runtime cần xác minh lại lúc triển khai.

## 5. Handoff

Next action: Week 2 foundation/auth/test harness và kiểm tra account feasibility. Không kéo Task CRUD/chatbot execution vào Week 2.

PROGRESS theo dõi kết quả checks của review và implementation thực tế; các weekly checklist chưa implement vẫn chưa được đánh dấu hoàn thành.
