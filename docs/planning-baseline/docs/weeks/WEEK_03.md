# WEEK 03 — TASK API, CATEGORIES & CONFLICT CORE

## Objective

Authenticated task API đầy đủ trên PostgreSQL, dùng làm nền chung cho Todo/Calendar/chatbot.

## Prerequisites

Week 2 auth/me/current_user, migration Users, test database và checks pass. Đọc DATABASE/API_SPEC và kiểm tra prerequisite thật trước implement.

## Tasks theo thứ tự

### 1. Schema và category

- [ ] Migration Categories/Tasks với FK, length/enum/time CHECK, timestamps và indexes tối thiểu.
- [ ] Backfill ba category mặc định cho user đã tạo Week 2, idempotent.
- [ ] Từ tuần này register tạo user + defaults trong cùng transaction.
- [ ] GET /api/categories scoped theo user; không CRUD category API/UI.
- [ ] Tạo data fixtures/demo bằng tài khoản test/development riêng, không seed tài khoản/secret vào production tự động.

### 2. Task service và REST

- [ ] Schema create/full PUT/status; reject extras/user_id/id/timestamps; defaults và HH:MM đúng API.
- [ ] Backend gán user_id; kiểm tra category cùng owner.
- [ ] POST/list/get/PUT/delete/PATCH status; hard delete; 204 bodyless.
- [ ] List AND filters search/status/priority/category/ngày/khoảng ngày inclusive; sort ổn định.
- [ ] Full PUT không nhận status; status endpoint completed/pending/no-op.
- [ ] Một task service được tái sử dụng, không nhét mọi nghiệp vụ vào router.

### 3. Conflict transaction

- [ ] Pending-only, cùng user/day, có đủ giờ; completed/all-day không chặn.
- [ ] Core overlap strict inequalities; update loại chính task.
- [ ] Check create, đổi date/time pending, completed -> pending; không check title-only edit.
- [ ] 409 TASK_CONFLICT kèm đúng conflicting_tasks; rollback chưa ghi.
- [ ] allow_conflict=true explicit request override, không bỏ validation/ownership.
- [ ] Khóa hàng User trong transaction trước conflict query + write; các đường ghi lịch cùng policy.
- [ ] Không dùng exclusion constraint vì cho phép override.

## Acceptance tests

- CRUD happy path và invalid enum/title/date/time; past date được phép.
- Cả hai time=null hợp lệ; thiếu một time, end<=start, giây khác 0, 24:00 bị từ chối.
- User A không list/get/update/delete/status task B; không create/update bằng category B.
- GET categories chỉ defaults của current user; user cũ được backfill, user mới có defaults; không duplicate seed.
- List search case-insensitive, nhiều filter AND, date range inclusive, from>to và date+range -> 422.
- PUT bỏ optional fields reset đúng default; status không bị thay bởi PUT.
- Conflict partial overlap/containment/equal ranges -> 409; adjacent/no-time/completed/khác user/ngày không conflict.
- Update time không tự conflict; reopen conflict đúng; complete giảm task chặn lịch.
- Override ghi được nhưng sai schema/category vẫn lỗi; request 409 không tạo record.
- Hai request lịch trùng chạy đồng thời với allow_conflict=false: tối đa một request thành công, request còn lại 409.
- Migration upgrade từ Week 2 có dữ liệu và database rỗng; tests thực trên PostgreSQL.

## Definition of Done

Task/category contract và conflict service qua automated tests; API manual smoke bằng ít nhất hai user. Backend tests pass; frontend auth/build không regress.

PROGRESS ghi modules, migration IDs, commands/results, known issues/deviation. Chưa đánh dấu Todo UI hoàn thành.

## Do Not Implement Yet

Không Calendar/chatbot; không CRUD category/pagination/notification. Không để Week 8 mới viết conflict core.
