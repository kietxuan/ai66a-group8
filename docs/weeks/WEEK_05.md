# WEEK 05 — CALENDAR

## Objective
Hiển thị cùng dữ liệu task dưới dạng Calendar cho authenticated user.

## Prerequisites
- Week 2 Authentication & Backend Foundation complete.
- Week 3 Task CRUD API ổn định.
- Week 4 Todo List hoạt động.

## Tasks
- [ ] Tích hợp FullCalendar.
- [ ] Month View.
- [ ] Week View.
- [ ] Day View.
- [ ] Convert task thành calendar event.
- [ ] Gọi protected task API với credentials.
- [ ] Khi create/update/delete task, calendar phản ánh thay đổi.
- [ ] Todo List và Calendar dùng cùng backend data.

## Tests / Validation
- Task đúng ngày/giờ.
- Edit thời gian -> calendar cập nhật.
- Delete -> event biến mất.
- Complete -> trạng thái hiển thị nhất quán theo UI design.
- User chỉ xem được calendar event từ task của mình.

## Definition of Done
- Calendar hiển thị task đúng.
- Không có nguồn dữ liệu calendar tách riêng.
- Todo List và Calendar đồng bộ.
- Authentication/ownership vẫn được giữ khi truy cập task.
- `PROGRESS.md` cập nhật.

## Do Not Implement Yet
- Không implement full chatbot.
- Không ưu tiên Dashboard.
