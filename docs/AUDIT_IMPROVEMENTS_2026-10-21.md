# Audit cải thiện toàn project — 2026-10-21

> Đây là audit **trước khi sửa**. Theo yêu cầu tiếp theo của user, các cải thiện đã được triển khai và theo dõi tại [trạng thái đủ 107 ID + nhóm AI bắt buộc](IMPROVEMENT_STATUS_2026-10-21.md). Giữ nguyên bằng chứng audit bên dưới, không đọc chúng như lỗi vẫn còn toàn bộ ở bản mới.

## Kết luận

Web có thể dùng trên điện thoại bằng responsive web; không cần viết app Android/iOS riêng. Source đã có viewport meta và CSS responsive ở các breakpoint 700/760/1100px. Tuy nhiên, chưa thể nói toàn bộ trải nghiệm mobile đã tốt hoặc đã test trên máy thật.

Báo cáo này liệt kê **107 hạng mục**, gồm lỗi/thiếu sót xác định được, rủi ro cần tái hiện, cải thiện UX nhỏ và kiểm thử còn thiếu. **Không phải 107 lỗi đã được chứng minh**, không phải cam kết audit tuyệt đối không bỏ sót. Không lặp lại đầy đủ phần nâng ngữ cảnh/prompt/phản hồi AI đã bàn trước; tập trung thêm độ tin cậy và toàn bộ web.

Lần này không sửa source/config/dependencies, không khởi động DB, không reset database, không đăng ký/đăng nhập hoặc tạo/sửa/xóa task, không gọi Groq và không deploy/push. Chỉ tạo báo cáo/ảnh, chạy frontend tests/collection và probes riêng trong RAM. Bản backend tạm ở loopback:8002 chỉ phục vụ kiểm tra public UI và được dọn sau audit.

## Cách đọc và ưu tiên

- **P1:** ưu tiên trước demo/public hoặc là phần quan trọng để dùng ổn định trên điện thoại; không đồng nghĩa đã có exploit nghiêm trọng.
- **P2:** nên cải thiện sau các blocker; UX, an toàn dữ liệu khi có race, bảo trì và kiểm thử.
- **P3:** tùy chọn nhỏ, chỉ sau core; không chặn MVP.
- **C:** hiện trạng được xác định từ source/đo/probe; không phải mọi hiện trạng đều là bug.
- **R:** rủi ro suy ra từ code, chưa tái hiện bằng browser + database thật trong audit này.
- **ĐX:** đề xuất UX/thiết kế, không phải chức năng bắt buộc đang thiếu.
- **T:** việc kiểm thử/gate còn cần bằng chứng, không tự suy thành test fail.

| Nhóm | Số mục |
|---|---:|
| A. Những điểm nên xử lý trước demo/public | 9 |
| B. Điện thoại: bố cục, đọc và thao tác | 14 |
| C. Khả năng đọc và accessibility | 10 |
| D. Todo, bộ lọc và form: các chi tiết nhỏ | 16 |
| E. Calendar ngoài vấn đề khung giờ đã nêu | 7 |
| F. Chat UI và độ tin cậy, không lặp phần nâng ngữ cảnh đã bàn | 10 |
| G. State, hiệu năng và khả năng phục hồi frontend | 10 |
| H. API, bảo mật và cấu hình | 10 |
| I. Chạy thử, deploy và bảo trì | 9 |
| J. Test cần bổ sung; đây không phải các lỗi đã được chứng minh hết | 12 |
| Tổng | 107 |

## Bằng chứng của lần audit này

- Đọc các module frontend, backend, schema, services, migrations, scripts/tests/CI/config; đối chiếu product/API/UI/architecture/roadmap và tiến độ.
- `npm test -- --run`: **24 passed**, 5 files, 4,09s trong lần chạy này.
- `pytest --collect-only -q`: **120 tests collected**. **Không phải 120 tests đã chạy**. PostgreSQL đang tắt nên không rerun integration/backend suite và không reset test DB.
- Backend chính :8000 không phản hồi tại lúc kiểm tra; `pg_ctl status` báo no server running. Không dùng điều này để kết luận source backend hỏng.
- Trang public build hiện có được kiểm tra bằng backend tạm :8002, không dùng database. Login và Register được xem ở viewport 390×844 và login ở 320×568.
- Login viewport390: clientWidth=scrollWidth=390, không tràn ngang; inputs 13px/cao42px; auth-switch cao22px; hero≈295px.
- Login viewport320: clientWidth=scrollWidth=305 vì scrollbar desktop; scrollHeight813, hero260, submitBottom≈689 (>viewport568). Cần cuộn, không phải mất nút.
- Register viewport390: clientWidth=scrollWidth=375 vì scrollbar desktop; scrollHeight885, inputs13px/cao42px. Không gửi form.
- Tính contrast từ CSS: auth description≈3,63:1; task metadata trắng≈3,10:1; chat footnote trắng≈2,46:1. Body/title chính tương phản tốt (khoảng11–12:1). Không phải full WCAG certification.
- Probe context bằng một process RAM riêng: pending có sẵn + request mới không context_id → 400 BUSINESS_RULE_ERROR, pending vẫn còn. Không đụng context của user hay DB.
- Probe Settings với giá trị giả trong RAM xác nhận secret toàn whitespace và Origin có path hiện vẫn được chấp nhận; không in hoặc thay secret thật.
- Headers bản tạm: HTML có Cache-Control:no-cache; chưa có CSP/frame protection/nosniff/referrer-policy. /auth/me401 chưa có cache policy riêng. Không coi đây là bằng chứng leak dữ liệu.
- Không rerun provider smoke, dependency audit hoặc cloud CI trong audit này. Các pass ngày21/10 trong PROGRESS/RELEASE_HANDOFF là evidence session trước, được giữ nguyên.
- Ảnh: [Register ở viewport điện thoại](screenshots/audit-register-mobile-2026-10-21.jpg). Đây là desktop viewport emulation, không phải Android/iPhone thật. Todo/Calendar/chat protected được review source, không được trình bày là đã live-test mobile trong session này.

