# WEEK 04 - TODO LIST

## Objective

Quản lý task đầy đủ qua UI, làm shared form/data layer để Calendar/chatbot tái sử dụng.

## Prerequisites

Week 3 Task/category API, ownership, validation, conflict/reopen tests pass. React auth shell/API client Week 2 hoạt động.

## Tasks theo thứ tự

- [ ] Shared task form create/edit với date, all-day/timed, priority/category; dữ liệu category từ API.
- [ ] List pending/completed và empty/loading/error states.
- [ ] Create/full PUT/delete/complete/reopen qua API; dữ liệu form không mất khi validation/network lỗi.
- [ ] Delete confirmation; disable submit khi pending, không auto-retry mutation.
- [ ] Conflict modal create/edit/reopen: đổi giờ/hủy/tiếp tục; chỉ explicit continue mới allow_conflict=true.
- [ ] Search debounce, filter ngày/khoảng/status/priority/category, reset và presets theo UI_DIRECTION.
- [ ] Tránh response cũ ghi đè khi đổi filter; một nguồn task refresh dùng chung.
- [ ] Mutation thành công re-fetch dữ liệu; 401/logout clear task/chat cache, không lẫn user.
- [ ] Responsive desktop/mobile, labels/focus/keyboard, lỗi không chỉ biểu diễn bằng màu.

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
