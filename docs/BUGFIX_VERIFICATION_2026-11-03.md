# Bugfix & verification — 2026-11-03

## Phạm vi

Nhánh `codex/fix-audit-regressions`, xuất phát từ `753788f`, tích hợp thêm `origin/main` tại `cedef4b` khi nhóm cập nhật giao diện auth/Landing. Giữ thiết kế mới và điều hướng về trang đã yêu cầu, áp dụng validation/OTP bugfix vào factory form mới. Chỉ sửa lỗi của chức năng có sẵn; không thêm Google/Outlook sync, Pomodoro, bộ lọc/category/ba mức priority mới, framework mới hay tool AI mới.

Source được sửa là checkout `ai66a-group8`. Web cổng 3000 đang mount từ `todo-list-pro/todo-list` là bản độc lập, không tự nhận các bản sửa này. Không sửa source, .env, database hoặc container `web-template` của bản đang sử dụng.

Kiểm thử ở Docker project `codex-planify-test`, frontend 13000/backend 18000, PostgreSQL *_test tmpfs và Redis riêng. Không gọi thêm Groq hoặc gửi email thật. Tài khoản, mật khẩu và nội dung QA đều tổng hợp, không phải dữ liệu cá nhân.

## Đối chiếu lỗi đã báo

Mã L/S theo báo cáo audit trước đợt sửa. “Regression” là bài tự động trên source/module/API thật với database test; không có nghĩa đã kiểm chứng provider/SMTP/điện thoại thật.

| Mục audit | Xử lý trên nhánh này | Kiểm chứng |
|---|---|---|
| L01 — cache chat A/B | Reset store, panel, workspace, modal/context menu và reminder state khi đổi user; bỏ response của phiên cũ; reload khi JWT đổi ở tab khác | Unit session/stale response; UI A → logout → B cùng tab, dấu QA_PRIVATE_A_FINAL không còn |
| L02 — foreign parent/cascade | Kiểm tra owner list/calendar trước create/update, kể cả batch và AI; serialize write theo owner | API hai user, foreign parent trả 404, CRUD/cascade của dữ liệu đúng owner |
| L03 — fallback lặp mutation | Ghi kết quả từng tool; không fallback NLP khi đã thực thi tool; chặn lặp cùng tool/args trong một lượt | Mock provider lỗi sau create: chỉ một task, trả kết quả thực tế |
| L04, S02 — AI xóa/mơ hồ | Confirmation backend theo user + conversation, TTL 10 phút, dùng một lần; đóng băng ID/snapshot; từ chối target thay đổi, nhiều kết quả hoặc phủ định | Confirmation/replay/expiry/stale/other-user tests; tên trùng không tự chọn |
| L05 — OTP bypass | Hai route register dùng cùng service bắt buộc proof OTP; proof atomic/single-use | Cả hai route không proof bị từ chối; xác minh/đăng ký có seed defaults |
| L06, S04 — task recurrence | Transition completion chung cho manual/PUT/auto; khóa row, unique recurrence_source_id; successor cùng transaction | 4 request đồng thời, retry/reopen và auto-complete không tạo successor lặp |
| L07, S05, S06 — event recurrence | Sửa split end/COUNT, giữ occurrence anchor ở form/drag/resize/tools; cập nhật exception có sẵn; xóa exception thành tombstone; kiểm tra anchor | API this/following, COUNT, update exception và cancellation; frontend suppression tests |
| L08 — expansion | Không giới hạn 500 occurrences trọn đời; không overflow ngày 31/leap day; BYDAY có COUNT theo thứ tự thời gian | JS và Python recurrence cases, chuỗi bắt đầu từ 2025 còn hiển thị cuối 2026 |
| L09, S09 — validation/all-day | Chặn title trắng, null sai contract, độ dài/giờ/thời lượng không hợp lệ; validate cả payload update đã merge; all-day xóa time | API 422, create/update, all-day adapter; lỗi 500 auto-complete phát hiện trong vòng test đầu đã sửa |
| L10 — timezone | Validate IANA timezone, business clock Asia/Ho_Chi_Minh, date-only không qua UTC midnight; đổi event time ở biên API; lưu selected date dạng date-only | JS suite chạy cả America/Los_Angeles; completion/dashboard tại 00:30 giờ VN |
| S01 — startup admin | Bootstrap chỉ tạo khi chưa có, không xóa admin khác/reset password/promote account thường trùng email | Database regression giữ account và hash cũ |
| S03 — event/task twin | AI create_event chỉ tạo Event; edit Event giữ Event ID, không tạo Task rồi xóa Event | AI Event có 1 record Event và 0 Task copy |
| S07, S08 — busy/free slots/auto-plan | Shared interval calculation gồm tasks + expanded events + exceptions, timezone-aware; auto-plan chỉ xếp khi đủ cả slot và recheck trước write | API/tool tests; 250 bộ khoảng bận ngẫu nhiên so với minute-grid độc lập |
| S10, S13 — quyền/phiên/config | User enumeration yêu cầu admin; user inactive bị từ chối; password đổi/reset tăng token_version; từ chối JWT/admin defaults không an toàn | Role/inactive/password tests; thiếu JWT bị 401 trên mọi protected route shape |
| S11, S12 — migration/readiness | Backfill theme/timezone; migration mới quản lý cột startup trước đây; bỏ startup ALTER/catch giả thành công; kiểm tra dependencies | Upgrade có user cũ + cột tồn tại, chạy head hai lần, downgrade/upgrade trong DB UUID test, đủ cột ORM |
| S14 — SMTP/OTP | SMTP độc lập admin; không log OTP; verify JSON body; cooldown/hourly cap, atomic attempts/TTL/proof; delivery false trả lỗi | Mock mail failure/cooldown/attempts/concurrent OTP/replay; chưa gửi email thật |
| S15 — stale/multi-day | Generation guard cho Calendar/Todo/Dashboard/chat; render theo overlap ngày, không chỉ start day; cắt block timed theo ngày | Unit overlap/exclusive end, API smoke; không giả nhận đã test mọi drag/touch gesture |
| S16 — My Day/false success | Filter/reset theo ngày VN; local agent trả lỗi từ kết quả tool, không báo thành công khi write thất bại; câu chỉ hỏi quá hạn không dời task | My Day expiry, failed tool, quoted title và read-only NLP tests |
| S17 — accessibility | Keyboard Enter/Space cho custom click controls, dialog aria/focus trap/restore, label giờ/màu, khóa footer khi đang lưu | Source/syntax + UI form smoke; chưa kiểm tra screen reader/WCAG certification |
| S18, S19 — test/evidence | Skip các probe lịch sử có giả định nguy hiểm; suite regression mới bắt buộc DB test, mock provider/SMTP; gắn nhãn lịch sử cho benchmark/checkbox cũ | Suite mới kiểm tra public API/module thật, không tự dispatch event để tự chứng minh |
| S20 — CI/dependency/docs | Pin versions đã chạy, lock Linux/Python 3.11, workflow build + regression + pip check; README phản ánh source hiện tại | Fresh Docker build và pip check; remote CI chỉ được xác nhận sau khi thấy kết quả run |

