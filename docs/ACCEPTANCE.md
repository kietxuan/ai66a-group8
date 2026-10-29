# ACCEPTANCE MATRIX — baseline 2026-10-05, bàn giao 2026-10-22

## Đợt cải thiện sau audit

Xem [đối chiếu đủ 107 ID + AI bắt buộc](IMPROVEMENT_STATUS_2026-10-21.md) và checkpoint mới trong [PROGRESS](PROGRESS.md). Các số 120/24/35/20 bên dưới là baseline trước đợt hardening này, không dùng để nghiệm thu code mới. Điện thoại thật, HTTPS, remote Linux CI và release candidate vẫn OPEN; chưa có đủ bằng chứng để đóng toàn bộ weekly DoD.

Bản cải thiện đã nghiệm thu local: **170 pytest / 41 Vitest pass**, production build pass 3m50s, HTTP smoke 25 checks không AI; [real execution 23 checks / 14 calls](evidence/ai-improvements-execution-2026-10-21.json) pass, cleanup_errors=[]. [NLU regression 39/40](evidence/nlu-regression-v2-2026-10-21.json) và [holdout 12/12](evidence/nlu-holdout-2026-10-21.json) đo parser + guard, không cam kết hiểu mọi câu. Selector cả ngày được harden tiếp và kiểm chứng execution, chưa có full rerun 40/40. Browser đã kiểm tra mobile viewport, Calendar keyboard và hai tab recovery/cancel/replay; còn thiết bị thật. Backup/restore local trên DB thử mới, fresh installs/audits/migrations/doc checks pass. Chi tiết giới hạn và lịch sử thất bại giữ tại PROGRESS/evidence.

## Amendment hiện tại: Groq thật

Provider được user đổi sang Groq `openai/gpt-oss-20b`; key server-side local đã hoạt động. Full regression 120 backend +24 frontend tests pass, Vite6.4.4 build pass, npm/pip audits sau bản vá không known vulnerabilities tại scan. Real smoke35 checks pass; extended execution20 checks/12 calls pass; final dry-run14 checks/8 calls pass, không ghi task. Có cả failure ban đầu và rerun; kết quả cuối trong [RELEASE_HANDOFF](RELEASE_HANDOFF.md) và docs/evidence. Browser đã xác minh Chat tạo task và cùng hiển thị Todo/Calendar đúng date/time. Render/Neon/remote CI/HTTPS/release vẫn OPEN.

Các mô tả Google SDK/mock/no-key bên dưới là evidence baseline ngày 05/10, được thay thế về provider bởi amendment này; không phải kết quả hiện tại. Không dùng chúng để phủ định real tests mới hoặc để chứng minh online.


## Phạm vi và cách đọc

Yêu cầu của user cho phép triển khai cả 10 phase trong một session, giữ thứ tự dependency Auth -> Task service -> Todo/Calendar -> AI dry-run -> execution -> hardening/regression/docs. Gate cần credentials không bị bỏ qua bằng mock. Week 1 planning là lịch sử trước session này.

PASS LOCAL: assert chạy trên PostgreSQL thật hoặc browser local. PASS MOCK/OFFLINE: logic chatbot/SDK được kiểm tra không gọi Google. READY: có config, chưa chạy platform. OPEN: thiếu bằng chứng/quyền/credentials. Không dùng coverage tùy ý hoặc health 200 thay DoD.

## Requirements -> implementation -> evidence

