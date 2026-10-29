# Theo dõi triển khai cải thiện — 21/10/2026

Đây là bản theo dõi thực hiện theo yêu cầu mới của user, bổ sung cho [audit 107 mục](AUDIT_IMPROVEMENTS_2026-10-21.md). Audit gốc được giữ nguyên như bằng chứng hiện trạng trước sửa. Không đánh dấu online/device thật hoàn thành bằng kiểm thử local.

Chốt bàn giao local ngày **22/10/2026**: 170 backend / 41 frontend tests pass, production build pass 3m50s. Evidence ngày 21/10 giữ nguyên ngày chạy. Xem [kết quả cuối và giới hạn](PROGRESS.md), [Todo mobile](screenshots/improved-todo-mobile-final-2026-10-21.jpg) và [chat đúng 12 giờ trưa](screenshots/improved-chat-noon-2026-10-21.jpg). Chưa có release online hoặc kiểm chứng điện thoại vật lý.

[Biên bản kiểm tra chốt 22/10](evidence/local-handoff-2026-10-22.json): smoke 25/25, hủy draft backend/reload/recovery và Calendar tab sạch pass; [ảnh mobile bản cuối](screenshots/improved-todo-mobile-final-2026-10-22.jpg).

## Quy ước

- **Local:** đã triển khai trong source; xem kết quả kiểm thử cuối phiên tại [PROGRESS](PROGRESS.md). Không đồng nghĩa đã xác nhận trên mọi browser/thiết bị.
- **Một phần:** phần code đã xử lý nhưng còn kiểm tra hoặc điều kiện ghi trong cùng hàng.
- **Bên ngoài:** cần quyền tài khoản, thiết bị vật lý hoặc release candidate được nhóm commit/push.
- **Hoãn:** có chủ đích, không phải bỏ sót; không cần để đạt MVP.

## Nhóm AI bắt buộc, ngoài 107 mục

Kết quả đo: regression thật 39/40 (97,5%) và bộ 12 cách diễn đạt bổ sung 12/12. Một câu chọn task cả ngày còn dao động được harden tiếp bằng selector backend; nghiệm thu HTTP thật đã xác minh chọn đúng task, không xóa trước confirm và giữ task có giờ khi hủy. Extended API 23 checks/14 calls pass, cleanup_errors=[]; xem [regression](evidence/nlu-regression-v2-2026-10-21.json), [holdout](evidence/nlu-holdout-2026-10-21.json), [execution](evidence/ai-improvements-execution-2026-10-21.json). Không diễn giải thành khả năng hiểu 100% mọi câu hoặc score riêng model không có backend guards.

| ID | Nội dung | Thực hiện / tiêu chí |
|---|---|---|
| AI01 | Ngữ cảnh có chọn lọc | RAM scoped user, TTL 600s, tối đa 6 bản ghi lượt nói / 400 ký tự mỗi bản ghi và 12 task gần nhất. Không DB chat history. |
| AI02 | Tham chiếu task | `last_task` / `recent_results`, ID trong ngữ cảnh; re-read theo owner, không fallback sang toàn database nếu reference không còn hợp lệ. |
| AI03 | Tên khác đặc điểm | `all_day`, giờ, ngày, status, priority, category là selector; title được tìm riêng, ưu tiên exact match; fallback không dấu vẫn giữ owner và các filter. Không fuzzy tự chọn task. |
| AI04 | Tiếng Việt ngày/giờ | Prompt đa dạng, backend chuẩn hóa khoảng giờ/relative date rõ ràng, không tự suy thiếu giờ kết thúc; không hỗ trợ qua đêm/recurring/bulk. |
| AI05 | Câu tiếp nối/sửa lời | Draft merge giữ field không đổi, đổi intent/target không mang nhầm edit; cập nhật kết quả vừa tạo không tạo bản sao. |
| AI06 | Phản hồi grounded | Thông báo đúng hành động, title/ngày/giờ/danh mục, field đã đổi, no-op; chỉ sau commit. Không thêm lần gọi AI để viết câu trả lời. |
| AI07 | An toàn | Backend giữ confirmation, version/conflict check; memory không cấp quyền xác nhận; hết hạn/restart/replay không execute. |
| AI08 | Đánh giá | `scripts/nlu_eval.py` gọi model thật read-only; `ai_acceptance.py` kiểm tra execution; pytest mock kiểm tra orchestration/safety. Không dùng pass schema để thay semantic eval. |
| AI09 | Giới hạn kết luận | Mục tiêu ≥95% trên bộ tình huống được đo, không hứa hiểu 95% mọi câu ngoài đời. Bộ dùng để chỉnh prompt là regression, không phải bằng chứng khái quát hóa độc lập. |

## Đối chiếu đủ 107 ID

### A — độ ổn định trước demo/public

