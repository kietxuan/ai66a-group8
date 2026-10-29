# UI DIRECTION

## 1. Nguyên tắc

Amendment được user phê duyệt 22/10: redesign lớp trình bày theo ZIP `stitch_nh_p_productivity_app_redesign.zip`, không đổi nghiệp vụ. Giữ thương hiệu Nhịp, màu xanh/giấy sáng và deep-forest tối, sidebar gọn, nội dung rộng, giảm khẩu hiệu/khối trang trí. CSS tokens dùng chung cho Auth/Todo/Calendar/Chat/dialog. Không chép HTML/Tailwind CDN hoặc dữ liệu mẫu vào ứng dụng, không thêm UI kit/dependency.

Đợt 21/10 trước đó chỉ harden thiết kế cũ; phần này được user cho phép thay thế về bố cục. Vẫn giữ input mobile 16px, vùng bấm chính 44px, metadata/tương phản, form một cột khi hẹp. Dialog focus heading, dirty close có confirmation; không ép mở bàn phím. Xem [trạng thái triển khai](IMPROVEMENT_STATUS_2026-10-21.md), không coi viewport desktop là test Android/iOS thật.

Bốn khu vực MVP: Login/Register, Todo List, Calendar, Chatbot. Dashboard không là prerequisite hoặc màn hình bắt buộc.

Thiết kế responsive tối thiểu desktop/mobile, nhãn tiếng Việt nhất quán; có loading/empty/error/success states. Không thêm UI kit lớn nếu HTML/CSS hiện tại đủ.

### Sáng/Tối và responsive — amendment 22/10

- Nút mặt trời/mặt trăng trên Auth, topbar workspace và dialog. Có accessible label/trạng thái pressed, dùng bàn phím được; dialog không phải đóng để đổi theme.
- Lần đầu theo `prefers-color-scheme`, sau khi chọn ưu tiên `localStorage['nhip-theme']` (chỉ light/dark); đồng bộ các nút trong trang và storage event giữa tab. Nếu storage bị chặn vẫn giữ lựa chọn trong phiên trang. Không bảng/API/user setting mới, không đọc/lưu token/chat/task vào localStorage.
- Script `/theme-init.js` cùng origin chạy trước stylesheet/application để giảm nháy sai theme; không inline script hoặc nới CSP. Màu meta/theme-color và native controls theo theme.
- Đổi theme không reload/remount App/form/chat/Calendar, không gửi API hoặc consume pending context. Ngày/giờ, filter, bản nháp và confirmation vẫn giữ nguyên.
- Desktop sidebar 232px; tablet 761–1024px dùng rail icon với accessible labels; mobile <=760px điều hướng ba mục ở đáy có safe area, theme trên topbar. Không cột phụ trống khi không mở editor.
- Form chung giữ native dialog/focus trap; >=1180px trình bày thành panel phải và chỉ chừa chỗ khi editor mở, màn nhỏ là dialog. Delete/conflict/dirty-close vẫn là modal riêng, không bỏ xác nhận.
- Chat tận dụng toàn chiều ngang; hướng dẫn chuyển thành disclosure. Mobile rút ngắn heading và giữ ô nhập trên thanh điều hướng ở viewport nghiệm thu; pending/choices được cuộn, không cắt mất nút quyết định. Bàn phím iOS/Android thật vẫn cần thử trên thiết bị.
- Amendment mới của user 22/10 cho phép riêng gợi ý giờ trống: một example chip và thẻ read-only trong Chat, hiển thị ngày/thời lượng/khung tìm kiếm/tối đa ba giờ cụ thể và cảnh báo chưa giữ chỗ. Không nút đặt lịch tự động, không screen/DB/theme preference mới. Token Sáng/Tối và responsive hiện hữu dùng lại.
- Không lấy các feature chỉ có trong mẫu: Google Login/reset password/30-day login/E2E claims, bell/notifications, stats/progress, AI recommendations tổng quát/voice/streaming, archive/history, projects/assignees, sort mới, CRUD category/drag-drop/recurring. Gợi ý giờ trống là ngoại lệ theo yêu cầu riêng, không chép các recommendation khác của mẫu. Không thêm nút trang trí giả chức năng.

## 2. Authentication — Week 2

- Register: name/email/password, validation, pending submit; thành công về Login.
- Login: email/password; thành công về Task Area.
- App khởi động gọi GET /api/auth/me; hiển thị loading trước khi quyết định auth route, tránh nháy màn Login.
- User header + Logout; khi 401 clear user/tasks/chat và về Login.
- Không đọc cookie/token bằng JS. API client gửi credentials và header chống CSRF như API_SPEC.
- Không làm forgot-password/OAuth/refresh token.
- Kiểm tra bàn phím, label input, lỗi không chỉ phân biệt bằng màu.

## 3. Todo List — Week 4

