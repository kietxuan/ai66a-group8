# PROJECT ROADMAP

## 1. Lịch và nguyên tắc

10 tuần = 10 phase; số tuần là mốc công việc, không tự gán ngày bắt đầu/kết thúc khi chưa có lịch môn học. Nếu rubric thay đổi, ghi rõ trong PROGRESS trước khi thay scope.

Authentication luôn trước Task CRUD. Test và kiểm tra security đi cùng từng tuần, không đợi Week 9. Deployment rehearsal bắt đầu Week 5; Week 10 dành release/demo, không phải lần đầu thử deploy.

| Tuần | Phạm vi bắt buộc | Gate / deliverable |
|---|---|---|
| 1 | Planning, chốt contract và MVP | Spec/API/schema/UI/roadmap nhất quán; không yêu cầu code chạy |
| 2 | Backend foundation + Authentication + React shell | Register/Login/Logout/me chạy; isolation auth, CSRF, migrations/test harness |
| 3 | Categories read-only + Task API + conflict core | CRUD/filter/range/status, ownership và conflict transaction qua API |
| 4 | Todo List | Shared form, filter, delete/overlap/reopen flow qua UI |
| 5 | Calendar + deploy rehearsal | Todo/Calendar đồng bộ, all-day/time đúng; auth/tasks chạy online |
| 6 | Chat foundation / dry-run | Structured Output, context follow-up, provider errors; không ghi task |
| 7 | Chat task execution | 5 action qua shared service; ambiguity/delete/conflict confirmation an toàn |
| 8 | MVP integration & hardening | MVP online qua acceptance matrix; optional chỉ sau gate |
| 9 | Regression testing & fixes | Security/data/time/chat/release regression, không mở feature mới |
| 10 | Release, docs & demo | Migration + smoke HTTPS; demo/fallback bàn giao được |

Chi tiết thao tác và DoD nằm trong [Week 1](weeks/WEEK_01.md), [Week 2](weeks/WEEK_02.md), [Week 3](weeks/WEEK_03.md), [Week 4](weeks/WEEK_04.md), [Week 5](weeks/WEEK_05.md), [Week 6](weeks/WEEK_06.md), [Week 7](weeks/WEEK_07.md), [Week 8](weeks/WEEK_08.md), [Week 9](weeks/WEEK_09.md), [Week 10](weeks/WEEK_10.md).

## 2. Dependencies và checkpoints

```text
Week 1 contract
  -> Week 2 auth + test foundation
  -> Week 3 task service + schema + conflict
  -> Week 4 Todo form/data
  -> Week 5 Calendar + online rehearsal
  -> Week 6 AI parse/context
  -> Week 7 chat uses existing task service
  -> Week 8 end-to-end MVP online
  -> Week 9 regression/fix
  -> Week 10 release/demo
```

- Week 2 kiểm tra sớm quyền Groq model, tài khoản Render/Neon và môi trường Python/Node/PostgreSQL. Kiểm tra quyền truy cập không đồng nghĩa kéo code chatbot vào Week 2.
- Week 3 prerequisite là current_user, user isolation và migrations/test database Week 2 đã chạy.
- Week 5 online rehearsal dùng kiến trúc same-origin đã chốt, không tách thêm frontend service.
- Week 6 prerequisite là model khả dụng; nếu không, báo user để quyết định model/provider, không tự đổi.
- Week 7 chỉ bật execution sau parser/context qua test; dùng lại task services và conflict policy Week 3.
- Week 8 gate đủ MVP mới cân nhắc một summary nhỏ (today/pending/completed count), không mở cả Dashboard + Statistics.
- Nếu core chưa đạt, bỏ optional trước; không cắt ownership, xác nhận xóa hay tests thiết yếu để giữ optional.

## 3. Quy trình mỗi tuần

User amendment 22/10: thêm hẹp gợi ý giờ trống read-only trong phase Week 9/10 theo [PLAN_REVIEW](PLAN_REVIEW.md) và [AVAILABILITY](AVAILABILITY.md). Đây không phải quyền mở thêm optional, không thay các gate online chưa đạt hay đánh dấu tuần hoàn thành.

Trước khi implement: đọc source of truth và tuần hiện tại; xem Git/code thực tế; chạy các check có sẵn; kiểm tra prerequisite. Không đánh dấu hoàn thành tuần chỉ vì đã tạo file.

Kết thúc tuần: ghi files/modules thay đổi, commands/checks và kết quả, known issues, deviation, next action trong PROGRESS. Nếu blocked, chỉ ghi gate đang thiếu; không đánh dấu tuần hoàn thành.

Test tối thiểu mỗi tuần gồm happy path và negative path của phạm vi mới. Backend dùng PostgreSQL test riêng; Groq mocked trong CI. Manual smoke bổ sung, không thay automated tests.

## 4. Các nguồn chuẩn

- PROJECT_SPEC: scope/product rules.
- DATABASE: schema/timezone/conflict transaction.
- API_SPEC: request/response/status/confirmation contract.
- ARCHITECTURE: module boundaries/auth/deploy/chat context.
- UI_DIRECTION: màn hình/shared form/calendar time mapping.
- PROGRESS: trạng thái thật, không phải danh sách điều định làm.
- [PLAN_REVIEW](PLAN_REVIEW.md): conflict đã xử lý và rủi ro bên ngoài chưa kiểm chứng.
