# PROJECT PROGRESS

> Cập nhật chuẩn bị bàn giao Git ngày 2026-10-29. Các evidence ngày 21–22/10 được giữ nguyên ngày chạy; các session cũ bên dưới là lịch sử, không thay kết quả mới.

## 1. Current status

- Current phase: WEEK_09/10 bổ sung hardening + chất lượng hội thoại theo yêu cầu mới ngày 2026-10-21; auth Passlib/bcrypt + UI redesign/Sáng-Tối và gợi ý giờ trống read-only theo các yêu cầu riêng 2026-10-22; không tự mở optional khác.
- Overall: LOCAL MVP + REAL GROQ VERIFIED; Render/Neon, remote CI và release HTTPS còn OPEN.
- Model/provider chính thức: Groq / openai/gpt-oss-20b, thay Gemini theo yêu cầu trực tiếp, không phải agent tự đổi.
- Key đã cấu hình trong .env ignored, chỉ backend dùng; không commit/source/frontend/log. User cho phép dùng tạm key đã lộ; nên rotate trước public.
- 45cf886 là baseline planning trước implementation. Đợt bàn giao Git theo yêu cầu user 29/10 được ghi bên dưới; commit thực tế xem Git log/remote. Chưa có release online HTTPS/URL; push source không đồng nghĩa đã deploy.
- Current improvement tracking: [107 mục + AI bắt buộc](IMPROVEMENT_STATUS_2026-10-21.md), giữ audit gốc như bằng chứng trước sửa. Sau giờ trống: **247 backend / 57 frontend tests pass**, production build pass, Groq parser 7/7 + browser nhiều lượt thật pass; xem amendment bên dưới. 200/53 và HTTP smoke 25/25 là checkpoint UI trước tính năng mới, không coi smoke cũ là bằng chứng giờ trống. Next: nhóm review/commit/push/remote CI và người có quyền deploy/HTTPS smoke, thử thiết bị thật.

## Bàn giao Git / clone setup — 2026-10-29

