# DATABASE DESIGN

## 1. Engine và dữ liệu thời gian

PostgreSQL; SQLAlchemy 2 + Alembic + psycopg; Neon production. ID integer identity, hard delete.

Timezone nghiệp vụ: Asia/Ho_Chi_Minh. task_date là DATE; start_time/end_time là TIME WITHOUT TIME ZONE có độ chính xác tới phút. created_at/updated_at là TIMESTAMPTZ lưu UTC, response ISO 8601 có timezone.

Không hỗ trợ task qua đêm/multi-day/recurring/multi-timezone trong MVP. Không chuyển task_date thành UTC timestamp.

## 2. Users

| Field | Kiểu / constraint |
|---|---|
| id | Integer identity primary key |
| name | VARCHAR(100), NOT NULL; trim, 1–100 ký tự |
| email | VARCHAR(254), NOT NULL, UNIQUE; email hợp lệ, trim/lowercase |
| password | VARCHAR(255), NOT NULL; chỉ chứa bcrypt hash |
| created_at | TIMESTAMPTZ, NOT NULL, default thời điểm tạo |
| updated_at | TIMESTAMPTZ, NOT NULL, cập nhật khi thay đổi |

Password input tối thiểu 8 ký tự, tối đa 72 byte UTF-8; không trim/cắt. Đây là validation input, không phải độ dài cột hash. Không trả password trong API. [Giới hạn bcrypt](https://pypi.org/project/bcrypt/).

Amendment 22/10: backend dùng Passlib CryptContext + bcrypt, vẫn lưu chuỗi bcrypt 60 ký tự (hash mới `$2b$12$...`) vào cột trên. Không thêm cột/migration, không reset database hoặc đổi mật khẩu tài khoản cũ; login chỉ verify, không ghi lại hash. Trường hợp password chứa NUL giữ nhánh pyca/bcrypt tương thích API cũ; xem [kiến trúc](ARCHITECTURE.md).

User có nhiều Tasks và Categories. Unique email được database bảo vệ cả khi register đồng thời.

## 3. Categories

| Field | Kiểu / constraint |
|---|---|
| id | Integer identity primary key |
| user_id | Integer, NOT NULL, FK Users, ON DELETE CASCADE |
| name | VARCHAR(50), NOT NULL; UNIQUE(user_id, name) |
| created_at | TIMESTAMPTZ, NOT NULL |

MVP có ba category mặc định/user: Học tập, Công việc, Cá nhân. GET /api/categories chỉ trả category của user hiện tại; không có API tạo/sửa/xóa category.

Week 3 migration thêm bảng và backfill ba category cho các user đã tạo Week 2. Service đăng ký từ Week 3 tạo categories trong cùng transaction tạo user. Seed/backfill phải idempotent, không tạo duplicate và không dựa vào các ID cố định.

FK Tasks.category_id dùng ON DELETE SET NULL để giữ tính toàn vẹn nếu category bị xóa bằng thao tác quản trị ngoài MVP.

## 4. Tasks

| Field | Kiểu / constraint |
|---|---|
| id | Integer identity primary key |
| user_id | Integer, NOT NULL, FK Users, ON DELETE CASCADE |
| category_id | Integer nullable, FK Categories, ON DELETE SET NULL |
| title | VARCHAR(200), NOT NULL; trim, 1–200 ký tự |
| description | TEXT nullable; API tối đa 2.000 ký tự |
| task_date | DATE, NOT NULL |
| start_time | TIME WITHOUT TIME ZONE nullable |
| end_time | TIME WITHOUT TIME ZONE nullable |
| priority | VARCHAR, NOT NULL; CHECK low/medium/high; default medium |
| status | VARCHAR, NOT NULL; CHECK pending/completed; default pending |
| created_at | TIMESTAMPTZ, NOT NULL |
| updated_at | TIMESTAMPTZ, NOT NULL; đổi trên mọi mutation thực tế |

CHECK thời gian:

- Cả start_time/end_time đều NULL; hoặc cả hai khác NULL và end_time > start_time.
- API chỉ nhận HH:MM; database cũng phải từ chối giờ có giây khác 0 hoặc giá trị 24:00.
- Task không có giờ được hiển thị ở vùng all-day và không tham gia conflict.
- Không hạn chế ngày quá khứ. Không dùng ngày hiện tại làm database constraint.

category_id nullable. Backend kiểm tra category.user_id = current_user.id trước create/update; một FK đơn không tự đảm bảo category cùng owner.

## 5. Ownership và indexes

Mọi query task/category/resolve chat phải filter theo current_user.id. Không nhận ownership từ client/AI; resource user khác trả 404.

Indexes MVP:

- PK các bảng và unique email.
- UNIQUE(categories.user_id, categories.name) đồng thời phục vụ query category theo user.
- tasks(user_id, task_date) cho Todo/Calendar/conflict.
- tasks(category_id) để hỗ trợ FK.

Chưa cần các index riêng theo priority/status/search; chỉ thêm khi query thực tế cho thấy cần. Không thêm full-text search hoặc pagination cho dữ liệu demo nhỏ.

## 6. Conflict policy

Chỉ xét task pending có đủ giờ, cùng user/cùng ngày; task completed/cả ngày không chặn lịch.

Overlap:

```text
new_start < existing_end
AND new_end > existing_start
```

- Khoảng chạm nhau không conflict.
- Khi update loại chính task hiện tại khỏi truy vấn.
- Check khi tạo; đổi ngày/giờ task pending; mở lại completed -> pending.
- Đổi title/description/priority/category không làm đổi lịch nên không bắt user xác nhận lại overlap đã được chấp nhận.
- Chuyển pending -> completed không cần conflict check.
- REST allow_conflict=true bỏ qua cảnh báo overlap sau quyết định user, không bỏ validation/ownership và không lưu flag.

Không dùng PostgreSQL exclusion constraint vì MVP cho phép user chủ động giữ overlap. Để tránh hai request cùng “thấy lịch trống”, khóa hàng User bằng SELECT ... FOR UPDATE trong transaction check + write. Mọi service ghi lịch dùng cùng policy; không giữ lock khi gọi Groq.

Test phải kiểm tra transaction đồng thời trên PostgreSQL, không chỉ test công thức overlap.

## 7. Migration và test database

- Week 2: Users migration. Week 3: Categories/Tasks + backfill category.
- Tạo/upgrade schema bằng Alembic, không create_all trong startup để thay migration.
- Kiểm tra nâng cấp từ schema Week 2 có dữ liệu và tạo database rỗng tới head.
- Test dùng TEST_DATABASE_URL trỏ PostgreSQL riêng. Fixture phải từ chối URL trùng DATABASE_URL và database chưa xác nhận là dành cho test trước reset schema.
- Rollback/cleanup test không được chạm development/production database. Migration tests dùng database test rỗng riêng.
- Production migration chạy một lần trước release; không tự downgrade/delete dữ liệu để “sửa lỗi”. Backup trước migration có rủi ro.

## 8. Chat context

Không tạo Conversations/Messages. Clarification và confirmation dùng context trong RAM, scoped theo user, TTL 10 phút như ARCHITECTURE/API_SPEC.

Context không phải dữ liệu bền vững: restart/expiry làm flow hết hiệu lực; backend yêu cầu user gửi lại. Không tuyên bố “stateless” khi vẫn cần ngữ cảnh nhiều lượt.

Đợt cải thiện 21/10 thêm memory có chọn lọc trong RAM, không bảng/cột mới. REST UI dùng updated_at làm expected_version để chống stale edit trong transaction hiện có. Không cần migration schema; `allow_conflict`, `expected_version`, reference và chat memory không được lưu như task fields.