Overlap Calendar vẫn được phép theo source mới. Không thêm cơ chế override/409/conflict dialog từ kế hoạch MVP cũ vào đợt chỉ sửa lỗi này. Cũng không thêm dirty-form confirmation, refresh-token, advanced filter hoặc chức năng chỉ được nêu như đề xuất UX trong audit.

## Lỗi phát hiện thêm khi sửa

- Xuất ICS trước đây làm mất giờ, DTSTART/DTEND all-day bằng nhau, không escape/fold text và bỏ Event records. Đã sửa UTC timed, end-exclusive, UTF-8 folding, recurrence cancellation/UID; không export RRULE trên mọi task clone để tránh nhân bản lịch. JSON backup gồm tasks và events; không thêm chức năng import.
- Dashboard bỏ sót recurring occurrences và đếm ngày hoàn thành theo UTC. Dùng expansion và ngày VN cho số liệu.
- Local NLP từng có thể hiểu “sửa việc cần làm” thành create, hoặc câu hỏi có “quá hạn/hôm nay” thành dời task. Chặn nhánh mutation không xác định, phân biệt quoted title; thiếu ngày/giờ Event phải hỏi lại.
- Tooltip tool từng báo thành công mặc định và chèn tool name bằng HTML. Hiển thị trạng thái thực, render tên bằng textContent.
- Toolbar mobile có class flex-wrap nhưng không có utility tương ứng. Kiểm tra browser phát hiện nút tạo bị cắt dù scrollWidth bằng viewport; đã sửa wrap thật và kiểm tra vị trí từng nút.
- Một test phiên bản đầu tái dùng session đã đóng, gây cảnh báo connection khi GC. Đã sửa fixture/session; không che bằng bỏ cảnh báo.
- Sau tích hợp auth mới: nhãn/minlength mật khẩu vẫn ghi 6 dù backend cần 8; retry đăng ký/khôi phục cố xác minh lại mã OTP đã bị tiêu thụ. Đã thống nhất 8 ký tự/72 bytes, giữ proof theo đúng email/mã cho retry và khóa các thao tác recovery đang chờ.
- Cài đặt: chặn response render đến muộn sau chuyển trang, không ghi preference local trước khi API lưu thành công, gắn label input và thoát phiên đã bị thu hồi sau đổi mật khẩu.
- Lịch biểu: mở đúng task gốc trong form có sẵn thay vì chỉ chuyển sang To Do; Event edit/delete dùng đúng callback refresh. Thêm tên truy cập cho các input trong Unified Form và thao tác Quan trọng bằng phím.

