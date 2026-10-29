# WEEK 05 — CALENDAR & DEPLOY REHEARSAL


## Checkpoint implementation — 2026-10-21

Calendar local đã verify thêm task do Groq thật tạo (22/10, 08–10). Config same-origin có sẵn; Render/Neon rehearsal HTTPS còn OPEN, không gọi local pass là deploy. Theo user cho phép tiếp tục các phase local dù gate account/online chưa đóng. [RELEASE_HANDOFF](../RELEASE_HANDOFF.md), [ACCEPTANCE](../ACCEPTANCE.md), [PROGRESS](../PROGRESS.md) ghi bằng chứng/known issues; checklist local không tự xác nhận toàn bộ weekly DoD online.

## Objective

Calendar quản lý task bằng shared form/data và deploy thử auth/tasks trên cùng origin trước giai đoạn AI.

## Prerequisites

Week 4 Todo/conflict/reopen/shared form pass. Kiến trúc Render same-origin và tài khoản/Neon được kiểm tra từ Week 2.

## Tasks theo thứ tự

### 1. Calendar

- [x] FullCalendar Month/Week/Day, locale vi, Monday start, responsive layout.
- [x] Task -> event adapter: timed/all-day/completed; stable event ID và đúng ngày/giờ.
- [x] Dùng named timezone Asia/Ho_Chi_Minh như UI_DIRECTION; pin các package FullCalendar cùng phiên bản, xác minh timezone API.
- [x] Fetch theo range hiển thị; chuyển FullCalendar end-exclusive về date_to inclusive.
- [x] Chọn ngày hoặc khoảng giờ mở shared create form; reject qua đêm/multi-day.
- [x] Event click mở shared detail/edit/delete/complete/reopen; cùng conflict modal Week 4.
- [x] Mutation từ Todo/Calendar đồng bộ cả hai view, không reload trang.
- [x] Không drag/drop/resize; chỉ thêm timezone adapter tương thích nếu khả năng có sẵn chưa đủ.

### 2. Deploy rehearsal không AI

- [ ] Cấu hình một Render Python Web Service build frontend/dist và backend dependencies; xác minh/pin Node/Python.
- [x] FastAPI serve static/SPA; API đăng ký trước fallback, sai /api không trả HTML.
- [ ] Neon database riêng; secrets qua platform, TLS, cookie Secure=true, Origin allowlist production.
- [ ] Chạy Alembic trước rollout bằng cơ chế tài khoản hỗ trợ; không schema create_all.
- [ ] Uvicorn host 0.0.0.0, PORT provider, một worker.
- [ ] Smoke online auth/me/reload/logout/CRUD/filter/Calendar hai user; lưu URL và kết quả, không secrets.
- [ ] Ghi build/start/migration settings vào README/01_SETUP khi đã chạy thật.

## Acceptance tests

- Timed task đúng slot; all-day đúng ngày; completed style đúng và không chặn lịch.
- Kiểm tra adapter ngày cuối tháng/năm, nhiều browser timezone, hiển thị không lệch ngày/giờ.
- Range Month/Week/Day không bỏ ngày cuối hoặc kéo thêm sai ngày từ end-exclusive.
- Create từ calendar chọn ngày/giờ đúng form; update/delete/complete/reopen phản ánh Todo ngay.
- Conflict ở Calendar giống Todo; cancel không ghi.
- Frontend adapter/component tests + backend regression + build pass.
- Online HTTPS: cookie auth hoạt động sau reload; deep-link SPA hoạt động; /api route sai JSON 404; user isolation đúng.

## Definition of Done

Calendar có tương tác hai chiều với Task API, không chỉ render events; Todo/Calendar đồng bộ. Bản auth/tasks/calendar deploy rehearsal truy cập được và smoke pass.

Nếu deploy account/build/migration chưa chạy được, ghi gate chưa đạt; không để tới Week 10 mới thông báo. PROGRESS ghi URL, commands/checks và blockers thực tế.

## Do Not Implement Yet

Không chatbot execution, Dashboard, drag/drop/resize, nhiều timezone. Rehearsal chưa phải full MVP release.
