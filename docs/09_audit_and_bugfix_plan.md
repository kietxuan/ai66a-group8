# 🔍 BÁO CÁO RÀ SOÁT LỖI TOÀN DIỆN & KẾ HOẠCH HOÀN THIỆN CHI TIẾT (PLANIFY - V2)

> **File tài liệu:** `docs/08-audit-and-bugfix-plan.md`  
> **Mục tiêu:** Rà soát sâu toàn bộ kiến trúc thiết kế (`docs/00` → `docs/07`), đối chiếu với mã nguồn hiện tại (`backend/`, `frontend/`) và giải quyết triệt để **7 nhóm lỗi giao diện & tính năng do người dùng phản ánh** cùng **13 lỗi kỹ thuật/logic hệ thống** phát hiện qua 2 vòng kiểm định chuyên sâu.

---

## PHẦN 1: TỔNG HỢP 20 HẠNG MỤC LỖI QUA 2 VÒNG RÀ SOÁT CHUYÊN SÂU

Bảng tổng hợp toàn bộ **20 lỗi** (bao gồm 7 vấn đề người dùng trực tiếp phát hiện và 13 lỗi kỹ thuật/UX tiềm ẩn trong code & docs):

| Mã lỗi | Nhóm vấn đề | Mô tả chi tiết lỗi phát hiện | Mức độ |
| :--- | :--- | :--- | :--- |
| **BUG-01** | Luồng điều hướng & Auth | Thiếu trang **Landing Page** giới thiệu sản phẩm trước khi đăng nhập; mọi đường dẫn khi chưa đăng nhập đều bị ép nhảy thẳng về `#login` | **Critical** |
| **BUG-02** | UX / Onboarding | Thiếu **Thẻ hướng dẫn thao tác (User Guide Banner / Onboarding Card)** nằm phía trên Lịch biểu và To Do để hướng dẫn người dùng mới sử dụng | **High** |
| **BUG-03** | To Do - Custom Lists | **Không thể thêm Danh sách mới (Task List)** trong phần Việc cần làm do đứt gãy Event Binding ở Sidebar, lệch cấu trúc JSON trả về và thiếu tự động tính `position` | **Critical** |
| **BUG-04** | Recurrence (RRULE) | **Chức năng lặp lại (Sự kiện & Việc cần làm)** và các chức năng phụ (Steps, My Day, Filter/Sort) hoạt động sai hoặc mất sự kiện lặp khi chuyển tuần/tháng | **Critical** |
| **BUG-05** | Đồng bộ Calendar ↔ To Do | Việc cần làm (To Do) **thiếu điều chỉnh khung thời gian (`start_time`, `end_time`, `duration_minutes`, `is_all_day`)**, bị ép nằm cố định ở thanh All-day thay vì gắn vào khung giờ cụ thể (Time-Blocking) | **Critical** |
| **BUG-06** | Theme & Persistence | **Đổi sang Dark Mode nhưng khi F5 (load lại trang) lại bị nhảy về chế độ Sáng (Light Mode)** do thẻ `<html data-theme="light">` hardcode, `app.js` ghi đè `user.theme_preference = "light"` từ DB (chưa lưu API khi bấm nút toggle) và nháy trắng màn hình (FOUC) | **Critical** |
| **BUG-07** | UI Palette & Visual Hierarchy | **Giao diện Light Mode quá nhiều màu trắng đơn điệu (`#ffffff`, `#fafafa`, `#f5f5f5`)**, thiếu chiều sâu thị giác, thiếu màu nhấn phân tách giữa Sidebar, Header, Card, Ngày hiện tại và các Smart Lists | **High** |
| **BUG-08** | Backend Exception | Lỗi cú pháp trong `ErrorDetail.throw()` (`backend/app/core/exceptions.py`) quên từ khóa `raise`, làm các lỗi 401/400/404 không dừng hàm mà trôi xuống gây lỗi `500 Internal Server Error` | **Blocker** |
| **BUG-09** | Backend OTP Helper | `auth_service.py` gọi `from app.helper.otp import send_email` nhưng trong `otp.py` hoàn toàn chưa định nghĩa hàm `send_email` (gây `ImportError` khi khởi chạy) | **Blocker** |
| **BUG-10** | Auth Login Content-Type | Endpoint `POST /api/v1/auth/login` dùng `OAuth2PasswordRequestForm` bắt buộc gửi `application/x-www-form-urlencoded` với trường `username`, trong khi `api.js` lại gửi `application/json` với `{email, password}` gây lỗi `422 Unprocessable Entity` | **Blocker** |
| **BUG-11** | Auth Register Endpoint Path | `docs/02` ghi đường dẫn đăng ký là `POST /api/v1/auth/register`, nhưng code thực tế trong `backend/app/api/v1/endpoints/users.py` lại đặt ở `POST /api/v1/users/register` | **High** |
| **BUG-12** | API Response Format | Xung đột định dạng JSON giữa `ApiResponse` (`{success, message, data}`) và `api.js` (đọc `error.detail` thay vì `error.error.message`, đọc trực tiếp response thay vì unwrap `response.data`) | **High** |
| **BUG-13** | Timezone Drift (Lệch múi giờ) | Khi chuyển đổi `Date` sang chuỗi bằng `.toISOString()` ở Frontend (múi giờ UTC) để gửi lên Backend (múi giờ `+07:00`), sự kiện và ngày hạn (`due_date`) bị lùi mất 7 tiếng (ví dụ chọn 00:00 ngày 02/11 bị lùi thành 17:00 ngày 01/11) | **High** |
| **BUG-14** | Keyboard Shortcuts Bug | Phím tắt toàn cục (`D, W, M, T, N, S, Space, Delete`) kích hoạt ngay cả khi người dùng đang gõ chữ vào ô `<input>` hoặc `<textarea>` (ví dụ gõ chữ "N" hoặc "Space" trong tiêu đề công việc bị bật popup tạo mới hoặc tự tick hoàn thành!) | **High** |
| **BUG-15** | Event Overlap & Scroll | Lưới lịch 24 giờ bắt đầu từ `00:00` không tự động cuộn (`auto-scroll`) đến khung giờ làm việc (`07:00 - 08:00`), và khi có 2 sự kiện trùng giờ chưa chia cột (`width: 50%`, `left: 50%`) nên bị đè chồng lên nhau | **Medium** |
| **BUG-16** | Browser Reminder Notification | Có bảng `event_reminders` và trường `reminder_at` trong `tasks` nhưng hoàn toàn **thiếu bộ chạy ngầm (Reminder Polling / Web Notification + In-App Toast + Âm báo)** ở Frontend để nhắc người dùng khi đến giờ | **High** |
| **BUG-17** | Cross-Module State Sync | Khi AI Agent thực thi tool (`create_event`, `create_task`, `complete_task`, `delete_task`), dữ liệu trong DB thay đổi nhưng giao diện Calendar/To Do đang mở bên dưới không tự động làm mới (`refresh`) | **High** |
| **BUG-18** | Database Schema Mismatch | Xung đột tên cột trong `event_reminders` (`remind_at` vs `minutes_before`); thiếu cột `color` / `category_id` trên `tasks` để đồng bộ màu sắc với Lịch biểu | **Medium** |
| **BUG-19** | Docker Healthcheck & CORS | `docker-compose.yml` gọi healthcheck `http://localhost:8000/health` chưa tồn tại; `backend/main.py` thiếu cấu hình `CORSMiddleware` gây lỗi chặn CORS khi phát triển | **High** |
| **BUG-20** | Default Data Seeding | Tài khoản Admin tạo lúc khởi chạy (`admin.py`) và tài khoản cũ chưa có sẵn Calendar `"Lịch của tôi"` và TaskList `"Tasks"` mặc định, gây lỗi khóa ngoại khi tạo nhanh sự kiện/task | **High** |

