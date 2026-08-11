# WEEK 07 — CHATBOT TASK MANAGEMENT

## Objective
Cho phép các CRUD/status action chính của task chạy qua chatbot.

## Prerequisites
- Chatbot foundation hoạt động.
- Task API/business logic ổn định.

## Tasks
- [ ] Create task bằng chat.
- [ ] Query task/lịch làm việc.
- [ ] Update task.
- [ ] Delete task.
- [ ] Complete task.
- [ ] Missing information clarification.
- [ ] Ambiguous task clarification.
- [ ] Confirmation cho delete/action cần thiết.

## Example Behaviors
- “Ngày mai tôi có công việc gì?” -> query backend.
- “Dời task Gym...” -> resolve task rồi update.
- Nếu có nhiều task Gym -> hỏi user chọn task.
- Nếu thiếu giờ/thời lượng -> hỏi thêm.
- Delete -> confirmation phù hợp.

## Tests / Validation
- Một task match.
- Nhiều task match.
- Không có task match.
- Thiếu field.
- Create/update/delete/complete/query.

## Definition of Done
- Chatbot có thể quản lý core task action.
- Không tự chọn khi ambiguous.
- Không tự đoán field bắt buộc còn thiếu.
- `PROGRESS.md` cập nhật.
