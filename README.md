# Planify Pro

Ứng dụng quản lý công việc, lịch cá nhân và trợ lý AI. Frontend dùng HTML/CSS/JavaScript ES Modules; backend dùng FastAPI, SQLAlchemy async, PostgreSQL và Redis. Source hiện tại không dùng React/Vite.

## Chạy local

Từ thư mục chứa `docker-compose.yml`:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Điền các giá trị riêng trong `.env`: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_PASSWORD` và `SECRET_KEY` ngẫu nhiên tối thiểu 32 ký tự. Giữ `.env` ngoài Git. Nếu dùng AI provider, đặt `AI_API_KEY`; model lấy từ `AI_MODEL`.

Để gửi OTP và email nhắc việc, đặt `SMTP_EMAIL` là địa chỉ Gmail và `SMTP_PASSWORD` là Gmail App Password (gửi qua `smtp.gmail.com:587`, STARTTLS). Nếu nâng cấp từ bản cũ, chuyển cấu hình gửi mail từ `ADMIN_EMAIL`/`ADMIN_PASSWORD` sang hai biến `SMTP_*`. `ADMIN_PASSWORD` chỉ là mật khẩu đăng nhập admin tạo lần đầu, có thể để trống để tắt bootstrap; khởi động lại không đặt lại mật khẩu admin đã tồn tại.

```powershell
docker compose up -d --build
docker compose ps
```

- Giao diện: <http://localhost:3000>
- Swagger API: <http://localhost:8000/docs>
- Kiểm tra backend: <http://localhost:8000/health>

Frontend gọi API cùng origin qua Nginx (`/api/v1`). Backend chạy Alembic khi container khởi động. Trước khi thay đổi migration trên database có dữ liệu, hãy sao lưu; không dùng `docker compose down -v` để sửa lỗi migration.

## Deploy Render + Brevo (khuyến nghị cho bản demo)

Image `Dockerfile.render` đóng gói frontend và FastAPI chung origin, chạy Alembic trước API, một worker, non-root, không `--reload`, lắng nghe `0.0.0.0:${PORT:-10000}`. Không thay đổi cách chạy Compose local. `render.yaml` là Blueprint chỉ tạo một Web Service Free, **không tạo database trả phí**. Credentials thật phải điền trên Render, không commit `.env`.

### 1. PostgreSQL trên Neon

- Tạo project/giữ project đã có tại Frankfurt; chọn Direct connection (tắt pooling) vì app và Alembic dùng chung URL.
- Lấy chuỗi tại Connect. Đổi đầu `postgresql://` thành `postgresql+asyncpg://`, bỏ query `?sslmode=require&channel_binding=require`, đặt `DATABASE_SSL=true` để app và Alembic xác minh TLS. Giữ nguyên host, user, tên database. Percent-encode ký tự đặc biệt trong password, không encode lại phần đã encode.
- Nếu từng chia sẻ chuỗi chứa mật khẩu, reset password của role rồi dùng chuỗi mới. Database mới trống; dữ liệu local không tự chuyển lên cloud. Không tự tạo bảng: Alembic sẽ chạy khi container khởi động.

### 2. Redis trên Upstash

- Giữ database Redis đã có hoặc tạo mới, ưu tiên gần Frankfurt. Lấy Redis protocol URL `rediss://default:PASSWORD@HOST:6379/0` (dùng đúng host/port của tài khoản), **không** dùng REST URL/token. TLS phải được giữ.
- Không dùng database Redis QA hoặc tài khoản của người khác; Redis lưu OTP, rate limit và các dữ liệu tạm.

### 3. Tài khoản gửi email Brevo

