# WEEK 04 — TODO LIST

## Objective
Authenticated user có thể quản lý task qua giao diện Todo List.

## Prerequisites
- Week 2 Authentication & Backend Foundation complete.
- Week 3 Task CRUD API hoạt động.

## Tasks
- [ ] Hoàn thiện React frontend cho Todo List.
- [ ] Hiển thị danh sách task.
- [ ] Create task form.
- [ ] Edit task.
- [ ] Delete task.
- [ ] Mark complete.
- [ ] Hiển thị Today/Tomorrow/Upcoming/Completed/Pending nếu phù hợp UI.
- [ ] Search & Filter theo scope: task_date/status/priority/category_id.

## Frontend
Task fields theo spec:
- title
- description
- task_date
- start_time
- end_time
- priority
- category_id
- status

Frontend phải gửi credentials khi gọi các protected API.

## Backend
- Hoàn thiện filter/query cần cho frontend.
- Không thay đổi API contract tùy tiện.
- Giữ ownership isolation theo authenticated user.

## Tests / Validation
- CRUD từ UI.
- Refresh page vẫn lấy đúng dữ liệu.
- Search/filter trả kết quả đúng.
- User chỉ nhìn thấy task của mình.

## Definition of Done
- Core Todo List usable.
- Create/Edit/Delete/Complete hoạt động end-to-end.
- Search/filter cơ bản hoạt động.
- `PROGRESS.md` cập nhật.

## Do Not Implement Yet
- Không làm Calendar.
- Không làm chatbot task actions.
- Dashboard vẫn optional/later.