| Nhóm/tuần | Requirement | Implementation | Evidence/kết quả |
|---|---|---|---|
| W2 | Settings root .env, validation, isolated test DB | core/config.py, database.py, tests/conftest.py | PASS LOCAL: migrations/tests safety guard; secret placeholder/DB driver fail-fast |
| W2 | Register, normalized unique email, bcrypt | schemas/auth.py, auth_service.py | PASS LOCAL: validation/hash/duplicate + concurrent race một user/ba categories |
| W2 | Login/me/logout JWT expiry/ownership | security.py, api/auth.py/deps.py | PASS LOCAL: HS256 only, expired/tampered/wrong algorithm/deleted user; flags/clear cookie |
| W2 | CSRF write checks + explicit CORS | write_guard; api/client.js | PASS LOCAL: Origin/header/JSON, preflight; no token in body/localStorage |
| W2 | CI/test harness | pytest/Vitest + .github/workflows/ci.yml | Local checks PASS; GitHub CI READY, chưa push/run |
| W3 | Users/Categories/Tasks migrations | Alembic 0001_users -> 0002_tasks_categories | PASS LOCAL: empty upgrade, populated Users backfill, idempotency, Alembic check |
| W3 | Three defaults/user, GET only | auth_service + category route | PASS LOCAL: owned categories, foreign category rejected; no CRUD category |
| W3 | Task CRUD/full PUT/status/validation | schemas/tasks, crud/tasks, task_service | PASS LOCAL: strict YYYY-MM-DD/HH:MM, pair times, enums, extras, resets, no-op |
| W3 | AND filters, inclusive range, sort/search | TaskFilters + scoped queries | PASS LOCAL: test_tasks negative/happy path; HTTP smoke range |
| W3 | A cannot read/mutate B task/category | every query/service uses uid | PASS LOCAL: API tests + live HTTP two-user smoke, no task data in 404 |
| W3 | Pending-only conflict/create/time edit/reopen | execute with User row lock | PASS LOCAL: adjacent/overlap/containment/same interval/self/all-day/completed, rollback/override |
| W3 | Concurrent scheduling cannot bypass check | same transaction lock/query/write | PASS LOCAL: two Sessions/threads -> [201,409], not SQLite/mock DB |
| W4 | Shared forms/list/filters/delete/conflict | TaskProvider, TaskForm, TaskDialogs, TodoView | PASS LOCAL: RTL assertions and browser create/edit/complete/reopen/cancel-delete |
| W4/W8 | Stale response, 401, errors, no auto-retry | AbortController + active guard + keyed provider | PASS LOCAL: state.test.jsx late-result/401/retry tests; error retains form |
| W4 | Desktop/mobile/keyboard | CSS + native dialog focus/Escape/restore | PASS LOCAL: desktop and mobile viewport, form focus/Escape; card overflow fixed |
| W5 | Calendar Month/Week/Day and event interactions | FullCalendar 6.1.19 + Luxon named zone | PASS LOCAL: actual plugin test; browser all three views, event detail, status mutation |
| W5 | Business date/time/range/selection | calendar/adapter.js + dates.js | PASS LOCAL: end-exclusive, year boundary, UTC midnight, three browser zones; date click opens correct shared form |
| W5 | Build same-origin/static/API fallback | static.py, render.yaml, scripts | PASS LOCAL: SPA and reserved JSON 404; build served by Uvicorn; Render/Neon READY/OPEN |
| W6 | Structured Output strict allowlist | Action/TaskDelta, gemini.py | PASS OFFLINE: actual pinned SDK generate_content request serialization, provider subset schema, full backend validation |
| W6 | Current date/timezone/minimal prompt | prompt_data + system policy | PASS OFFLINE: VN date assertion, no secrets; natural-language interpretation by real model OPEN |
| W6 | Missing data/follow-up/choices/no match | chat_service merge/dispatch | PASS MOCK: field merge, time pair, unknown category, selections whitelist, changed intent resets draft |
| W6 | Read-only dry-run | CHAT_EXECUTION_ENABLED=false | PASS MOCK: create/update/delete/complete records and timestamps unchanged |
| W6/W7 | Five actions and shared service | handle/dispatch/execute_pending | PASS MOCK: create/get/update/delete/complete, no-op, absent-vs-null and preservation |
| W7 | Delete/conflict pending preview | ContextStore backend-owned action | PASS MOCK: preview before delete, cancel unchanged, confirm once, no client action/override accepted |
| W7/W8 | Recheck task/conflict changes | expected_version + conflict versions | PASS LOCAL/MOCK: TASK_CHANGED, deleted target, new/changed blocker asks again |
| W7/W8 | TTL/restart/wrong owner/replay/race | RAM context + flow lock + consume | PASS MOCK: 601s expiry, cleared store restart, owner mismatch, concurrent confirm [200,409] |
| W7 | AI never SQL/DB/lock while waiting | provider parses only; rollback read before parse | PASS LOCAL/MOCK: provider asserts no active DB transaction; injection/extras rejected |
| W7/W8 | Chat UI choices/confirm/shared refresh | ChatView + TaskProvider | PASS RTL MOCK: confirmations/results mutate/refresh; real browser displays AI unavailable safely |
| W8 | Manual app usable when AI fails | provider errors + UI manual task actions | PASS LOCAL: no key ->503 clear message; existing tasks unchanged/manual navigation works |
| W8/W9 | Error envelope/config/security audit | handlers/security/static/locks | PASS LOCAL: validation input stripped, DATABASE_UNAVAILABLE SQL/params sanitized; npm/pip audit clean at scan time |
| W9 | Regression and reproducible deps | 82 pytest +21 Vitest, lockfiles | PASS LOCAL; two known deprecation warnings; CI Linux execution OPEN |
| W10 | Setup/demo/handoff | README, 01_SETUP, DEMO, PROGRESS, screenshots | Local handoff prepared; official release/online URL/commit OPEN |

