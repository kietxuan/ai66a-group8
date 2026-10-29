# WEEK 09 — REGRESSION TESTING & FIXES


## Checkpoint implementation — 2026-10-21

Full regression120 backend +24 frontend tests, production build Vite6.4.4 và audits sau vá certifi pass; hai deprecation warnings còn. Real-AI reports tách khỏi mock CI. Remote Linux CI/HTTPS vẫn OPEN. Theo user cho phép tiếp tục các phase local dù gate account/online chưa đóng. [RELEASE_HANDOFF](../RELEASE_HANDOFF.md), [ACCEPTANCE](../ACCEPTANCE.md), [PROGRESS](../PROGRESS.md) ghi bằng chứng/known issues; checklist local không tự xác nhận toàn bộ weekly DoD online.

## Objective

Đợt cải thiện sau audit theo yêu cầu user 21/10 bổ sung mobile/ngữ cảnh/ngôn ngữ và hardening trong phase này. Kết quả mới tại [IMPROVEMENT_STATUS](../IMPROVEMENT_STATUS_2026-10-21.md) / [PROGRESS](../PROGRESS.md); không dùng checkpoint 120/24 cũ để nghiệm thu code mới. Các gate online/device thật vẫn chưa được đóng.

Kiểm thử toàn hệ thống và sửa regression, khóa scope trước release. Không phải tuần đầu tiên viết test.

## Prerequisites

Week 8 MVP integration gate pass; test harness/CI đã có từ Week 2 và tests mỗi tuần. Nếu chưa pass, ưu tiên lỗi core, không mở feature mới.

## Tasks

- [x] Lập ma trận requirement -> test/check -> kết quả theo PROJECT_SPEC/API_SPEC.
- [x] Backend unit/API tests dùng PostgreSQL riêng; migrations rỗng + nâng cấp Users -> Tasks -> head.
- [x] Auth validation/unique email race/JWT expired/tampered/cookie/CSRF/Origin/content-type.
- [x] User isolation cho task/category/chat/context/confirmation; ID người khác không lộ title/data.
- [x] CRUD/filter/full PUT/status/time rules/conflict concurrency/override/reopen regression.
- [x] Chat tests mocked: 5 action/unsupported/schema errors/missing/choices/no match/prompt injection.
- [x] Chat lifecycle: TTL/restart/2 tab thay flow/confirm replay/race/TASK_CHANGED/new conflict/401.
- [x] Frontend auth/form/filter/debounce/conflict/modal/chat refresh/Calendar adapter tests.
- [ ] Manual integration desktop/mobile/keyboard, loading/empty/error/network failure, hai user.
- [ ] Online HTTPS smoke cùng bản release candidate; API 404 không thành HTML; startup/migration không mất task.
- [x] Ghi các lỗi và ưu tiên; sửa lỗi data loss/security/core trước lỗi cosmetic.
- [ ] CI pass, frontend build pass; README/setup commands khớp implementation thật.
- [x] Dependency/version và secrets check; không upgrade hàng loạt ngay trước release.

## Test discipline

- Không dùng development/production database để chạy fixture reset.
- Không gọi Groq thật trong CI; một smoke thật theo checklist riêng với key server-side.
- Không đặt mục tiêu coverage phần trăm tùy ý thay cho acceptance; ưu tiên critical branch và negative path.
- Không cần load test production-scale, E2E framework mới hoặc dashboard analytics để đạt DoD.
- Không đếm print Hello world, mock response không assert hoặc health 200 là bằng chứng toàn app hoạt động.

## Definition of Done

Critical regression/security/data/confirmation tests pass; không lỗi nghiêm trọng làm mất dữ liệu hoặc vượt ownership. Online manual checks có kết quả được ghi. Known issues nhỏ có phạm vi/ảnh hưởng rõ.

PROGRESS ghi exact test/build/migration commands và kết quả, issue fixes/deviation. Release candidate được xác định bằng commit sau khi nhóm thực sự commit; không invent SHA.

## Do Not Implement Yet

Không feature mới, không đổi framework/model/database, không thêm optional đang dang dở. Không xóa test để “làm xanh CI”.
