# WEEK 09 - REGRESSION TESTING & FIXES

## Objective

Kiểm thử toàn hệ thống và sửa regression, khóa scope trước release. Không phải tuần đầu tiên viết test.

## Prerequisites

Week 8 MVP integration gate pass; test harness/CI đã có từ Week 2 và tests mỗi tuần. Nếu chưa pass, ưu tiên lỗi core, không mở feature mới.

## Tasks

- [ ] Lập ma trận requirement -> test/check -> kết quả theo PROJECT_SPEC/API_SPEC.
- [ ] Backend unit/API tests dùng PostgreSQL riêng; migrations rỗng + nâng cấp Users -> Tasks -> head.
- [ ] Auth validation/unique email race/JWT expired/tampered/cookie/CSRF/Origin/content-type.
- [ ] User isolation cho task/category/chat/context/confirmation; ID người khác không lộ title/data.
- [ ] CRUD/filter/full PUT/status/time rules/conflict concurrency/override/reopen regression.
- [ ] Chat tests mocked: 5 action/unsupported/schema errors/missing/choices/no match/prompt injection.
- [ ] Chat lifecycle: TTL/restart/2 tab thay flow/confirm replay/race/TASK_CHANGED/new conflict/401.
- [ ] Frontend auth/form/filter/debounce/conflict/modal/chat refresh/Calendar adapter tests.
- [ ] Manual integration desktop/mobile/keyboard, loading/empty/error/network failure, hai user.
- [ ] Online HTTPS smoke cùng bản release candidate; API 404 không thành HTML; startup/migration không mất task.
- [ ] Ghi các lỗi và ưu tiên; sửa lỗi data loss/security/core trước lỗi cosmetic.
- [ ] CI pass, frontend build pass; README/setup commands khớp implementation thật.
- [ ] Dependency/version và secrets check; không upgrade hàng loạt ngay trước release.

## Test discipline

- Không dùng development/production database để chạy fixture reset.
- Không gọi Gemini thật trong CI; một smoke thật theo checklist riêng với key server-side.
- Không đặt mục tiêu coverage phần trăm tùy ý thay cho acceptance; ưu tiên critical branch và negative path.
- Không cần load test production-scale, E2E framework mới hoặc dashboard analytics để đạt DoD.
- Không đếm print Hello world, mock response không assert hoặc health 200 là bằng chứng toàn app hoạt động.

## Definition of Done

Critical regression/security/data/confirmation tests pass; không lỗi nghiêm trọng làm mất dữ liệu hoặc vượt ownership. Online manual checks có kết quả được ghi. Known issues nhỏ có phạm vi/ảnh hưởng rõ.

PROGRESS ghi exact test/build/migration commands và kết quả, issue fixes/deviation. Release candidate được xác định bằng commit sau khi nhóm thực sự commit; không invent SHA.

## Do Not Implement Yet

Không feature mới, không đổi framework/model/database, không thêm optional đang dang dở. Không xóa test để “làm xanh CI”.
