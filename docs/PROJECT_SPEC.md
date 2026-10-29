# PROJECT SPECIFICATION

## 1. Mục tiêu và phạm vi

Todo List Calendar tích hợp AI Chatbot là project môn Web Design and Programming, thực hiện trong 10 tuần/10 phase. Xây dựng ứng dụng quản lý công việc cá nhân, không mở rộng thành production-scale SaaS.

Một loại người dùng: user đã đăng ký. Mỗi user chỉ đọc và thay đổi dữ liệu của chính mình. Không có admin, chia sẻ task hay phân quyền nhiều role trong MVP.

Nguồn chi tiết: [kiến trúc](ARCHITECTURE.md), [database](DATABASE.md), [API](API_SPEC.md), [UI](UI_DIRECTION.md), [roadmap](ROADMAP.md), [tiến độ](PROGRESS.md).

## 2. MVP bắt buộc

### 2.1 Authentication

- Register, Login, Logout; lấy user hiện tại qua `GET /api/auth/me`.
- Register thành công chuyển sang Login, không tự đăng nhập.
- Password hash bằng Passlib CryptContext + bcrypt (yêu cầu user 22/10); giữ hash bcrypt cũ và không đổi database. JWT access token chỉ nằm trong HttpOnly cookie, không trả token trong JSON hay lưu localStorage.
- Khôi phục phiên sau reload bằng `/me`. Token hết hạn trả 401 và yêu cầu đăng nhập lại.
- Không refresh token, reset password, email verification hoặc token revocation trong MVP.

### 2.2 Task và Category

- Create, Read, Edit, Delete; chuyển giữa `pending` và `completed`.
- Task gồm title, description, task_date, start_time, end_time, priority, category_id, status.
- Title và ngày bắt buộc; giờ bắt đầu/kết thúc cùng có hoặc cùng không có. Task không có giờ là task cả ngày, không phải thiếu dữ liệu.
- Priority: low/medium/high, mặc định medium. Status mặc định pending.
- Category optional. Mỗi user có ba category mặc định: Học tập, Công việc, Cá nhân. MVP chỉ cung cấp danh sách, không có màn hình CRUD category.
- Search title/description; filter ngày hoặc khoảng ngày, status, priority, category. Các filter kết hợp bằng AND; không pagination trong MVP.
- Ngày trong quá khứ được phép. Không hỗ trợ task qua đêm, lặp lại, kéo dài nhiều ngày hay nhiều timezone.
- Todo List và Calendar dùng cùng Task API và cùng luồng cập nhật dữ liệu.

### 2.3 Todo List và Calendar

- Todo List có form tạo/sửa, hoàn thành/mở lại, xác nhận xóa, search/filter.
- Today/Tomorrow/Upcoming/Completed/Pending là preset filter, không phải bảng dữ liệu riêng.
- Calendar có Month/Week/Day; hiện task cả ngày và task có giờ.
- Chọn ngày/khoảng giờ để mở form tạo; chọn event để xem/sửa/xóa/hoàn thành.
- Dùng lại task form của Todo List. Drag/drop, resize event không nằm trong MVP.
- Mọi thay đổi thành công từ UI/chat phải cập nhật dữ liệu liên quan, không cần reload trang.
- UI amendment 22/10: bố cục theo mẫu ZIP và nút Sáng/Tối, nhớ theme trên trình duyệt; không thêm nghiệp vụ/API/database. Phạm vi chi tiết tại UI_DIRECTION.

### 2.4 Chatbot

Các action ghi/tìm task: create_task, get_tasks, update_task, delete_task, complete_task. Amendment trực tiếp của user 22/10 thêm action **chỉ đọc** `suggest_free_slots`; không thêm action mở lại task bằng chat, mở lại dùng Todo/Calendar.

- AI chỉ hiểu intent và trả structured data. Backend xác thực, validate, tìm task, kiểm tra conflict và ghi database.
- Backend cung cấp ngày hiện tại theo Asia/Ho_Chi_Minh để xử lý “hôm nay/ngày mai”; không dựa vào ngày ví dụ cố định trong prompt.
- Thiếu thông tin quan trọng hoặc nhiều task phù hợp phải hỏi lại, không tự đoán/tự chọn.
- User nêu ngày nhưng không yêu cầu giờ: có thể tạo task cả ngày. User yêu cầu lịch có giờ nhưng thiếu một đầu giờ/duration: hỏi lại.
- Có ngữ cảnh tạm thời để tiếp tục câu hỏi/xác nhận; không lưu Conversations/Messages vào database.
- Theo yêu cầu cải thiện 21/10: hiểu câu tiếp nối bằng memory có chọn lọc (task vừa tạo/kết quả vừa hiện), tách tên task khỏi đặc điểm như cả ngày; phản hồi cụ thể theo dữ liệu đã ghi và đánh giá hội thoại nhiều lượt. Giữ TTL 10 phút/user, không hứa hiểu mọi câu hoặc tự đoán khi thiếu/mơ hồ.
- Xóa luôn cần xác nhận. Tiếp tục khi trùng lịch cần xác nhận riêng, do backend quản lý.
- AI lỗi không làm hỏng quản lý task thủ công. Không gửi password/token hoặc dữ liệu user khác cho AI.

#### Gợi ý giờ trống — amendment 22/10