---

## PHẦN 2: PHÂN TÍCH CHI TIẾT & GIẢI PHÁP CHO 7 NHÓM VẤN ĐỀ NGƯỜI DÙNG PHẢN ÁNH

### 1. LỖI 1: Thiếu trang Landing Page & Cơ chế tự động nhảy về trang Đăng nhập (`BUG-01`)

#### 🔍 Nguyên nhân gốc rễ (Root Cause)
- Trong `docs/06-frontend-architecture.md` (Mục 3.1, 3.2 và 5.1):
  - `index.html` chỉ có 2 vùng chứa: `#auth-container` (Login/Register) và `#app-container` (Main App). Hoàn toàn **không có vùng chứa hay route cho trang Landing Page (`#landing` / `#home`)**.
  - Trong `router.js`: `const hash = window.location.hash.slice(1) || 'calendar';` mặc định đẩy thẳng vào `'calendar'`.
  - Khi trang `'calendar'` được gọi, nó lập tức gọi API `/api/v1/events` và `/api/v1/calendars`. Do người dùng chưa đăng nhập (không có `access_token`), backend trả về `401 Unauthorized`.
  - Hàm `handleUnauthorized()` trong `api.js` lập tức thực thi: `window.location.hash = 'login'`. Hệ quả là khách truy cập vào bất kỳ đường dẫn nào của web cũng bị giật màn hình và đá thẳng về trang Đăng nhập mà không biết ứng dụng này là gì.

#### 🛠️ Thiết kế giải pháp & Kế hoạch chỉnh sửa
1. **Phân tách rõ Public Routes và Protected Routes trong `js/router.js`:**
   - **Public Routes** (Truy cập tự do không cần đăng nhập):
     - `#` hoặc `#home` hoặc `#landing` → Trang **Landing Page** giới thiệu Planify.
     - `#login` → Trang Đăng nhập.
     - `#register` → Trang Đăng ký.
     - `#forgot-password` → Trang Quên mật khẩu / Xác thực OTP.
   - **Protected Routes** (Yêu cầu phải có JWT hợp lệ):
     - `#calendar`, `#todo`, `#ai`, `#settings`.
   - **Logic Route Guard trong `router.js`:**
     - Nếu người dùng **chưa đăng nhập** (`!auth.isAuthenticated()`):
       - Khi vào `/`, `#`, `#home`, `#landing` → Hiển thị **Landing Page** (`#landing-container`), tuyệt đối không gọi các API yêu cầu xác thực để tránh lỗi 401.
       - Khi vào một Protected Route (ví dụ `#calendar` hoặc `#todo`) → Lưu lại đường dẫn đích vào `sessionStorage.setItem('redirect_after_login', hash)`, sau đó điều hướng về `#login` kèm thông báo *"Vui lòng đăng nhập để tiếp tục"* và có nút *"← Quay về Trang chủ"*.
     - Nếu người dùng **đã đăng nhập** (`auth.isAuthenticated()`):
       - Khi vào `#login`, `#register` → Tự động chuyển thẳng vào `#calendar` (hoặc trang đã lưu trong `redirect_after_login`).
2. **Thiết kế chi tiết Trang Landing Page (`js/pages/landing.js` & `css/pages/landing.css`):**
   - **Header / Navbar:** Logo **Planify** với gradient màu thương hiệu, menu điều hướng (*Tính năng*, *Lịch & To Do*, *Trợ lý AI*, *Hướng dẫn*), nút chuyển đổi Sáng/Tối (☀️/🌙), nút **Đăng nhập** (`#login`) và nút CTA nổi bật **Bắt đầu miễn phí** (`#register`).
   - **Hero Section:**
     - Tiêu đề lớn với hiệu ứng chữ Gradient: *"Planify — Quản lý Lịch biểu & Việc cần làm thông minh cùng AI"*.
     - Mô tả: Kết hợp liền mạch giữa Lịch (Calendar), Danh sách công việc (To Do) có gắn khung giờ (Time-Blocking) và Trợ lý AI tiếng Việt tự động lên lịch.
     - Hình minh họa trực quan (Interactive UI Preview mô phỏng Lịch biểu đa sắc màu + To Do + AI Chat).
   - **Feature Cards (3 trụ cột chính với các dải màu sắc sinh động):**
     - 📅 **Lịch biểu thông minh (Indigo/Blue):** Xem theo Ngày/Tuần/Tháng, kéo thả sự kiện, lặp lại linh hoạt.
     - ✅ **To Do gắn liền Thời gian (Emerald/Teal):** Quản lý My Day, Important, Planned, danh sách tùy chỉnh và đặt khung giờ trực tiếp lên lịch.
     - 🤖 **Planify AI Agent (Violet/Purple):** Ra lệnh bằng ngôn ngữ tự nhiên để thêm việc, xếp lịch và nhận gợi ý tối ưu thời gian.

---

### 2. LỖI 2: Bổ sung Thẻ Hướng Dẫn (User Guide Card) phía trên Lịch biểu (`BUG-02`)

#### 🔍 Nguyên nhân gốc rễ (Root Cause)
- Giao diện Calendar có nhiều thao tác tương tác (click ô trống tạo nhanh, kéo thả đổi giờ, kéo cạnh dưới chỉnh thời lượng, phím tắt `D/W/M/T/N`, tích hợp checkbox To Do trên lịch) nhưng hoàn toàn **thiếu thẻ hướng dẫn trực quan**, khiến người dùng bỡ ngỡ.

