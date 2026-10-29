# WEEK 06 — AI CHATBOT FOUNDATION


## Checkpoint implementation — 2026-10-21

Groq strict JSON Schema qua HTTPX đã chạy thật: all-day, relative-date-duration, missing date/follow-up, missing end; xem từng run và cả failure/rerun trong RELEASE_HANDOFF. Key backend local đã cấu hình; dry-run không ghi task. Rehearsal/online còn OPEN. Theo user cho phép tiếp tục các phase local dù gate account/online chưa đóng. [RELEASE_HANDOFF](../RELEASE_HANDOFF.md), [ACCEPTANCE](../ACCEPTANCE.md), [PROGRESS](../PROGRESS.md) ghi bằng chứng/known issues; checklist local không tự xác nhận toàn bộ weekly DoD online.

## Objective

Tích hợp Groq Structured Output, parse/clarification/context và Chat UI ở chế độ dry-run. Chưa ghi task qua chatbot.

## Prerequisites

Task service/API và Todo/Calendar pass; local build/config Week 5 đã có; rehearsal online còn OPEN, tiếp tục phase local theo user ủy quyền. Quyền openai/gpt-oss-20b được kiểm tra lại bằng tài khoản thực tế; không suy ra khả dụng chỉ từ model name.

Nếu model không dùng được, ghi kết quả và báo user quyết định thay model/provider trước tích hợp. Không tự đổi stack. Mock giúp phát triển parser/tests nhưng không chứng minh provider thật hoạt động.

## Tasks theo thứ tự

- [x] Dùng HTTPX đã có cho Groq Chat Completions + strict JSON Schema; bỏ Google SDK; key server-side, GROQ_MODEL/AI_TIMEOUT_SECONDS.
- [x] Xây structured action schema đúng API_SPEC; chọn Structured Output, không thêm Function Calling/streaming song song.
- [x] Prompt có ngày hiện tại/timezone, category names và policy; chỉ dữ liệu current user tối thiểu, không secrets.
- [x] Parse action/fields/filters; validate enum/date/time/unknown fields ngoài output.
- [x] Phân biệt task cả ngày với user muốn lịch có giờ nhưng thiếu start/end/duration.
- [x] Convert relative date/duration khi đủ thông tin; hỏi lại nếu mơ hồ, không suy diễn field quan trọng.
- [x] POST /api/chat protected + request validation, CSRF, response envelope.
- [x] Context RAM keyed user/random ID, TTL 10 phút, một flow/user; draft + missing fields + choices, không Conversations/Messages.
- [x] Follow-up merge vào draft; lựa chọn task chỉ từ choices stored, không tự tin ID do AI trả.
- [x] Dùng read-only task/category queries để resolve/ambiguity; đủ dữ liệu trả draft với mutated=false, tuyệt đối không gọi service ghi.
- [x] Provider timeout 20 giây/error/rate-limit/output sai -> đúng codes, không stacktrace/key.
- [x] Chat UI pending/errors/draft/clarification/choices; draft ghi rõ “đã hiểu, chưa thực hiện”.
- [x] Mock provider trong tests; một smoke request thật có chủ đích, không key trong CI/logs.

## Acceptance tests

- Ví dụ tạo/query/update/delete/complete phân loại đúng, unsupported không biến thành hành động khác.
- “Học React ngày mai” có thể là all-day; “học lúc 8h” thiếu ngày/end hỏi lại đúng.
- Relative date theo Asia/Ho_Chi_Minh khi ngày UTC khác ngày Việt Nam; không hardcode ngày demo.
- Follow-up bổ sung field với context_id thực sự giữ draft; nhiều task phải có choices.
- Sai owner/context expired/server restart/ID lựa chọn ngoài choices không thực hiện action.
- Structured output sai schema hoặc business fields bị từ chối/hỏi lại theo policy, không dùng thẳng.
- Mọi request chat dry-run không đổi số record/task updated_at, kể cả output delete/complete.
- Timeout/rate-limit/output lỗi hiển thị rõ; Todo/Calendar vẫn hoạt động.
- Backend parser/context tests + frontend Chat UI tests + regression/build pass.
- Smoke Groq thật ghi model/result nhưng không secrets; nếu chưa smoke, ghi gate thiếu.

## Definition of Done

Parser, context follow-up và UI dry-run chạy local/online; provider thật được xác minh, tests mock deterministic pass. PROGRESS phân biệt parse thành công với task đã thực hiện.

## Do Not Implement Yet

Không bật mutation, /api/chat/confirm execution, chat DB history/streaming hoặc model fallback tự động. Xác nhận/thực thi là Week 7.