- Header user, Logout, navigation Todo/Calendar/Chat.
- Toolbar search, ngày/khoảng ngày, status, priority, category, nút reset filter.
- Preset Today/Tomorrow/Upcoming/Completed/Pending chỉ áp query filter. Upcoming = từ ngày mai trở đi, status=pending; Today/Tomorrow mặc định pending. Ngày hiện tại theo Asia/Ho_Chi_Minh.
- Category lấy GET /api/categories, có lựa chọn Không phân loại; không có CRUD category.
- Task form dùng chung cho Todo/Calendar: title, description, task_date, tùy chọn Cả ngày, start/end, priority, category.
- Chọn Cả ngày gửi cả hai time=null; chọn Có giờ phải đủ cặp, end > start. Giữ dữ liệu form khi lỗi.
- Task item: title/date/time/priority/category/status, edit, complete/reopen, delete.
- PUT gửi đầy đủ form editable; status dùng endpoint riêng.
- Delete modal hiện đúng title/date, confirm/cancel trước khi gửi API.
- Disable submit khi đang gửi; không auto-retry mutation, không optimistic “thành công” trước response.
- Search debounce và tránh response cũ ghi đè filter mới.

Conflict modal cho create/edit/reopen:

- Hiện task dự kiến và danh sách task bị trùng.
- Đổi giờ quay về form; Hủy không ghi; Vẫn tiếp tục gửi lại đúng action với allow_conflict=true.
- Không tick/ghi nhớ “luôn bỏ qua conflict”.
- Reopen cũng dùng modal này, không chỉ form create/edit.

## 4. Calendar — Week 5

- FullCalendar Month/Week/Day, locale vi, tuần bắt đầu thứ Hai.
- Chọn ngày/cell all-day mở shared form với ngày đã chọn, times=null.
- Chọn khoảng giờ mở shared form với ngày và hai giờ; từ chối multi-day/qua đêm trước submit.
- Chọn event mở detail/edit; delete/complete/reopen dùng cùng mutation/conflict flow như Todo.
- Không drag/drop/resize trong MVP.
- Query date_from/date_to theo range hiện; end của FullCalendar là exclusive, date_to API inclusive.
- Task không giờ -> event allDay=true, chỉ dùng YYYY-MM-DD; task có giờ -> allDay=false.
- Completed có style/label riêng, không bị mất khỏi calendar chỉ vì không tham gia conflict.

FullCalendar dùng named timezone Asia/Ho_Chi_Minh. Task có giờ chuyển thành ISO datetime với offset +07:00; task cả ngày vẫn là YYYY-MM-DD. Khi đọc callback, dùng chuỗi ngày/giờ theo timezone của calendar hoặc format Date rõ timezone Asia/Ho_Chi_Minh; không dùng local getters/toISOString để lấy ngày form.

Pin các package FullCalendar cùng phiên bản, kiểm tra named-timezone API theo tài liệu của bản đó trước tích hợp. Ưu tiên khả năng timezone có sẵn, chỉ thêm adapter nhỏ tương thích nếu bản đã chọn cần. Không giả giờ Việt Nam thành UTC để hiển thị. “Hôm nay”, highlight ngày và now indicator đều dựa trên timezone nghiệp vụ. [FullCalendar timeZone](https://fullcalendar.io/docs/timeZone).

## 5. Chatbot — Week 6–7

- Message list lưu memory phiên hiện tại; input/send, pending/error state.
- Một request/flow tại một thời điểm; disable send/confirm trong khi gửi.
- Clarification giữ context_id; user nhập phần bổ sung gửi cùng context.
- Ambiguity hiện choices có title/ngày/giờ, chọn ID thuộc danh sách backend trả.
- Confirmation/conflict hiển thị preview + Confirm/Cancel. Trong lúc pending chỉ cho hai nút này; muốn yêu cầu mới thì Cancel trước.
- Không lấy chữ “đồng ý” từ AI output làm bằng chứng user đã xác nhận.
- CONTEXT_EXPIRED/TASK_CHANGED: giải thích flow không còn hiệu lực, clear context và mời user gửi lại; không tự thực hiện action cũ.
- Không retry mutation/confirm khi mất kết nối; gợi ý kiểm tra lại Todo trước khi gửi lại.
- Khi result.mutated=true refresh Todo/Calendar. Query/clarify/cancel không báo “đã tạo/sửa/xóa”.
- Provider lỗi: thông báo có thể dùng quản lý task thủ công, không khóa Todo/Calendar.
- Reload/logout/401 xóa context/message, không hứa khôi phục chat history.
- Reload xóa message client nhưng có thể GET context để lấy lại preview/pending **còn hiệu lực**; không khôi phục lịch sử hoặc action expired/restart. Hiện TTL trong panel chính trên mobile.
- Chat cho mở chi tiết task sau re-read owner, preview hiển thị thay đổi cũ→mới. Bubble lỗi/unknown không trông như đã thành công. Enter xuống dòng, Ctrl/⌘+Enter gửi, tôn trọng IME/reduced motion, không kéo scroll khi đang đọc tin cũ.

## 6. Đồng bộ và acceptance

Shared task form/service frontend; sau mutation refetch view đang dùng, view khác được đánh dấu refresh khi mở. Chat không sửa một bản task riêng.

Mỗi tuần UI phải kiểm tra:

- loading/empty/error; network failure và 401;
- keyboard/focus, validation và submit lặp;
- 2 user đăng nhập luân phiên không thấy cache cũ;
- mobile viewport; ngày/giờ đúng, task cả ngày không lệch ngày;
- các tiêu chí cụ thể trong kế hoạch tuần.
