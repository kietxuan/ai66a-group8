# WEEK 08 — MVP INTEGRATION & HARDENING


## Checkpoint implementation — 2026-10-21

Real Chat tạo Học React và Todo/Calendar cùng hiện đúng ngày/giờ; backend120/frontend24/build/audit pass. Online E2E/HTTPS còn OPEN; optional không làm trước gate. Theo user cho phép tiếp tục các phase local dù gate account/online chưa đóng. [RELEASE_HANDOFF](../RELEASE_HANDOFF.md), [ACCEPTANCE](../ACCEPTANCE.md), [PROGRESS](../PROGRESS.md) ghi bằng chứng/known issues; checklist local không tự xác nhận toàn bộ weekly DoD online.

## Objective

Hoàn thiện MVP online qua acceptance matrix; xử lý edge cases giữa auth/CRUD/Calendar/chat/conflict. Conflict core đã có từ Week 3, không viết lại hệ thống ở tuần này.

## Prerequisites

Week 7 có đủ 5 action/context/confirmation, Week 5 deploy same-origin, tests từng module đang pass.

## Tasks bắt buộc

- [ ] Chạy end-to-end: Login -> Todo create/edit -> Calendar -> Chat mutation -> UI refresh -> Logout/re-login.
- [x] Kiểm tra pending-only overlap trên REST/Todo/Calendar/chat theo cùng policy.
- [x] Hardening adjacent/containment/identical/all-day/completed/reopen/update self exclusion và request đồng thời.
- [x] Clarification nhiều bước, title trùng, không match, expired/restart context, confirm replay/race, task/conflict đổi sau preview.
- [x] 401 giữa chat flow: không thực thi pending, clear frontend state; chuyển user không lẫn cache/context.
- [x] Kiểm tra browser timezone/ngày cuối tháng/năm, FullCalendar range exclusive và relative-date prompt.
- [x] Chống stale responses, double submit, mutation network failure; không tự retry hoặc báo success giả.
- [x] Kiểm tra provider unavailable/rate-limit: UI thủ công vẫn chạy, lỗi không lộ secrets.
- [x] Rà validation/error envelope/static fallback/log secrets/config production.
- [ ] Deploy full MVP một service/worker + Neon, migration nâng cấp không mất dữ liệu demo.
- [x] Lưu acceptance matrix pass/fail và evidence vào PROGRESS; sửa lỗi core trước optional.

## Acceptance matrix tối thiểu

| Nhóm | Kiểm tra bắt buộc |
|---|---|
| Auth/security | Register/Login/me/reload/logout/expiry; Origin/header/JSON; hai user |
| Data | CRUD/full PUT/status/category ownership; validation/filter/date range |
| UI | Todo/Calendar/chat đồng bộ; all-day/timed/completed; loading/errors/mobile |
| Conflict | Create/time edit/reopen, cancel/override, concurrency, cùng policy |
| Chat | 5 action, thiếu field/nhiều match, confirm/cancel/TTL/replay/task changed |
| Online | HTTPS cookie, deep links, JSON API errors, migration, provider smoke |

Automated tests dùng provider mock/PostgreSQL riêng; online smoke thêm provider thật. Mock pass không thay acceptance online.

## Optional gate

Chỉ sau mọi dòng bắt buộc pass và không còn lỗi nghiêm trọng, cân nhắc một summary nhỏ dùng data/service hiện có: today/pending/completed count. Có thể bỏ hoàn toàn.

Không triển khai cả Dashboard + Statistics, notification/recommendation/phân tích thói quen. Không thêm endpoint/schema/dependency lớn chỉ để làm optional. Optional thiếu không chặn MVP release.

## Definition of Done

Full MVP online, acceptance matrix bắt buộc pass với evidence; issues core được giải quyết hoặc gate còn thiếu ghi rõ. Optional không ảnh hưởng baseline/tests.

PROGRESS ghi kết quả, files/modules, URL/checks, known issues/deviation; Week 9 tập trung regression.

## Do Not Implement Yet

Không redesign framework/database/model, không thêm feature lớn. Không đánh dấu “conflict completed” chỉ vì đã có hàm overlap.
