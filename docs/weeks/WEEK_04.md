# WEEK 04 — TODO LIST


## Checkpoint implementation — 2026-10-05

[x] dưới đây chỉ xác nhận item local/mock đã có evidence, không tự xác nhận DoD toàn tuần hoặc gate cloud. Todo local/RTL/browser pass, including shared form, conflict/delete cancel, status/refetch/401/stale responses. Desktop/mobile/Escape được kiểm tra; không coi local như online. Xem [ACCEPTANCE](../ACCEPTANCE.md), [PROGRESS](../PROGRESS.md) và [DEMO](../DEMO.md).

## Objective

Quản lý task đầy đủ qua UI, làm shared form/data layer để Calendar/chatbot tái sử dụng.

## Prerequisites

Week 3 Task/category API, ownership, validation, conflict/reopen tests pass. React auth shell/API client Week 2 hoạt động.

## Tasks theo thứ tự

- [x] Shared task form create/edit với date, all-day/timed, priority/category; dữ liệu category từ API.
- [x] List pending/completed và empty/loading/error states.
- [x] Create/full PUT/delete/complete/reopen qua API; dữ liệu form không mất khi validation/network lỗi.
- [x] Delete confirmation; disable submit khi pending, không auto-retry mutation.
- [x] Conflict modal create/edit/reopen: đổi giờ/hủy/tiếp tục; chỉ explicit continue mới allow_conflict=true.
- [x] Search debounce, filter ngày/khoảng/status/priority/category, reset và presets theo UI_DIRECTION.
- [x] Tránh response cũ ghi đè khi đổi filter; một nguồn task refresh dùng chung.
- [x] Mutation thành công re-fetch dữ liệu; 401/logout clear task/chat cache, không lẫn user.
- [x] Responsive desktop/mobile, labels/focus/keyboard, lỗi không chỉ biểu diễn bằng màu.

## Acceptance tests

- Register/Login -> create all-day và timed task -> edit -> complete/reopen -> delete confirmed.
- Cancel delete hoặc cancel conflict không đổi DB; 409 giữ form; continue tạo/sửa/mở lại đúng.
- Invalid fields hiện message, end<=start không gửi thành công.
- Filter/presets đúng định nghĩa; search/filter nhanh không bị response cũ thay kết quả.
- Category labels từ API, null hiển thị Không phân loại; không hardcode category ID.
- Token hết hạn/network lỗi không báo success giả; user mới không thấy task cache cũ.
- Frontend tests shared form/list/filter/conflict/delete/401; backend regression + frontend build pass.
- Manual smoke ít nhất desktop/mobile; kiểm tra dữ liệu thực qua API.

## Definition of Done

User thao tác task hoàn chỉnh qua Todo, kể cả negative/conflict/reopen flows. Shared form/data layer sẵn sàng cho Calendar, không phải hai bộ CRUD riêng.

PROGRESS ghi files/tests/results, issues/deviation, next action Week 5.

## Do Not Implement Yet

Không FullCalendar/chatbot/Dashboard. Không rewrite auth hoặc thêm category CRUD vì đã có dropdown.