| ID | Trạng thái | Xử lý / phần còn lại |
|---|---|---|
| A01 | Local | Deadline bao cả fetch và JSON; báo kết quả mutation chưa rõ, không auto retry. |
| A02 | Local | Connect 5s, statement 15s, lock 5s, pool 5s; settings có giới hạn; test PostgreSQL thật. |
| A03 | Local | GET context read-only lấy lại pending còn hiệu lực; có nút kiểm tra/hủy; không tái tạo action hết hạn. |
| A04 | Local | TimeGrid từ 00:00, scrollTime 06:00; test render thật. |
| A05 | Local | Smoke mặc định không POST chat; `--live-ai` mới dùng quota. |
| A06 | Local | UI gửi expected_version khi edit/status/delete; stale trả TASK_CHANGED; contract cũ không gửi vẫn tương thích. |
| A07 | Một phần | Rate limit RAM 12 auth/IP/phút, 10 chat/user/phút; cần kiểm tra proxy/IP trên hosting thật. |
| A08 | Local | Cap body 32KiB trước JSON, bounded streaming, deadline đọc body 10s; không chỉ dựa Content-Length. |
| A09 | Bên ngoài | Key đã lộ: cần chủ tài khoản revoke/rotate trước public. Không tự tạo/thay key hoặc đưa ra frontend. |

### B — điện thoại

| ID | Trạng thái | Xử lý / phần còn lại |
|---|---|---|
| B01 | Local | Input mobile 16px, tăng chữ nội dung/metadata. |
| B02 | Local | Vùng bấm chính 44px; task check/icon/send/auth switch được tăng. |
| B03 | Local | Thu hero auth ở mobile, giữ thiết kế desktop. |
| B04 | Local | Bộ lọc details đóng mặc định trên màn hình hẹp; có số điều kiện. |
| B05 | Local | Header điều hướng sticky mobile, không thêm bottom bar chồng bàn phím. |
| B06 | Local | Calendar mặc định Day trên máy hẹp; vẫn chọn Month/Week/Day; không ép event xuống 8px. |
| B07 | Một phần | dateClick cả ngày + long press 500ms; cần touch vật lý. |
| B08 | Một phần | Chat layout theo visualViewport, vùng message co giãn; cần keyboard Android/iOS thật. |
| B09 | Một phần | Form một cột, modal dvh/scroll, action wrap; cần kiểm tra thêm keyboard/landscape máy thật. |
| B10 | Local | Mở dialog focus heading, không tự focus input bật bàn phím. |
| B11 | Một phần | Safe-area cho header/footer/chat; cần thiết bị có notch/home indicator. |
| B12 | Bên ngoài | Không có Android/iPhone vật lý được kết nối; desktop viewport không thay thế. |
| B13 | Hoãn | PWA/manifest/offline/push không bắt buộc; chưa qua online MVP gate. |
| B14 | Local | Hiện/ẩn password mặc định che, aria state; không lưu password. |

### C — khả năng đọc / accessibility

| ID | Trạng thái | Xử lý / phần còn lại |
|---|---|---|
| C01 | Local | Chữ phụ đổi màu đậm hơn; không đổi toàn palette. |
| C02 | Local | Metadata chính 12px, nội dung 14px+, mobile input 16px. |
| C03 | Local | aria-current cho điều hướng. |
| C04 | Local | aria-pressed cho preset. |
| C05 | Local | Field error association, aria-invalid/describedby và focus sau khi mở khóa form. |
| C06 | Local | aria-busy, status/alert, fieldset disable lúc gửi. |
| C07 | Một phần | Dialog native, heading focus/restore, dirty confirmation; cần screen reader/browser vật lý bổ sung. |
| C08 | Local | prefers-reduced-motion cho CSS và scroll chat. |
| C09 | Local | Skip link và focus ring đậm hơn; kiểm tra thứ tự Tab cốt lõi. |
| C10 | Một phần | Event có accessible label ngày/giờ/status, completed không chỉ màu; cần screen reader thật. |

### D — Todo / form

