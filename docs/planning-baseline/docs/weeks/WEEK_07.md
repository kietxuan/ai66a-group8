# WEEK 07 - CHATBOT TASK MANAGEMENT

## Objective

Bật 5 action chatbot qua task service hiện có, với clarification/ambiguity/delete/conflict confirmation an toàn.

## Prerequisites

Week 6 parser/provider/context và errors pass; Week 3 service/conflict/ownership, Week 4–5 refresh UI hoạt động. Dry-run không được gọi là chat execution đã hoàn thành.

## Tasks theo thứ tự

- [ ] Action dispatcher chỉ allowlist create_task/get_tasks/update_task/delete_task/complete_task.
- [ ] current_user là nguồn ownership; resolve task ID/query scoped; không match -> hỏi lại, nhiều match -> choices.
- [ ] Resolve category_name từ defaults user; unknown category hỏi lại, không tự thêm category.
- [ ] Create validate title/date, all-day hoặc cặp giờ, priority/category; gọi shared create service.
- [ ] Query dùng filters đã hỗ trợ, trả current-user tasks kể cả array rỗng.
- [ ] Update merge delta với dữ liệu hiện tại; phân biệt absent/null; shared update service.
- [ ] Complete gọi status service; không thêm action reopen qua chat trong MVP.
- [ ] Delete luôn tạo backend-owned pending preview trước, chưa xóa.
- [ ] Conflict create/update tạo pending action + preview/conflicting_tasks, chưa ghi.
- [ ] POST /api/chat/confirm chỉ context_id + decision, không action/override client tự khai.
- [ ] Confirm recheck ownership/updated_at/conflict trong transaction; conflict preview đổi thì hỏi lại.
- [ ] Flow lock tránh confirm đồng thời; consume context sau confirm/cancel; replay/expired không mutation.
- [ ] AI không có user_id/allow_conflict/confirmed; không giữ DB lock khi chờ Gemini.
- [ ] Frontend confirmation/choices/follow-up; pending confirm chỉ confirm/cancel; không auto-retry mutation.
- [ ] Kết thúc flow clear context; result.mutated=true refresh Todo/Calendar; query/cancel không báo success mutation.
- [ ] Deploy chat trên service rehearsal một worker; secrets/model server-side.

## Acceptance tests

- 5 action chạy với mock Gemini: tạo/query/sửa/xóa/complete đúng và chỉ task current user.
- Thiếu dữ liệu -> follow-up -> đúng task; title trùng -> choices -> chọn đúng, không arbitrary first result.
- Unknown category/no match không tạo dữ liệu thay thế; user/AI gửi ID người khác không lộ dữ liệu.
- Delete trước confirm record còn nguyên; cancel không xóa; confirm đúng chỉ xóa một lần.
- Conflict trước confirm không ghi; cancel không ghi; confirm override đúng preview.
- Conflict mới xuất hiện sau preview -> hỏi lại; task đổi trước confirm -> 409 TASK_CHANGED.
- Double/concurrent confirm, hết TTL, restart hoặc context owner khác không thực hiện lần hai.
- Prompt/AI tự khai confirmed/allow_conflict/user_id bị từ chối, không bypass backend.
- Update title-only không reset time/category/priority chưa được yêu cầu; malformed output không ghi.
- Complete task đã completed là no-op, mutated=false; không tự mở lại.
- Frontend chat flow/refetch tests + backend regression/build pass; smoke online có provider thật theo kịch bản nhỏ.

## Definition of Done

Chat task execution, clarification và confirmation end-to-end chạy; không chỉ intent demo. Todo/Calendar đồng bộ sau chat; tests negative/security/concurrency pass.

PROGRESS ghi actions đã chứng minh, tests/real smoke, files/modules, issues/deviation. Chưa mở optional khi core còn lỗi.

## Do Not Implement Yet

Không bulk delete, autonomous scheduling, AI trực tiếp SQL/DB, lưu chat history, refresh token, nhiều worker/replica.
