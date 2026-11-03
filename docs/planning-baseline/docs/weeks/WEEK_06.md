# WEEK 06 - AI CHATBOT FOUNDATION

## Objective

Tích hợp Gemini Structured Output, parse/clarification/context và Chat UI ở chế độ dry-run. Chưa ghi task qua chatbot.

## Prerequisites

Task service/API và Todo/Calendar pass; deploy rehearsal Week 5 đã có. Quyền gemini-2.5-flash được kiểm tra lại bằng tài khoản thực tế; không suy ra khả dụng chỉ từ model name.

Nếu model không dùng được, ghi kết quả và báo user quyết định thay model/provider trước tích hợp. Không tự đổi stack. Mock giúp phát triển parser/tests nhưng không chứng minh provider thật hoạt động.

## Tasks theo thứ tự

- [ ] Thêm google-genai SDK phiên bản tương thích đã kiểm tra; key server-side, GEMINI_MODEL/AI_TIMEOUT_SECONDS.
- [ ] Xây structured action schema đúng API_SPEC; chọn Structured Output, không thêm Function Calling/streaming song song.
- [ ] Prompt có ngày hiện tại/timezone, category names và policy; chỉ dữ liệu current user tối thiểu, không secrets.
- [ ] Parse action/fields/filters; validate enum/date/time/unknown fields ngoài output.
- [ ] Phân biệt task cả ngày với user muốn lịch có giờ nhưng thiếu start/end/duration.
- [ ] Convert relative date/duration khi đủ thông tin; hỏi lại nếu mơ hồ, không suy diễn field quan trọng.
- [ ] POST /api/chat protected + request validation, CSRF, response envelope.
- [ ] Context RAM keyed user/random ID, TTL 10 phút, một flow/user; draft + missing fields + choices, không Conversations/Messages.
- [ ] Follow-up merge vào draft; lựa chọn task chỉ từ choices stored, không tự tin ID do AI trả.
- [ ] Dùng read-only task/category queries để resolve/ambiguity; đủ dữ liệu trả draft với mutated=false, tuyệt đối không gọi service ghi.
- [ ] Provider timeout 20 giây/error/rate-limit/output sai -> đúng codes, không stacktrace/key.
- [ ] Chat UI pending/errors/draft/clarification/choices; draft ghi rõ “đã hiểu, chưa thực hiện”.
- [ ] Mock provider trong tests; một smoke request thật có chủ đích, không key trong CI/logs.

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
- Smoke Gemini thật ghi model/result nhưng không secrets; nếu chưa smoke, ghi gate thiếu.

## Definition of Done

Parser, context follow-up và UI dry-run chạy local/online; provider thật được xác minh, tests mock deterministic pass. PROGRESS phân biệt parse thành công với task đã thực hiện.

## Do Not Implement Yet

Không bật mutation, /api/chat/confirm execution, chat DB history/streaming hoặc model fallback tự động. Xác nhận/thực thi là Week 7.