## Những nền tảng nên giữ

Ownership scoped user, hash password, JWT HttpOnly cookie, Origin/header/JSON guard, backend-owned confirmation, conflict transaction/row lock, PostgreSQL test DB riêng, timezone VN và shared task service đã có nền tảng đúng. Không cần đổi framework/database/provider để làm mobile. Đã có loading/error states, stale-response guard cho list, native dialog và Calendar lazy-load; nên cải thiện có mục tiêu thay vì viết lại.

---

## A. Những điểm nên xử lý trước demo/public

Nguồn chính: [API client](../frontend/src/api/client.js), [database](../backend/app/core/database.py), [chat service](../backend/app/services/chat_service.py), [Calendar](../frontend/src/calendar/CalendarView.jsx), [smoke](../scripts/smoke.py).

- **A01 · P1 · C — Timeout phía trình duyệt.** fetch chưa có thời hạn cho login, CRUD, chat hoặc đọc JSON. Khi server không trả lời, busy có thể giữ vô hạn. Thêm deadline, thông báo có thể xử lý tiếp; tuyệt đối không tự retry mutation.

- **A02 · P1 · C — Timeout database/row lock.** create_engine mới có pool_pre_ping; chưa đặt connect_timeout, statement_timeout/lock_timeout hoặc pool timeout theo nhu cầu. DB dừng hoặc lock lâu có thể làm request treo; cần giới hạn và trả lỗi an toàn.

- **A03 · P1 · C — Mất đường xác nhận sau reload/mất response.** ChatView khởi tạo flow=null trong khi backend vẫn chặn yêu cầu mới nếu có pending. Probe RAM riêng xác nhận 400 BUSINESS_RULE_ERROR. Cần cách lấy lại preview hoặc hủy pending của chính user mà không thực thi; không khôi phục action hết hạn/restart.

- **A04 · P1 · C — Task 00:00–06:00 bị khuất ở Week/Day.** Calendar đặt slotMinTime=06:00 nhưng API cho tạo từ 00:00. Nên hiển thị từ 00:00; nếu muốn mở màn hình ở 06:00 thì dùng scrollTime, không cắt khoảng giờ hợp lệ.

- **A05 · P1 · C — Smoke mặc định vẫn gọi Groq thật.** Nhánh không --live-ai vẫn POST /api/chat một câu query. Có key thì vẫn tốn quota dù báo live_ai=false. Tách kiểm tra manual/API khỏi provider smoke, yêu cầu opt-in rõ ràng.

- **A06 · P1 · R — Form cũ có thể ghi đè sửa mới từ tab/thiết bị khác.** REST PUT gửi toàn bộ field nhưng không gửi expected_version; version check hiện chủ yếu dùng cho pending chat. Nên có kiểm tra phiên bản khi lưu/sửa/xóa từ UI, hoặc báo người dùng tải bản mới thay vì âm thầm last-write-wins.

- **A07 · P1 · C — Giới hạn gọi login/register/AI.** Chưa thấy rate limit ở các route. Public có thể bị thử password hoặc tiêu hết quota AI. Với MVP một process, dùng giới hạn đơn giản theo IP/user và trả 429; không cần Redis/microservices.

- **A08 · P1 · C — Giới hạn kích thước request trước khi đọc toàn body.** write_guard đọc request.body() trước schema validation, chưa có cap byte. Giới hạn payload ở app/proxy; giới hạn 2.000 ký tự chat không thay thế giới hạn body HTTP.

- **A09 · P1 · C — Key đã lộ cần rotate trước public.** Việc dùng tạm là theo ủy quyền, không phải lý do để xem key còn bí mật. Nhóm revoke/rotate, cập nhật backend secret và smoke lại; không đưa vào VITE_*, source, ảnh hoặc logs.

## B. Điện thoại: bố cục, đọc và thao tác

Nguồn chính: [CSS](../frontend/src/styles.css), [Auth](../frontend/src/auth/AuthScreen.jsx), [Modal](../frontend/src/components/Modal.jsx), [TaskForm](../frontend/src/tasks/TaskForm.jsx).

- **B01 · P1 · C — Tăng chữ nhập liệu mobile.** Auth đo được input 13px; CSS form task 12px, chat textarea mobile 10px. Đề xuất input khoảng 16px, nội dung 14–16px; đây là mục tiêu usability, không phải khẳng định WCAG bắt buộc 16px.

- **B02 · P1 · C — Tăng vùng bấm thay vì chỉ tăng icon.** Task complete khai báo 22×22px; nút chuyển auth đo cao 22px; nút gửi chat 40×40px; delete mobile padding=0. Đề xuất vùng bấm chính khoảng 44×44px, icon bên trong có thể nhỏ.

- **B03 · P2 · C — Thu gọn phần trang trí trang đăng nhập.** Ở 320×568, hero cao 260px, nút login kết thúc ở y≈689, cần cuộn xuống. Có thể thu hero trên máy thấp; không cần bỏ thiết kế desktop.

- **B04 · P2 · ĐX — Thu gọn bộ lọc Todo.** Nhiều field ngày/status/priority/category làm danh sách ở xa trên mobile. Cho mở/đóng bộ lọc và hiện số bộ lọc đang áp dụng; giữ query và nút reset rõ ràng.