#### 🛠️ Thiết kế giải pháp & Kế hoạch chỉnh sửa
1. **Vị trí hiển thị:**
   - Đặt ngay phía trên khu vực Lịch biểu chính (giữa thanh `Calendar Header Toolbar` và lưới `Calendar Grid` trong `js/pages/calendar.js`).
   - Có nút **`[❓ Hướng dẫn]`** nổi bật trên thanh Header của Lịch biểu để người dùng có thể bật/tắt (Expand/Collapse) bất cứ lúc nào.
2. **Thiết kế giao diện Thẻ Hướng Dẫn (`js/components/guide-card.js` & `css/components/guide-card.css`):**
   - Nền thẻ sử dụng dải màu **Soft Indigo-Blue Tint** (`linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)` ở Light Mode và `linear-gradient(135deg, #1E293B 0%, #1E1B4B 100%)` ở Dark Mode) với viền trái điểm nhấn màu `#4F46E5`, giúp tách biệt hoàn toàn với nền lịch trắng:
   ```
   ┌──────────────────────────────────────────────────────────────────────────────────────┐
   │ 💡 Hướng dẫn thao tác nhanh trên Lịch biểu                     [Thu gọn ▲]  [Đóng ✕] │
   ├─────────────────────────┬─────────────────────────┬──────────────────────────────────┤
   │ 🖱️ Tạo & Chỉnh sửa      │ ✋ Kéo thả & Thời lượng  │ ⌨️ Phím tắt & Tích hợp To Do     │
   │ • Click ô trống: Tạo    │ • Kéo sự kiện/task: Đổi │ • Phím D / W / M: Đổi chế độ xem │
   │   nhanh sự kiện/việc làm│   giờ hoặc chuyển ngày  │ • Phím T: Về hôm nay | N: Tạo mới│
   │ • Click vào thẻ: Xem    │ • Kéo cạnh dưới: Tăng/  │ • Việc cần làm có hẹn giờ sẽ     │
   │   chi tiết, sửa hoặc xóa│   giảm thời lượng       │   hiện trực tiếp trên khung giờ  │
   └─────────────────────────┴─────────────────────────┴──────────────────────────────────┘
   ```
3. **Cơ chế lưu trạng thái:**
   - Lưu trạng thái thu gọn/mở rộng vào `localStorage.getItem('planify_guide_collapsed')` để tôn trọng lựa chọn của người dùng, nhưng nút `❓ Hướng dẫn` trên thanh công cụ luôn hiển thị để mở lại ngay khi cần.

---

### 3. LỖI 3: Không thể thêm Danh sách mới (Custom List) trong Việc cần làm (`BUG-03`)

#### 🔍 Nguyên nhân gốc rễ (Root Cause)
1. **Đứt gãy sự kiện nút `+ Tạo list mới`:** Nút nằm ở `smart-lists.js` (Sidebar) nhưng logic mở Modal lại đặt ở `task-list-view.js` hoặc bị mất sự kiện click sau khi re-render Sidebar.
2. **Xung đột cấu trúc JSON trả về:** `GET /api/v1/lists` trả về `{ lists: [...] }` hoặc `{ data: [...] }`, trong khi `POST /api/v1/lists` trả về 1 object đơn lẻ; Frontend không chuẩn hóa nên mảng `store.state.taskLists` bị lỗi hoặc không cập nhật.
3. **Thiếu tự động tính `position` & Lazy Seeding:** Backend chưa tự tính `position = max + 1` và chưa tự tạo list `"Tasks"` mặc định cho tài khoản cũ/Admin.

#### 🛠️ Thiết kế giải pháp & Kế hoạch chỉnh sửa
1. **Ở Backend (`task_lists.py`, `task_list_service.py`, `task_schema.py`):**
   - Cho phép truyền `name`, `color` (mặc định `#4F46E5`), `icon` (mặc định `📝`), tự động tính `position` tiếp theo.
   - Bổ sung cơ chế **Lazy Seeding**: Khi gọi `GET /api/v1/lists`, nếu user chưa có list mặc định, tự động tạo ngay list `"Tasks"`.
   - Đảm bảo `POST /api/v1/lists` trả về đầy đủ `task_count: 0`, `completed_count: 0`.
2. **Ở Frontend (`smart-lists.js`, `todo.js`):**
   - Gắn sự kiện trực tiếp (Event Delegation) cho nút `+ Tạo danh sách mới` và ô nhập nhanh trên Sidebar.
   - Hỗ trợ chọn **10 màu sắc nổi bật** và **12 Emoji Icon** trực quan.
   - Ngay sau khi `POST /api/v1/lists` thành công: cập nhật `store.set('taskLists', ...)`, re-render Sidebar, tự động chuyển sang danh sách vừa tạo và hiển thị Toast thông báo.
   - Thêm nút menu `⋮` trên mỗi danh sách tùy chỉnh để **Đổi tên / Đổi màu & Icon / Xóa danh sách**.

---

### 4. LỖI 4: Chức năng Lặp lại (Recurrence) và các chức năng khác hoạt động chưa đúng (`BUG-04`)

#### 🔍 Nguyên nhân gốc rễ (Root Cause)
1. **Sự kiện lặp lại biến mất khi chuyển tuần/tháng:** Truy vấn `GET /api/v1/events?start=...&end=...` lọc cứng `Event.start_at >= start`. Khi sự kiện gốc tạo ở tuần trước (`01/11`) có `recurrence_rule = "FREQ=DAILY"`, sang tuần sau (`09/11`), điều kiện `start_at >= 09/11` loại bỏ mất sự kiện gốc!
2. **Sửa/Xóa 1 buổi trong chuỗi lặp (`scope=this|following|all`) bị lỗi:** Thiếu cột `is_cancelled` trong bảng `events`; chưa ghép đúng `original_start` của bản ghi ngoại lệ (`is_exception=True`) để ghi đè hoặc ẩn buổi đã xóa.
3. **Task lặp lại (Recurring Tasks) không sinh bản sao mới chuẩn xác:** Khi hoàn thành Task lặp lại nhưng Task chưa có `due_date` thì bị lỗi `NoneType`; khi bỏ tick hoàn thành lại sinh thêm bản sao trùng; quên sao chép các bước nhỏ (`steps`) sang Task kỳ tiếp theo.
4. **Các chức năng phụ khác bị lỗi:**
   - **Smart List `My Day`**: Quên kiểm tra `my_day_date == date.today()` nên không tự reset qua ngày mới.
   - **Subtasks (`Steps`)**: Thêm/xóa/tick hoàn thành step trong panel chi tiết không cập nhật lại tiến độ `1/3 bước` trên thẻ Task ở danh sách chính.
   - **Sort & Filter**: Đổi tiêu chí sắp xếp (Quan trọng, Ngày hạn, Tên A-Z, Ngày tạo) chưa re-render danh sách hoặc làm mất nhóm `Đã hoàn thành`.
   - **Checkbox ẩn/hiện Lịch ở Sidebar**: Bỏ chọn lịch nhưng sự kiện thuộc lịch đó vẫn hiển thị trên lưới lịch.