## Kết quả tự động

- Backend: **35 tests PASS**: 31 API/service/AI cases + migration + 3 nhóm pure rules/property tests. Property group có 250 tập khoảng bận, không tính thành 250 integration tests.
- Frontend: **38 tests PASS** = 21 core regressions + 17 auth/settings/agenda DOM-double tests. Core suite chạy lại với TZ=America/Los_Angeles, gồm date-only/business midnight, recurrence, session reset/stale responses, password bytes và ICS. Bộ auth của main được bổ sung browser primitives/ID user hợp lệ trong fixture để tương thích API hardening, không hạ validation thật nhằm làm test pass.
- Python compileall với cache riêng: PASS. Lần đầu cache mặc định bị Windows chặn rename .pyc; chạy lại với pycache_prefix=.local/audit-pycache, không sửa/tắt kiểm tra.
- Tất cả JS modules qua node --check; git diff whitespace check PASS.
- Docker build từ requirements.lock PASS; pip check không có dependency hỏng. Không coi pip check là CVE audit.

Lệnh tái lập có trong [README](../README.md). Workflow theo tài liệu chính thức của [checkout](https://github.com/actions/checkout) và [setup-node](https://github.com/actions/setup-node); chưa suy ra remote workflow đã pass chỉ từ YAML.

## UI đã chạy và giới hạn

- Login hai QA, To Do/Calendar create task → refresh không F5 → complete từ Calendar → To Do phản ánh đúng.
- QA A mở chat, gửi dấu riêng bằng local NLP, logout, QA B login cùng tab: profile B, panel trống/welcome, không còn dấu hoặc hội thoại của A.
- To Do 390×844 và 320×640: không tràn trang; mọi nút toolbar nằm trong viewport sau sửa wrap. Theme đổi sang dark đúng một lần. Có kiểm tra ảnh render, không chỉ scrollWidth.
- Sau tích hợp main: Landing/auth ở 320px, protected Guide → login → trở lại Guide, Settings lưu hồ sơ QA; tải ICS/JSON và đọc nội dung file; Calendar tuần tạo task → Lịch biểu sửa title/Quan trọng bằng phím → hoàn thành → Dashboard 1/2 và 1 mục hoàn thành hôm nay. Tháng/Ngày cũng render trong lượt QA; không thay bằng mock UI.
- Workspace AI dùng fallback local, A gửi dấu QA_WORKSPACE_A_FINAL → logout → B login cùng tab: DOM/profile B và không có dấu/chat/task A. Composer mobile 390×844 nhìn thấy phía trên bottom nav. Các log 401/stale token cũ xảy ra khi fixture tự động thay ID user trong DB test, không tính là lỗi UI mới hoặc che log.
- Kiểm tra responsive viewport không thay cho iOS/Android/touch thật. Không chứng nhận mọi breakpoint, browser, concurrency/load hoặc mọi câu nói tự nhiên.
- Không chạy SMTP/Groq thật, cloud deploy, database migration của user hoặc security penetration test độc lập. Không có cam kết “an toàn/không lỗi 100%”.

## Khi áp dụng lên app thật

1. Dùng source nhánh này trong đúng folder đang chạy; push Git không tự thay bind mount từ todo-list-pro.
2. Backup database trước khi rebuild/start để Alembic nâng schema. Không down -v, không reset DB thật.
3. Bổ sung SMTP_* vào .env nếu muốn OTP/email. Không dùng mật khẩu admin làm Gmail app password. Kiểm tra SECRET_KEY riêng, không copy test signing key.
4. Pending confirmation ở RAM sẽ hết khi restart và không thực thi lại; giữ một backend worker cho contract này. Password đổi/reset sẽ làm JWT cũ hết hiệu lực, cần đăng nhập lại.
5. Nghiệm thu Groq/SMTP và thiết bị thật là kiểm chứng ngoài môi trường test, chưa được dùng làm bằng chứng trong báo cáo.