- **B05 · P2 · ĐX — Điều hướng dễ chạm khi cuộn.** Navigation ở trên đầu, cuộn danh sách/chat dài phải quay lên để đổi mục. Cân nhắc sticky navigation gọn hoặc thanh dưới; nếu dùng thanh dưới phải chừa safe area.

- **B06 · P2 · ĐX — Chọn view lịch phù hợp màn hình hẹp.** Month hiện chữ event xuống 8px. Có thể ưu tiên Day/Week hoặc cách xem danh sách trong ngày trên mobile, không tự thêm dependency/plugin khi chưa cần.

- **B07 · P2 · R — Tạo task trên lịch bằng chạm rõ ràng.** Đang dùng select, chưa có dateClick riêng; FullCalendar interaction v6 có longPressDelay mặc định 1000ms. Kiểm tra thao tác chạm thật; thêm hướng dẫn nhấn giữ hoặc dateClick để người dùng không phải đoán.

- **B08 · P1 · R — Bàn phím không che ô chat và nút gửi.** Chat có vùng message cao cố định 380px trên mobile cộng header/form/footer; chưa có xử lý visual viewport. Thử bàn phím thật, dùng layout linh hoạt/dvh phù hợp thay vì chỉ co chiều rộng.

- **B09 · P2 · R — Modal trên máy thấp/ngang.** Modal max-height 90dvh và form hai cột vẫn giữ trên màn hình nhỏ. Kiểm tra nội dung/nút lưu khi bàn phím mở; chuyển một cột ở breakpoint hẹp nếu cần.

- **B10 · P2 · R — Đừng mở bàn phím khi chỉ xem task.** Modal tự focus input và TaskForm autoFocus tiêu đề. Trên mobile, mở detail để đọc có thể bật bàn phím không cần thiết. Có thể focus heading khi xem, chỉ focus field khi thực sự sửa.

- **B11 · P2 · R — Chừa vùng tai thỏ/home indicator.** Chưa thấy CSS safe-area-inset. Nếu có thanh cố định hoặc chạy kiểu home-screen, thêm khoảng chừa thích hợp; không che nút xác nhận/gửi.

- **B12 · P2 · T — Kiểm thử Android Chrome và iOS Safari thật.** Viewport desktop không mô phỏng đủ keyboard, date/time picker, zoom input, touch và thanh địa chỉ. Cần thử portrait/landscape, máy thấp, 320/360/390/430px và tablet.

- **B13 · P3 · ĐX — Add to Home Screen chỉ là phần phụ.** Có thể thêm manifest/icon sau core gate để mở như ứng dụng. Không cần native app để dùng điện thoại; chưa hứa offline, push hoặc đồng bộ nền.

- **B14 · P2 · ĐX — Hiện/ẩn password có nhãn rõ.** Auth chưa có nút hiện password, dễ gõ sai trên điện thoại. Có thể thêm toggle chỉ tại máy người dùng, mặc định che, aria-label/state rõ; không lưu password vào localStorage.

## C. Khả năng đọc và accessibility

Nguồn chính: [CSS](../frontend/src/styles.css), [Workspace](../frontend/src/tasks/Workspace.jsx), [Todo](../frontend/src/tasks/TodoView.jsx), [Modal](../frontend/src/components/Modal.jsx).

- **C01 · P1 · C — Tăng tương phản chữ phụ.** Đo/calculate: mô tả auth #7a847d trên #f7f8f4 ≈3,63:1; task metadata trên trắng ≈3,10:1; chat footnote ≈2,46:1. Text thường nên đạt 4,5:1. Không cần đổi toàn bộ bảng màu.

- **C02 · P2 · C — Chữ metadata không nên quá nhỏ.** CSS có 8–11px cho priority/date/time/category/footnote, trong khi đây là thông tin người dùng cần đọc. Tăng size/line-height trước khi chỉ tăng zoom cả trang.

- **C03 · P2 · C — Thông báo mục đang chọn cho screen reader.** Navigation chỉ dùng class active. Thêm aria-current hoặc trạng thái phù hợp, không chỉ đổi màu.

- **C04 · P2 · C — Bộ lọc nhanh có trạng thái truy cập được.** Preset chỉ class active. Dùng aria-pressed cho button hoặc triển khai tab pattern đầy đủ; không gắn role=tab một nửa rồi thiếu keyboard navigation.

- **C05 · P2 · C — Gắn lỗi vào field tương ứng.** Hiện nhiều lỗi ở alert chung. Dùng details.fields, aria-invalid/aria-describedby và focus field lỗi đầu tiên; vẫn giữ input người dùng đã nhập.

- **C06 · P2 · C — Thông báo trạng thái đang gửi nhất quán.** Đặt aria-busy/status cho auth và form khi gửi, không chỉ disable nút hoặc đổi text. Đảm bảo một lỗi không bị đọc lặp bởi hai alert.

- **C07 · P2 · R — Mô tả dialog và focus dialog lồng nhau.** Đã có dialog native/aria-labelledby/focus restore, đây là nền tốt. Bổ sung aria-describedby khi phù hợp và kiểm tra Escape, focus trap, focus về đúng nút với editor + delete/conflict.

- **C08 · P2 · C — Tôn trọng giảm chuyển động.** CSS smooth scroll và JS scrollIntoView smooth đang dùng cố định. Đổi sang auto khi prefers-reduced-motion, không ép người đang đọc lịch sử chat bị cuộn.

- **C09 · P2 · ĐX — Skip link và thứ tự focus.** Thêm lối đi thẳng đến nội dung chính, kiểm tra thứ tự Tab xuyên nav/filter/list/dialog; giữ focus ring hiện có, không bỏ outline.

