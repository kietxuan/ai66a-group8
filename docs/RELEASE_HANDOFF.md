# BÀN GIAO MVP & GROQ — cập nhật 2026-10-22

## 1. Kết quả và phạm vi

Đợt cải thiện sau handoff baseline: [107 mục + nhóm AI](IMPROVEMENT_STATUS_2026-10-21.md) và [PROGRESS](PROGRESS.md) ghi source/checks mới. Các số 120/24 và real smoke phía dưới là baseline trước đợt này; không coi là đã rerun bản mới. Không đổi provider/model hoặc mở gate online bằng local evidence.

Chốt bản cải thiện local: **170 backend / 41 frontend tests pass**, Vite build pass 3m50s, HTTP smoke 25 checks (`live_ai=false`). [Execution thật](evidence/ai-improvements-execution-2026-10-21.json): 23 checks / 14 calls pass, cleanup_errors=[]. [NLU regression](evidence/nlu-regression-v2-2026-10-21.json) 39/40 và [holdout](evidence/nlu-holdout-2026-10-21.json) 12/12, reported model đúng; điểm bao gồm backend guards. Một selector cả ngày được harden tiếp và kiểm thử execution, không có full run 40/40 để tuyên bố. Browser mobile viewport, thao tác keyboard Calendar và hai tab cancel/replay đã chạy; chưa Android/iOS vật lý. Fresh dependency install/audits, migration check, backup/restore DB thử và docs check pass. Bảng 107 mục: 87 Local / 14 Một phần / 5 Bên ngoài / 1 Hoãn. Working tree chưa commit/push, HEAD 45cf886 không phải release candidate.

Theo yêu cầu trực tiếp của user, đổi quyết định AI từ Gemini sang **Groq / `openai/gpt-oss-20b`**. Không đổi framework, database, kiến trúc API hoặc quy tắc bảo vệ dữ liệu. Không thêm Function Calling, fallback model, streaming, refresh token hoặc chức năng optional vượt MVP.

MVP local đã có Authentication, PostgreSQL/migrations, Task REST API, Todo, FullCalendar, chatbot năm thao tác, clarification, delete confirmation, conflict detection và shared refresh. Đây **chưa phải release online**: chưa có quyền tài khoản Render/Neon, remote CI hoặc URL HTTPS thật. Xem danh sách việc còn lại ở mục 6.

## 2. Key/model đã được cấu hình thế nào

- Key user cho phép được lưu trong `.env` ở root, biến `GROQ_API_KEY`; file bị Git ignore. Không có key trong source, tài liệu, frontend, `VITE_*`, ảnh hoặc báo cáo nghiệm thu.
- Model ID gửi Groq là `openai/gpt-oss-20b`, không phải `gpt-oss-20b` rút gọn. `GROQ_MODEL` có thể cấu hình nhưng không tự fallback khi model/quota lỗi.
- Backend gọi duy nhất endpoint HTTPS cố định `https://api.groq.com/openai/v1/chat/completions`. Không follow redirect hoặc retry tự động; API key không do browser gửi.
- Dùng HTTPX đã có, bỏ Google SDK khỏi dependencies. Settings dùng SecretStr và che key khi repr/JSON serialization.
- `reasoning_effort=low`, `include_reasoning=false`, `temperature=0`, không stream; timeout mặc định 20 giây, `AI_MAX_COMPLETION_TOKENS=1024`. Output bị cắt, tool calls, refusal, schema/field lỗi đều không được thực thi.
- CI và pytest không dùng key thật: fixture xóa key trong settings, provider tests dùng HTTPX MockTransport. Smoke thật là opt-in riêng.

Key đã từng được dán vào chat nên không còn được xem là bí mật an toàn. Việc dùng tạm được thực hiện đúng ủy quyền; nên revoke/rotate trước demo public. Đổi key: sửa `GROQ_API_KEY` trong `.env`, restart backend; trên Render sửa environment secret rồi redeploy. Không sửa code hoặc đưa key vào Git. Không xóa file database để thay key.