- Nhận một ngày hôm nay/tương lai, thời lượng 1–1439 phút và hai mốc khung tìm kiếm trong cùng ngày. Thiếu/mơ hồ hỏi tiếp trong context RAM 10 phút, không mặc định giờ làm việc/thời lượng/ngày.
- Backend lấy task của chính user theo policy conflict có sẵn, hợp nhất khoảng bận, trả tối đa ba khung sớm nhất, đủ thời lượng và không chồng nhau. Cả ngày/completed không chặn; khoảng chạm nhau hợp lệ. Hôm nay bỏ thời gian đã qua, làm tròn lên phút nếu đang giữa phút.
- Snapshot chỉ đọc, không ghi DB/giữ chỗ/tự dời task. Muốn tạo việc phải yêu cầu mới đủ tên/ngày/giờ, qua conflict service hiện hữu. Không thông báo hay tự đặt lịch, không tối ưu thói quen/đa ngày/qua đêm.
- Memory có thể giữ tiêu chí tìm vừa dùng để hiểu “còn ngày kia?”; không giữ kết quả giờ trống như sự thật lâu dài và không biến slot thành task/confirmation. Mỗi lần gợi ý đều đọc lại lịch. Chi tiết và manual test: [AVAILABILITY](AVAILABILITY.md).

### 2.5 Conflict detection

Core triển khai Week 3; UI Week 4–5; chatbot Week 7; tích hợp/hardening Week 8.

- Chỉ xét task pending, cùng user, cùng ngày, có đủ hai giờ.
- Hai khoảng overlap khi new_start < existing_end và new_end > existing_start. Hai khoảng chạm ranh giới không conflict.
- Kiểm tra khi tạo, đổi ngày/giờ task pending, và khi chuyển completed về pending.
- Task completed và task cả ngày không chặn lịch.
- Trả 409 TASK_CONFLICT trước khi ghi. Cho user đổi giờ, hủy hoặc chủ động tiếp tục.
- REST dùng request flag allow_conflict; chatbot dùng xác nhận ngữ cảnh phía backend. Flag không lưu vào task và không bỏ qua ownership/validation.
- Kiểm tra và ghi trong cùng transaction; tuần 3 có xử lý hai request lịch đồng thời.

## 3. Quy tắc dữ liệu chung

- ID integer identity; backend gán user_id từ phiên đăng nhập, không tin user_id từ client/AI.
- Email hợp lệ, normalize trim/lowercase, unique.
- Name 1–100 ký tự; title 1–200 sau trim; description tối đa 2.000 ký tự.
- Password tối thiểu 8 ký tự, tối đa 72 byte UTF-8; không trim hay cắt password.
- task_date định dạng YYYY-MM-DD; giờ HH:MM, chính xác tới phút, end_time > start_time; không nhận 24:00.
- task_date và giờ mang nghĩa giờ Việt Nam; timestamp hệ thống lưu UTC.
- Hard delete. Không có soft delete hoặc history/audit subsystem.

## 4. Technology decisions

- Frontend: React.js + HTML/CSS/JavaScript, Vite; FullCalendar.
- Backend: Python 3.11 + FastAPI + Uvicorn.
- Persistence: SQLAlchemy 2 + Alembic + psycopg; PostgreSQL.
- Auth: PyJWT, JWT access token trong HttpOnly cookie + Passlib 1.7.4/bcrypt 4.3.0; chi tiết tương thích trong ARCHITECTURE.
- AI: Groq API, baseline openai/gpt-oss-20b; dùng Structured Output. Không triển khai thêm Function Calling song song trong MVP.
- Tests: pytest + HTTPX/FastAPI TestClient; Vitest + React Testing Library. Postman/REST Client chỉ bổ sung manual testing.
- Deploy: một Render Web Service phục vụ FastAPI và React build cùng origin; Neon PostgreSQL.
- Dev: Vite proxy /api và /health tới FastAPI. Node.js dùng cho frontend/build, không phải backend Node.js/Express.
- Version dependencies được pin/lock sau khi xác nhận chạy được ở Week 2; không mặc định lấy mọi bản mới nhất.

Model phải kiểm tra quyền truy cập bằng tài khoản thực tế sớm ở Week 2 và xác nhận lại Week 6. Nếu model không khả dụng, báo user trước khi thay model/provider. Xem [rủi ro bên ngoài](PLAN_REVIEW.md).

## 5. Out of MVP

- Dashboard/Statistics: chỉ cân nhắc một phần nhỏ sau khi toàn bộ MVP qua gate Week 8.
- Notification, Recommendation, phân tích thói quen, recurring task.
- CRUD category, chat history database, streaming AI.
- OAuth, refresh token, password reset, admin, chia sẻ task.
- Redis, queue, microservices, nhiều worker/replica cho chatbot.
- Không bắt buộc Docker; chỉ dùng nếu môi trường triển khai thực sự cần.

## 6. Tiêu chí hoàn thành

MVP hoàn thành khi:

- User A không đọc/sửa/xóa task hoặc dùng category/context chat của user B.
- Auth chạy sau reload, xử lý hết hạn, logout và bảo vệ request ghi bằng cookie.
- CRUD, filter, Calendar và chatbot các action bắt buộc chạy theo API contract.
- Clarification, nhiều kết quả, xác nhận xóa, trùng lịch đều có luồng tiếp nối hoạt động.
- Task pending/cả ngày/completed hiển thị và xử lý thời gian thống nhất.
- Tests chạy từ từng tuần; Week 9 regression và Week 10 smoke trên bản online.
- Migration chạy được trên database rỗng và nâng cấp từ migration tuần trước.
- README/setup và PROGRESS phản ánh trạng thái thật; không coi placeholder hoặc test “Hello world” là chức năng đã hoàn thành.

Week 1 hoàn thành ở mức planning, không đòi app chạy. Mỗi tuần implementation có Definition of Done riêng trong [kế hoạch tuần](ROADMAP.md).