- **C10 · P2 · T — Status/priority của event không chỉ dựa màu.** Todo đã có label priority, Calendar có legend/strikethrough. Kiểm tra accessible name của event có ngày/giờ/status và điều khiển bằng keyboard; không giả định library tự phủ mọi trường hợp.

## D. Todo, bộ lọc và form: các chi tiết nhỏ

Nguồn chính: [Todo](../frontend/src/tasks/TodoView.jsx), [TaskForm](../frontend/src/tasks/TaskForm.jsx), [TaskDialogs](../frontend/src/tasks/TaskDialogs.jsx), [dates](../frontend/src/tasks/dates.js).

- **D01 · P2 · C — Đóng form đang sửa cần bảo vệ draft.** Escape/nút đóng/hủy hiện bỏ form ngay. Nếu values đã đổi, hỏi bỏ thay đổi; chỉ khi dirty, không hỏi với form rỗng.

- **D02 · P2 · C — Không cho sửa tiếp trong lúc đang lưu mà rồi mất nội dung.** Busy chủ yếu disable button, chưa disable các input. Request đã lấy body cũ nhưng người dùng có thể gõ thêm rồi modal đóng. Khóa fieldset hoặc quản lý rõ snapshot được lưu.

- **D03 · P2 · C — Hiển thị năm khi cần.** dateLabel(full=false) chỉ ngày/tháng, dùng ở Todo/chat/confirmation. Task thuộc năm khác nhìn giống nhau. Hiện năm khi khác năm hiện tại, và date đầy đủ ở preview xóa.

- **D04 · P2 · ĐX — Phân biệt việc cũ với việc sắp tới.** Default All sắp ngày tăng nên task cũ có thể lên đầu. Thêm nhóm/nhãn quá hạn hoặc hướng dẫn preset; được phép tạo ngày quá khứ, không tự cấm trái spec.

- **D05 · P2 · C — Giải thích Today/Tomorrow mặc định pending.** Hiện tên preset ngắn nhưng tự áp status=pending; task vừa hoàn thành biến khỏi view là đúng contract nhưng dễ gây hiểu nhầm. Hiện filter chip hoặc nhãn 'chưa xong'.

- **D06 · P2 · C — Số đếm phải nói là theo bộ lọc.** completed count tính từ tasks đang trả về. Ở preset pending, '0 đã hoàn thành' không phải tổng thành tích user. Đổi nhãn rõ phạm vi, không thêm Dashboard.

- **D07 · P2 · C — Giữ đầu ngày còn lại khi sửa preset sang range.** Handler date_from/date_to bỏ task_date; đầu còn lại từng được hiển thị từ task_date có thể biến mất. Chuyển preset đơn ngày thành hai đầu range rồi sửa đúng đầu.

- **D08 · P2 · C — Báo đảo khoảng ngày trước request.** Chưa đặt min/max hoặc kiểm tra from>to ở frontend; backend có từ chối nhưng chỉ báo chung. Inline validation và nút xóa từng mốc rõ ràng.

- **D09 · P2 · C — Lỗi tải category không nên thành 'Không phân loại'.** Todo lấy tên bằng find(...)||'Không phân loại'. Nếu category_id có thật nhưng categories chưa tải/lỗi, label sai nghĩa. Hiện loading/unknown và nút retry category ở Todo, không chỉ trong form.

- **D10 · P2 · C — Thông báo thành công theo thao tác.** Workspace dùng chung câu 'Đã cập nhật kế hoạch'. Tách tạo/sửa/hoàn thành/mở lại/xóa; nhánh override conflict cũng nên có notice nhất quán, không báo thành công khi no-op.

- **D11 · P2 · C — Xóa lỗi cũ khi đổi/cancel dialog.** TaskDialogs giữ error chung; một số nút 'Giữ lại'/'Hủy' chỉ đóng modal, không clear error. Dialog sau có thể mang lỗi trước. Reset khi mở mới và mọi đường đóng.

- **D12 · P2 · R — Bắt rejection của status trong TaskForm.** Todo bọc run(...).catch(...), nhưng onStatus trong form trả Promise mà onClick không catch. Lỗi mạng có thể thành unhandled rejection và alert nằm sau modal; xử lý lỗi tại dialog.

- **D13 · P2 · C — Giữ filter/search khi chuyển Todo sang Calendar rồi quay lại.** Todo unmount theo view, useState reset. Giữ view-state theo user trong RAM để chuyển tab không mất công lọc; logout vẫn clear sạch.

- **D14 · P2 · C — Phân biệt danh sách rỗng thật với lọc không ra kết quả.** Empty state hiện dùng một mẫu chung. Khi có filter/search, hiện 'Không có kết quả' + bỏ bộ lọc; khi user chưa có task, hiện CTA tạo task ngay.

- **D15 · P2 · ĐX — Prefill ngày từ ngữ cảnh UI khi không mơ hồ.** Nút thêm chung luôn mở form default hôm nay. Với preset Ngày mai/ngày đơn đang chọn, có thể prefill ngày đó và hiển thị rõ; range nhiều ngày vẫn yêu cầu chọn, không tự đoán.

- **D16 · P3 · ĐX — Xóa search riêng mà không reset mọi filter.** Hiện nút Đặt lại xóa toàn bộ trạng thái. Thêm nút clear search có tên truy cập được để giữ category/date/status đã chọn.

## E. Calendar ngoài vấn đề khung giờ đã nêu

Nguồn chính: [CalendarView](../frontend/src/calendar/CalendarView.jsx), [adapter](../frontend/src/calendar/adapter.js), [Workspace](../frontend/src/tasks/Workspace.jsx).

- **E01 · P2 · C — Giữ Month/Week/Day và ngày đang xem.** Calendar unmount khi đổi view ứng dụng; mở lại trở về Month/today. Lưu view/date theo user, không cần lưu task/history vào localStorage.