## 3. Structured Output và bảo vệ nghiệp vụ

Groq strict JSON Schema yêu cầu mọi property required và object đóng. Adapter dùng wire format riêng:

```json
{
  "action": "update_task",
  "task_id": null,
  "task_query": "Học React",
  "reference": null,
  "fields": [{"name": "description", "value": null}],
  "filters": [],
  "missing_fields": []
}
```

Mảng rỗng nghĩa là không cung cấp thay đổi; entry null là yêu cầu xóa giá trị có chủ đích. Adapter chuyển sang Action/TaskDelta hiện có, giữ phân biệt absent/null, từ chối property/entry trùng và unknown fields. REST/UI contract không đổi.

AI không có database session, user_id, allow_conflict hoặc confirmed. Backend luôn resolve current-user task/category, hỏi lại khi thiếu/nhiều kết quả, validate date/time/enums, kiểm tra conflict và ghi bằng task service chung. Không giữ transaction/row lock trong lúc gọi Groq. Xóa và overlap có pending backend-owned; confirm rechecks version/conflicts, không replay. Context RAM TTL 600 giây; một worker/instance.

Sửa thêm lỗi đổi target trong clarification: khi user chuyển task, không tái dùng ID/fields của task trước. Thêm tests cho thay target, response provider sai cấu trúc và frontend 429/502/503 giữ nội dung, không retry/refresh giả.

## 4. Bằng chứng kiểm tra

| Kiểm tra | Kết quả thực tế |
|---|---|
| Groq account/model | GET models thành công; đúng ID được cấp cho key; không chỉ đọc tài liệu |
| Full backend regression | 120 passed, 2 dependency deprecation warnings; PostgreSQL test riêng |
| Frontend regression | 24 passed, 5 files; gồm provider-failure UI |
| Vite production build | Pass với Vite 6.4.4, 4m04s; main 217.50KB, Calendar lazy 335.86KB |
| Install từ lock | npm ci pass; pip install -r backend/requirements.txt pass |
| Alembic check / pip check | No new upgrade operations / No broken requirements |
| Dependency advisory scan | Vite 6.4.3 -> 6.4.4, certifi 2026.7.22 -> 2026.10.19; sau vá npm audit 0 và pip-audit không có known vulnerabilities tại lúc scan |
| Live HTTP smoke bản cuối | 35 assertions, live_ai=true sau restart backend cuối; [báo cáo](evidence/smoke-final-2026-10-21.json); tạo/tìm/sửa/complete/xóa xác nhận với Groq thật |
| Extended real-AI execution | 20 checks / 12 AI requests, pass; báo cáo tại `docs/evidence/ai-execution-2026-10-21.json` |
| Real dry-run cuối | 14 checks / 8 calls PASS; có category-only follow-up, bulk refusal, relative dates/duration và database unchanged; giữ cả lần chưa đạt để truy vết |
| Browser same-origin | Chat tạo Học React ngày mai 08:00–10:00; Todo và Calendar cùng hiển thị 22/10; reload giữ cookie/data; console tab kiểm tra không warn/error |

Ảnh [Calendar với task AI](screenshots/groq-calendar-2026-10-21.jpg), [Todo sau restart](screenshots/groq-todo-2026-10-21.jpg). Các ảnh ngày 05/10 là evidence baseline, không thay bằng chứng Groq ngày 21/10. Test script tạo tài khoản synthetic và xóa task thuộc chính hai tài khoản đó, không reset database; tài khoản giữ lại vì MVP không account-delete. Task trong tài khoản UI demo giữ lại để người dùng thử.