#### 🛠️ Thiết kế giải pháp & Kế hoạch chỉnh sửa
1. **Truy vấn & Bung chuỗi Sự kiện lặp lại chuẩn xác:**
   - Sửa câu truy vấn SQL trong `event_crud.py`: Lấy tất cả sự kiện không lặp nằm trong `[start, end]` **CỘNG VỚI** tất cả sự kiện gốc có `recurrence_rule IS NOT NULL` mà `start_at <= end` và `(recurrence_end IS NULL OR recurrence_end >= start)`.
   - Thêm cột `is_cancelled = Column(Boolean, default=False)` vào bảng `events`.
   - Xây dựng module `rrule_helper.py` ở Backend và `rrule.js` đồng bộ ở Frontend hỗ trợ đầy đủ `FREQ=DAILY|WEEKLY|MONTHLY|YEARLY`, `INTERVAL`, `BYDAY`, `BYMONTHDAY`, `COUNT`, `UNTIL`.
2. **Hoàn thiện Chu trình Lặp lại của Việc cần làm (`task_service.py`):**
   - Khi `PATCH /api/v1/tasks/{id}/complete` chuyển trạng thái từ `False → True` cho task có `recurrence_rule`:
     - Tính `next_due_date` từ `task.due_date` (hoặc `date.today()` nếu `due_date` trống).
     - Tạo Task mới cho kỳ tiếp theo, giữ nguyên `title`, `note`, `list_id`, `is_important`, `recurrence_rule`, `start_time`, `end_time`, `duration_minutes`, `is_all_day`, `color` và sao chép toàn bộ `steps` (đặt lại `is_completed = False`).
     - Trả về cả `completed_task` và `next_task` trong response để Frontend cập nhật ngay lập tức lên giao diện mà không cần F5!

---

### 5. LỖI 5: Điều chỉnh Thời gian cho Việc cần làm & Kết hợp đồng bộ 2 chiều Calendar ↔ To Do (`BUG-05`)

#### 🔍 Nguyên nhân gốc rễ (Root Cause)
- Bảng `tasks` chỉ có `due_date` và `due_time` đơn lẻ; tài liệu `docs/03` ép mọi Task hiển thị cố định ở ô `All-day` trên lịch. Người dùng không thể đặt **Giờ bắt đầu - Giờ kết thúc (Time-Blocking)** cho một công việc cần làm, cũng không thể kéo thả công việc đó vào khung giờ trong ngày trên Lịch biểu.

#### 🛠️ Thiết kế giải pháp & Kế hoạch chỉnh sửa
1. **Mở rộng bảng `tasks` & Pydantic Schemas:**
   - Thêm các trường:
     - `start_time` (`Time`, nullable): Giờ bắt đầu thực hiện (VD: `08:30`).
     - `end_time` (`Time`, nullable): Giờ kết thúc dự kiến (VD: `10:00`).
     - `duration_minutes` (`Integer`, default `60`): Thời lượng công việc (phút).
     - `is_all_day` (`Boolean`, default `True`): `True` nếu chỉ gán ngày hạn chung; `False` nếu có gán khung giờ cụ thể trên lịch.
     - `color` (`String(7)`, nullable): Màu sắc riêng của Task (hoặc kế thừa từ màu của `TaskList`).
2. **Giao diện Điều chỉnh Thời gian linh hoạt trong To Do & Calendar:**
   - Trong **Thanh tạo Task nhanh** và **Bảng Chi tiết Task (Sidebar phải)**:
     - Cho phép chọn **Ngày thực hiện (`due_date`)**.
     - Cho phép bật/tắt **Đặt khung giờ trên lịch (`start_time` → `end_time`)** kèm các nút chọn nhanh thời lượng (`15p`, `30p`, `45p`, `1h`, `1.5h`, `2h`) hoặc `Cả ngày`.
   - Trên **Lịch biểu (Day View, Week View, Month View)**:
     - **Task có khung giờ (`is_all_day = False`)**: Hiển thị trực tiếp thành một khối công việc (**Task Time-Block**) ngay tại khung giờ `start_time → end_time` trên lưới 24h, có icon Checkbox `☐`, nhãn `[Việc cần làm]` và viền phân biệt rõ với Sự kiện.
     - **Task cả ngày (`is_all_day = True`)**: Hiển thị trên thanh `All-day`.
     - **Kéo thả 2 chiều trên Lịch biểu:**
       - Kéo Task từ thanh `All-day` thả vào ô `09:00` trên lưới lịch → Tự động gán `start_time = 09:00`, `end_time = 10:00`, `is_all_day = False`.
       - Kéo di chuyển khối Task trên lịch sang giờ khác/ngày khác hoặc kéo cạnh dưới để tăng/giảm thời lượng → Tự động cập nhật `due_date`, `start_time`, `end_time`, `duration_minutes` của Task!
     - **Modal Tạo mới hợp nhất trên Lịch biểu:** Khi click vào bất kỳ ô giờ nào trên lịch, Modal cho phép chuyển tab **`[📅 Tạo Sự kiện]`** hoặc **`[✅ Tạo Việc cần làm]`** ngay tại khung giờ vừa chọn.

---

### 6. LỖI 6 (MỚI): Đổi sang Dark Mode nhưng Load lại trang (F5) bị nhảy về Light Mode (`BUG-06`)

#### 🔍 Nguyên nhân gốc rễ (Root Cause)
Qua kiểm tra chi tiết `docs/06-frontend-architecture.md` và `docs/01-database-schema.md`, có **3 nguyên nhân trực tiếp** khiến Dark Mode bị mất khi tải lại trang:

1. **Thẻ `<html>` trong `index.html` bị gán cứng `data-theme="light"`:**
   - Trong `docs/06` (Mục 5.1): `<html lang="vi" data-theme="light">`, và script `js/theme.js` lại được đặt ở **cuối thẻ `<body>`** (sau hàng loạt file CSS). Khi trình duyệt tải trang, nó luôn render `light` trước hoặc nếu có bất kỳ script nào phía trước (`api.js`, `auth.js`) lỗi/redirect, `theme.js` chưa kịp chạy hoặc bị reset.