- **E02 · P2 · ĐX — Đi tới ngày cụ thể nhanh hơn.** Nếu có task nhiều tuần/năm trước, chỉ prev/next khá mất công. Thêm chọn ngày hoặc hành động 'Xem trên lịch' từ task, dùng cùng dữ liệu.

- **E03 · P2 · R — Event dài và nhiều event một ngày.** Kiểm tra title 200 ký tự, giờ dài, nhiều event, +more và tooltip/detail trên màn hình nhỏ. Không chỉ giảm chữ đến 8px để cố nhét.

- **E04 · P2 · C — Xóa cảnh báo selection cũ khi đổi lịch.** selectionError chỉ clear khi chọn lần sau; chuyển range/view có thể còn cảnh báo của lựa chọn cũ. Reset theo sự kiện phù hợp.

- **E05 · P2 · C — Tránh fetch đầu tiên dư thừa.** State range ban đầu task_date=today rồi datesSet thay sang range hiển thị. Có thể tạo hai lượt query; chỉ fetch khi range Calendar đã sẵn sàng.

- **E06 · P2 · T — Mốc cuối ngày/tháng/năm và event completed.** Giữ test timezone hiện có; bổ sung render/timegrid cho 00:00–06:00, 23:59, 29/2, cuối tháng và task completed. Không gọi UTC conversion của task date là cách sửa.

- **E07 · P3 · ĐX — Filter lịch nếu thực sự cần.** Có thể thêm status/category để lịch nhiều task dễ đọc, nhưng dùng cùng TaskFilters/service, không nhân đôi policy. Đây là UX mở rộng, không phải MVP bị thiếu.

## F. Chat UI và độ tin cậy, không lặp phần nâng ngữ cảnh đã bàn

Nguồn chính: [ChatView](../frontend/src/chat/ChatView.jsx), [chat API](../backend/app/api/chat.py), [chat context](../backend/app/services/chat_context.py).

- **F01 · P2 · C — Phân biệt tin đã gửi và tin gửi thất bại.** User bubble được thêm trước await. Nếu network lỗi, bubble vẫn trông như gửi thành công và input còn nguyên. Thêm trạng thái failed/unknown; không tự retry action.

- **F02 · P2 · C — Không tự cuộn khi người dùng đang đọc tin cũ.** Mỗi thay đổi messages/busy/flow đều scrollIntoView. Chỉ auto-scroll nếu gần cuối; nếu không, hiện 'Có tin mới'.

- **F03 · P2 · C — Giới hạn DOM tin nhắn trong phiên dài.** messages tăng không giới hạn và render tất cả. Có thể giới hạn số tin/bản tóm tắt hiển thị trong RAM; không thêm database history hoặc phục hồi pending cũ.

- **F04 · P2 · ĐX — Mở chi tiết task từ kết quả chat.** TaskSummary chỉ là div. Thêm nút mở form/lịch để người dùng kiểm tra/sửa nhanh; backend vẫn revalidate owner/version, không tin ID tự khai.

- **F05 · P1 · C — Preview update nên thấy các field quan trọng.** Chat TaskSummary chỉ hiện title/date/time. Với pending update/conflict, category/priority/description cũng có thể đổi nhưng chưa thấy. Hiện diff cũ→mới của các field liên quan trước xác nhận.

- **F06 · P2 · C — TTL phải thấy được trên mobile.** Giới hạn 10 phút nằm ở chat-tips, nhưng aside bị ẩn dưới 1100px. Đưa nhắc expiry/pending-state vào vùng chính; countdown không phải quyền thực thi.

- **F07 · P2 · C — Thông báo 429 có thời gian thử lại nếu có.** Backend có retry_after_seconds nhưng UI chỉ dùng err.message. Hiện hướng dẫn chờ theo dữ liệu hợp lệ; không retry mutation tự động hoặc hứa quota cố định.

- **F08 · P2 · R — Thống nhất trạng thái busy giữa chat và manual task.** Chat có busy riêng, Workspace có busy riêng. Có thể thao tác song song và thấy dữ liệu/notice lệch thời điểm. Xác định hành vi rõ, backend vẫn là nguồn quyết định.

- **F09 · P2 · R — Nhiều tab/thiết bị cùng user cần thông báo dễ hiểu.** Backend chỉ một active flow/user như thiết kế. Tab khác có thể thay draft hoặc giữ pending; UI cần giải thích và cho recover/hủy hợp lệ, không mở multi-worker để né vấn đề.

- **F10 · P2 · ĐX — Quy ước Enter/Shift+Enter và bộ gõ tiếng Việt.** Textarea hiện Enter xuống dòng. Hiển thị hướng dẫn nhất quán; nếu hỗ trợ Enter để gửi thì giữ Shift+Enter và không submit lúc IME đang composing. Không gọi hành vi hiện tại là lỗi.

## G. State, hiệu năng và khả năng phục hồi frontend

Nguồn chính: [TaskProvider](../frontend/src/tasks/TaskProvider.jsx), [App](../frontend/src/App.jsx), [Workspace](../frontend/src/tasks/Workspace.jsx), [static](../backend/app/api/static.py).

- **G01 · P2 · C — Đừng refetch ba category sau mọi task mutation.** revision đổi làm GET categories lại dù category MVP read-only. Cache theo user, retry khi lỗi; giữ refresh task đúng, sửa test đang gắn với số request category thay vì nghiệp vụ.

- **G02 · P2 · C — Refetch không nhất thiết xóa sạch dữ liệu cũ.** useTasks set tasks=[] khi loading, làm list/calendar nhấp nháy. Giữ snapshot cùng user và hiện updating cho refresh thích hợp; đổi user/401 vẫn clear ngay.

