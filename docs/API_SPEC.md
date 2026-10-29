# REST API SPECIFICATION

## 1. Quy ước chung

Base path /api; JSON; cookie authentication. Health là GET /health ngoài base path.

Thành công: {"data": object hoặc array}. 204 không có body. Không trả token/password.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ",
    "details": {}
  }
}
```

FastAPI exception handlers chuyển validation/auth/business errors về envelope trên, không để mặc định {"detail": ...} ở một số endpoint.

| HTTP | Ý nghĩa / code |
|---|---|
| 200 / 201 / 204 | Đọc/cập nhật; tạo mới; logout/delete |
| 400 | BUSINESS_RULE_ERROR: yêu cầu hợp schema nhưng không thực hiện được |
| 401 | UNAUTHENTICATED / INVALID_CREDENTIALS |
| 403 | CSRF_REJECTED: Origin hoặc header request ghi không hợp lệ |
| 404 | NOT_FOUND: resource không tồn tại hoặc không thuộc current user |
| 409 | EMAIL_EXISTS, TASK_CONFLICT, TASK_CHANGED, CONTEXT_EXPIRED |
| 415 | UNSUPPORTED_MEDIA_TYPE: body không phải application/json |
| 422 | VALIDATION_ERROR: kiểu/độ dài/enum/field/date/time/filter sai |
| 429 | AI_RATE_LIMITED; details.retry_after_seconds optional khi Groq trả header số hợp lệ, không tự retry |
| 408 / 413 | REQUEST_TIMEOUT khi body quá chậm / PAYLOAD_TOO_LARGE khi body vượt 32KiB mặc định |
| 429 | RATE_LIMITED cho auth/chat gửi quá nhanh; Retry-After và details.retry_after_seconds |
| 500 | INTERNAL_ERROR an toàn, X-Request-ID để đối chiếu log; không raw SQL/exception |
| 502 | AI_INVALID_OUTPUT |
| 503 | AI_UNAVAILABLE: provider timeout/lỗi tạm thời; DATABASE_UNAVAILABLE: lỗi kết nối/thao tác DB, không trả SQL/parameters |

POST/PUT/PATCH/DELETE /api yêu cầu X-Requested-With: todo-app, kiểm tra Origin theo allowlist nếu có. Body có dữ liệu phải là application/json. OPTIONS preflight được xử lý trước auth/CSRF checks. GET không thay đổi dữ liệu.

Client dùng credentials: include. Không retry tự động request mutation; khi mất response, tải lại dữ liệu để kiểm tra trước khi gửi lại.

## 2. Health và Authentication

### GET /health

Public, 200 {"data":{"status":"ok"}} khi app process hoạt động. Đây là liveness, không chứng minh database/Groq sẵn sàng; không trả secrets/config.

### POST /api/auth/register

```json
{
  "name": "Nguyen Van A",
  "email": "user@example.com",
  "password": "example-pass-123"
}
```

- name trim, 1–100 ký tự; email hợp lệ, trim/lowercase, tối đa 254 ký tự.
- Password tối thiểu 8 ký tự, tối đa 72 byte UTF-8, không trim/cắt.
- 201 {"data":{"id":1,"name":"Nguyen Van A","email":"user@example.com"}}.
- Email duplicate: 409 EMAIL_EXISTS, kể cả hai register đồng thời.
- Không auto-login. Từ Week 3 tạo ba category mặc định trong transaction đăng ký.

### POST /api/auth/login

```json
{
  "email": "user@example.com",
  "password": "example-pass-123"
}
```

200, cùng user response như register, set access_token cookie. Sai email/password cùng message chung 401 INVALID_CREDENTIALS.

Cookie: HttpOnly; Path=/; host-only; SameSite=Lax; Secure trên production HTTPS, false ở localhost HTTP; JWT expiry mặc định 60 phút. Không JWT trong JSON/localStorage.

Auth/task/chat responses (kể cả lỗi) có Cache-Control:no-store. Public OpenAPI có response schema auth/tasks/categories và chat discriminated union theo type. Request ID không chứa user/key.

### GET /api/auth/me

Protected, 200 user response; 401 nếu cookie thiếu/sai/hết hạn/user đã bị xóa. Frontend gọi khi mở/reload app.

### POST /api/auth/logout

Protected, 204 không body; clear cookie và context chat user hiện tại. Cookie hết hạn có thể trả 401; frontend vẫn clear local state và về Login. Không refresh/revoke token trong MVP.

## 3. Categories

### GET /api/categories

Protected; 200 data là array, sort theo id:

```json
{
  "data": [
    {"id": 1, "name": "Học tập"},
    {"id": 2, "name": "Công việc"},
    {"id": 3, "name": "Cá nhân"}
  ]
}
```

ID trên chỉ là ví dụ, client không hardcode. Mỗi user có ID riêng. Không có POST/PUT/DELETE category trong MVP.

## 4. Task schema và CRUD

### Input và response

- title: required, trim, 1–200 ký tự.
- description: nullable, tối đa 2.000 ký tự; mặc định null.
- task_date: required YYYY-MM-DD; cho phép ngày quá khứ.
- start_time/end_time: HH:MM hoặc null; cùng có/cùng không có, end > start, không 24:00/qua đêm.
- priority: low/medium/high, mặc định medium.
- category_id: positive integer hoặc null, category phải thuộc user; mặc định null.
- status: pending/completed; create mặc định pending, chỉ thay qua status endpoint.
- allow_conflict: boolean request flag, mặc định false; không phải field lưu DB.
- Reject field ngoài schema, gồm user_id và client tự gửi id/timestamps. Category user khác trả 404.

Task response:

```json
{
  "data": {
    "id": 10,
    "title": "Học React",
    "description": "Ôn hooks",
    "task_date": "2026-10-02",
    "start_time": "19:00",
    "end_time": "21:00",
    "priority": "medium",
    "category_id": null,
    "status": "pending",
    "created_at": "2026-10-02T10:00:00Z",
    "updated_at": "2026-10-02T10:00:00Z"
  }
}
```

Ngày ví dụ không dùng làm ngày mặc định trong code/prompt. Response giờ cũng là HH:MM; timestamps UTC ISO 8601.

### POST /api/tasks

Protected, backend gán user_id. Request:

```json
{
  "title": "Học React",
  "description": "Ôn hooks",
  "task_date": "2026-10-02",
  "start_time": "19:00",
  "end_time": "21:00",
  "priority": "medium",
  "category_id": null,
  "allow_conflict": false
}
```

201 Task response. 409 TASK_CONFLICT trước khi insert nếu overlap và chưa được user override.

### GET /api/tasks

Protected, 200 {"data": [Task, ...]}; không pagination.

| Query | Quy tắc |
|---|---|
| task_date | Một ngày YYYY-MM-DD; không kết hợp date_from/date_to |
| date_from, date_to | Khoảng ngày inclusive; có thể một đầu; nếu cả hai phải from <= to |
| status | pending/completed |
| priority | low/medium/high |
| category_id | Positive integer thuộc current user; user khác trả 404 |
| search | Trim, tối đa 200 ký tự, case-insensitive title/description; rỗng thì bỏ filter |
| all_day | Boolean; true chỉ task không giờ, false chỉ task có giờ |
| start_time, end_time | HH:MM; selector bằng giờ cụ thể, không tự đổi thời gian |

Các filter AND. Sort task_date tăng, start_time tăng (null cuối), id tăng. Không có filter nghĩa là toàn bộ task của current user.

```text
GET /api/tasks?task_date=2026-10-02&status=pending
GET /api/tasks?date_from=2026-10-01&date_to=2026-10-31
GET /api/tasks?search=react&priority=high
```

Calendar chuyển range end-exclusive của FullCalendar sang date_to inclusive, không tự thay API contract.

### GET /api/tasks/{id}

200 Task response; 404 cho resource không tồn tại/user khác. id phải positive integer.

### PUT /api/tasks/{id}

Full replacement các field editable: title/task_date bắt buộc; description/times/category bỏ qua thì reset null, priority bỏ qua thì medium. Không nhận status; giữ status hiện có. UI luôn gửi đủ form để không vô tình mất dữ liệu.

PUT và PATCH status nhận optional `expected_version` là updated_at đã đọc. DELETE nhận query `expected_version`. Nếu có và không khớp: 409 TASK_CHANGED, chưa ghi. UI mới luôn gửi version; API cũ không gửi vẫn tương thích. Version không phải task field lưu DB.

200 Task response. Kiểm tra conflict khi đổi date/time của task pending; loại chính task đó khỏi so sánh. Edit task completed không conflict cho tới khi mở lại.

Chat update chỉ trích delta; backend merge với task hiện tại trước khi gọi cùng service, không reset những field user chưa yêu cầu đổi.

### PATCH /api/tasks/{id}/status

```json
{
  "status": "pending",
  "allow_conflict": false
}
```

200 Task response. pending -> completed không conflict. completed -> pending check conflict và có thể trả 409; gửi allow_conflict=true sau quyết định user. Set cùng status là no-op, không cập nhật updated_at.

### DELETE /api/tasks/{id}

Protected, hard delete; 204 không body. UI xác nhận trước khi gọi; chatbot không gọi trực tiếp endpoint này mà qua backend-owned confirmation. Không có API xóa nhiều task trong MVP.

## 5. Conflict contract

Chỉ task pending, cùng user/ngày, có đủ hai giờ. Cả ngày/completed không chặn lịch; khoảng chạm nhau không overlap.

```json
{
  "error": {
    "code": "TASK_CONFLICT",
    "message": "Task trùng lịch với công việc hiện có",
    "details": {
      "conflicting_tasks": [
        {
          "id": 11,
          "title": "Học Python",
          "task_date": "2026-10-02",
          "start_time": "20:00",
          "end_time": "22:00"
        }
      ]
    }
  }
}
```

REST client giữ nguyên form, cho đổi giờ/hủy/tiếp tục; chỉ gửi lại allow_conflict=true sau user chọn tiếp tục. Flag không bỏ validation/ownership.

Chat không để client/AI gửi flag: backend giữ pending action + conflict preview và chờ /api/chat/confirm.

## 6. Chat request và context

### POST /api/chat

Protected:

```json
{
  "message": "Ngày mai lúc 8 giờ tối thêm task học JavaScript trong 2 tiếng",
  "context_id": null,
  "selected_task_id": null
}
```

- message trim, 1–2.000 ký tự.
- context_id optional; backend random ID, scoped user, TTL 10 phút.
- selected_task_id chỉ dùng chọn từ choices đã lưu trong context đó. Không chấp nhận ID tùy ý/user khác; sai lựa chọn trả 422.
- Yêu cầu mới không context_id thay flow cũ. Pending confirmation phải confirm/cancel trước theo UI.
- Follow-up gửi message + context_id từ response trước. Backend merge với draft được lưu, không bắt AI tự nhớ.
- Backend có memory có chọn lọc theo user dù result đã tiêu thụ flow. Model nhận các lượt nói/task vừa hiện tối thiểu, không phải toàn bộ tin nhắn trên màn hình. TTL 10 phút, không history DB.
- Không có context/expired/restart/sai owner: 409 CONTEXT_EXPIRED, không có mutation.
- Week 6 dry-run; Week 7 production execution. Draft chỉ là output kiểm chứng parser ở Week 6, không phải action đã hoàn thành.

### Structured action nội bộ từ Groq

Đây là action đã normalize trong backend, không phải payload ghi database từ client. Groq wire schema riêng dùng `fields`/`filters` là mảng `{name,value}` để mọi thuộc tính đều required theo strict JSON Schema. Mảng rỗng = không đổi; entry với value null = xóa giá trị. Adapter từ chối tên/entry/property trùng, sau đó validate lại Action/TaskDelta. Client không gửi wire format và API công khai không đổi:


```json
{
  "action": "create_task",
  "task_id": null,
  "task_query": null,
  "fields": {
    "title": "Học JavaScript",
    "task_date": "2026-10-03",
    "start_time": "20:00",
    "end_time": "22:00",
    "priority": "medium",
    "category_name": null
  },
  "filters": {},
  "missing_fields": []
}
```

Action enum: create_task/get_tasks/update_task/delete_task/complete_task/suggest_free_slots/clarify/unsupported. fields chỉ chứa task fields hợp lệ (category_name được backend resolve sang category_id); filters chỉ gồm query filters đã hỗ trợ. Phân biệt field không có (không đổi khi update) với null (xóa giá trị).

Amendment 22/10: wire thêm property required `availability` là mảng `{name,value}` (rỗng cho action khác). name chỉ task_date/duration_minutes/start_time/end_time; value string/null; duration là số phút nguyên dạng string ở wire, normalize thành strict integer 1–1439 trong Action. Adapter từ chối trùng entry, duration float/bool/ngoài giới hạn, date/time sai; không dùng availability làm task fields. suggest_free_slots không nhận task_id/task_query/fields/filters khác rỗng; reference chỉ null hoặc last_availability. Reference đó resolve tiêu chí trong RAM của current-user, merge phần bổ sung; không còn memory thì hỏi lại toàn bộ, không tin tiêu chí AI chép lại. Client vẫn chỉ gửi message/context_id, không gửi structured action.

Action nội bộ thêm optional `reference=last_task|recent_results`; amendment giờ trống thêm `last_availability` chỉ cho suggest_free_slots/clarify, không hợp lệ trên action task. Groq wire property luôn required, giá trị null khi không tham chiếu. filters hỗ trợ all_day/giờ để tách tên khỏi đặc điểm task. Backend không fallback toàn database khi reference không hợp lệ. Tên “Ngủ” và selector all_day=true không phải title “Ngủ cả ngày”.

Không nhận user_id/allow_conflict/confirmed. task_id/task_query từ AI chỉ là gợi ý, vẫn phải scoped query và ambiguity check. Backend validate lại ngày/giờ/enum/title; structured JSON không chứng minh dữ liệu đúng nghiệp vụ.

Create cần title và task_date. Không mặc định thiếu start_time là lỗi nếu user chỉ muốn task cả ngày. Nếu user nói có giờ/duration nhưng dữ liệu chưa đủ cặp giờ, hỏi lại. Update cần xác định một task và ít nhất một field thay đổi.

### Các response chat

Tất cả 200 có data.type, data.message, data.mutated:

| type | Payload thêm / ý nghĩa |
|---|---|
| draft | action; mutated=false; chỉ parser dry-run Week 6 |
| clarification | context_id, missing_fields và/hoặc choices; mutated=false |
| confirmation | context_id, action, task_preview; mutated=false; cần xác nhận xóa |
| conflict | context_id, action, task_preview, conflicting_tasks; mutated=false |
| result | action, task (object/null), tasks (array); mutated chỉ true khi có thay đổi thực tế |
| availability | action=suggest_free_slots, criteria, effective_start_time, checked_at, slots, has_more; mutated luôn false, không có confirmation/context_id sau result |

Clarification thiếu dữ liệu:

```json
{
  "data": {
    "type": "clarification",
    "message": "Bạn muốn task này vào ngày nào?",
    "mutated": false,
    "context_id": "opaque-context-id",
    "missing_fields": ["task_date"],
    "choices": []
  }
}
```

Nhiều kết quả: choices gồm id/title/task_date/start_time/end_time; không tự chọn và không cho user xem task người khác. Không tìm được task/category: clarification giải thích và hỏi lại, không tạo/xóa task thay thế.

get_tasks trả result với tasks array (có thể rỗng), mutated=false. Unsupported trả result, action=unsupported, message giải thích, mutated=false. Khi flow kết thúc, client xóa context_id.

### Gợi ý giờ trống — POST /api/chat, không endpoint mới

Ví dụ: “Gợi ý 90 phút trống ngày mai từ 08:00 đến 18:00”. Backend cần đủ `task_date`, `duration_minutes`, `start_time`, `end_time` trong Action.availability; thiếu/mơ hồ trả clarification với các tên trên và context_id. Không đoán default. Ngày quá khứ/giờ đảo/thời lượng dài hơn khung trả clarification, không ghi task. Không đa ngày/qua đêm; giờ tối đa 23:59, không 24:00.

```json
{
  "data": {
    "type": "availability",
    "action": "suggest_free_slots",
    "message": "Các khung giờ gợi ý theo lịch hiện tại, chưa tạo hay giữ chỗ.",
    "mutated": false,
    "criteria": {"task_date":"2026-10-23","duration_minutes":90,"start_time":"08:00","end_time":"18:00"},
    "effective_start_time": "08:00",
    "checked_at": "2026-10-22T19:00:00+07:00",
    "slots": [{"task_date":"2026-10-23","start_time":"08:00","end_time":"09:30"}],
    "has_more": false
  }
}
```

Giờ/date trên chỉ ví dụ, slot thật tính từ PostgreSQL current-user. Tối đa ba lựa chọn sớm nhất, liên tiếp theo thời lượng khi cùng một khoảng trống, không chồng nhau. `has_more` true nếu còn ít nhất một slot đủ thời lượng ngoài ba slot đầu; không có nghĩa ba khoảng đó là toàn bộ giờ rảnh trong ngày. `effective_start_time` là max(giờ bắt đầu, hiện tại làm tròn lên phút) cho hôm nay, hoặc null khi khung đã hết; ngày tương lai bằng start_time. Không đủ chỗ trả slots=[], has_more=false, thông báo thật.

Chỉ pending timed chặn, cả ngày/completed không chặn. `checked_at` là thời điểm snapshot VN, không bảo đảm slot còn trống sau response. Không tạo task, không auto-refresh Todo/Calendar, không pending confirmation/giữ chỗ. Ngay cả CHAT_EXECUTION_ENABLED=false vẫn đọc/gợi ý được. Memory có thể gửi lại bốn tiêu chí cho câu tiếp nối; không gửi/lưu slot như quyền đặt lịch. Muốn tạo phải dùng create_task và kiểm tra conflict lại. TTL/ownership/CSRF/rate limit/provider errors giữ nguyên.

## 7. Chat confirmation

### GET /api/chat/context

Protected, read-only: `{"data":{"flow":null}}` hoặc flow clarification/confirmation/conflict còn hiệu lực của current user. Không thực thi, không kéo dài TTL, không khôi phục history/action đã hết hạn hoặc sau restart. Frontend dùng để lấy lại preview/cancel sau reload hoặc kết quả request không rõ.

### POST /api/chat/confirm

Protected; không gọi AI để quyết định xác nhận:

```json
{
  "context_id": "opaque-context-id",
  "decision": "confirm"
}
```

decision chỉ confirm/cancel. Không nhận action/task_id/allow_conflict từ client.

- cancel: 200 result, action=cancel, mutated=false; clear pending/context.
- decision=cancel cũng được dùng hủy clarification draft để nút Bắt đầu yêu cầu khác không phục hồi lại bản nháp đã bỏ sau reload; không ghi task, không cấp quyền confirm cho draft.
- confirm: lấy action do backend lưu, recheck ownership/schema và task updated_at.
- Task thay đổi sau preview: 409 TASK_CHANGED; hủy pending cũ và yêu cầu xem/yêu cầu lại.
- Conflict đang chặn thay đổi/có task mới overlap: 200 conflict với preview/context cập nhật; chưa ghi, user phải quyết định lại. Blocker cũ đã bị xóa hoặc không còn overlap thì không còn cần override blocker đó; không được override blocker mới/chưa được user xem.
- Confirm xóa hoặc override đúng preview: shared service thực thi, 200 result; delete có task=null, tasks=[], mutated=true.
- Thành công/cancel tiêu thụ context. Confirm lặp lại/expired: 409 CONTEXT_EXPIRED, không ghi lần hai.
- Memory task/lượt nói có thể còn để hiểu câu tiếp theo, nhưng không giữ ID xác nhận hay quyền replay.
- Xác nhận và execute được bảo vệ bởi flow lock; version/conflict recheck và write nằm trong transaction.
- 401/logout không cho pending action tiếp tục. Không auto-retry xác nhận khi timeout.

## 8. Provider failures và authorization

Timeout AI mặc định 20 giây; trả 503 khi timeout/provider unavailable, 429 khi rate-limited, 502 khi output không validate được. Không thực thi action một phần và không trả stacktrace/API key.

Mọi category/task/chat/confirm:

- xác định current_user từ JWT cookie;
- query/resolve/write scoped theo user;
- không tin ownership, ID, xác nhận hoặc quyền override do AI/client tự khai;
- không gửi dữ liệu người khác vào prompt/response;
- response lỗi không được kèm task/title/category của user khác.

Automated chatbot tests mock provider; không yêu cầu key/network thật.
