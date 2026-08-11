# WEEK 10 — DEPLOYMENT

## Objective
Đưa hệ thống lên môi trường online và chuẩn bị trạng thái demo cuối.

## Prerequisites
- Core tests pass.
- Không còn blocker nghiêm trọng.

## Tasks
- [ ] Deploy React frontend lên Render Static Site.
- [ ] Deploy FastAPI backend chạy bằng Uvicorn lên Render Web Service.
- [ ] Deploy/configure PostgreSQL trên Neon.
- [ ] Cấu hình environment variables.
- [ ] Kiểm tra frontend gọi đúng backend production.
- [ ] Kiểm tra database production.
- [ ] Kiểm tra authentication.
- [ ] Kiểm tra chatbot/LLM key trên môi trường deploy.
- [ ] Smoke test core flows.

## Core Demo Flow
Tối thiểu verify:
1. Register/Login.
2. Create task.
3. Edit/Complete/Delete.
4. Search/filter.
5. Calendar display.
6. Chatbot create/query/update/delete/complete.
7. Missing/ambiguous clarification.
8. Conflict detection.

## Definition of Done
- App truy cập được online.
- MVP demo chạy được.
- `PROGRESS.md` cập nhật trạng thái final.

## Deployment Note
Render free web service có thể sleep/spin down khi không hoạt động. Trước buổi demo nên mở app sớm để backend warm up.

Không dùng Render Free Postgres cho project 10 tuần vì free database của Render có thời hạn ngắn; Neon được chọn để PostgreSQL free phù hợp hơn với project kéo dài 10 tuần.