- **G03 · P2 · R — 401 cũ không nên đăng xuất phiên mới.** API client dispatch session-expired toàn cục, không gắn auth epoch. Cần test response muộn của request phiên A khi đã login B, kể cả response.json giải quyết trễ.

- **G04 · P2 · C — Quay lại tab cần cập nhật task.** Chưa thấy xử lý visibility/focus để đọc lại dữ liệu sau khi tab/điện thoại ngủ lâu. Refetch có kiểm soát, tránh polling dày và luôn giới hạn theo user.

- **G05 · P2 · C — Qua nửa đêm phải cập nhật 'hôm nay'.** today() được tính khi render/chọn preset, chưa có lịch cập nhật khi app mở qua ngày. Đồng bộ header/preset hợp lý khi ngày VN đổi, không tự đổi ngày task đã nhập.

- **G06 · P2 · C — ErrorBoundary cho lỗi render/lazy chunk.** Calendar có Suspense cho loading nhưng chưa có boundary cho import/render lỗi. Hiện fallback có retry/reload và không phá cả app.

- **G07 · P2 · C — Logout lỗi không nên khóa toàn app.** App.setError khi logout network lỗi đưa user sang màn full-page error chỉ có reload. Giữ workspace và lỗi có retry logout; không giả vờ cookie đã xóa nếu server chưa nhận.

- **G08 · P2 · C — URL/deep link phản ánh view thật.** Static /calendar trả HTML, nhưng Workspace mặc định todo, không đọc URL. Chưa phải deep link Calendar hoàn chỉnh. Dùng URL state nhẹ để back/reload đúng view; không nhất thiết thêm router lớn.

- **G09 · P3 · ĐX — Cache asset hash và font tốt hơn.** Index đã no-cache là hợp lý; có thể cache immutable cho assets có hash. CSS @import Google Fonts có thêm phụ thuộc mạng; cân nhắc self-host theo license hoặc giữ system fallback tốt.

- **G10 · P2 · T — Đo trước khi thêm pagination/index/virtualization.** API cố ý không pagination trong MVP. Test dataset nhỏ thực tế nhưng nhiều task/title dài/chat dài; chỉ tối ưu điểm nghẽn có bằng chứng, không tự biến thành production-scale.

## H. API, bảo mật và cấu hình

Nguồn chính: [routers](../backend/app/api/tasks.py), [errors](../backend/app/core/errors.py), [security](../backend/app/core/security.py), [config](../backend/app/core/config.py), [auth service](../backend/app/services/auth_service.py).

- **H01 · P2 · C — Response schemas/OpenAPI rõ ràng.** Routes trả dict nhưng chưa có response_model. Thêm schemas response/envelope để tài liệu API thể hiện đúng và test contract, không chỉ input schema.

- **H02 · P2 · R — Lỗi ngoài SQLAlchemy/AppError cần envelope an toàn.** Chưa có handler 500 cuối. Lỗi bất ngờ có thể không phải JSON, khiến frontend json() lỗi thêm. Trả mã chung + request ID, log server đã che secrets; không giấu exception khỏi chẩn đoán.

- **H03 · P1 · C — Headers bảo vệ khi public.** Bản tạm không có CSP/frame protection/nosniff/referrer-policy. Thiết kế CSP khớp assets/fonts/FullCalendar, chống embedding; HSTS chỉ trên HTTPS thật sau kiểm tra, không áp bừa local HTTP.

- **H04 · P2 · C — Cache policy cho API dữ liệu cá nhân.** Probe /auth/me 401 không có Cache-Control; routes không đặt policy riêng. Đặt no-store phù hợp cho auth/tasks/chat và kiểm tra sau logout, không coi đây là bằng chứng đã rò dữ liệu.

- **H05 · P2 · C — Validate Origin cấu hình chặt hơn.** Settings hiện chủ yếu kiểm tra wildcard literal và HTTPS với Secure cookie. Nên parse scheme/host/port, cấm path/query/userinfo và normalize rõ, để sai CORS_ORIGINS fail-fast thay vì login 403 khó hiểu.

- **H06 · P2 · C — Reject secret toàn khoảng trắng.** JWT secret chỉ kiểm độ dài/chuỗi placeholder; chuỗi đủ dài nhưng toàn whitespace có thể qua. Reject rỗng/whitespace và hướng dẫn sinh random; không tự rotate secret đang dùng trong audit.

- **H07 · P2 · R — Chi phí login email không tồn tại và sai password.** Nhánh user=None bỏ qua bcrypt; cân nhắc dummy-hash check và rate limit để giảm khác biệt thời gian. Chưa đo một cuộc tấn công enumeration thực tế.

- **H08 · P2 · R — bcrypt hash hỏng không nên thành lỗi khó hiểu.** verify_password có thể raise khi row chứa hash không hợp lệ, ví dụ dữ liệu import sai. Trả lỗi auth an toàn và log mã lỗi không kèm password/hash.

- **H09 · P2 · ĐX — Log chẩn đoán có request ID/thời gian.** Hiện log chính là Uvicorn access log. Gắn request ID, thời gian DB/provider và error code để phân biệt DB down/quota/JSON lỗi; không log prompt đầy đủ, password, cookie, key hoặc SQL params.

- **H10 · P2 · ĐX — Readiness riêng với liveness.** /health=200 chỉ chứng minh process sống, đã đúng docs. Thêm kiểm tra DB có timeout cho readiness/chạy thử; không gọi Groq thật mỗi health check vì tốn quota và làm app phụ thuộc provider.

## I. Chạy thử, deploy và bảo trì

Nguồn chính: [README](../README.md), [setup](01_SETUP.md), [CI](../.github/workflows/ci.yml), [Render](../render.yaml), [handoff](RELEASE_HANDOFF.md).