2. **Dữ liệu `user.theme_preference` từ Backend ghi đè lại `localStorage` khi khởi động app (`app.js` / `auth.js`):**
   - Trong bảng `users` (`docs/01`), cột `theme_preference` có giá trị mặc định là `"light"`.
   - Khi người dùng bấm nút đổi sang Dark Mode (`#theme-toggle`), hàm `themeManager.toggle()` trong `docs/06` (Mục 3.4) **chỉ lưu vào `localStorage.setItem('theme', 'dark')` mà KHÔNG gọi API `PUT /api/v1/users/me` để lưu `theme_preference = "dark"` xuống Database**.
   - Ngay khi người dùng nhấn **F5 (Load lại trang)**, hàm khởi tạo `app.init()` gọi `GET /api/v1/users/me`, nhận về `user.theme_preference = "light"` từ Database rồi gọi `themeManager.apply(user.theme_preference)` → **Đè ngược từ `"dark"` về lại `"light"`!**
3. **Key lưu trong `localStorage` không đồng nhất hoặc bị xóa khi Logout/Refresh:**
   - Một số file dùng key `'theme'`, chỗ khác dùng `'planify_theme'` hoặc `'theme_preference'`, hoặc dùng `localStorage.clear()` khi xử lý token khiến cài đặt giao diện bị xóa sạch.

#### 🛠️ Thiết kế giải pháp & Kế hoạch chỉnh sửa triệt để

1. **Chống nháy trắng (Anti-FOUC) ngay trên `<head>` của `index.html`:**
   - Bỏ thuộc tính cứng `data-theme="light"` trên thẻ `<html>` và đặt một đoạn inline script nhỏ ngay đầu `<head>` (trước tất cả các thẻ `<link rel="stylesheet">`) để đọc ngay theme từ `localStorage` trong 0ms đầu tiên:
   ```html
   <script>
     (function() {
       const savedTheme = localStorage.getItem('planify_theme') || 'light';
       document.documentElement.setAttribute('data-theme', savedTheme);
     })();
   </script>
   ```
2. **Đồng bộ 2 chiều giữa `localStorage` và Database (`theme.js` & `users.py`):**
   - Thống nhất sử dụng duy nhất key `planify_theme` trong `localStorage`.
   - Khi người dùng bấm nút chuyển đổi Sáng/Tối (`#theme-toggle`) ở bất kỳ trang nào (Landing Page, Sidebar, hay trang Settings):
     1. Cập nhật ngay lập tức `document.documentElement.setAttribute('data-theme', newTheme)`.
     2. Lưu ngay vào `localStorage.setItem('planify_theme', newTheme)`.
     3. Nếu người dùng đang đăng nhập (`auth.isAuthenticated()`), gọi ngầm (background non-blocking) `api.put('/users/me', { theme_preference: newTheme })` để lưu vĩnh viễn vào Database.
   - Khi tải lại trang (`F5`):
     - **Ưu tiên số 1:** Giữ nguyên giá trị người dùng đã chọn trong `localStorage.getItem('planify_theme')` (không bao giờ để giá trị mặc định `"light"` từ DB ghi đè lên lựa chọn cục bộ mới nhất của người dùng). Nếu `localStorage` đã có giá trị khác với `user.theme_preference` trên DB, tự động đồng bộ giá trị từ `localStorage` lên DB.
3. **Khi Đăng xuất (`auth.logout()`):**
   - Chỉ xóa `access_token` và dữ liệu phiên đăng nhập (`localStorage.removeItem('access_token')`), **tuyệt đối không dùng `localStorage.clear()`** để không làm mất chế độ Dark/Light Mode và trạng thái Thẻ hướng dẫn của người dùng.

---

### 7. LỖI 7 (MỚI): Thiết kế lại Bảng màu (Color System) vì giao diện hiện tại quá nhiều màu trắng (`BUG-07`)

#### 🔍 Nguyên nhân gốc rễ (Root Cause)
- Trong `docs/06-frontend-architecture.md` (Mục 4.2 - Light Theme):
  - `--color-bg-primary: #ffffff` (Trắng)
  - `--color-bg-sidebar: #fafafa` (Gần như trắng)
  - `--color-bg-secondary: #f5f5f5` (Xám trắng nhạt)
  - Toàn bộ Sidebar, Header, Nền trang To Do, Nền Lịch biểu, các Thẻ công việc (Task Cards) và Modal đều dùng tông trắng/xám trắng sát nhau. Khi mở ứng dụng lên, cả màn hình trắng xóa, thiếu điểm nhấn thị giác, khó phân biệt khu vực điều hướng (Sidebar), khu vực làm việc chính (Canvas) và các thẻ nội dung (Cards).

#### 🛠️ Thiết kế giải pháp: Hệ thống Bảng màu Đa sắc thái Hiện đại (Rich & Vibrant Palette)

Thay thế bảng màu trắng đơn điệu bằng thiết kế **Layered Surface & Tinted Accent System** (lấy cảm hứng từ Notion Calendar, Linear & Microsoft To Do hiện đại):

1. **Bảng màu Light Mode mới (Ấm áp, có chiều sâu, phân tách lớp rõ ràng, không bị trắng lóa):**
   - **Sidebar Navigation (`--color-bg-sidebar`):** Chuyển từ trắng `#fafafa` sang tông **Deep Slate / Indigo Navy sang trọng (`#0F172A` hoặc `#1E1B4B`)** với chữ sáng `#F8FAFC` và nút đang chọn (Active Nav) tô gradient `#4F46E5 → #6366F1`! Cách này tạo độ tương phản cực kỳ hiện đại, chấm dứt hoàn toàn cảm giác "cả màn hình toàn màu trắng".
   - **Nền tổng thể khu vực chính (`--color-bg-app` / `--color-bg-secondary`):** Sử dụng màu **Soft Cool Slate-Blue (`#F1F5F9` / `#EEF2FF`)** dịu mắt thay vì trắng tinh.
   - **Nền Thẻ / Khung Lịch / Khung Danh sách (`--color-bg-surface` / `--color-bg-card`):** Dùng màu `#FFFFFF` nổi bật trên nền `#F1F5F9` kèm viền mảnh `#E2E8F0` và đổ bóng nhẹ (`0 4px 16px rgba(79, 70, 229, 0.06)`).
   - **Thanh Header & Toolbar:** Phủ hiệu ứng kính mờ (`backdrop-filter: blur(12px)`) với dải viền gradient tinh tế phía dưới.
   - **Cột Ngày Hôm Nay trên Lịch biểu (`--color-today-column-bg`):** Tô nền **Soft Indigo Tint (`rgba(79, 70, 229, 0.05)`)** và badge số ngày hình tròn màu `#4F46E5` nổi bật để nhìn vào biết ngay cột hôm nay.
   - **Khung giờ ngoài giờ làm việc (Trước 7h sáng & Sau 19h tối):** Tô nền sọc/tint nhẹ (`#F8FAFC`) để phân biệt trực quan với khung giờ làm việc chính (`08:00 - 18:00`).