1. Đăng ký tại https://www.brevo.com/, chọn Free nếu có, xác minh email và hoàn tất thông tin tài khoản. Hoàn thành xét duyệt/kích hoạt Transactional emails nếu Brevo yêu cầu; chưa active thì app không thể tự khắc phục.
2. Vào Settings → Senders, Domains, IPs → Senders → Add a sender. From name: `Planify Pro`; From email: email bạn kiểm soát. Nhập mã Brevo gửi tới email đó để Verify sender. `MAIL_FROM_EMAIL` phải trùng địa chỉ đã xác minh này.
3. Nếu có domain riêng, thêm domain và cấu hình DNS DKIM/DMARC theo Brevo để tăng khả năng vào inbox. Gmail/Yahoo không thể được bạn xác thực domain; Brevo có thể thay địa chỉ gửi bằng địa chỉ tương thích. Không cam kết mail luôn vào inbox, cần kiểm tra Spam và delivery logs.
4. Vào Settings → SMTP & API → API Keys (hoặc API Keys & MCP) → Generate API key, đặt tên `planify-render`, chọn thời hạn phù hợp. Nếu dùng Restricted permissions, cấp quyền gửi transactional email (`POST /v3/smtp/email`); không cần bật MCP. Lưu key riêng tư; dùng **API key**, không phải SMTP key/password. Không cần tạo template Brevo: app gửi nội dung HTML sẵn có qua HTTPS.