## Commands và bằng chứng chạy

Từ backend: .venv/Scripts/python.exe -m pytest -o addopts='' --tb=short -q: 82 passed, 2 warnings, 64.58s; -m alembic upgrade head, -m alembic check (“No new upgrade operations detected”), -m pip check (“No broken requirements found”).

Từ frontend: npm test -- --run: 21 tests, 5 files PASS. npm run build PASS (responsive-fix 4m31s, final lockfile reinstall rebuild 6m); CSS 19.21KB, Calendar lazy chunk 335.86KB, main 217.50KB, không warning >500KB. Build đã serve và kiểm tra trên browser cùng origin FastAPI; cuối cùng smoke HTTP pass sau rebuild.

npm audit: 0 vulnerabilities. Python pip-audit từ .local/audit-env, scan backend/.venv/Lib/site-packages: “No known vulnerabilities found” sau các bản vá có chọn lọc. Đây là thời điểm scan, không là đảm bảo bảo mật tuyệt đối.

npm ci đã chạy lại từ lock, 21 tests pass và build pass 6m, asset hashes không đổi. EPERM esbuild do dev server Windows giữ file được xử lý bằng dừng đúng owned process rồi restart; không tắt security policy. Settings smoke 4 fail-fast cases, Bash syntax check và 23 Markdown link/fence checks pass. Remote CI vẫn chưa chạy.

Live scripts/smoke.py: 26 assertions hai synthetic users, CRUD/conflict/category isolation/CSRF/static/logout trên Uvicorn/PostgreSQL; live_ai=false. Script này không là bằng chứng Gemini thật.

Browser: register -> login; all-day + timed 19:00–20:30; Calendar detail complete -> Todo completed -> reopen; cancel delete giữ record; Month/Week/Day đúng slot; ngày 6/10 prefill form; Escape đóng; thiếu Gemini key error; responsive không document overflow. Logout A -> register/login B list/chat rỗng -> login A giữ tasks, không cache lẫn. Reload sau API restart giữ cookie/data. Production build ở port8000 tải task và lazy Calendar, console không error/warning. Screenshots chỉ synthetic demo data.

## Gate chưa đạt — không được đánh dấu release hoàn thành

| Gate | Vì sao OPEN | Cần chạy để đóng |
|---|---|---|
| Groq account/model thật (W2/W6/W7) | CLOSED LOCAL ngày 21/10: key/model và real smoke/extended tests PASS | Kiểm tra lại khi đổi key/quota hoặc deploy; không tự fallback |
| Render/Neon rehearsal (W5) | Không có account/connection/platform quyền | Deploy single service + TLS DB; auth/tasks/calendar HTTPS smoke |
| Full MVP online (W8) | Groq local PASS; platform/HTTPS prerequisites OPEN | Deploy exact candidate, five-action chat smoke và shared UI refresh |
| Regression CI/HTTPS (W9) | Workflow chưa được push/run | Remote CI Linux green; online browser cookie/CSRF/restart/persistence |
| Official release (W10) | Chưa release commit/URL, rubric chưa có | Group review/commit thực, online evidence, deadline/rubric và demo đúng account/gói |

## Known limitations không phải feature thiếu ngoài MVP

RAM context TTL 10 phút, một worker/instance, một flow/user; restart cần gửi lại. Không DB chat history, refresh token, category CRUD, recurring/bulk/drag-drop, notifications/recommendations. Dashboard optional bỏ vì online gate chưa pass. Google font fallback khi offline. Local PostgreSQL trust loopback chỉ development. Không load test production-scale.

Hai warnings dependency: Starlette báo deprecated HTTPX TestClient và AnyIO BlockingPortal alias. Assertions đều pass, không suppress warning hoặc thay cả stack chỉ để logs sạch. Linux-only uvloop 0.21.0 constraints cần remote CI xác minh.

Ảnh browser là chứng cứ giao diện local, không phải deployment/provider proof. Không invent release SHA hoặc URL.