2. **Màu sắc Chủ đề riêng biệt cho từng Smart List trong To Do (Ambient Header & Background Tint):**
   Mỗi danh sách trong To Do có một **Banner Header & Tông màu chủ đạo riêng** (thay vì nền trắng giống hệt nhau):
   - ☀️ **My Day (Ngày của tôi):** Tông **Warm Amber / Sunrise Gradient** (`linear-gradient(135deg, #F59E0B, #EA580C)`), nền trang phớt vàng ấm `#FFFBEB`.
   - ⭐ **Important (Quan trọng):** Tông **Rose / Crimson Gradient** (`linear-gradient(135deg, #EC4899, #E11D48)`), nền trang phớt hồng `#FFF1F2`.
   - 📅 **Planned (Đã lập kế hoạch):** Tông **Emerald / Teal Gradient** (`linear-gradient(135deg, #10B981, #0D9488)`), nền trang phớt xanh ngọc `#ECFDF5`.
   - 📋 **All Tasks (Tất cả công việc):** Tông **Royal Indigo / Violet Gradient** (`linear-gradient(135deg, #4F46E5, #7C3AED)`), nền trang phớt tím xanh `#EEF2FF`.
   - 🎨 **Custom Lists (Danh sách tự tạo):** Tự động lấy chính mã màu (`color`) mà người dùng đã chọn khi tạo danh sách để phủ màu cho Banner Header, nút `+ Thêm công việc` và thanh tiến độ của danh sách đó!

3. **Bảng màu Dark Mode mới (Deep Midnight Slate — Dịu mắt, chuẩn độ tương phản WCAG):**
   - `--color-bg-sidebar`: `#090D16` (Midnight Obsidian)
   - `--color-bg-primary` (App Canvas): `#0F172A` (Deep Slate 900)
   - `--color-bg-secondary` (Cards / Panels): `#1E293B` (Slate 800)
   - `--color-bg-tertiary` (Inputs / Hover): `#334155` (Slate 700)
   - `--color-border`: `#334155`
   - `--color-accent`: `#818CF8` (Indigo 400) & `#38BDF8` (Sky 400)
   - Các thẻ Sự kiện và Task trên lịch ở chế độ Dark Mode được thiết kế với nền bán trong suốt (`rgba(color, 0.22)`), viền trái đậm `4px solid color` và chữ sáng rõ nét.

---

## PHẦN 3: PHÂN TÍCH 13 LỖI KỸ THUẬT & LOGIC HỆ THỐNG KHÁC (ĐÃ RÀ SOÁT KỸ)

Để bạn yên tâm rằng không còn lỗi ngầm nào bị bỏ sót trước khi bắt tay vào sửa code, dưới đây là 13 lỗi kỹ thuật trong cả Backend và Frontend đã được kiểm tra từng dòng:

### 8. LỖI 8: Quên từ khóa `raise` trong `ErrorDetail.throw()` (`BUG-08`)
- **Vị trí:** `backend/app/core/exceptions.py` (Dòng 15-17).
- **Chi tiết:** Hàm `throw()` chỉ khởi tạo `CustomAppException(self, dynamic_message)` mà không có `raise`, trả về `None`. Khi các service gọi `raise AuthErrors.INVALID_LOGIN.throw()`, Python báo lỗi `TypeError: exceptions must derive from BaseException` và trả về `500` thay vì `401/400`.
- **Khắc phục:** Sửa thành `raise CustomAppException(self, dynamic_message)`.

### 9. LỖI 9: Thiếu hàm `send_email` trong `backend/app/helper/otp.py` (`BUG-09`)
- **Vị trí:** `backend/app/services/auth_service.py` (Dòng 12) & `backend/app/helper/otp.py`.
- **Chi tiết:** `auth_service.py` import `send_email` nhưng hàm này chưa được viết trong `otp.py`.
- **Khắc phục:** Viết đầy đủ hàm `async def send_email(email: str, otp: str)` sử dụng `smtplib` trong `asyncio.to_thread`, đồng thời nếu môi trường local chưa cấu hình mật khẩu ứng dụng Gmail thật thì tự động in mã OTP ra log console và không làm crash luồng đăng ký.

### 10. LỖI 10: Lệch chuẩn dữ liệu Đăng nhập (`OAuth2PasswordRequestForm` vs JSON) (`BUG-10`)
- **Vị trí:** `backend/app/api/v1/endpoints/auth.py` & `frontend/js/auth.js`.
- **Chi tiết:** Endpoint `/api/v1/auth/login` dùng `OAuth2PasswordRequestForm = Depends()` (yêu cầu gửi `FormData` / `application/x-www-form-urlencoded` với key `username` và `password`). Nếu Frontend gọi `api.post('/auth/login', { email, password })` dạng JSON sẽ bị lỗi `422 Unprocessable Entity`.
- **Khắc phục:** Hỗ trợ song song cả JSON `{ email, password }` lẫn Form Data `username/password` ở Backend `/api/v1/auth/login`, đồng thời trả về thống nhất trong `ApiResponse` hoặc object chứa `access_token` và thông tin `user`.

### 11. LỖI 11: Lệch đường dẫn API Đăng ký tài khoản (`BUG-11`)
- **Vị trí:** `docs/02-api-design.md` ghi `POST /api/v1/auth/register`, nhưng code trong `backend/app/api/v1/endpoints/users.py` lại đặt tại `POST /api/v1/users/register`.
- **Khắc phục:** Đăng ký route `/register` ở cả `/api/v1/auth/register` và `/api/v1/users/register` để mọi lời gọi từ Frontend đều hoạt động.

### 12. LỖI 12: Xung đột cấu trúc JSON Response (`ApiResponse` wrapper) (`BUG-12`)
- **Vị trí:** `backend/app/schemas/common.py` & `frontend/js/api.js`.
- **Chi tiết:** Backend bọc dữ liệu trong `{ "success": true, "message": "...", "data": ... }` và bọc lỗi trong `{ "success": false, "error": { "code": "...", "message": "..." } }`.
- **Khắc phục:** Trong `api.js`, tự động kiểm tra nếu response có trường `success === true` và `data !== undefined` thì trả về `res.data`; khi lỗi thì lấy `err?.error?.message || err?.detail || 'Có lỗi xảy ra'`.