Tài liệu: [sender](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email), [API gửi email](https://developers.brevo.com/docs/send-a-transactional-email), [yêu cầu sender](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders).

### 4. Tạo dịch vụ Render bằng Blueprint

1. Đăng nhập https://dashboard.render.com/ bằng GitHub; cấp quyền đọc repo `kietxuan/ai66a-group8`.
2. New → Blueprint; chọn repo và branch **`main`**, Blueprint path `render.yaml`.
3. Kiểm tra service là `planify-pro`, Docker runtime, Free, Frankfurt; không thêm Postgres/Redis từ Render. File YAML tự sinh `SECRET_KEY` ngẫu nhiên và cấu hình TLS, pool, Brevo, `/health`.
4. Điền các giá trị được hỏi: `DATABASE_URL`, `REDIS_URL`, `BREVO_API_KEY`, `MAIL_FROM_EMAIL`, `AI_API_KEY` (Groq key cho AI thật; nếu chưa dùng, có thể bỏ giá trị và bổ sung sau trên service Environment). Không paste cả lệnh `psql`/`redis-cli`, không thêm dấu nháy bao ngoài giá trị trên UI.
5. Review → Deploy/Apply. Không nhập thẻ/nâng cấp gói nếu chỉ muốn dùng Free. Nếu UI yêu cầu xác minh tài khoản, hoàn thành theo Render; không giả định mọi tài khoản đều được duyệt.

**Cách thủ công thay thế (chỉ chọn một cách, không tạo hai service):** New → Web Service → repo → branch `main`; Language/Runtime Docker; Root directory để trống; Dockerfile path `./Dockerfile.render`; Docker context gốc repo; Docker Command để mặc định; Region Frankfurt; Instance Free; Health Check Path `/health`. Nhập các biến trong `.env.render.example`; tạo `SECRET_KEY` riêng bằng `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Không dùng giá trị mẫu làm secret thật. Giữ `ADMIN_PASSWORD` trống/không khai báo. Không cần Build command, `npm run build`, Nginx hay cài Neon CLI.

### 5. Kiểm tra end to end sau deploy

1. Xem Events/Logs: build thành công, Alembic upgrade không lỗi, Uvicorn lắng nghe cổng Render cấp, service Live. Lỗi build và runtime là hai bước khác nhau.
2. Mở URL `https://TEN_SERVICE.onrender.com/health`: cần HTTP 200 và `{"status":"healthy"}`. Sau đó mở `/`: phải thấy giao diện, JS/CSS không 404.
3. Đăng ký bằng một email bạn kiểm soát. Gửi OTP, xem Brevo Transactional → Logs (tên menu có thể thay đổi), kiểm tra inbox/Spam. API nhận gửi thành công **không có nghĩa đã giao vào inbox**. Đợi 60 giây trước khi gửi lại; OTP có hạn 5 phút.
4. Nhập OTP → đăng ký → đăng nhập. Tạo/sửa/hoàn thành/xóa một công việc thử; kiểm tra Dashboard, To Do, Calendar. Đăng xuất/đăng nhập lại để xác nhận dữ liệu vẫn còn trên Neon.
5. Đăng xuất, thử quên mật khẩu với tài khoản QA riêng và OTP mới, đặt lại mật khẩu; đăng nhập bằng mật khẩu mới. Không dùng tài khoản cá nhân để thử phá luồng.
6. Nếu đã cấu hình Groq, gửi một yêu cầu thử không nhạy cảm, xác nhận kết quả trong To Do/Calendar. Có thể tiêu quota Groq. Kiểm tra thông báo email thử trong Settings nếu cần; nhắc lịch chạy nền không bảo đảm đúng giờ trên Free.

| Triệu chứng | Kiểm tra |
|---|---|
| Build không tìm thấy file | Branch đúng, Dockerfile.render, root/context gốc repo |
| Không mở được port | Không ghi đè Docker Command; app dùng PORT do Render cấp |
| Migration/health lỗi PostgreSQL | URL asyncpg, password mới/đã encode, không query sslmode/channel_binding, DATABASE_SSL=true |
| Health lỗi Redis | URL rediss, đúng credentials/port; không dùng REST endpoint |
| Brevo HTTP 401 | API key sai/thu hồi, hoặc đang dùng SMTP key |
| Brevo HTTP 400/403 | Sender chưa hợp lệ, tài khoản/transactional chưa được duyệt, hoặc chính sách IP/domain; xem Brevo dashboard |
| Brevo HTTP 429 | Rate limit/quota; đợi reset/kiểm tra plan, không gửi liên tiếp |
| API gửi thành công nhưng chưa nhận OTP | Delivery logs, bounce/blocked/Spam; không đồng nghĩa gửi vào inbox |
| AI không dùng được | AI_API_KEY/model và quota Groq; không liên quan key Brevo |

### 6. Giới hạn Free và cập nhật về sau

- Render Free ngủ sau 15 phút không có request; lần mở đầu có thể chờ khoảng một phút. SMTP 25/465/587 bị chặn, nên bắt buộc dùng `MAIL_PROVIDER=brevo` trên Render Free. Không dùng cơ chế ping liên tục để né giới hạn Free.
- Nhắc lịch nền chỉ chạy lúc service đang thức. Muốn nhắc đúng giờ 24/7 cần dịch vụ luôn chạy hoặc scheduler ngoài; chưa thêm ở bản này.
- Brevo Free hiện giới hạn 300 email/ngày, còn phụ thuộc trạng thái tài khoản. Neon/Upstash/Groq cũng có quota. Kiểm tra usage và điều khoản hiện tại, không tự nâng cấp trả phí.
- Nhánh phát hành là `main`; `render.yaml` đã đặt `branch: main`. Với app trước đây chạy từ `deploy/render-brevo`, đổi nhánh liên kết của Blueprint trên Render sang `main`, sync Blueprint và kiểm tra Source branch của service cũng là `main`. Giữ nguyên service và credentials, không tạo lại Blueprint/database. Những lần cập nhật tiếp theo nên review PR rồi merge vào main để auto-deploy. Không thay SECRET_KEY tùy tiện vì sẽ buộc đăng nhập lại; thay key đã lộ thì phải redeploy.
- Xem [Render Free](https://render.com/docs/free), [Docker](https://render.com/docs/docker), [Blueprint](https://render.com/docs/blueprint-spec), [Brevo plans](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans).

## Koyeb (phương án cũ, không dùng cho tài khoản Free mới)

Koyeb thông báo tài khoản mới cần gói trả phí; không tiếp tục hướng này nếu muốn Free. `Dockerfile.koyeb` được giữ để tương thích, hướng deploy hiện tại là Render + Brevo ở trên.

`Dockerfile.koyeb` đóng gói FastAPI và frontend chung origin; không thay thế Docker Compose local. Build context phải là **gốc repository**, Dockerfile path là `Dockerfile.koyeb` (không chọn working directory `backend`). Cấu hình một Web Service, một instance, HTTP port `8000`, health check HTTP `GET /health`; giữ nguyên entrypoint/command của image. Entrypoint chạy Alembic trước Uvicorn, không có `--reload`.

1. Tạo PostgreSQL trên Neon và Redis trên Upstash. Không dùng database/Redis của người khác hoặc dữ liệu local để kiểm thử deploy.
2. Điền các biến từ `.env.koyeb.example` vào Environment/Secrets trên Koyeb. Không upload `.env` và không commit key. `DATABASE_URL` dùng driver `postgresql+asyncpg://`, bỏ query `sslmode`/`channel_binding`, đặt `DATABASE_SSL=true`. Mã hóa URL các ký tự đặc biệt trong user/password. TLS kiểm tra CA và hostname áp dụng cho cả migration và app. Upstash dùng URL `rediss://`, không dùng REST URL/token.
3. Tạo `SECRET_KEY` riêng bằng `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Cấu hình Gmail App Password ở `SMTP_PASSWORD`, không phải mật khẩu đăng nhập Gmail. `ADMIN_PASSWORD` để trống nếu không cần bootstrap admin. Đặt `AI_API_KEY` nếu cần Groq thật.
4. Build thử: `docker build -f Dockerfile.koyeb -t planify-koyeb .`. Để chạy thử, tạo file riêng `.env.koyeb.local` (được Git bỏ qua) trỏ tới **database/Redis thử**, rồi chạy `docker run --rm -p 127.0.0.1:3001:8000 --env-file .env.koyeb.local planify-koyeb`. Mở `http://localhost:3001/` và `/health`; xác nhận đăng ký/OTP, đăng nhập, CRUD và AI sau khi điền credentials thật.
5. Sau deploy, kiểm tra `/health`, tài nguyên JS/CSS, gửi OTP đến email của bạn và đăng nhập lại. Nếu OTP lỗi, kiểm tra SMTP credentials và kết nối cổng 587 trong logs, không đưa App Password vào ảnh/log công khai.

Giữ một worker/instance để tránh nhiều scheduler gửi nhắc trùng. Free instance có thể ngủ: OTP chỉ gửi khi có request, nhưng **nhắc lịch nền không bảo đảm đúng giờ khi service ngủ**. Log trong container không bền; xem console logs của Koyeb. Database/Redis phải ở dịch vụ ngoài. Kiểm tra điều khoản/gói phí hiện tại trước khi tạo dịch vụ; repository không tự tạo tài nguyên cloud.

## Chức năng và giới hạn

- Đăng ký/khôi phục tài khoản bằng OTP email, đăng nhập JWT Bearer; quản lý profile và giao diện sáng/tối.
- To Do: bảng công việc, danh sách, bước con, tìm kiếm, bộ lọc, ngày giờ, độ quan trọng, lặp và nhắc việc.
- Calendar: tháng, tuần, ngày, lịch biểu; sự kiện riêng và task có lịch; xử lý trùng giờ.
- Dashboard và trợ lý AI quản lý công việc/lịch bằng tiếng Việt.
- Màn hình “thanh toán $20” trước khi vào AI là **mô phỏng giao diện**, không thu tiền.

Ứng dụng không đồng bộ tài khoản Google/Outlook. Kết quả kiểm thử cũ không tự chứng minh source hiện tại đã nghiệm thu đầy đủ.

Xem [PROJECT.md](docs/PROJECT.md) để tra cứu kiến trúc, API, cách kiểm thử và bảng Functional Acceptance Cases.