| ID | Trạng thái | Xử lý / phần còn lại |
|---|---|---|
| D01 | Local | Dirty close hỏi bỏ thay đổi; hủy dialog nhỏ giữ draft. |
| D02 | Local | Fieldset disabled khi save; không nhập thêm rồi mất nội dung. |
| D03 | Local | Hiện năm khi khác năm hiện tại, xóa dùng ngày đầy đủ. |
| D04 | Local | Nhãn pending đã qua ngày; không cấm tạo ngày quá khứ. |
| D05 | Local | Preset Today/Tomorrow/Upcoming giải thích chỉ pending. |
| D06 | Local | Số hoàn thành ghi rõ trong danh sách hiện tại. |
| D07 | Local | Chuyển preset ngày đơn thành hai đầu range trước khi sửa. |
| D08 | Local | min/max, lỗi range inline; không query khi range đảo. |
| D09 | Local | Category chưa tải không bị gắn nhãn Không phân loại; retry riêng. |
| D10 | Local | Notice theo action/no-op, override có thông báo riêng. |
| D11 | Local | Reset error khi chuyển/đóng flow dialog. |
| D12 | Local | Bắt rejection status ở form và hiển thị trong dialog. |
| D13 | Local | Filter/search/preset RAM theo TaskProvider user, không localStorage. |
| D14 | Local | Phân biệt chưa có việc với filter rỗng; có clear filter. |
| D15 | Local | Nút thêm dùng ngày preset/ngày đơn rõ ràng; không lấy đầu range nhiều ngày. |
| D16 | Local | Clear search riêng, giữ filter khác. |

### E — Calendar

| ID | Trạng thái | Xử lý / phần còn lại |
|---|---|---|
| E01 | Local | Giữ view/date trong RAM user; business date VN, không UTC date. |
| E02 | Local | Input đi tới ngày. |
| E03 | Một phần | Tooltip/aria-label, shared detail, +more có sẵn; cần stress touch với title/event dày. |
| E04 | Local | Clear selection error khi chuyển range/view. |
| E05 | Local | Đợi datesSet mới query, không query today thừa. |
| E06 | Một phần | Test named timezone/year boundary/00:00; cần xác minh thêm picker thiết bị thật và mọi mốc lịch. |
| E07 | Local | Lọc status/category dùng TaskFilters/API chung; không thêm business logic. |

### F — Chat UI

| ID | Trạng thái | Xử lý / phần còn lại |
|---|---|---|
| F01 | Local | Bubble failed/unknown khi lỗi; giữ input; không tự retry. |
| F02 | Local | Chỉ auto-scroll khi gần cuối, có nút xuống tin mới. |
| F03 | Local | Tối đa 80 tin hiển thị, 20 task/tin; hướng dẫn thu hẹp kết quả lớn. |
| F04 | Local | Mở detail từ kết quả, GET scoped task mới trước mở; version được kiểm tra lúc lưu. |
| F05 | Local | Preview đủ fields và diff trước→sau cho update conflict. |
| F06 | Local | TTL/giới hạn RAM hiển thị trong panel chính cả mobile. |
| F07 | Local | retry_after_seconds hợp lệ được hiển thị; không auto resend. |
| F08 | Local | Busy chat/manual phối hợp, backend vẫn bảo vệ transaction/version. |
| F09 | Local | Browser hai tab cùng user: tab mới recover đúng pending, cancel ở tab B, confirm cũ ở tab A trả CONTEXT_EXPIRED, không ghi. Vẫn một flow/user/một worker. |
| F10 | Local | Enter xuống dòng, Ctrl/⌘+Enter gửi, không gửi khi IME composing. |

### G — state / hiệu năng / phục hồi

| ID | Trạng thái | Xử lý / phần còn lại |
|---|---|---|
| G01 | Local | Category cache riêng theo user; task mutation không refetch category. |
| G02 | Local | Giữ snapshot cùng query khi refetch; không hiện snapshot query/user khác. |
| G03 | Local | Auth epoch ngăn 401 cũ đăng xuất phiên mới, kể cả JSON resolve trễ. |
| G04 | Local | visibility/focus refetch có khoảng cách tối thiểu, không polling dày. |
| G05 | Local | Header ngày VN cập nhật, preset tương đối theo ngày mới; không đổi ngày task. |
| G06 | Local | ErrorBoundary cho Calendar/lazy render, fallback có reload. |
| G07 | Local | Logout lỗi giữ workspace, báo cookie chưa được xác nhận xóa. |
| G08 | Local | URL Todo/Calendar/Chat + popstate/deep link, không thêm router lớn. |
| G09 | Một phần | Asset hash cache immutable, HTML no-cache; giữ Google Fonts + fallback, chưa self-host font. |
| G10 | Local | Kiểm thử 200 task/title dài + cap prompt; chưa có lý do thêm pagination/virtualization/index. Không phải production load test. |

### H — API / bảo mật

| ID | Trạng thái | Xử lý / phần còn lại |
|---|---|---|
| H01 | Local | Response models auth/tasks/categories và discriminated union chat/context, OpenAPI contract tests; giữ sparse delta. |
| H02 | Local | Envelope unexpected 500 an toàn + client non-JSON message; log loại lỗi/request ID, không raw exception/SQL. |
| H03 | Một phần | CSP/frame/nosniff/referrer/permissions headers; không bật HSTS local; cần smoke CSP/HTTPS hosting thật. |
| H04 | Local | API no-store, bao gồm lỗi auth. |
| H05 | Local | Origin parse scheme/host/port, cấm path/query/userinfo/wildcard. |
| H06 | Local | Reject secret toàn whitespace/placeholder/ngắn. |
| H07 | Local | Missing email vẫn bcrypt dummy check + rate limit; không tuyên bố loại hết timing side-channel. |
| H08 | Local | Hash hỏng trả auth failure an toàn, không 500/raw hash. |
| H09 | Một phần | Request ID, status/duration log không body/query/secrets; chưa trace DB/provider riêng trên cloud. |
| H10 | Local | /ready kiểm tra DB có timeout, /health chỉ liveness; không gọi Groq. |