Lỗi phát hiện trong real tests: model ban đầu hỏi lại thay vì trả unsupported cho bulk delete, dù không mutation; policy bổ sung ví dụ và cấm diễn giải bulk thành single action. Trình duyệt cũng cho thấy category-only follow-up có thể bị hiểu nhầm intent; policy bổ sung giữ draft.action. Run cuối [14 checks/8 calls](evidence/ai-dry-run-final-2026-10-21.json) pass cả hai tình huống; [run thất bại ban đầu](evidence/ai-dry-run-2026-10-21.json) và [rerun trung gian](evidence/ai-dry-run-rerun-2026-10-21.json) vẫn giữ. Model có thể hiểu sai câu ngoài mẫu đã thử; đây không phải cam kết độ chính xác 100%.

## 5. Chạy và kiểm tra lại

Làm theo [01_SETUP](01_SETUP.md) cho database/migration; không copy `.env` lên repository. Bản local phục vụ frontend đã build tại <http://127.0.0.1:8000>.

Từ backend, một terminal:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -X utf8 -m uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1
```

Terminal khác, từ root:

```powershell
.\backend\.venv\Scripts\python.exe -X utf8 scripts/smoke.py --live-ai
.\backend\.venv\Scripts\python.exe -X utf8 scripts/ai_acceptance.py --report .local/ai-execution-new.json
```

Không chạy hai bộ AI cùng lúc hoặc bấm chat liên tục khi đang smoke; quota thuộc tổ chức Groq và chia sẻ giữa các client. Script giãn cách 25 giây/request (có thể tăng bằng `--interval-seconds 30`); không retry khi 429. Báo cáo không cho overwrite, dùng tên mới mỗi run. Scripts dùng tài khoản synthetic; không chạy trên production nếu không chấp nhận việc thêm tài khoản thử.

Để kiểm tra dry-run riêng: dừng backend của mình, đặt env rồi chạy lại cùng lệnh Uvicorn:

```powershell
$env:CHAT_EXECUTION_ENABLED='false'
# Chạy Uvicorn ở terminal này; terminal khác chạy:
.\backend\.venv\Scripts\python.exe -X utf8 scripts/ai_acceptance.py --dry-run --report .local/ai-dry-new.json
```

Sau kiểm tra, dừng Uvicorn, xóa biến override ở terminal đã đặt bằng `Remove-Item Env:CHAT_EXECUTION_ENABLED`, khởi động lại. Không để demo ở dry-run nếu muốn task được tạo thật. Sửa `.env` hoặc env không đổi settings của process đang chạy: cần restart.

## 6. Toàn bộ việc còn lại và cách đóng gate

### A. Render + Neon / Week 2 feasibility, Week 5 rehearsal, Week 8 online MVP

Chưa có kết nối được xác nhận hoặc credentials/quyền cloud trong phiên này. Đã tìm thấy tích hợp Render/Neon nhưng gợi ý kết nối không phải bằng chứng đã đăng nhập, tạo service hoặc deploy.

1. Người có quyền đăng nhập Neon, tạo project/database dành riêng production; chọn region phù hợp Render. Sao lưu dữ liệu cần giữ. Không dùng database production làm TEST_DATABASE_URL.
2. Lấy PostgreSQL connection string theo hướng dẫn Neon, giữ `sslmode=require`, đổi prefix sang `postgresql+psycopg://`; URL-encode password nếu cần. Không dán URL có password vào chat/log/source.
3. Review diff và commit/push candidate của nhóm; kết nối đúng repository/branch với Render. Dùng `render.yaml` Blueprint hoặc Web Service Python, root repository, build `bash scripts/build.sh`, start `bash scripts/start.sh`, health `/health`.
4. Một instance, Uvicorn một worker; không bật autoscaling/đa replica khi chưa đổi thiết kế context. Kiểm tra account thực tế có đáp ứng runtime/build/gói mong muốn; không cam kết free tier hay uptime.
5. Đặt secret DATABASE_URL, GROQ_API_KEY, JWT_SECRET_KEY random; GROQ_MODEL=`openai/gpt-oss-20b`, COOKIE_SECURE=`true`, CORS_ORIGINS=HTTPS origin thật không path/trailing slash, CHAT_EXECUTION_ENABLED=`true`.
6. Xác minh build frontend/backend và startup Alembic head thành công. Không chạy nhiều migrations/rollout đồng thời. Health 200 chỉ liveness, tiếp tục auth/tasks/database/provider smoke.
7. Chạy smoke với `--base-url https://SERVICE` (và `--live-ai` có chủ đích), rồi browser: hai users, đăng nhập/reload, Todo CRUD, Calendar, năm chat action, clarification/confirmation/conflict, logout. Kiểm tra Secure/HttpOnly/SameSite cookie, Origin guard, deep links/API JSON 404.
8. Restart service: tasks vẫn còn; pending context cũ phải CONTEXT_EXPIRED, không thực thi lại. Ghi URL, commit SHA thật, thời điểm, platform logs đã loại secrets và kết quả vào PROGRESS/ACCEPTANCE.

