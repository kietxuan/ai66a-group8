# WEEK 06 — AI CHATBOT FOUNDATION

## Objective
Tạo chatbot có thể hiểu user request và trả structured action cho backend mà chưa cần hoàn thiện mọi task action.

## Prerequisites
- Authentication và task backend ổn định.
- Google Gemini API access đã sẵn sàng.
- Model mặc định: Gemini 2.5 Flash.

## Tasks
- [ ] Chat UI.
- [ ] POST /api/chat.
- [ ] Kết nối Google Gemini API bằng model `gemini-2.5-flash`.
- [ ] Xác định action/intent.
- [ ] Extract fields.
- [ ] Structured Output hoặc Function/Tool Calling.
- [ ] Backend validate structured output.
- [ ] Thiết kế response khi thiếu thông tin.
- [ ] Chatbot MVP hoạt động stateless, không lưu Conversations/Messages vào database.

## Core Rule
AI không trực tiếp thao tác database.

## Tests / Validation
- Câu create task mẫu được parse đúng.
- Missing time/duration được nhận ra.
- Invalid structured output không được backend thực hiện mù quáng.

## Definition of Done
- Chat request -> AI -> structured action -> backend validation hoạt động.
- Chưa cần mọi action hoàn chỉnh.
- `PROGRESS.md` cập nhật.