### I — vận hành

| ID | Trạng thái | Xử lý / phần còn lại |
|---|---|---|
| I01 | Local | scripts/dev.ps1 kiểm tra DB→migration→build nếu cần→Uvicorn một worker; không initdb/reset. |
| I02 | Local | Hướng dẫn phân biệt PostgreSQL chuẩn 5432 và cụm riêng 55432; không copy đè .env. |
| I03 | Local | Script dùng UTF-8, docs chỉ rõ runtime pin đã test; không upgrade hàng loạt. |
| I04 | Bên ngoài | Chưa Render/Neon account, HTTPS URL hoặc release SHA. |
| I05 | Local | Hướng dẫn LAN exact Origin/host/firewall Private tối thiểu; không tự mở cổng hay expose PG. |
| I06 | Local | backup_check.py dump và restore vào DB thử mới, so count, dọn đúng target; backup giữ ignored. |
| I07 | Local | Tách requirements-dev, bỏ constraints dư sau resolver, kiểm tra venv mới; không nâng phiên bản runtime. |
| I08 | Local | Favicon SVG theo thương hiệu, tài khoản QA synthetic không dùng dữ liệu thật. |
| I09 | Local | Bảng trạng thái này + liên kết README/PROGRESS, giữ lịch sử cũ. |

### J — kiểm thử / evidence

| ID | Trạng thái | Xử lý / phần còn lại |
|---|---|---|
| J01 | Local | API/UI recovery/expiry/replay + browser hai tab cancel/confirm cũ không thực thi. Không khôi phục action sau TTL/restart. |
| J02 | Local | Fetch/body deadlines, unknown result, no retry tests; DB statement/lock test thật. |
| J03 | Local | Stale PUT/status/delete regression; conflict policy cũ giữ nguyên. |
| J04 | Một phần | Dirty/fieldset/error/focus/status failure/category cache tests; native keyboard cần browser bổ sung. |
| J05 | Local | Unicode byte limit/logout failure/stale 401 + auth regression đã có. |
| J06 | Bên ngoài | Viewport và keyboard desktop không thay Android/iOS/screen reader thật. |
| J07 | Local | Unit provider chạy không PG; integration vẫn PostgreSQL riêng, không SQLite. |
| J08 | Local | Smoke cleanup ExitStack kể cả assert fail, progress từng bước, không reset/account-delete. |
| J09 | Local | Acceptance theo dõi account đã login, kiểm status list/delete/logout và báo cleanup_errors. |
| J10 | Local | expected model tách verified; NLU đọc reported model/usage thật, không hardcode đã verify. |
| J11 | Một phần | CI compile/docs/schema/a11y assertions qua tests; chưa remote run hoặc automated full accessibility certification. |
| J12 | Bên ngoài | Chưa commit/push/remote Linux CI/HTTPS candidate; không ghi pass bằng local tests. |

## Còn cần người dùng/nhóm

Tổng đối chiếu: **87 Local, 14 Một phần, 5 Bên ngoài, 1 Hoãn = 107**. “Một phần” phần lớn là code đã có nhưng còn xác minh thiết bị/hosting/screen reader; đọc lý do từng hàng, không coi là 14 lỗi đã chứng minh. Nhóm AI phía trên là yêu cầu bổ sung riêng, không cộng nhầm thành 107 feature.

1. Rotate key đã lộ bằng tài khoản Groq của chủ key; cập nhật secret backend rồi smoke lại.
2. Review working tree trước commit/push, chạy GitHub CI, triển khai Render/Neon và smoke HTTPS.
3. Thử Android Chrome/iOS Safari thật: keyboard, touch, date/time picker, landscape, zoom, safe area, screen reader.
4. Không mở dashboard/notification/recurring/bulk/chat history DB/multi-worker để làm đẹp danh sách.

## Cơ sở thiết kế AI

Áp dụng nguyên tắc cung cấp context liên quan và đánh giá theo tình huống từ [conversation state](https://developers.openai.com/api/docs/guides/conversation-state), [prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering) và [evaluation practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices). Đây là nguyên tắc chung; project vẫn dùng Groq Chat Completions, không đổi sang OpenAI Responses/Conversations API.