### B. GitHub CI / Week 9

Workflow đã có PostgreSQL 18, Python 3.11.9, Node 24.19.0, pytest, pip check, Bash syntax, npm ci/test/build; GROQ_API_KEY rỗng. Local pass không phải remote CI green. Chưa commit/push trong phiên này để không tự phát hành working tree có sẵn của nhóm.

Sau nhóm review thay đổi và secrets, commit và push branch candidate; mở Actions trên đúng repository, xác nhận cả backend/frontend jobs green đúng SHA. Nếu Linux runtime/uvloop/build lỗi, sửa trên candidate và chạy lại; không bỏ test hoặc gắn “pass” thủ công. Bảo đảm repo quyền truy cập được Render. Không tự push main hoặc force-push.

### C. Release chính thức / Week 10

Chỉ sau A/B: nhóm chốt SHA + URL, kiểm tra rubric/deadline/phân công (chưa được cung cấp), điền báo cáo/presentation theo yêu cầu giảng viên nếu có. Chạy [DEMO](DEMO.md), thử cold start bằng gói thật, chuẩn bị ảnh/local backup khi mạng/quota lỗi. Đóng từng weekly DoD theo evidence, không đánh dấu toàn bộ 10 tuần hoàn thành chỉ vì local đã chạy.

### D. Key và quota trước demo public

User cho phép dùng tạm key đã lộ; hiện đang dùng đúng key đó. Nhóm cần revoke/rotate sau, nhập lại server-side và chạy một smoke thật. Xem limits thực tế tại Groq Console của đúng tổ chức; free access có rate/daily caps và có thể đổi. Không tự đăng ký paid plan, không hứa đủ quota cho mọi thành viên dùng đồng thời. Khi AI lỗi, Todo/Calendar thủ công vẫn dùng được.

### E. Optional không thuộc phần bắt buộc còn thiếu

Dashboard/Statistics/Notification/Recommendation không triển khai vì gate online MVP chưa đóng. Đây là quyết định scope theo AGENTS, không phải chức năng bắt buộc bị bỏ sót. Không hỗ trợ bulk/recurring/reopen bằng chat, chat history DB, multi-worker hoặc refresh token. Reopen qua API/UI vẫn kiểm tra conflict đúng policy.

## 7. Nguồn và ngày xác minh

- [Groq model](https://console.groq.com/docs/model/openai/gpt-oss-20b), [Structured Outputs](https://console.groq.com/docs/structured-outputs), [API reference](https://console.groq.com/docs/api-reference), [Rate limits](https://console.groq.com/docs/rate-limits): protocol và giới hạn, kiểm tra ngày 2026-10-21; không thay account smoke thật.
- [OpenAI gpt-oss-20b](https://developers.openai.com/api/docs/models/gpt-oss-20b): định danh model; deployment trong bài dùng Groq, không dùng OpenAI API key.
- [Vite 6.4.4](https://github.com/vitejs/vite/releases/tag/v6.4.4), [advisory Windows](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [certifi 2026.10.19](https://github.com/certifi/python-certifi/releases/tag/2026.10.19): bản vá chọn lọc, không upgrade hàng loạt.