- **I01 · P1 · ĐX — Một lệnh dev/demo có kiểm tra prerequisites.** Thay chuỗi lệnh dễ quên bằng script kiểm tra PostgreSQL→migration→build có cần hay không→API, báo cổng/URL rõ. Không initdb/reset database tự động.

- **I02 · P2 · C — Tách hai cấu hình database trong hướng dẫn.** Env example dùng localhost:5432, cụm local của phiên dùng 127.0.0.1:55432/todo_local. Cả hai có thể đúng trên máy khác nhau nhưng cần chọn đúng mode, không copy đè .env đã cấu hình.

- **I03 · P2 · C — UTF-8 và version nhất quán.** Chuẩn hóa hướng dẫn scripts Windows dùng -X utf8. Root Python pin 3.11.9, backend/.python-version là 3.11, package engines rộng hơn Node pin; giải thích baseline đã test và không upgrade hàng loạt.

- **I04 · P1 · T — Deploy HTTPS thật trước khi nói dùng mọi nơi.** Render/Neon/remote CI/release gates còn OPEN theo tài liệu. Cần build/migration/cookie/CSRF/ownership/provider smoke trên đúng commit và URL, không dùng ảnh local thay bằng chứng online.

- **I05 · P2 · ĐX — Hướng dẫn điện thoại cùng Wi-Fi phải đủ host + Origin.** 127.0.0.1 trên điện thoại không phải PC. Dev LAN cần bind API đúng interface, allow Origin IP máy + port và firewall Private tối thiểu; không expose PostgreSQL/key ra LAN/Internet.

- **I06 · P2 · T — Backup và phục hồi thử dữ liệu demo.** Có migration không có nghĩa backup đã phục hồi được. Chuẩn bị backup/restore quy mô nhỏ được phép, không copy pgdata binary qua máy hoặc reset để xử lý lỗi.

- **I07 · P2 · ĐX — Dependencies/constraints sạch và audit định kỳ.** Lock còn constraints transitive từ môi trường cũ, runtime requirements có pytest. Cân nhắc tách dev dependencies/clean-install compatibility, loại constraints không cần sau kiểm tra; không nâng toàn bộ package vì thích bản mới.

- **I08 · P2 · C — Favicon/icon và thông tin demo.** index.html chưa có favicon asset/link, từng thấy /favicon.ico 404. Thêm icon đúng thương hiệu; tài khoản/demo tasks không chứa dữ liệu thật, không ghi password dùng chung vào repo.

- **I09 · P2 · ĐX — Một bảng trạng thái hiện tại dễ tìm.** PROGRESS có nhiều lịch sử và checklist vẫn OPEN hợp lý nhưng dễ đọc nhầm. Giữ lịch sử, thêm liên kết audit/current gates và cách khởi động; không đánh dấu checkbox complete khi mới có config.

## J. Test cần bổ sung; đây không phải các lỗi đã được chứng minh hết

Nguồn chính: [frontend tests](../frontend/src/test/state.test.jsx), [task tests](../frontend/src/test/tasks.test.jsx), [backend fixtures](../backend/tests/conftest.py), [AI acceptance](../scripts/ai_acceptance.py), [smoke](../scripts/smoke.py).

- **J01 · P1 · T — Reload/mất response lúc pending.** Test UI mất context_id nhưng server còn pending, cancel/recover được, không xóa/override trước khi user quyết định; thêm nhiều tab cùng user.

- **J02 · P1 · T — Hết deadline và kết quả mutation chưa rõ.** Test DB down, API không phản hồi, body JSON không kết thúc, mất mạng sau commit. Hết thời gian phải mở khóa UI và hướng dẫn kiểm tra task, không tự gửi lại action.

- **J03 · P1 · T — Hai client sửa cùng task.** Test PUT stale, delete/status khi task đã thay đổi và trường hợp manual override có blocker mới. REST allow_conflict=true hiện đúng contract; nếu muốn ngang chat re-confirm phải đổi contract có chủ đích, không gọi đó là bug trái spec.

- **J04 · P2 · T — Form/modal negative paths.** Thêm test category fetch fail, error cũ ở modal mới, status trong detail reject, dirty close, inputs lúc busy, editor + conflict/delete focus. Hiện RTL giả showModal/close nên chưa chứng minh focus/inert browser thật.

- **J05 · P2 · T — Auth lỗi và response cũ.** Bổ sung duplicate register UI, sai password, 72-byte Unicode, logout network fail, delayed 401 của user trước. Không dùng tài khoản thật để test failure.

- **J06 · P1 · T — Điện thoại thật và accessibility.** Chạy login→Todo→Calendar→chat→confirm với Android/iOS, keyboard, touch, landscape, zoom và screen reader. Snapshot viewport desktop mới là một phần bằng chứng, không là chứng nhận mobile toàn diện.

- **J07 · P2 · C — Unit tests thuần hiện bị gắn PostgreSQL.** Fixture clean(engine,...) autouse áp cả provider/schema/static tests. Tách unit khỏi integration để schema/provider MockTransport chạy được khi DB tắt; giữ mọi integration tests dùng PostgreSQL riêng.

- **J08 · P2 · C — Smoke cần finally cleanup và tiến độ.** smoke.py cleanup ở cuối happy path, assert fail có thể để task synthetic tồn tại; cũng im lặng đến cuối run. Cleanup scoped trong finally, report từng bước an toàn, không account-delete/reset database.

- **J09 · P2 · C — Acceptance phải kiểm tra lỗi cleanup thật.** ai_acceptance.py không thêm cleanup_errors khi GET /tasks trả non-200 thông thường; note có thể nói removed khi chưa xác minh. Theo dõi account nào đã login, kiểm mọi status cleanup/logout và ghi partial cleanup rõ.