### 13. LỖI 13: Lệch múi giờ 7 tiếng (UTC vs `Asia/Ho_Chi_Minh`) khi chọn Ngày/Giờ (`BUG-13`)
- **Vị trí:** `frontend/js/utils/date.js`, `event-form.js`, `task-detail.js`.
- **Chi tiết:** Trong JavaScript, khi dùng `new Date(year, month, day).toISOString()`, trình duyệt tự trừ đi 7 tiếng để đổi sang giờ UTC (`Z`), làm ngày `2026-11-02 00:00` biến thành `2026-11-01T17:00:00.000Z` (lùi mất 1 ngày!).
- **Khắc phục:** Viết hàm `toLocalISOString(date)` và `formatLocalDate(date)` giữ nguyên múi giờ địa phương (`+07:00` hoặc `YYYY-MM-DD` theo giờ máy người dùng), không dùng `.toISOString().split('T')[0]`.

### 14. LỖI 14: Phím tắt (Keyboard Shortcuts) kích hoạt nhầm khi đang gõ văn bản (`BUG-14`)
- **Vị trí:** `frontend/js/pages/calendar.js` & `frontend/js/pages/todo.js`.
- **Chi tiết:** Khi người dùng đang gõ tiêu đề công việc hoặc chat với AI, nhấn phím `D`, `W`, `M`, `T`, `N`, `S`, `Space` sẽ bị trình nghe sự kiện `keydown` toàn cục bắt lấy và chuyển trang hoặc đóng/mở modal.
- **Khắc phục:** Thêm điều kiện kiểm tra đầu hàm `keydown`:
  ```javascript
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;
  ```

### 15. LỖI 15: Sự kiện trùng giờ đè lên nhau & Cuộn lịch mặc định (`BUG-15`)
- **Vị trí:** `day-view.js`, `week-view.js`.
- **Chi tiết:**
  - Khi 2 sự kiện hoặc Task Time-Block diễn ra cùng khung giờ (ví dụ `09:00 - 10:00`), nếu render cùng `left: 0; width: 100%` thì thẻ sau sẽ che khuất thẻ trước.
  - Khi mở Day/Week View, khung nhìn bắt đầu ở `00:00` đêm thay vì giờ hành chính.
- **Khắc phục:**
  - Viết thuật toán **Collision Detection & Column Packing**: tự động chia chiều ngang (`width = 100 / totalColumns %`, `left = colIndex * width %`) cho các sự kiện/task giao nhau.
  - Tự động scroll khung lịch đến mốc `07:00` sáng (hoặc giờ hiện tại trừ 1 tiếng) khi mở lịch.

### 16. LỖI 16: Thiếu bộ chạy ngầm thông báo Nhắc nhở (Reminder Notification Engine) (`BUG-16`)
- **Vị trí:** `frontend/js/components/reminder-notifier.js`.
- **Chi tiết:** Người dùng đặt nhắc nhở trước 5/15/30 phút cho Sự kiện hoặc đặt giờ nhắc `reminder_at` cho Việc cần làm, nhưng không có tiến trình nào kiểm tra và phát thông báo khi đến giờ.
- **Khắc phục:** Bổ sung `ReminderService` ở Frontend chạy mỗi 30 giây, kiểm tra các sự kiện và công việc sắp diễn ra để hiển thị **Toast thông báo nổi bật kèm âm báo nhẹ** và **Browser Notification API** (nếu được cấp quyền), đánh dấu đã nhắc để không lặp lại.

### 17. LỖI 17: AI Agent thay đổi dữ liệu nhưng UI không tự động cập nhật (`BUG-17`)
- **Vị trí:** `frontend/js/ai/chat-panel.js`.
- **Chi tiết:** Khi người dùng bảo AI *"Tạo giúp tôi việc cần làm họp nhóm lúc 14h hôm nay"*, AI gọi tool tạo thành công trong Database, nhưng màn hình Lịch hoặc To Do đang mở bên cạnh không tự load lại dữ liệu mới.
- **Khắc phục:** Trong `chat-panel.js`, khi nhận phản hồi từ AI có chứa `tool_calls` khác rỗng, tự động phát sự kiện `window.dispatchEvent(new CustomEvent('planify:data-changed'))` để trang Calendar và To Do tự động fetch lại dữ liệu mới nhất ngay lập tức.

### 18. LỖI 18: Đồng nhất Schema `event_reminders` và Màu sắc của `tasks` (`BUG-18`)
- **Khắc phục:** Thống nhất cột `minutes_before` cho `EventReminder`, thêm cột `color` vào `Task` và đồng bộ bảng `categories`.

### 19. LỖI 19: Bổ sung Endpoint `/health` và `CORSMiddleware` (`BUG-19`)
- **Khắc phục:** Thêm `GET /health` vào `backend/main.py` cho Docker healthcheck và cấu hình `CORSMiddleware` cho phép Frontend gọi API mượt mà.

### 20. LỖI 20: Tự động khởi tạo dữ liệu mặc định (Lazy Seeding) cho mọi tài khoản (`BUG-20`)
- **Khắc phục:** Tạo hàm `ensure_user_defaults(db, user_id)` tự động tạo Calendar `"Lịch của tôi"` (`#4F46E5`) và TaskList `"Tasks"` (`#4F46E5`) ngay khi đăng ký hoặc lần đầu gọi API.

---

## PHẦN 4: LỘ TRÌNH 5 GIAI ĐOẠN TRIỂN KHAI & SỬA LỖI TOÀN DIỆN

### 🚀 Giai đoạn 1: Khắc phục Lỗi Blocker Backend & Nâng cấp Database Schema
1. **Task 1.1:** Sửa `raise CustomAppException` trong `exceptions.py`; bổ sung hàm `send_email` trong `otp.py`; thêm `GET /health` và `CORSMiddleware` vào `main.py`.
2. **Task 1.2:** Cập nhật Model `User` (`theme_preference`, `timezone`) và bổ sung API `PUT /api/v1/users/me` để lưu cài đặt giao diện Dark/Light Mode vào DB.
3. **Task 1.3:** Xây dựng đầy đủ các Models & Alembic Migration:
   - `Calendar`, `Event` (có `is_cancelled`), `EventReminder` (`minutes_before`).
   - `TaskList`, `Task` (**có `due_date`, `start_time`, `end_time`, `duration_minutes`, `is_all_day`, `color`, `recurrence_rule`, `my_day_date`**), `TaskStep`.
   - `Category`, `AIConversation`, `AIMessage`.