- Commit implementation **e359278e4b8838ae3235dee8b4c57cf5196d4605** đã push thành công lên origin/main; `git ls-remote origin refs/heads/main` xác nhận đúng SHA. Không force push, working tree sạch ngay sau push. Ghi chú này là bổ sung bàn giao, không đổi source nghiệp vụ.
- GitHub Actions đã tạo [run 40819516766](https://github.com/kietxuan/ai66a-group8/actions/runs/40819516766), trạng thái quan sát đầu tiên in_progress; không đánh dấu CI pass trước conclusion thực tế. Render/Neon/HTTPS và thiết bị vật lý vẫn OPEN.

- User cho phép commit/push các file cần thiết để nhóm clone chạy được. Remote origin=https://github.com/kietxuan/ai66a-group8.git, nhánh main; fetch xác minh HEAD và origin/main cùng baseline trước khi stage, không force push hoặc thay remote.
- Bao gồm source backend/frontend, migrations, tests, dependency pins/lockfiles, scripts, CI/deploy config, docs và evidence/ảnh đang được docs tham chiếu (~1,25MB). Ghi nhận việc bỏ các Dockerfile/compose/API/schema placeholder rỗng từ implementation; không xóa file local mới trong lượt này.
- Không đưa .env/API key/JWT secret/password thật, .local/pgdata/backups, venv, node_modules, dist, cache/log lên Git. Rà 160 file candidate ban đầu: không match local Groq/JWT secret hoặc credential/private-key/JWT pattern; không coi pattern scan là chứng nhận mọi loại secret. Git ignore và snapshot xác minh năm nhóm local không nằm trong file sẽ publish.
- README có quy trình Windows clone mới: prerequisites, PostgreSQL tự cài/tạo DB, .env riêng/random JWT/Groq key, venv/requirements/npm ci, `scripts/dev.ps1 -Build`. Không dùng -StartLocalDatabase trên máy clone mới; launcher migrate bảng chứ không tạo database/cài thư viện. .env.example thêm đủ Origins local8000/Vite5173; JWT mẫu vẫn bị từ chối. Không thay .env đang dùng.
- Tests lượt đầu chờ rồi timeout do cụm PostgreSQL local chưa chạy (1 setup error, không phải pass). Khởi động đúng cụm .local/pgdata loopback55432, không initdb/reset DB chính. Regression chạy lại với connection timeout 5s: **247 passed / 2 warnings, 67,80s**; frontend **57 passed, 6,61s**, production build pass **2m42s**. Không gọi Groq thật trong lượt chuẩn bị Git này.
- Export Git index vào `.local/publish-snapshot-20261029` ignored: không .env/.venv/node_modules/dist/pgdata. Backend tests **247 passed / 2 warnings, 63,43s** từ source snapshot, dùng packages Python venv hiện hữu và riêng PostgreSQL todo_app_test. Frontend npm ci từ lock sạch cài 164 packages, **57 tests pass, 5,86s**. Đây là source-only validation, không claim fresh Python install/physical machine/Linux/online smoke.
- Fresh npm ci/audit phát hiện hai moderate entries ở Vitest/@vitest/mocker 4.1.11: [manual mock injection](https://github.com/vitest-dev/vitest/security/advisories/GHSA-qxg6-89mg-rqv8) và [Windows traversal](https://github.com/vitest-dev/vitest/security/advisories/GHSA-xp26-3454-mjgp). Upstream xác nhận bản vá backport 4.1.12. Chỉ pin Vitest 4.1.12 và các package cùng family trong lockfile, không audit fix --force/nâng major hoặc runtime deps. npm ci + audit sau vá **0 vulnerabilities**, tests mới **57 passed, 6,14s**. Không bảo đảm advisory tương lai không xuất hiện.
- pip check không broken requirements; compileall và document checker 27/0, Git diff whitespace pass. Warnings npm transitive whatwg-encoding và esbuild allow-scripts không bị suppress/đổi policy; tests/build exit code là bằng chứng, không chỉ log installing. Starlette/AnyIO deprecations vẫn known issue.
- Sau vá, snapshot chạy lại npm ci từ lockfile cuối: 0 npm vulnerabilities, **57 tests pass, 5,72s**, **production build pass 2m53s** với Vitest 4.1.12. Snapshot build trước vá dev-tool pass 3m02s; CSS/main/lazy Calendar giữ cùng hash với working-tree build. Không có thay đổi runtime dependency; không suy rộng npm audit sang toàn bộ backend. Thư mục validation giữ local trong .local ignored, không chứa .env/key/database; PostgreSQL đã khởi động phục vụ test được giữ running, không mở app/LAN/cloud.
- Các check này không đóng Render/Neon/HTTPS/physical-phone gate; không cấp URL deploy giả. Chưa triển khai cloud hoặc chia sẻ secrets. Chỉ các commit/source đã push được xác nhận qua remote Git; đây không phải online product release.

## Gợi ý giờ trống — user amendment 2026-10-22

### Phạm vi / source

- User yêu cầu “AI có chức năng Gợi ý giờ trống”, mở rộng hẹp so với scope không recommendation của redesign và optional gate Week 8. Đây là ngoại lệ được user yêu cầu, không kéo thêm Dashboard/notification/tự đặt lịch/đa ngày hoặc thay model/stack.
- `schemas/availability.py`, `services/availability_service.py`: partial/required criteria, duration strict integer 1–1439 phút, ngày/giờ business VN; backend dùng lại CRUD conflicts current-user, merge/clip blockers, chọn tối đa ba slot sớm nhất không chồng nhau. Hôm nay bỏ phần đã qua, ceil phút; has_more chỉ khi thật sự còn slot đủ dài.
- Chat Action/Groq wire schema/adapter/prompt + chat_service: action riêng suggest_free_slots, tách availability khỏi task fields/filters. Thiếu/mơ hồ/ngày qua/giờ đảo/thời lượng quá dài hỏi lại trong TTL; readonly cả khi execution=false. Không task_service.execute/row lock/write/giữ chỗ, không slot do model bịa; mỗi lần đọc lại DB. Tạo việc sau đó vẫn conflict service hiện hữu.
- chat_context giữ last_availability chỉ bốn tiêu chí, không slots/quyền tạo; reference riêng chỉ đọc, scoped user/TTL, không được gắn với task mutation. Thiếu/hết memory thì bỏ tiêu chí do AI chép và hỏi lại, không fallback user khác. Xóa task referent cũ sau gợi ý để không dùng khung giờ làm ID task; draft luôn JSON-safe khi sửa tiêu chí rồi hỏi tiếp.
- ChatView/styles: example chip chỉ điền input, thẻ ngày/thời lượng/khung giờ/slots/giờ VN, có none/more/elapsed states và ghi rõ chưa giữ chỗ. Không booking button, không refresh task khi mutated=false. Rút gọn phần lặp sau kiểm tra mobile; dùng token Sáng/Tối/responsive sẵn có. Không dependency/API endpoint/migration/.env mới.
- Tests mới test_availability.py, provider tests và bốn frontend tests; nlu_eval có suite availability opt-in. Spec/API/Architecture/AGENTS/UI/Plan Review/Roadmap/setup/README đồng bộ; [AVAILABILITY](AVAILABILITY.md) có cách dùng và 12 bước test thủ công.

### Checks / lỗi thực tế

- Baseline provider 46 pass, chat API 30 pass và frontend 53 pass. Sandbox chặn PostgreSQL và Vitest rename cache (29 setup errors/1 pass, 8 frontend suites chưa collect); chạy lại ngoài sandbox đúng database test/cache thông thường mới pass, không sửa/tắt tests hoặc reset database chính.
- Regression sau feature ban đầu 241 backend/57 frontend pass; sau bổ sung reference 245 pass, sau JSON-safe draft 246 pass, sau ưu tiên live draft **247 pass / 2 warnings Starlette/AnyIO, 113,01s**. Đây là tests PostgreSQL `_test` đã guard + provider mock, không quota AI. Provider tests trên prompt cuối 55 pass, 0,18s. Frontend sau rút gọn thẻ vẫn **57 pass, 8 files, 5,68s**.
- Thuật toán có 250 bộ khoảng bận ngẫu nhiên reproducible, so với minute-grid độc lập, ngoài boundary/overlap/touch/exact-fit/no-slot/cap. API kiểm tra read-only/versions, pending-only/all-day/completed/owner, follow-up/recovery/TTL/replay/pending guard, reference sai owner/hết hạn, JSON-safe draft, VN current-minute và conflict khi tạo sau gợi ý.
- Groq thật run đầu 5/6, run chỉ sửa prompt vẫn 5/6: câu dùng tiêu chí cũ bị HTTP400 structured_output_rejected. Diagnostic chỉ đọc metadata/kiểu output, không log raw body/key: model dùng reference string trong khi enum chưa hỗ trợ last_availability. Đã bổ sung reference đóng, chỉ đọc và backend resolve memory/owner/TTL; run v3 6/6, reported_model_matches=true. Không “sửa” bằng bỏ strict/fallback model/auto-retry.
- Browser phát hiện thêm câu đầy đủ trên chip bị model gán nhầm reference dù không có memory: backend hỏi lại an toàn, không tạo task. Đã làm rõ gate reference trong prompt và bổ sung đúng câu UI + assertion reference_is_empty vào suite cuối. Giữ nguyên các run trước; không lấy 6/6 v3 để che nhánh còn thiếu.
- Review raw output phát hiện continuation có draft vẫn bị model gán reference last_availability khi chưa có completed-search memory. Backend merge ưu tiên draft đã scoped/TTL thay vì bỏ thông tin user vừa nêu; thêm regression riêng. Browser thật trên bản cuối đã chạy chuỗi ngày mai → hỏi thiếu thời lượng/hai giờ → 90 phút/08–18 → availability đúng 23/10, ba slot 08–09:30 / 09:30–11 / 11–12:30; mutated=false, không có confirmation mới.
- Groq parser suite cuối **7/7**, mọi successful reported_model_matches=true, fingerprint `f54c0b375b41e786a3823b08c7c3e224d8ea373099b4de8a5b6ab210e1c54cc1`; gồm câu đủ, không dấu/trưa, thiếu tiêu chí, draft follow-up, last criteria, legacy create và đúng UI chip. Chỉ parse/guards; backend merge/execution policy kiểm tra bằng PostgreSQL tests và browser thật, không suy rộng thành hiểu mọi câu. Raw reports initial/v2/v3/final vẫn ở .local, metadata/failure trail công khai trong evidence không chứa key/body secrets.
- Build đầu feature pass 2m49s; **build cuối sau rút gọn mobile pass 5m22s**: CSS index-DE7SoFzz.css 26,23KB, main index-D2LMlo5a.js 233,79KB, lazy CalendarView-BIxxTNtL.js 337,81KB. Không dependency/chunk >500KB warning. Restart QA backend + reload browser để nghiệm thu đúng source/dist cuối.
- Browser cuối: Light/Dark giữ nguyên slots, không tạo task; desktop1366/mobile390/320/viewport thấp390x500 không tràn ngang (scrollWidth=clientWidth lần lượt1351/375/305/375). Mobile390x844 input bottom621,48 < nav top775,64; compact390x500 input bottom261,66 < nav top431,64. Không coi viewport resize là test bàn phím/Android/iOS thật. Console cuối warn/error=[]; DB read-only xác minh tài khoản QA có sẵn vẫn 0 task, không cần xóa task hay tạo account mới trong đợt này.
- compileall app/tests/script, pip check, document checker **27/0** và diff whitespace pass. Không package/dependency mới nên không tuyên bố chạy lại full advisory audit/remote CI. Bằng chứng: [JSON](evidence/availability-2026-10-22.json), [desktop tối](screenshots/availability-desktop-dark-2026-10-22.png), [mobile sáng](screenshots/availability-mobile-light-2026-10-22.png), [mobile tối](screenshots/availability-mobile-dark-2026-10-22.png).
- Teardown: đăng xuất tài khoản QA/clear RAM context, reset viewport/đóng tab test và dừng đúng Uvicorn QA đã tạo; PostgreSQL local có sẵn được giữ nguyên. Không xóa task/account của user. Dist cuối đã build; nhóm mở lại từ root bằng `scripts/dev.ps1 -StartLocalDatabase` (không cần -Build ngay, các lần sửa UI tiếp theo mới cần build lại).

### Giới hạn giữ nguyên

- Một ngày, khung giờ/thời lượng rõ ràng; không tự định nghĩa buổi sáng/giờ làm việc, không qua đêm/đa ngày/tự đặt/dời/“đặt khung đầu tiên”. Gợi ý là snapshot, không reservation. Không cam kết hiểu mọi cách nói; provider vẫn có thể 429/502/503, không tự retry mutation.
- Các gate Render/Neon/remote CI/HTTPS/thiết bị Android/iOS vật lý vẫn OPEN. Không deploy/commit/push, không sửa dữ liệu thật hoặc xóa tài khoản test tồn tại.

## UI redesign theo ZIP + Sáng/Tối — 2026-10-22

### Phạm vi được user yêu cầu

User đã chốt danh sách sẽ làm/không làm và yêu cầu triển khai: tham khảo bố cục/phong cách ZIP, giảm khoảng trống/khẩu hiệu/trang trí, giữ nghiệp vụ, thêm duy nhất preference Sáng/Tối ở lớp hiển thị. Đây là redesign được user phê duyệt trong phase Week 9/10, thay giới hạn không redesign của đợt 21/10; không đổi stack hoặc kéo optional vào MVP. Skill Sites được dùng theo nhánh local-only: chỉnh checkout React sẵn có, không tạo/publish Site hoặc thay hosting.

### Source/modules

- `frontend/src/styles.css`: thay các màu hardcode/overrides chồng nhau bằng token Light/Dark, responsive desktop/tablet/mobile, input 16px/vùng bấm chính 44px. FullCalendar/native controls/dialog dùng cùng palette, focus/reduced-motion vẫn giữ.
- `frontend/src/components/ThemeToggle.jsx`, `frontend/public/theme-init.js`, `frontend/index.html`: bootstrap cùng origin trước CSS/React; preference nhip-theme light/dark, system default, storage bị chặn vẫn dùng được, đồng bộ trong trang/giữa tab; meta theme-color/native color-scheme. Không API mới hoặc lưu JWT/task/chat vào storage.
- AuthScreen/Workspace: auth card gọn, tiêu đề ngắn, sidebar 232px/rail tablet/nav đáy mobile, theme trên Auth/topbar; bỏ slogan card/footer và cột trang trí.
- Modal/TaskForm/Icon: form chung thành panel phải trên desktop >=1180px khi mở, dialog trên màn nhỏ; native focus trap/Escape/dirty-close và delete/conflict modal giữ nguyên. Theme có ngay trong dialog, không mất bản nháp.
- TodoView/CalendarView/ChatView: thẻ task/metadata/ưu tiên rõ hơn, search/filter gọn, icon nhất quán; Calendar toolbar gọn, không đổi named timezone/adapter/selection. Chat toàn chiều ngang, hướng dẫn thu gọn, preview/confirmation/TTL vẫn giữ; compact mode theo visualViewport cho màn ngắn.
- Tests mới `frontend/src/test/theme.test.jsx` (7) và `theme-bootstrap.test.js` (5). Docs UI_DIRECTION/ARCHITECTURE/PLAN_REVIEW/01_SETUP/README/PROGRESS được đồng bộ.
- Không sửa backend implementation, DB schema/migrations, .env, provider/model/key, dependency/package-lock hoặc nghiệp vụ. Không thêm Google login/reset/30-day login/bell/stats/recommendation/voice/archive/CRUD category/drag-drop và các feature chỉ có trong mockup.

### Checks và lỗi đã xử lý

- Baseline frontend 41/41 pass (3,66s). Lượt trong sandbox lỗi EPERM rename cache trước khi collect tests; chạy lại ngoài sandbox pass, không đổi/tắt test.
- Sau redesign 47/47 pass; thêm bootstrap tests ban đầu lỗi test harness vì Vite đổi new URL(public asset) thành web URL; sửa cách đọc file test, không thay expected để che lỗi. 52/52 pass; sau compact chat regression: **53/53, 8 files, 4,60s**.
- Backend regression cùng phiên: **200 passed**, 2 warnings Starlette/AnyIO, 64,12s, PostgreSQL test riêng, không Groq thật. HTTP smoke **25/25**, live_ai=false, cleanup_errors=[]; auth/2-user isolation/category/conflict/reopen/CRUD/CSRF/SPA/logout thật.
- Build đầu pass 3m57s; build sau mobile fix pass 3m41s; **final compact-mode build pass 3m29s**: CSS25,56KB/main232,22KB/Calendar lazy337,81KB, không >500KB chunk warning. GET bootstrap/index ordering được kiểm tra trên production FastAPI. Không dùng kết quả build trước để nghiệm thu source đã sửa tiếp.
- Browser production + dev: auth/theme, lưu timed task 08:00–12:00 đúng Học tập, all-day/completed/long-title; theme giữ form/ngày/giờ; lọc ưu tiên, cancel-delete, complete/reopen, Todo/Calendar shared data; chat draft không gửi model, theme không mất draft. Calendar Month/Week/Day đã mở; chọn event mở shared form, Escape dirty-close/quay lại giữ draft rồi bỏ thay đổi không ghi DB. Reload giữ theme/session/task; logout về Auth, Register mobile giữ đúng ba fields thật, không có feature giả. Console QA cuối không warn/error; không suy rộng thành manual rerun mọi nhánh của app.
- Quan sát chat mobile ban đầu: composer dưới fold; đã thu gọn heading và chia chiều cao hội thoại. Viewport ngắn 390x500 vẫn bị nav che một phần, nên thêm compact visualViewport mode: giảm branding/header trùng, giữ input/decision và scroll. Kiểm tra lại input bottom 271,66 < nav top 431,64, không tràn ngang; không coi resize này là bàn phím iOS/Android thật.
- Viewports 320/390/768/1366 đã đối chiếu DOM width: scrollWidth == clientWidth cho các view đã thử, kể cả bộ lọc mở/Calendar/chat. Native scrollbar khiến clientWidth nhỏ hơn viewport ở vài view; không phải overflow. Mobile search input computed 16px.
- Production GET /theme-init.js trả JavaScript đúng, không SPA HTML; index nạp bootstrap trước assets. Cảnh báo Passlib metadata lúc startup là known issue của auth amendment, không phải lỗi UI; không che warning hoặc hạ dependency.
- Main pip check/compileall app pass; document checker 26/0 và diff whitespace pass (Git CRLF notices). Scan pattern key Groq trong src/public/dist không match; không coi pattern scan là chứng nhận secrets tuyệt đối. Không dependency mới nên không tuyên bố chạy lại full package advisory audit trong đợt này.
- Bằng chứng: [biên bản JSON](evidence/ui-redesign-2026-10-22.json), [Todo sáng](screenshots/redesign-todo-light-2026-10-22.png), [Todo tối](screenshots/redesign-todo-dark-2026-10-22.png), [Todo mobile](screenshots/redesign-todo-mobile-light-2026-10-22.png), [Calendar tối](screenshots/redesign-calendar-dark-2026-10-22.png), [Calendar mobile](screenshots/redesign-calendar-mobile-light-2026-10-22.png), [Chat viewport ngắn](screenshots/redesign-chat-compact-2026-10-22.png), [Register mobile](screenshots/redesign-auth-mobile-dark-2026-10-22.png). Các ảnh chỉ chứa dữ liệu synthetic; task QA đã dọn sau chụp, không kỳ vọng còn ba task đó khi mở lại.
- Teardown: đóng tab QA và reset viewport, dừng đúng các session Vite/Uvicorn đã tạo. Tool kết thúc cây launcher cũng dừng PG local; đã khởi động lại riêng cụm hiện có và xác minh SELECT 1/QA task count=0, không initdb/reset/migration mới. App không còn chạy; bản dist cuối đã có, mở lại bằng `scripts/dev.ps1 -StartLocalDatabase` từ root (không cần build lại ngay).

### Gate còn mở

- Android/iPhone, bàn phím/safe-area/browser/screen reader vật lý chưa có thiết bị để xác minh. Không tuyên bố pixel-perfect mọi browser hoặc đóng physical-device gate.
- Không gọi lại Groq thật trong đợt UI, không sửa khả năng hiểu/ngữ cảnh. Các kết quả NLU/execution 21/10 là evidence lịch sử, không bị thay bằng mock UI.
- Remote CI/Render/Neon/HTTPS/release SHA vẫn OPEN; không commit/push/publish hoặc mở LAN/firewall. Tài khoản synthetic được giữ vì MVP không có account-delete; task QA được dọn qua API scoped trước handoff, không reset dữ liệu user.

## Launcher compatibility fix — 2026-10-22

- User gặp 6 ParserError khi chạy `scripts/dev.ps1` trong Windows PowerShell 5.1. Đã tái hiện đúng 6 lỗi bằng parser 5.1: UTF-8 không BOM bị đọc theo ANSI, ký tự tiếng Việt thành dấu nháy/cú pháp sai. PowerShell 7 trước đó parse được nên kiểm thử ban đầu chưa bao phủ shell của user.
- Sửa riêng thông báo/comment launcher sang ASCII, giữ nguyên logic DB/migration/build/single-worker và các safety guards. `scripts/check_project.py` thêm kiểm tra ASCII để ngăn tái phát; `docs/01_SETUP.md` ghi nguyên nhân. Không đổi execution policy, dependency, key hoặc dữ liệu.
- Xác minh: parser Windows PowerShell 5.1.26100.9711 và PowerShell 7.6.5 đều 0 errors; chạy launcher thật qua 5.1 với port không hợp lệ đi đến đúng validation rồi dừng trước DB/app; document/config checker 26 files/0 errors; diff whitespace check pass. Không chạy lại full app/LLM trong hotfix này; người dùng chạy lại launcher để tiếp tục test thủ công.

## Đợt cải thiện toàn web + hội thoại — chốt local 2026-10-22

### Phạm vi / deviation được user yêu cầu

User yêu cầu triển khai các cải thiện sau audit, trong đó ngữ cảnh/ngôn ngữ tự nhiên bắt buộc. Đây là mở rộng hardening Week 9/10, không thay stack/model/ownership/confirmation, không đổi sang production-scale. File audit cũ không bị viết lại thành “đã sửa hết”; bảng theo dõi mới chứa đủ 107 ID và các gate thực tế.

### Source/modules thay đổi

- Backend: HTTP safety/rate limit/body cap/deadline/security/cache/request ID; DB connect/statement/lock/pool timeout; validation Origin/secret, dummy bcrypt/hash hỏng; response schemas/OpenAPI.
- Task REST: expected_version cho PUT/status/DELETE, service dùng cùng lock/transaction, không migration/schema DB mới. Optional để giữ API cũ; UI mới luôn gửi version.
- Chat: memory bounded scoped user/TTL 600s, 6 bản ghi lượt nói/400 ký tự và 12 recent task IDs, re-read owner; selector all_day/giờ, exact/no-accent title resolution, không fallback whole DB cho reference expired. Prompt, normalize ngày/giờ rõ ràng, câu tiếp nối/ordinal, phản hồi grounded/no-op/diff. GET context read-only recover/cancel pending, không tái tạo/replay.
- Frontend: deadline bao JSON, auth epoch, category cache riêng, giữ same-query snapshot/view-state, refresh khi resume, ngày VN đổi; URL/deep links; ErrorBoundary. Form dirty/fieldset/error focus/status rejection; mobile 16px/44px/contrast/sticky/filter/calendar Day/keyboard-aware chat/safe area; Chat failed state/bounded messages/scroll/TTL/detail/diff/IME/retry-after.
- Tooling: scripts/dev.ps1, backup_check.py, nlu_eval.py, check_project.py; smoke mặc định không gọi Groq, cleanup bảo đảm; acceptance cleanup/metadata; tách requirements-dev và constraints không còn dùng; CI compile/docs/schema/a11y tests. Không thêm dependency lớn hoặc upgrade runtime.

### Kết quả cuối bản cải thiện

- Backend: **170 passed**, 2 dependency deprecation warnings, 56,32s trên venv cài mới, PostgreSQL test database riêng. Frontend: **41 passed / 6 files**, 4,26s; production build Vite 6.4.4 pass 3m50s, main JS 230,70KB / Calendar lazy 337,76KB. Không dùng số baseline 120/24 để nghiệm thu bản mới.
- Provider unit: **46 passed** khi TEST_DATABASE_URL trỏ port không truy cập được; integration vẫn dùng PostgreSQL thật. Alembic `0002_tasks_categories (head)`, check không có upgrade mới.
- HTTP smoke: **25 checks**, `live_ai=false`, `cleanup_errors=[]`. Real Groq execution: **23 checks / 14 calls pass**, [evidence](evidence/ai-improvements-execution-2026-10-21.json); có category-only follow-up, all-day selector, isolation/confirmation/conflict/replay. HTTP endpoint không attest model; NLU trực tiếp mới kiểm tra reported model.
- NLU regression: [39/40](evidence/nlu-regression-v2-2026-10-21.json), holdout cách nói bổ sung [12/12](evidence/nlu-holdout-2026-10-21.json), đúng reported model `openai/gpt-oss-20b`. Một all-day selector dao động được harden bằng guard backend và nghiệm thu execution thật sau đó; **không có full rerun 40/40**, không tuyên bố model hiểu mọi câu. Điểm là pipeline parser + guard, không riêng model.
- Browser: login/create/complete/reopen; Calendar Day và Enter mở form, dirty-close giữ draft/focus; Todo preset; chat hiểu 08:00–12:00 là trưa và gọi đúng conflict. Hai tab cùng user: recover pending, cancel ở tab thứ hai, confirm cũ trả CONTEXT_EXPIRED, không mutation. Không chứng minh nhiều tài khoản đồng thời trong một browser profile (cookie dùng chung).
- Viewport 320/390/768/1366 không horizontal overflow; input mobile 16px, nút chính 44px. [Todo mobile](screenshots/improved-todo-mobile-final-2026-10-21.jpg), [desktop](screenshots/improved-todo-desktop-final-2026-10-21.jpg), [chat đúng giờ trưa](screenshots/improved-chat-noon-2026-10-21.jpg). Đây không phải chứng nhận Android/iPhone vật lý.
- Fresh npm ci / pip install / pip check pass; npm audit 0, pip-audit không known vulnerabilities tại scan sau vá bootstrap pip/setuptools riêng. Compileall, doc/link/evidence checker và Git diff whitespace check pass; key scan Git-visible text không phát hiện key, `.env` ignored. Không suppress hai warning hoặc upgrade app stack hàng loạt.
- Đối chiếu đủ **87 Local / 14 Một phần / 5 Bên ngoài / 1 Hoãn = 107**. PWA hoãn có chủ đích; chưa đóng online/device/release gates.
- Chốt lại ngày 22/10, không đổi source: `/ready` thành công; HTTP smoke 25/25 không AI, doc check 26 files/0 errors, compileall/pip check/diff check pass. Browser login lại sau expiry; một Groq request synthetic thiếu ngày hỏi lại đúng, hủy draft trả thông báo thật, reload/recover không còn draft, Todo không có task ngoài ý muốn. Calendar tab mới hiện task và console không warn/error. [Biên bản cuối](evidence/local-handoff-2026-10-22.json), [mobile bản cuối](screenshots/improved-todo-mobile-final-2026-10-22.jpg), [hủy draft](screenshots/improved-chat-cancel-draft-2026-10-22.jpg). Test tasks của smoke được dọn, synthetic accounts giữ lại; không reset dữ liệu user.

### Checkpoints lịch sử trong đợt (đã được kết quả cuối phía trên thay thế)

- Baseline đầu đợt: 120 backend passed / 24 frontend passed.
- Frontend mới: 38 passed / 6 files; production build pass, Calendar vẫn lazy split. Browser phát hiện range=null ở Calendar; đã sửa và bổ sung test render Calendar thật (không chỉ adapter).
- Backend venv cài mới tại checkpoint: 157 passed, 2 dependency warnings; sau đó đã rerun kết quả cuối phía trên. Provider unit 46 passed khi TEST_DATABASE_URL trỏ port không truy cập được, chứng minh unit không bị kéo vào PG.
- Checkpoint tiếp: 164 passed trên venv mới; npm ci ->38 tests pass ->build pass 2m45s. Audit venv bootstrap phát hiện pip24/setuptools65.5 cũ; vá riêng pip26.2.1/setuptools83.0.0 (cùng baseline venv chính), pip check và pip-audit sau vá pass. Đã cập nhật setup/CI; không nâng app dependencies hàng loạt.
- HTTP smoke mới: 25 checks pass, live_ai=false, không POST chat, cleanup_errors=[]; synthetic accounts giữ lại, chỉ task của run được xóa.
- Backup/restore local pass: dump .local/backups/todo-20261021T120607Z-707265.dump; phục hồi vào todo_restore_7492a8d7656a_test rồi xóa đúng database thử. users/categories/tasks count khớp; không reset/restore DB chính. Dump chứa dữ liệu riêng, ignored, không commit/upload.
- NLU real initial: 36/40, giữ [report lỗi](evidence/nlu-initial-2026-10-21.json). Run tiếp [nlu-final](evidence/nlu-final-2026-10-21.json): 37/40 theo grader cũ; một failure thực ra là date_from=date_to tương đương task_date. Sửa grader để chấm ý nghĩa, không sửa expected để che lỗi. Ordinal và unsupported-topic được harden; kết quả full regression v2 + cách nói bổ sung ghi phía trên.
- Browser synthetic mobile390: register/login, create QA Học bài 22/10 08–12 Học tập qua shared form, UI notice sau commit; width==scrollWidth, input16px, check44x44; Calendar Day render từ00:00 sau sửa. Đây là viewport, không điện thoại thật.

### Gate còn mở

- Model có tính biến thiên: semantic eval là đo trong phạm vi được hỗ trợ, không bảo đảm mọi câu. Không tăng điểm bằng mock hoặc đổi model/fallback.
- Không có Android/iOS/screen reader vật lý được kết nối; keyboard/safe-area/touch cần nhóm thử thật.
- Không có Render/Neon account/URL hoặc release SHA/remote CI. Không commit/push/deploy/mở firewall/LAN trong phiên này.
- Key đã lộ vẫn theo ủy quyền dùng tạm; cần chủ key rotate trước public. Không đưa vào source/frontend/log/report.

## Auth amendment — Passlib + bcrypt, 2026-10-22

### Thay đổi và tương thích

- User yêu cầu thêm Passlib; đã chuyển hash/verify password thông thường sang `CryptContext`, pin Passlib 1.7.4 và giữ bcrypt 4.3.0. Hash mới `$2b$`, cost 12, salt ngẫu nhiên; bật truncate_error và kiểm tra giới hạn 72 byte cả ở helper. Không trim/cắt/pre-hash input.
- Tài khoản/hash bcrypt cũ vẫn login; không auto-rehash, không migration/reset database hoặc yêu cầu đổi password. JWT, cookie, CSRF, REST contract, model/chat context và UI giữ nguyên.
- Passlib không nhận NUL nhưng API/bcrypt cũ từng nhận. Chỉ trường hợp chứa NUL giữ trực tiếp pyca/bcrypt cùng cost 12; test xác nhận không strip/truncate và hash cũ còn dùng được. Không đổi schema validation để làm mất tương thích.
- Files source: `backend/app/core/security.py`, `backend/requirements.txt`, `backend/requirements.lock.txt`, `backend/tests/test_passwords.py` (30 cases mới). Docs: AGENTS/README/PROJECT_SPEC/ARCHITECTURE/DATABASE/01_SETUP/PLAN_REVIEW/PROGRESS và [evidence](evidence/passlib-bcrypt-2026-10-22.json).
- Đã cài Passlib vào backend/.venv hiện có và venv verification riêng. Giữ toàn bộ phiên bản dependency khác, không nâng pip/framework. Người đang chạy server cần restart để nạp source/dependency mới; không cần frontend build cho thay đổi này.

### Checks đã chạy

- Compatibility unit trong venv verification: **26 passed, 4 deselected**, 7,66s; không cần database. Hash mới verify được bằng bcrypt trực tiếp, hash cũ verify được bằng Passlib; Unicode/khoảng trắng/72 byte/hash hỏng/NUL đều được kiểm tra.
- Backend regression trên backend/.venv: **200 passed, 2 dependency deprecation warnings, 53,56s**. Dùng PostgreSQL thật với database test riêng đã qua guard; có API login hash cũ/giữ nguyên hash trong DB, /me/logout/register, ownership/task/conflict/chat/TTL/migrations. Không gọi Groq thật, không tiêu quota AI.
- Lượt baseline auth đầu tiên lỗi kết nối vì cụm PostgreSQL local đang tắt: 12 setup errors/1 passed; đây không phải kết quả pass. Đã khởi động lại đúng cụm .local/pgdata loopback55432, rồi regression trên chạy pass; không initdb hoặc reset database ứng dụng. Fixture chỉ reset schema trong database test.
- Main và verification `pip check`: no broken requirements. `pip install -r backend/requirements-dev.txt --dry-run`: tất cả pins/extras đã được thỏa mãn trong main venv; không coi dry-run là fresh environment install.
- pip-audit targeted `passlib==1.7.4` và `bcrypt==4.3.0` (`--no-deps --disable-pip`, venv audit riêng): no known vulnerabilities tại thời điểm scan. Không phải audit toàn bộ dependencies mới trong lần này, không bảo đảm advisory tương lai.
- Compileall app/tests pass; checker **26 documents/0 errors**; `git diff --check` pass (chỉ Git CRLF notices). Không sửa frontend nên không rerun frontend build/tests; số 41 frontend phía trên là evidence 21/10.

### Known issues / deviation

- Passlib 1.7.4 log `(trapped) error reading bcrypt version` khi init pyca/bcrypt 4.3.0 vì metadata `__about__` không còn. Đã tái hiện và xác nhận exception bị thư viện bắt; hash/verify tiếp tục pass. Không suppress/monkeypatch/hạ bcrypt để che log. Warning log này độc lập với hai pytest deprecation warnings Starlette/AnyIO đang có từ trước. [Upstream issue](https://github.com/pyca/bcrypt/issues/684).
- Passlib stable đã cũ; chỉ xác nhận Python 3.11 và cặp pin trên, không tuyên bố mọi Python/bcrypt tương lai tương thích. Nâng dependency cần test lại. Không thêm thuật toán/refresh tokens/luồng rehash vì ngoài yêu cầu.
- Đây là amendment auth theo user, thay quyết định bcrypt trực tiếp trước đó; không mở feature tuần sau. Remote CI/Linux/Render/Neon/HTTPS/device gates vẫn OPEN, chưa có deploy mới/commit/push.

## 2. Technology decisions

- React/Vite JavaScript, FullCalendar 6.1.19 + Luxon; Python 3.11/FastAPI/Uvicorn.
- PostgreSQL; SQLAlchemy 2 + Alembic + psycopg, migrations 0001_users -> 0002_tasks_categories.
- JWT HttpOnly cookie + Passlib 1.7.4/bcrypt 4.3.0 (user amendment 22/10), /auth/me, Origin/header/JSON guard; không refresh token.
- Groq strict Structured Output qua HTTPX đã có; bỏ Google SDK, không Function Calling/fallback.
- Context RAM user-scoped TTL 600 giây, một worker/instance; không chat history database.
- Category 3 defaults/user, GET only; conflict pending timed-only, kiểm tra lại khi reopen/confirm.
- Render Web Service same-origin + Neon TLS vẫn giữ; chưa có account/platform evidence.

## 3. Weekly progress

| Tuần | Phạm vi | Trạng thái hiện tại |
|---|---|---|
| WEEK_01 | Planning | COMPLETED; provider amendment ngày 21/10 |
| WEEK_02 | Auth/Foundation/feasibility | LOCAL VERIFIED; Groq account/model thật PASS, Render/Neon account OPEN |
| WEEK_03 | Task API/Categories/Conflict | LOCAL VERIFIED; migrations/isolation/transactions/concurrency |
| WEEK_04 | Todo | LOCAL VERIFIED; shared service/forms/refresh và browser baseline |
| WEEK_05 | Calendar/Deploy rehearsal | LOCAL VERIFIED; task AI hiện đúng trên Calendar; online rehearsal OPEN |
| WEEK_06 | AI foundation/dry-run | REAL GROQ parser/dry-run kiểm tra; xem các run/issue trong evidence và handoff; ONLINE OPEN |
| WEEK_07 | Five actions/confirmation | REAL GROQ EXECUTION PASS: 20 extended checks/12 calls; online OPEN |
| WEEK_08 | Integration/hardening | LOCAL REAL CHAT -> TODO/CALENDAR VERIFIED; online MVP OPEN, optional không làm |
| WEEK_09 | Regression | Auth + UI amendments 22/10: 200 backend +53 frontend/build PASS; HTTP25/25; remote CI/HTTPS OPEN |
| WEEK_10 | Release/docs/demo | LOCAL HANDOFF READY; official online release/rubric OPEN |

## Session hiện tại — 2026-10-21

### Thay đổi

- ai_provider.py: Groq fixed HTTPS endpoint, strict JSON Schema, sparse name/value wire arrays giữ absent-vs-null; normalize về Action/TaskDelta, full backend validation, không DB/network retry/redirect/tools.
- Settings SecretStr, GROQ_MODEL, AI_MAX_COMPLETION_TOKENS; cập nhật .env.example/render.yaml và .env local theo ủy quyền.
- Bỏ google-genai/google-auth requirements; giữ HTTPX hiện có. Không đổi public API/schema DB hoặc thêm dependency lớn.
- Sửa chat merge khi chuyển target không reuse ID/fields task cũ; tests mới bảo vệ user data.
- Provider tests chuyển HTTPX MockTransport, test malformed/duplicate/null/strict output, auth/quota/timeout/redirect/refusal/finish_reason/errors và key masking; pytest tự vô hiệu key thật.
- Frontend thêm ba cases 429/502/503 giữ input/dữ liệu, không retry hoặc fake refresh.
- scripts/smoke.py giãn cách calls; thêm scripts/ai_acceptance.py cho real execution/dry-run, cleanup scoped synthetic accounts, báo cáo không secrets và không overwrite.
- CI explicit key rỗng + pip check/Bash syntax; Vite vá 6.4.4, certifi vá 2026.10.19 theo advisory mới, không upgrade hàng loạt.
- Đồng bộ current AGENTS/spec/architecture/setup/roadmap/week plans; thêm RELEASE_HANDOFF và evidence real. Các chứng cứ cũ được giữ theo ngày.

### Checks thực sự chạy

- Backend full pytest cuối: **120 passed, 2 warnings**, 51.33s; PostgreSQL todo_app_test riêng. Không gọi Groq trong pytest.
- Frontend: **24 passed**, 5 files; npm ci pass; Vite 6.4.4 build pass 4m04s, main217.50KB/Calendar335.86KB.
- pip install locked requirements, pip check, alembic check pass; migration không cần thay schema.
- npm audit 0 vulnerabilities; pip-audit no known vulnerabilities sau vá certifi. Đây là scan tại thời điểm chạy.
- Real Groq key/model authentication: thành công; scripts/smoke.py --live-ai **35 checks pass**, chạy lại trên backend bản cuối sau restart vẫn 35 PASS; evidence/smoke-final-2026-10-21.json.
- Extended real-AI execution **20 checks/12 calls pass**: năm actions, preserve delta, missing date/follow-up, ambiguity whitelist, delete cancel/confirm/replay, conflict cancel/new blocker/reconfirm/override, A/B isolation/unsupported.
- Real dry-run ban đầu 10 checks rồi fail kỳ vọng bulk unsupported (không mutation); sửa policy -> run tiếp **12 checks/6 calls pass**. Run cuối bổ sung category-only follow-up: **14 checks/8 calls PASS**, không mutation, giữ đúng create intent/title/07–12/category. Cả failure và reruns lưu docs/evidence, không che kết quả trước.
- Browser Chat tạo Học React ngày mai08–10; Todo/Calendar hiển thị 22/10/2026, đúng Học tập; reload sau restart cuối giữ phiên/data; console tab verification không warn/error. Ảnh groq-calendar-2026-10-21.jpg và groq-todo-2026-10-21.jpg. Không gọi đó là online deployment.
- Hygiene cuối: 24 Markdown files/77 local links/13 JSON examples pass; evidence JSON parse pass; Git diff --check pass, không high-confidence key pattern trong files Git-visible. Bash build/start syntax pass sau escalation vì MSYS bị sandbox chặn; không deploy Linux bằng check syntax.

### Issues/deviations/gates

- User cho phép đi hết phase liên tiếp và đổi provider/model; nguyên tắc AI không DB/ambiguity/confirmation/CSRF/conflict giữ nguyên.
- Real model có thể hiểu sai: activity phrase ban đầu thiếu title; bổ sung policy/ví dụ rồi real relative-date-duration pass. Bulk ban đầu hỏi lại thay unsupported; policy sửa và real rerun pass. Category-only follow-up từng đổi nhầm intent; policy + acceptance mới xác minh đã giữ đúng create intent trong run cuối 14 checks pass.
- Hai deprecation warnings HTTPX TestClient/AnyIO còn, không assertion fail hoặc tắt warning. Npm có warning transitive deprecated/install-script approval; ci/test/build thật đều pass, không đổi policy máy.
- Không có Render/Neon kết nối xác nhận, API credentials hoặc CLI auth cloud; gợi ý tích hợp không phải deploy. Không tự tạo account/gói paid.
- Remote CI chưa chạy; chưa commit/push/release SHA/URL, cần group review candidate của working tree có sẵn. Không tự push main.
- Rubric/deadline chưa cung cấp. Optional chỉ sau online MVP gate nên không triển khai.
- .env/DB/venv/build/.local reports ignored; tài khoản synthetic scripts giữ lại, tasks của chúng cleanup; task UI demo giữ lại, không reset database.

---

## 4. Latest handoff — plan review 2026-10-02

### Completed — documentation only

- Đọc toàn bộ project plan và đối chiếu source/config/dependencies hiện có.
- Giữ Authentication trước Task CRUD; giữ core MVP/stack và roadmap 10 tuần.
- Bổ sung me/categories/date-range endpoints, input/output/error/PUT/status contract.
- Làm rõ all-day/timed, timezone, category defaults, ownership và conflict/reopen transaction.
- Bổ sung ngữ cảnh chat/confirmation/version/replay/expiry và giới hạn RAM/single worker.
- Đơn giản hóa deploy same-origin và optional; đưa tests/feasibility/rehearsal vào checkpoint sớm.
- Đồng bộ từng tuần với prerequisites/tasks/acceptance/DoD/do-not-implement.
- Thêm audit log và rủi ro ngoài repo trong [PLAN_REVIEW](PLAN_REVIEW.md).

### Files / modules changed

Chỉ Markdown:

- AGENTS.md, README.md.
- docs/PROJECT_SPEC.md, ARCHITECTURE.md, DATABASE.md, API_SPEC.md, UI_DIRECTION.md.
- docs/01_SETUP.md, ROADMAP.md, PROGRESS.md; thêm docs/PLAN_REVIEW.md.
- docs/weeks/WEEK_01.md tới WEEK_10.md.

Không sửa source backend/frontend, requirements, .env.example, Docker/config; không chạy install/migration/seed hoặc thao tác tài khoản/dữ liệu ngoài.

### Checks / tests run

- Đọc và đối chiếu scope/stack/ownership/route/field/time/conflict/chat/deploy giữa tất cả tài liệu.
- Git diff --check: pass, không whitespace/conflict-marker errors.
- Kiểm tra 21 file Markdown, 45 local links tồn tại, code fences cân bằng, 12 JSON examples parse được: pass.
- Kiểm tra đủ prerequisites/Objective/DoD/scope boundary ở 10 tuần; không checklist implementation nào bị đánh dấu completed: pass.
- Git diff chỉ gồm 20 file Markdown sửa và 1 file Markdown mới; không source/config/dependency changes: pass.
- Rà references kế hoạch cũ/TBD/Express và thứ tự tuần để loại mismatch còn sót.

Không chạy application/pytest/frontend build/migration/LLM/deploy tests: code vẫn là skeleton và chưa có test harness thực tế. Các check tài liệu không chứng minh MVP hoạt động.

### Known issues / gates còn mở

- backend/main.py và phần lớn modules rỗng; backend/tests/test.py chỉ print Hello world.
- Frontend chưa có React package.json/test/build scripts; Alembic và CI chưa được tạo.
- Dependencies chưa pin; .env.example chưa có TEST_DATABASE_URL/COOKIE_SECURE/model/timeout settings. Bổ sung cùng implementation đúng tuần.
- Dockerfile/docker-compose placeholders chưa runnable; Docker không bắt buộc.
- Account access gemini-2.5-flash chưa kiểm chứng. Google có giới hạn access dòng 2.5; xem nguồn trong PLAN_REVIEW.
- Tài khoản/gói Render/Neon, deadline/rubric và phân công nhóm chưa được xác minh.
- Không được đánh dấu các gate trên pass bằng mock hoặc chỉ đọc tài liệu.

### Deviations / plan refinements

- Deploy frontend/backend chung Render Web Service thay hai service để tránh cookie cross-site.
- Chọn một Structured Output flow thay “Structured Output / Function Calling” song song.
- Không lưu chat history nhưng có ngữ cảnh tạm backend để đáp ứng hỏi tiếp/xác nhận.
- Test/CI từ Week 2; rehearsal Week 5; Week 8 MVP hardening trước optional.
- Category giản lược default read-only; conflict chỉ pending, bổ sung reopen/concurrency.
- Đây là thay đổi kế hoạch do yêu cầu review của user, chưa là feature implementation.

## 5. Handoff template cho tuần implementation

Mỗi lần cập nhật ghi:

- Tuần/mục tiêu và prerequisite đã kiểm tra.
- Đã thực hiện, files/modules/migration IDs thay đổi.
- Exact commands/checks và pass/fail; manual/provider/online smoke riêng.
- Known issues, mức ảnh hưởng và gate chưa đạt.
- Deviation so với plan và lý do.
- Next action; không invent release commit/URL hoặc tuyên bố completed khi DoD chưa đạt.

## 6. Implementation session — 2026-10-05

User yêu cầu triển khai toàn bộ roadmap trong session, tự quyết routine implementation. Đây là authorization đi qua các phase liên tiếp; gate online/provider thiếu vẫn phải ghi thiếu, không tự đổi stack/model.

### Week 2 checkpoint

- Python 3.11.9, Node 24.19.0/npm 11.17.0, PostgreSQL 18 có sẵn. Tạo cluster riêng `.local/pgdata`, port 55432, bind 127.0.0.1; database `todo_app` và `todo_app_test`. Không thao tác database/service PostgreSQL khác.
- Thêm FastAPI settings/session/errors/CSRF/auth/JWT/bcrypt, migration `0001_users`, React auth shell/API client, pytest/Vitest và CI.
- Settings đọc `.env` root; local `.env` ignored; secrets không đưa vào source/build. Reject placeholder secret. Không tạo schema bằng create_all.
- Commands: backend `.venv/Scripts/python.exe -m alembic upgrade head` pass; `.venv/Scripts/python.exe -m pytest --tb=short`: **9 passed** trên PostgreSQL test riêng. Frontend `npm test -- --run`: **2 passed**; build đang kiểm tra.
- Sandbox chặn network/localhost nên dependency install và PostgreSQL tests được chạy sau escalation. Không thay PostgreSQL bằng SQLite.
- `npm audit` phát hiện Vite/Vitest baseline có advisory; pin bản đã vá và kiểm tra compatibility lại trước kết luận final.
- Gemini key/Render/Neon account không có trong môi trường/project. Không có smoke provider hoặc online. Google docs xác nhận baseline 2.5 Flash chưa deprecated nhưng access có giới hạn: https://ai.google.dev/gemini-api/docs/deprecations .
- Next: Categories/Tasks migration + shared service + conflict row-lock tests.

### Week 3 checkpoint

- Migration `0002_tasks_categories`: FK/CHECK/indexes/backfill defaults; registration tạo defaults cùng transaction.
- CRUD/categories/query/filter/full PUT/status, strict date/time/extras, ownership, pending conflict/reopen/override.
- `task_service.execute` là đường mutation chung, khóa hàng User và check/write chung transaction; test hai thread/database sessions xác nhận [201, 409].
- Test lần đầu: 32 pass/1 fail do timestamp database session +07:00 và value mới UTC serialize khác biểu diễn; sửa normalize timestamps/version về UTC (cùng instant).
- Frontend auth sau vá dependency: 2 tests pass; baseline build pass. Vite 6.4.3/Vitest 4.1.11 tương thích Node 24.19.0; npm install audit 0 vulnerabilities.
- Tiếp tục Todo/shared refresh/forms rồi Calendar, theo yêu cầu tất cả phase; online rehearsal vẫn chưa thể chạy khi không có Render/Neon credentials.

### Week 4–5 checkpoint

- Todo/shared TaskProvider/API mutation/refetch, TaskForm/native modal, search debounce/cancel stale requests, presets/filter/category, delete/conflict/reopen flows, responsive tiếng Việt.
- FullCalendar 6.1.19 packages pinned đồng bộ, Luxon 3.7.2 + @fullcalendar/luxon3 adapter. Đọc chính source package 6.1.19 xác nhận named timezone implementation vì online docs đã chuyển v7.
- Task events có +07:00; cả ngày date-only; range end-exclusive -> inclusive; selection reject nhiều ngày/qua đêm, shared form. Calendar lazy-load để tách bundle.
- Frontend checkpoint: `npm test -- --run`: **12 passed**; `npm run build`: pass (trước lazy split có warning >500KB, xử lý split ở Week 8).
- Backend checkpoint: **33 passed**, sau thêm static/chat **54 passed**. Static/deep-link/reserved API JSON 404 test đã có.
- Render blueprint + build/start scripts, root Node/Python pins; startup Alembic trước Uvicorn single worker. Chưa execute trên Render/Neon, chưa có URL online.

### Week 6–7 checkpoint

- google-genai 1.26.0 Structured Output; timeout 20s/retry attempts 1, schema backend strict. Provider schema loại exclusiveMinimum/exclusiveMaximum SDK chưa support, backend vẫn enforce.
- Parser/draft follow-up/context RAM keyed user, TTL 600s, một flow/user, không DB history; ref-counted per-user lock, cleanup abandoned contexts.
- Dry-run flag `CHAT_EXECUTION_ENABLED=false`: create/update/delete/complete tested không thay records/updated_at. Final execution flag true.
- 5 action dùng task_service; update delta giữ field absent, delete backend-owned preview; conflict versions recheck trong transaction; consume pending sau confirm/cancel, double confirm [200,409].
- Chat UI choices, confirm/cancel, pending khóa input, context-expired clear, result.mutated refresh chung, giữ message/context khi đổi navigation trong cùng phiên.
- Tests checkpoint sau serialization HH:MM sửa: backend **54 passed**; frontend chat added -> **14 passed**.
- Các assertions dùng mock provider/SDK transport offline; chưa chứng minh Gemini thật khả dụng. Không thay model/provider hoặc thêm Function Calling.


### Week 8–10 final local checkpoint

**Kết quả:** core local đã triển khai và verify; local handoff sẵn sàng, không phải official online release. Không tuyên bố 10 tuần DoD đầy đủ khi các gate có credentials chưa được chạy.

#### Files / modules cuối

- Backend: main/app factory, settings/DB/errors/security, auth/task/chat/static routers, SQLAlchemy models, strict schemas, scoped CRUD, auth/task/chat services, RAM context/locks, Gemini Structured Output provider.
- Alembic config + 0001_users/0002_tasks_categories; backfill defaults idempotent; requirements.txt + requirements.lock.txt constraints.
- Backend tests: auth/ownership/category/task/filter/validation/conflict/transactions/concurrency/chat/TTL/confirmation/SDK/errors/static/migrations.
- React: auth/App, shared TaskProvider/TaskForm/TaskDialogs, TodoView, FullCalendar/Luxon adapter, ChatView, Modal/Icon, dates/client, responsive CSS; 5 Vitest files.
- Config/tooling: Vite/package-lock/runtime pins/.env.example/.gitignore, GitHub CI, render.yaml, scripts/build.sh/start.sh/smoke.py.
- Handoff: README, docs/01_SETUP.md, ACCEPTANCE.md, DEMO.md, week2–10 checkpoint/checklists, API_SPEC database-error code, screenshots.
- Bỏ các Dockerfiles/compose/API/schema placeholders rỗng và print Hello world; không xóa dữ liệu chức năng. Không revert các documentation changes ban đầu, không git reset/commit/push.

#### Exact checks và kết quả

| Check | Kết quả |
|---|---|
| backend .venv/Scripts/python.exe -m pytest -o addopts='' --tb=short -q | **82 passed**, 2 dependency deprecation warnings, 64.58s |
| backend -m alembic upgrade head | Pass trên development riêng, không reset data |
| backend -m alembic check | No new upgrade operations detected |
| backend -m pip check | No broken requirements found |
| root backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt | Locked constraints install verified |
| frontend npm test -- --run | **21 passed**, 5 files |
| frontend npm run build | Responsive-fix build pass 4m31s; lockfile reinstall rebuild pass 6m; CSS19.21KB/main217.50KB/Calendar335.86KB, không >500KB warning |
| frontend npm audit | 0 vulnerabilities tại thời điểm scan |
| root .local/audit-env/Scripts/python.exe -m pip_audit --path backend/.venv/Lib/site-packages --format columns | No known vulnerabilities found |
| root backend/.venv/Scripts/python.exe scripts/smoke.py | **26 live HTTP assertions**, two users, PostgreSQL, live_ai=false |
| Browser local/Vite + production same-origin FastAPI | Auth/reload/logout/A-B isolation, all-day/timed, complete/reopen/shared refresh, cancel-delete, Month/Week/Day/selection/Escape, AI-unavailable, desktop/mobile PASS |
| Restart own Uvicorn + reload | Tasks giữ PostgreSQL, cookie tiếp tục; không reset cluster/database |
| Production browser console | Không error/warning sau load task/Calendar lazy asset |
| frontend npm ci -> npm test -- --run -> npm run build | Install từ lock thành công, 21 tests pass, rebuild pass 6m, cùng asset hashes với bản trước |
| Settings fail-fast smoke | 4 checks pass: secret placeholder, SQLite driver, Secure với HTTP origin, wildcard origin đều bị từ chối |
| Git Bash -n scripts/build.sh scripts/start.sh | Syntax pass; chưa thực thi build/deploy Linux |
| Markdown/Git/secrets hygiene | 23 Markdown files, không broken local links/fence lỗi; git diff --check pass; .env/DB/build/venv/node_modules ignored; high-confidence key scan không match |

Local demo: PostgreSQL loopback55432 (.local/pgdata), Uvicorn127.0.0.1:8000 one worker, Vite127.0.0.1:5173. Cần chạy lại theo setup sau khi processes/máy dừng. Cluster trust chỉ development, không expose public.

Tài khoản demo-local@example.com có hai synthetic tasks, demo-user-b@example.com rỗng; password không ghi source/docs. Smoke synthetic accounts giữ lại (MVP không account-delete), chỉ tasks của run được xóa. PostgreSQL test reset chỉ database tên todo_app_test đã kiểm tra.

Screenshots: docs/screenshots/todo-desktop.jpg, todo-mobile.jpg, calendar-desktop.jpg (production same-origin), calendar-mobile.jpg. Viewport test390x844 cho content375px có scrollbar; document.scrollWidth == clientWidth sau fix Todo/Calendar/Chat. Không claim kiểm tra mọi thiết bị/browser vật lý.

#### Issues đã phát hiện và xử lý

- Timestamp +07 vs UTC representation: normalize system timestamp/version về UTC, không đổi business task date/time sang UTC.
- HH:MM serialization: không lưu HH:MM:SS vào pending payload khiến confirmation validate fail.
- Gemini SDK1.26 subset: omit unsupported provider schema keywords, full backend schema vẫn validate; close sync transport per request, actual SDK serialization được test offline.
- Follow-up đổi intent không kế thừa task/fields draft cũ; pending preview update hiển thị fields thay đổi.
- Per-user scheduling transaction/row lock; no transaction trong provider wait; concurrent scheduling/confirmation tests.
- Stale task/category responses/401/user switch; category reload thành công clear error cũ.
- Calendar timezone adapter đúng pinned v6 và lazy split; tránh áp dụng docs v7 sai baseline.
- Mobile task cards tràn ngang5px: min-width0/width100%, kiểm tra lại document width.
- Error SQLAlchemy ->503 DATABASE_UNAVAILABLE không trả SQL/parameters/connection strings.
- Advisory dependency scan: vá chọn lọc FastAPI/Starlette/PyJWT/python-dotenv/pytest, Vite/Vitest và pip/setuptools môi trường; không đổi model/framework hoặc thêm dependency lớn.
- Regression Secure-cookie test ban đầu thất bại do HTTP TestClient đúng policy không gửi Secure cookie; sửa test mô phỏng authenticated HTTPS delivery. Không tắt Secure flag.
- RTL network-form test ban đầu match hai alerts (background + dialog mock không inert); scope assert vào dialog, không bỏ negative-path test.
- npm ci lần đầu EPERM vì Vite/esbuild của session đang giữ esbuild.exe trên Windows; xác minh exact owned processes rồi dừng, npm ci/test/build chạy lại pass, dev server đã restart. Không kill process khác hoặc xóa dữ liệu DB. npm có warnings transitive whatwg-encoding deprecated và esbuild install-script approval pending; tests/build dùng binary đã cài pass, không thay global script/security policy.

#### Gate/known issues/deviation

- **Gemini thật chưa chạy:** thiếu GEMINI_API_KEY/account access; 82 tests bao gồm mock logic/SDK offline không chứng minh model. Giữ gemini-2.5-flash; không fallback provider hoặc Function Calling.
- **Render/Neon chưa deploy:** thiếu account/credentials/quyền; config ready, chưa URL/HTTPS cookies/cloud migrations/cold-start proof. Week5/8/10 online DoD vẫn OPEN.
- **Remote CI chưa chạy:** workflow chuẩn bị, không push/commit tự động; Linux-only uvloop/runtimes cần CI/platform xác nhận.
- **Release SHA/URL chưa có**, không invent. Rubric/deadline chưa cung cấp; demo hướng dẫn đã chuẩn bị, không tạo presentation/report ngoài scope.
- Hai warnings Starlette HTTPX TestClient/AnyIO BlockingPortal deprecation, test pass; không suppress hoặc nâng cả HTTP client stack chỉ để sạch warnings.
- Không Dashboard/Statistics/Notifications/Recommendation vì optional chỉ sau online MVP gate, chưa đạt.
- Deviations có chủ đích: user cho phép đi hết các phase liên tiếp trong session thay một tuần/calendar-week; routine dependency/SDK/UI fixes tự quyết, không đổi permanent product/architecture rules.
- Local cluster riêng vì không có DB credentials dev sẵn; không dùng SQLite, không reset DB chính. Startup migration single-instance thay giả định paid predeploy hook.
- Đóng local handoff trong khi gate ngoài chưa đóng; đây là giới hạn bằng chứng/quyền, không claim hoàn thành toàn bộ roadmap.

#### Handoff tiếp theo (cần inputs bên ngoài)

1. Nhóm review diff/secrets, commit candidate thực rồi push để remote CI chạy.
2. Điền key server-side và kiểm tra Gemini2.5Flash bằng --live-ai + manual clarification/relative date/ambiguity/conflict.
3. Người có quyền triển khai Render/Neon theo 01_SETUP/DEMO; HTTPS smoke hai users và restart/persistence/context.
4. Ghi URL/SHA/CI/provider evidence vào ACCEPTANCE/PROGRESS; chỉ khi đó đóng official Week5/8/9/10 gates.
