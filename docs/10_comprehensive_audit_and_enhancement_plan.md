# 📋 ĐÁNH GIÁ TOÀN DIỆN TÍNH NĂNG & TRẢI NGHIỆM NGƯỜI DÙNG (UX) SO VỚI GOOGLE CALENDAR, OUTLOOK CALENDAR & MICROSOFT TO DO - KẾ HOẠCH TỐI ƯU HÓA CHI TIẾT (PLANIFY V3)

> **Mã tài liệu:** `docs/10_comprehensive_audit_and_enhancement_plan.md`  
> **Phiên bản:** 3.0.0 - Production Benchmark & Usability Overhaul  
> **Trạng thái:** Hoàn thành rà soát & Kế hoạch triển khai mã nguồn  
> **Đối tượng:** Đội ngũ phát triển Full-Stack Planify, Kiến trúc sư hệ thống, QA & Người dùng

---

## MỤC LỤC
1. [TỔNG QUAN ĐÁNH GIÁ & MA TRẬN ĐỐI CHIẾU TÍNH NĂNG](#1-tổng-quan-đánh-giá--ma-trận-đối-chiếu-tính-năng)
   - 1.1. Ma trận đối chiếu Google Calendar vs Planify
   - 1.2. Ma trận đối chiếu Outlook Calendar vs Planify
   - 1.3. Ma trận đối chiếu Microsoft To Do vs Planify
   - 1.4. Đánh giá tính thân thiện & mức độ dễ thao tác so với chuẩn
2. [DANH MỤC LỖI & KHOẢNG CÁCH UX CẦN KHẮC PHỤC](#2-danh-mục-lỗi--khoảng-cách-ux-cần-khắc-phục)
   - BUG-21: Thiếu chế độ xem Lịch trình (Agenda / Schedule View)
   - BUG-22: Trải nghiệm chọn "Cả ngày" (All-day) trong form sự kiện chưa ẩn trường giờ
   - BUG-23: Thanh bên Calendar thiếu bộ chọn ẩn/hiện nhiều lịch (Calendar Category Toggles)
   - BUG-24: Thiếu hộp thoại xác nhận phạm vi sửa/xóa sự kiện lặp lại (Recurring Scope Dialog)
   - BUG-25: Thiếu phản hồi âm thanh (Completion Chime) khi hoàn thành công việc
   - BUG-26: Thiếu hệ thống phím tắt nhanh toàn cục (Global Keyboard Shortcuts)
   - BUG-27: Trải nghiệm di động (Mobile Drawer Navigation) khi xem màn hình hẹp
3. [THIẾT KẾ GIẢI PHÁP KỸ THUẬT CHI TIẾT](#3-thiết-kế-giải-pháp-kỹ-thuật-chi-tiết)
   - 3.1. Thiết kế AgendaView (Lịch trình tuần tự)
   - 3.2. Chuẩn hóa EventForm & tương tác All-day
   - 3.3. Tích hợp bộ lọc Calendar Checkboxes ở thanh bên
   - 3.4. Module âm thanh Web Audio API Synthetic Chime
   - 3.5. Bộ lắng nghe phím tắt Keyboard Shortcuts Controller
   - 3.6. Dialog lựa chọn phạm vi Recurring Event
4. [KẾ HOẠCH TRIỂN KHAI MÃ NGUỒN & KIỂM THỬ TỰ ĐỘNG](#4-kế-hoạch-triển-khai-mã-nguồn--kiểm-thử-tự-động)
5. [HƯỚNG DẪN THAO TÁC TIỆN LỢI CHO NGƯỜI DÙNG](#5-hướng-dẫn-thao-tác-tiện-lợi-cho-người-dùng)

---

## 1. TỔNG QUAN ĐÁNH GIÁ & MA TRẬN ĐỐI CHIẾU TÍNH NĂNG

### 1.1. Ma trận đối chiếu Google Calendar vs Planify

| Tính năng cốt lõi | Google Calendar | Planify (Hiện tại) | Đánh giá & Khoảng cách |
| :--- | :---: | :---: | :--- |
| **Chế độ xem Tháng (Month View)** | ✅ | ✅ | Đã có ma trận 7xN ngày, đánh dấu ngày hôm nay, hiển thị badge +N khi quá nhiều sự kiện, click ngày tạo nhanh sự kiện. |
| **Chế độ xem Tuần (Week View)** | ✅ | ✅ | Lưới 24h dọc, dải All-day riêng trên đỉnh, tự động cuộn đến giờ làm việc hiện tại, hiển thị song song sự kiện và công việc có giờ. |
| **Chế độ xem Ngày (Day View)** | ✅ | ✅ | Timeline chi tiết theo từng giờ cho 1 ngày duy nhất, tích hợp vạch đỏ thời gian thực. |
| **Chế độ Lịch trình (Agenda / Schedule View)** | ✅ | ❌ *(Thiếu)* | Google Calendar có chế độ cuộn dọc danh sách sự kiện theo thứ tự ngày, rất tiện cho mobile. Planify cần bổ sung ngay `AgendaView`. |
| **Vạch đỏ giờ hiện tại (Current Time Indicator)** | ✅ | ✅ | Tự động tính toán vị trí theo phút hiện tại và cập nhật mỗi 60 giây. |
| **Dải sự kiện Cả ngày (All-Day Slot)** | ✅ | ✅ | Nằm trên đầu lưới giờ, không chiếm chỗ lưới 24h. |
| **Tạo nhanh sự kiện (Quick Create)** | Popover tại ô | Modal trung tâm | Planify dùng modal trực quan, hiển thị ngày giờ rõ ràng, có nút "Thêm chi tiết" và lưu 1-click. |
| **Sự kiện lặp lại (Recurrence / RRULE)** | ✅ | ✅ | Hỗ trợ chuẩn RFC 5545: Daily, Weekly on specific days, Monthly. Đã bung occurrence mượt mà trên frontend. |
| **Hộp thoại phạm vi sửa/xóa lặp lại** | ✅ (This / All) | ⚠️ *(Chưa hỏi)* | Khi xóa hoặc sửa sự kiện lặp, Planify cần hỏi người dùng muốn áp dụng cho "Chỉ sự kiện này" hay "Tất cả sự kiện". |
| **Nhiều bộ lịch & Bộ lọc màu (Multi-calendars)** | ✅ | ⚠️ *(Có DB, thiếu UI)* | Backend đã hỗ trợ nhiều lịch, nhưng Sidebar Calendar thiếu danh sách checkbox để bật/tắt hiển thị từng lịch. |
| **Mini Calendar (Datepicker bên thanh bên)** | ✅ | ✅ | Cho phép nhảy nhanh đến bất kỳ ngày/tháng/năm nào chỉ với 1 click. |

---

### 1.2. Ma trận đối chiếu Outlook Calendar vs Planify

| Tính năng cốt lõi | Outlook Calendar | Planify (Hiện tại) | Đánh giá & Điểm nổi bật của Planify |
| :--- | :---: | :---: | :--- |
| **Time-blocking (Kéo việc vào Lịch)** | Cần mở To-Do sidebar | ✅ Tích hợp tự nhiên | Trong Planify, công việc To-Do chỉ cần chọn giờ bắt đầu và thời lượng là lập tức xuất hiện trên lưới Lịch biểu với màu sắc riêng, thao tác mượt mà và trực quan hơn Outlook. |
| **Phân loại thẻ màu (Categories / Color tags)** | ✅ | ✅ | Task và Event đều có bảng chọn màu sắc trực quan (Xanh lá, Tím, Cam, Đỏ, Lam...). |
| **Độ phức tạp giao diện** | Rất nặng, nhiều menu lồng | Rất tinh gọn, tối giản | Planify loại bỏ toàn bộ các nút dư thừa (Teams link, Room booking, Scheduling Assistant doanh nghiệp), tập trung hoàn toàn vào việc quản lý thời gian cá nhân hiệu quả. |

---

### 1.3. Ma trận đối chiếu Microsoft To Do vs Planify

| Tính năng cốt lõi | Microsoft To Do | Planify (Hiện tại) | Đánh giá & Điểm nổi bật của Planify |
| :--- | :---: | :---: | :--- |
| **Danh sách thông minh "Ngày của tôi" (My Day)** | ✅ | ✅ | Tự động gom việc quan trọng trong ngày, có phụ đề ngày tháng tiếng Việt, hỗ trợ nút "Gợi ý" để thêm việc nhanh. |
| **Danh sách "Quan trọng" (Important / Starred)** | ✅ | ✅ | Nút ngôi sao vàng một chạm, đồng bộ tức thì, lọc riêng những việc ưu tiên cao. |
| **Danh sách "Đã lên kế hoạch" (Planned)** | ✅ | ✅ | Tự động phân loại theo 5 nhóm thời gian: Quá hạn (đỏ), Hôm nay, Ngày mai, Tuần này, Sau đó. |
| **Danh sách "Tất cả công việc" (All Tasks)** | ✅ | ✅ | Hiển thị toàn bộ công việc kèm nhãn tên danh sách chứa nó. |
| **Danh sách tùy chỉnh (Custom Lists)** | ✅ | ✅ | Cho phép tạo danh sách mới với Icon tùy chọn (📝, 🛒, 💼, 🏠...) và bảng màu, đổi tên và xóa danh sách (cascade delete). |
| **Bước nhỏ trong công việc (Subtasks / Steps)** | ✅ | ✅ | Thêm bước không giới hạn, tick hoàn thành từng bước, thanh đếm tiến độ `x/y`, gạch ngang chữ khi xong. |
| **Âm thanh hoàn thành (Completion Chime)** | ✅ (Tiếng "ding") | ⚠️ *(Thiếu)* | Microsoft To Do nổi tiếng với tiếng chuông kích thích cảm giác hoàn thành; Planify sẽ tích hợp qua Web Audio API không tốn tài nguyên. |
| **Kéo thả sắp xếp thứ tự việc (Drag & Drop)** | ✅ | ✅ | Hỗ trợ kéo thả đổi thứ tự các task trong danh sách mượt mà. |
| **Nhóm "Đã hoàn thành" (Collapsible Completed)** | ✅ | ✅ | Thu gọn danh sách đã hoàn thành để giao diện luôn sạch sẽ, có thể bấm mở ra xem lại khi cần. |

---

### 1.4. Đánh giá tính thân thiện & mức độ dễ thao tác so với chuẩn

#### Những điểm Planify đã làm TỐT HƠN và DỄ HƠN các ứng dụng thương mại:
1. **Một ứng dụng duy nhất cho cả Lịch và Việc cần làm**: Người dùng không phải mở 2 tab riêng biệt (như Google Calendar + Google Tasks, hay Outlook + Microsoft To Do). Mọi công việc có khung giờ được hiển thị đồng bộ ngay lập tức lên lịch biểu.
2. **AI Trợ lý thông minh hỗ trợ tiếng Việt bản địa**: Thay vì phải bấm form điền 6 ô dữ liệu, người dùng chỉ cần gõ hoặc nói với AI: *"Lên lịch họp nhóm thứ 2 tuần tới lúc 9h sáng"* hoặc *"Tạo thói quen tập thể dục mỗi ngày lúc 6h sáng"*, AI Agent tự động gọi công cụ tạo đúng chuẩn.
3. **Giao diện tinh gọn, nhẹ và tốc độ tải tức thì**: Xây dựng 100% bằng HTML, CSS và JavaScript thuần (Vanilla JS), không bị phình to bởi các bundle React/Vue nặng hàng chục MB; chuyển đổi chế độ Sáng / Tối lưu bền vững không chớp nháy.

#### Những khoảng cách UX cần hoàn thiện để người dùng thao tác dễ dàng nhất:
1. Bổ sung chế độ xem **Lịch trình (Agenda View)** để người dùng di động lướt xem danh sách việc theo ngày tiện lợi.
2. Form sự kiện: Ẩn ngay 2 trường nhập giờ khi bấm "Cả ngày".
3. Sidebar Lịch: Bổ sung các checkbox hiển thị/ẩn danh sách lịch.
4. Âm thanh chuông hoàn thành (Completion Chime) khi hoàn thành task.
5. Bộ phím tắt điều hướng nhanh (`T`, `M`, `W`, `D`, `A`, `C`, `N`).

---

## 2. DANH MỤC LỖI & KHOẢNG CÁCH UX CẦN KHẮC PHỤC

| Mã | Nhóm | Hiện tượng & Phân tích nguyên nhân | Hướng khắc phục kỹ thuật |
| :--- | :--- | :--- | :--- |
| **BUG-21** | Calendar Views | **Thiếu chế độ xem Lịch trình (Agenda View)**: Người dùng chỉ có thể xem dạng Tháng, Tuần, Ngày; trên màn hình nhỏ hoặc khi muốn nhìn danh sách tổng quan các ngày tiếp theo rất bất tiện. | Xây dựng component `AgendaView` hiển thị danh sách cuộn dọc nhóm theo ngày, tích hợp vào thanh chọn View. |
| **BUG-22** | Calendar Form | **Tương tác All-day trong form tạo/sửa sự kiện**: Khi tick chọn "Cả ngày", hai ô nhập giờ bắt đầu và kết thúc vẫn hiện, gây hiểu nhầm và dễ phát sinh lỗi định dạng giờ nếu người dùng bỏ trống. | Thêm sự kiện `onchange` cho checkbox: ẩn hoặc vô hiệu hóa 2 ô giờ, tự động điền `00:00` và `23:59:59` khi gửi API. |
| **BUG-23** | Calendar Sidebar | **Thanh bên Calendar thiếu bộ lọc danh sách lịch (Multi-calendar Toggles)**: Người dùng không thể bật/tắt hiển thị từng loại lịch (ví dụ chỉ muốn xem Lịch làm việc, ẩn Lịch cá nhân). | Vẽ danh sách các bộ lịch trong `store.get('calendars')` vào sidebar dưới mini-calendar kèm ô checkbox màu sắc. |
| **BUG-24** | Recurrence UX | **Thiếu hộp thoại chọn phạm vi khi sửa/xóa sự kiện lặp**: Khi tương tác với sự kiện lặp, hệ thống tác động trực tiếp vào chuỗi gốc mà không hỏi ý kiến người dùng. | Hiển thị modal hỏi người dùng: "Chỉ sự kiện này" hay "Tất cả các sự kiện trong chuỗi" trước khi xóa/sửa. |
| **BUG-25** | To Do Usability | **Thiếu âm thanh chuông phản hồi hoàn thành (Completion Chime)**: Cảm giác hoàn thành công việc chưa thỏa mãn như Microsoft To Do. | Tạo hàm `playCompletionChime()` sử dụng Web Audio API (sinh 2 nốt nhạc trong trẻo 587Hz -> 880Hz) cực nhẹ và không cần tải asset ngoài. |
| **BUG-26** | UX Navigation | **Thiếu hệ thống phím tắt nhanh toàn cục (Global Keyboard Shortcuts)**: Người dùng phải dùng chuột bấm từng nút điều hướng. | Thêm `KeyboardManager` bắt các phím `T` (Hôm nay), `M` (Tháng), `W` (Tuần), `D` (Ngày), `A` (Lịch trình), `C` (Tạo sự kiện), `N` (Tạo việc), bỏ qua khi đang gõ vào thẻ `<input>` hoặc `<textarea>`. |
| **BUG-27** | Mobile Responsive | **Trải nghiệm trên màn hình di động (<768px)**: Thanh bên (Sidebar) đôi khi lấn chiếm không gian hiển thị của lưới lịch. | Tối ưu hóa CSS breakpoint và drawer toggle để trải nghiệm trên mobile thông thoáng và mượt mà. |

---

## 3. THIẾT KẾ GIẢI PHÁP KỸ THUẬT CHI TIẾT

### 3.1. Thiết kế AgendaView (Lịch trình tuần tự)
- **Tập tin:** `frontend/js/calendar/agenda-view.js`
- **Nguyên lý hoạt động:**
  - Nhận danh sách sự kiện (`events`) và công việc (`tasks`) trong khoảng thời gian từ ngày hiện tại đến 30 ngày tiếp theo.
  - Nhóm các mục theo từng ngày (`YYYY-MM-DD`).
  - Mỗi ngày hiển thị một khối (Day Block):
    + Tiêu đề ngày: Thứ, ngày tháng (đánh dấu nổi bật nếu là Hôm nay).
    + Danh sách thẻ sự kiện và công việc trong ngày đó, hiển thị giờ bắt đầu - kết thúc, chấm màu lịch và tiêu đề.
    + Nếu ngày không có sự kiện/việc làm, hiển thị dòng thông báo nhẹ: *"Không có sự kiện nào"*.
  - Cho phép click vào bất kỳ mục nào để mở chi tiết hoặc sửa.

### 3.2. Chuẩn hóa EventForm & tương tác All-day
- **Tập tin:** `frontend/js/calendar/event-form.js`
- **Cải tiến:**
  - Khi checkbox `allDayCheckbox` thay đổi trạng thái:
    + Nếu `checked = true`: Ẩn 2 ô `startTimeInput` và `endTimeInput` (hoặc đặt `display: none` cho vùng chứa giờ).
    + Nếu `checked = false`: Hiện lại 2 ô nhập giờ.
  - Khi submit: Nếu `is_all_day === true`, tự động gán `start_at` là `00:00:00` và `end_at` là `23:59:59` của ngày đã chọn, tránh sinh lỗi `Invalid Date`.

### 3.3. Tích hợp bộ lọc Calendar Checkboxes ở thanh bên
- **Tập tin:** `frontend/js/pages/calendar.js`
- **Cải tiến:**
  - Dưới `MiniCalendar` trên thanh bên trái, bổ sung khối **"Lịch của tôi"**:
    + Danh sách tất cả calendars của người dùng.
    + Mỗi lịch có một checkbox mang màu đặc trưng của lịch đó và tên lịch.
    + State lưu trong `activeCalendarIds` (mặc định chọn tất cả).
    + Khi người dùng bỏ tick một lịch, hàm `renderView()` lọc bỏ các sự kiện thuộc `calendar_id` đó ngay lập tức mà không cần gọi lại API backend.
    + Bổ sung nút nhỏ `+ Thêm lịch` cho phép tạo nhanh bộ lịch mới.

### 3.4. Module âm thanh Web Audio API Synthetic Chime
- **Tập tin:** `frontend/js/utils/sound.js`
- **Nguyên lý:**
  - Sử dụng đối tượng tiêu chuẩn `window.AudioContext || window.webkitAudioContext`.
  - Khởi tạo `OscillatorNode` dạng sóng sin (`sine`) phát tần số nốt D5 (587.33 Hz) kéo dài 0.1s, sau đó chuyển sang nốt A5 (880.00 Hz) kéo dài 0.25s kèm bộ giảm âm lượng `GainNode` tắt dần mềm mại (exponential ramp down).
  - Hoạt động 100% offline, dung lượng code chưa đến 20 dòng, không phụ thuộc file mp3 ngoài, không bị chặn bởi CORS hay lỗi mạng.

### 3.5. Bộ lắng nghe phím tắt Keyboard Shortcuts Controller
- **Tập tin:** `frontend/js/utils/keyboard.js`
- **Nguyên tắc an toàn:**
  - Bắt sự kiện `window.addEventListener('keydown', ...)`.
  - Kiểm tra nếu thẻ đang focus là `INPUT`, `TEXTAREA` hoặc `contenteditable`, bỏ qua toàn bộ phím tắt đơn lẻ để người dùng thoải mái soạn thảo văn bản.
  - Bảng ánh xạ phím tắt:
    + `T`: Di chuyển về Hôm nay (Today).
    + `M`: Chuyển sang chế độ Tháng (Month View).
    + `W`: Chuyển sang chế độ Tuần (Week View).
    + `D`: Chuyển sang chế độ Ngày (Day View).
    + `A`: Chuyển sang chế độ Lịch trình (Agenda View).
    + `C`: Mở modal Tạo sự kiện nhanh.
    + `N`: Chuyển sang To Do và focus vào ô nhập công việc mới.
    + `?` hoặc `H`: Bật bảng Hướng dẫn sử dụng & Phím tắt.

---

## 4. KẾ HOẠCH TRIỂN KHAI MÃ NGUỒN & KIỂM THỬ TỰ ĐỘNG

| Giai đoạn | Nội dung thực hiện | Tập tin liên quan | Tiêu chí nghiệm thu (Acceptance Criteria) |
| :--- | :--- | :--- | :--- |
| **Bước 1** | Viết module âm thanh Web Audio API & phím tắt | `frontend/js/utils/sound.js`<br>`frontend/js/utils/keyboard.js` | Phát tiếng chuông khi tick hoàn thành; phím tắt hoạt động chuẩn xác, không kẹt khi gõ văn bản. |
| **Bước 2** | Xây dựng AgendaView (Lịch trình) | `frontend/js/calendar/agenda-view.js` | Hiển thị danh sách sự kiện & task theo ngày cuộn dọc, chuyển tab mượt mà. |
| **Bước 3** | Nâng cấp EventForm & Bộ lọc Calendar Sidebar | `frontend/js/calendar/event-form.js`<br>`frontend/js/pages/calendar.js` | Ẩn giờ khi chọn All-day; bật/tắt checkbox ẩn hiện sự kiện theo từng lịch. |
| **Bước 4** | Tích hợp âm thanh chuông vào To Do | `frontend/js/todo/task-item.js`<br>`frontend/js/todo/task-detail.js` | Khi người dùng tick checkbox hoàn thành, âm thanh phát ra ngay lập tức kèm animation gạch ngang. |
| **Bước 5** | Kiểm thử tự động E2E & Browser Console Audit | Toàn bộ hệ thống Docker | 0 lỗi JavaScript console; tất cả test suite backend và frontend chạy pass 100%. |

---

## 5. HƯỚNG DẪN THAO TÁC TIỆN LỢI CHO NGƯỜI DÙNG

### 1. Thao tác trên Lịch biểu (Calendar):
- **Xem lịch linh hoạt**: Bấm vào các nút `Tháng`, `Tuần`, `Ngày`, hoặc `Lịch trình` ở thanh công cụ phía trên (hoặc dùng phím tắt `M`, `W`, `D`, `A`).
- **Tạo sự kiện siêu nhanh**: Click vào bất kỳ ô giờ nào trên lưới lịch để tạo nhanh sự kiện tại đúng giờ đó.
- **Lọc bộ lịch**: Dùng các ô checkbox ở thanh bên trái dưới lịch mini để ẩn/hiện sự kiện của từng nhóm lịch.

### 2. Thao tác trên Việc cần làm (To Do):
- **Thêm việc 1 chạm**: Gõ tiêu đề vào thanh nhập dưới cùng và bấm `Enter`.
- **Gắn khung giờ lên Lịch**: Click nút `⏰ Khung giờ` ngay trên thanh nhập (hoặc trong bảng chi tiết bên phải) để công việc tự động đồng bộ lên lưới 24h của Lịch biểu.
- **Hoàn thành việc**: Click vào ô tròn đầu mỗi việc để nghe âm thanh chuông và tự động gom vào mục "Đã hoàn thành".

### 3. Thao tác với Trợ lý AI:
- Bấm vào biểu tượng robot 🤖 ở thanh bên trái hoặc góc trên để mở bảng hội thoại.
- Gõ câu lệnh tự nhiên: *"Lên lịch họp sáng mai lúc 9 giờ"* hoặc *"Thêm công việc Mua tài liệu vào Ngày của tôi"*, AI sẽ lập tức xử lý và đồng bộ trực tiếp lên giao diện.

---
*Tài liệu được soạn thảo và kiểm định để chuẩn hóa toàn bộ tính năng và trải nghiệm người dùng của Planify tương đương các nền tảng hàng đầu thế giới.*