### 🚀 Giai đoạn 2: Hoàn thiện API Backend (Recurrence, Custom Lists, Time-Blocking, AI Agent)
1. **Task 2.1:** Xây dựng `rrule_helper.py` xử lý chuẩn xác việc bung chuỗi sự kiện lặp lại (`expand_recurring_events`) và tính ngày kế tiếp cho công việc lặp lại (`get_next_occurrence`).
2. **Task 2.2:** Hoàn thiện các Services & Endpoints:
   - `calendars.py` & `events.py`: Hỗ trợ đầy đủ sự kiện lặp lại, sửa/xóa theo `scope = this | following | all`.
   - `task_lists.py`, `tasks.py`, `task_steps.py`: Hỗ trợ tạo danh sách mới, quản lý bước con (steps), đặt khung giờ (`start_time`, `end_time`), tự động sinh task kỳ tiếp theo khi hoàn thành task lặp lại, tự động reset `My Day`.
   - `dashboard.py` & `ai_chat.py`: Tích hợp AI Agent gọi 12 tools quản lý cả Sự kiện lẫn Việc cần làm có khung giờ.

### 🚀 Giai đoạn 3: Hệ thống Màu sắc Mới, Fix lỗi Dark Mode Persistence, Landing Page & Thẻ Hướng Dẫn
1. **Task 3.1 (Fix Lỗi 6 & 7 - Theme & Color Palette):**
   - Nhúng script chống nháy trắng (Anti-FOUC) vào `<head>` của `index.html`.
   - Xây dựng `theme.js` đồng bộ 2 chiều giữa `localStorage ('planify_theme')` và `PUT /api/v1/users/me`, không bao giờ để mặc định DB ghi đè lựa chọn Dark Mode của người dùng khi F5.
   - Áp dụng bảng màu **Rich Layered Palette**: Sidebar tông Indigo-Slate đậm hiện đại, nền ứng dụng Soft Cool Slate (`#F1F5F9`), mỗi Smart List có dải màu Banner Gradient riêng biệt, cột Ngày hôm nay được tô màu nổi bật.
2. **Task 3.2 (Fix Lỗi 1 - Router & Landing Page):**
   - Phân tách `PUBLIC_ROUTES` và `PROTECTED_ROUTES` trong `router.js`.
   - Xây dựng trang **Landing Page** (`landing.js`, `landing.css`) bắt mắt trước khi vào Đăng nhập/Đăng ký.
3. **Task 3.3 (Fix Lỗi 2 - Thẻ Hướng Dẫn trên Lịch biểu):**
   - Xây dựng `guide-card.js` đặt ngay phía trên Lịch biểu hướng dẫn đầy đủ thao tác chuột, kéo thả và phím tắt, kèm nút `❓ Hướng dẫn` trên thanh công cụ.

### 🚀 Giai đoạn 4: Hoàn thiện Giao diện Lịch biểu & Việc cần làm (Fix Lỗi 3, 4, 5 & Các lỗi UX)
1. **Task 4.1 (Fix Lỗi 3):** Hoàn thiện Modal tạo/sửa/xóa Danh sách mới (`Custom Lists`) với bảng chọn 10 màu sắc và 12 icon, cập nhật tức thì trên Sidebar.
2. **Task 4.2 (Fix Lỗi 5):**
   - Thêm bộ chọn **Khung giờ (`start_time` - `end_time` / `duration`)** cho Việc cần làm.
   - Hiển thị trực tiếp các Việc cần làm có khung giờ lên lưới 24h của Lịch biểu (Day/Week View), hỗ trợ tick hoàn thành, kéo thả đổi giờ và kéo cạnh dưới chỉnh thời lượng ngay trên lịch.
   - Hợp nhất Modal tạo mới trên Lịch biểu: cho phép chọn tạo **Sự kiện** hoặc **Việc cần làm** ngay khi click vào ô giờ trống.
3. **Task 4.3 (Fix Lỗi 4 & Lỗi 13-17):**
   - Hoàn thiện bộ chọn Lặp lại (Recurrence) và hộp thoại chọn phạm vi sửa/xóa (`Chỉ sự kiện này`, `Từ nay trở đi`, `Tất cả`).
   - Sửa lỗi lệch múi giờ (`BUG-13`), lỗi phím tắt khi đang gõ input (`BUG-14`), chia cột khi sự kiện trùng giờ (`BUG-15`), bộ nhắc nhở tự động (`BUG-16`) và tự động làm mới UI khi chat với AI (`BUG-17`).

---

## PHẦN 5: CHECKLIST NGHIỆM THU TOÀN DIỆN (ACCEPTANCE CRITERIA)

- [x] **AC-01 (Landing Page & Routing):** Truy cập trang gốc khi chưa đăng nhập hiển thị **Landing Page** hiện đại; không bị ép nhảy về `#login`.
- [x] **AC-02 (Dark Mode Persistence):** Chuyển sang **Dark Mode** rồi nhấn **F5 (Load lại trang)** hoặc đóng tab mở lại vẫn giữ nguyên chế độ Tối mượt mà, không bị nháy trắng hay quay về chế độ Sáng.
- [x] **AC-03 (Bảng màu & Giao diện):** Giao diện chế độ Sáng có chiều sâu với Sidebar Indigo-Slate, nền phân lớp dịu mắt, mỗi mục trong To Do và Lịch biểu có màu sắc chủ đạo rõ ràng, không còn bị trắng xóa đơn điệu.
- [x] **AC-04 (Thẻ Hướng Dẫn):** Phía trên Lịch biểu có **Thẻ hướng dẫn thao tác** trực quan, có thể thu gọn hoặc bật lại qua nút `❓ Hướng dẫn`.
- [x] **AC-05 (Thêm Danh Sách Mới):** Tạo, đổi tên, đổi màu, đổi icon và xóa danh sách tùy chỉnh trong phần Việc cần làm hoạt động tức thì.
- [x] **AC-06 (Chức năng Lặp lại & Tính năng phụ):** Sự kiện lặp lại hiển thị đúng qua mọi tuần/tháng; sửa/xóa theo 3 phạm vi hoạt động chuẩn; hoàn thành Task lặp lại tự sinh Task kỳ kế tiếp kèm đầy đủ các bước con (`steps`).
- [x] **AC-07 (Điều chỉnh Thời gian cho Task & Đồng bộ Lịch ↔ To Do):** Task có thể chỉnh Ngày + Giờ bắt đầu & Giờ kết thúc (Time-Blocking), hiển thị đúng vào khung giờ trên Lịch biểu và kéo thả/chỉnh sửa đồng bộ 2 chiều.