- **J10 · P2 · C — Metadata evidence không nên hardcode model đã chạy.** ai_acceptance report configured_target là literal Groq/openai/gpt-oss-20b. Đúng cấu hình lần trước nhưng không tự chứng minh server/model khác trong tương lai. Phân biệt expected/configured/verified và gắn candidate/build ID không chứa secrets.

- **J11 · P2 · T — CI cần thêm contract/a11y/syntax checks phù hợp.** Workflow hiện có tests/build/pip check/Bash syntax tốt; có thể thêm lint, doc/schema checks, audit dependency theo chu kỳ, test responsive trọng điểm. Dùng tool dev nhỏ và pin sau compatibility.

- **J12 · P2 · T — Release candidate phải có evidence mới.** Chạy clean install/build/CI Linux trên đúng SHA, smoke HTTPS, ghi browser/device/viewport/time và known issues. 120 backend tests của session trước không được ghi thành đã rerun trong audit này.

## Dùng trên điện thoại: hai cách, chưa tự áp dụng cấu hình

### 1. Dùng mọi nơi qua HTTPS — phù hợp bản nộp/demo chính thức

Deploy một Render Web Service same-origin + Neon theo [setup](01_SETUP.md) và [handoff](RELEASE_HANDOFF.md). Giữ một worker/instance, DB TLS, COOKIE_SECURE=true và CORS_ORIGINS đúng URL HTTPS thật. Kiểm thử bằng trình duyệt trên điện thoại thật trước khi ghi pass. Hiện các online gates còn OPEN, không có URL release được xác nhận trong audit này.

### 2. Thử cùng Wi-Fi — chỉ development trên mạng tin cậy

`127.0.0.1` trên điện thoại là chính điện thoại, không phải PC. Với code hiện tại, muốn truy cập từ điện thoại phải:

1. PC và điện thoại cùng mạng tin cậy, không bị client isolation; xác định IPv4 LAN của PC.
2. Khởi động backend của project bind đúng interface, ví dụ lệnh dưới từ backend. **Đây là hướng dẫn, audit không chạy lệnh mở LAN này.**
3. Thêm chính xác origin LAN vào CORS_ORIGINS, ví dụ `http://192.168.1.10:8000` chỉ là IP minh họa; restart app để settings được nạp. Không dùng wildcard.
4. Chỉ nếu cần, người dùng tự cho phép TCP8000 trong Windows Firewall profile Private tối thiểu. Không tắt firewall hoặc mở router/public port.
5. Truy cập `http://IP-LAN-CUA-PC:8000` trên điện thoại. Không mở port PostgreSQL55432, không đưa key vào browser.
6. HTTP development không mã hóa login: chỉ dùng tài khoản/dữ liệu thử trên mạng tin cậy. Dữ liệu thật hoặc truy cập từ Internet dùng HTTPS.

```powershell
# Từ thư mục backend; chỉ chạy khi chủ động muốn thử LAN
.\.venv\Scripts\python.exe -X utf8 -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
```

Build frontend đã có sẽ do FastAPI phục vụ; không cần chạy Vite cho trường hợp này. Nếu sửa frontend thì build lại hoặc dùng dev workflow riêng đúng proxy/Origin, không dùng build cũ để đánh giá code mới.

## Thứ tự triển khai gợi ý, chưa là thay đổi đã thực hiện

1. A01–A05: timeout, DB diagnosis/recovery, orphan confirmation, khung giờ Calendar, smoke opt-in.
2. B/C: font, vùng bấm, contrast, keyboard/modal, kiểm tra Android/iOS.
3. D–G: giữ state/draft, hiển thị lỗi/notice đúng, chống stale edits/responses, xử lý import/network failure.
4. A06–A09/H: an toàn khi nhiều client và trước public; giữ scope monolith nhỏ.
5. J + I: tests mới, remote CI/release candidate, HTTPS smoke, demo trên máy thật.

Có thể xử lý cùng nhau các mục fix + regression tương ứng; số mục không phải số sprint hay yêu cầu viết 107 feature riêng. Nhóm chọn ưu tiên theo rubric/thời gian. Không thêm Dashboard/Statistics/Notification/Recommendation, refresh token, category CRUD, chat history DB, multi-worker, recurring/bulk hoặc native app chỉ để làm đẹp danh sách cải tiến.

## Nguồn đối chiếu ngoài repository

- [W3C target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): mức AA24×24CSSpx có ngoại lệ khoảng cách/inline/equivalent; nút22px không tự động đồng nghĩa vi phạm nếu spacing hợp lệ.
- [W3C target size enhanced](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html): 44×44CSSpx là mục tiêu enhanced/AAA hữu ích cho touch, không ghi nhầm thành mọi nút AA bắt buộc44px.
- [W3C contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): chữ thường4,5:1, chữ lớn3:1; màu chữ phụ cần xét với đúng background.
- [MDN viewport concepts](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/CSSOM_view/Viewport_concepts): phân biệt layout/visual viewport, keyboard/zoom; không dùng chỉ một screenshot để chứng minh mobile.
- [OWASP HTTP Headers](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html): cơ sở thiết kế CSP/cache/nosniff/referrer/frame policy; phải thử compatibility trước áp dụng.
- Calendar đã đối chiếu cả source FullCalendar6.1.19 đang cài: default slotMinTime00:00, scrollTime06:00, longPressDelay1000ms. Không suy API v7 thành implementation v6.

Đây là audit kỹ thuật/UX theo scope môn học, không phải chứng nhận an toàn, kiểm toán pháp lý hoặc bảo đảm mọi thiết bị/browser đều tương thích.
