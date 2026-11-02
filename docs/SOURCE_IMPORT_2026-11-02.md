# SOURCE IMPORT — 2026-11-02

## Phạm vi được user xác nhận

Thay source hiện tại trên GitHub bằng project trong todo-list-pro/todo-list; giữ tài liệu cũ và lịch sử repository kietxuan/ai66a-group8, nhánh main. Không force-push.

Baseline mới nhất trước import: 96ed0b8fdd70a7c630fca04e1aa2b50a0708c446. Fetch và fast-forward trước khi sửa nên các commit e359278/96ed0b8 vẫn là tổ tiên của commit import.

## File và tài liệu

- Nhập 218 file từ project nguồn, loại riêng .env. Không sửa/xóa folder todo-list-pro gốc.
- Backend/frontend, Docker Compose, migrations, tests và docs đánh số dùng bản user cung cấp.
- Bỏ 78 file runtime chỉ thuộc app trước: React/Vite source/tooling, migrations/tests cũ, scripts, Render config và CI cũ. Không trộn hai schema hoặc chạy workflow cũ trên project mới. Có thể khôi phục chúng từ Git history tại 96ed0b8.
- Giữ mọi file kế hoạch và evidence cũ trong docs; giữ README trước import ở [README_PLANNING](../README_PLANNING.md). Chúng là tài liệu lịch sử nếu không khớp source mới.
- Lưu 21 file Markdown local chưa commit ở [planning-baseline](planning-baseline/README.md), giữ cấu trúc relative links. Git stash local cũng giữ backup trước import; không pop stash trực tiếp vì có thể ghi đè docs mới.
- README hiện tại lấy từ source mới, bổ sung bước tạo .env và phân biệt tài liệu mới/cũ.
- Không đổi business logic. Khác biệt so với source nguồn chỉ gồm safeguards .gitignore, JWT placeholder .env.example, README setup/ghi chú và whitespace ở ba file Python.

## Kiến trúc thực tế của bản được nhập

- Frontend Vanilla JavaScript ES Modules và CSS, không React/Vite.
- FastAPI, SQLAlchemy async + asyncpg, PostgreSQL, Redis.
- API /api/v1; Bearer token phía client, không cookie flow của kế hoạch cũ.
- Custom Calendar/Events/Task Lists, AI tools và Groq/OpenAI-compatible client; model mặc định lấy từ cấu hình source mới.
- Có thêm Dashboard/recurrence/OTP/admin và các chức năng ngoài MVP baseline.

Đây là ghi nhận khác biệt theo yêu cầu thay source của user, không phải tuyên bố mọi chức năng mới đã đạt acceptance/security. Không dùng các tests, migrations, render.yaml hoặc launcher của app trước cho bản mới.

Tài liệu đi cùng source mới: [tổng quan](00-tong-quan-du-an.md), [database](01-database-schema.md), [API](02-api-design.md), [AI](05-ai-agent-design.md), [frontend](06-frontend-architecture.md), [implementation](07-implementation-plan.md).

## Clone và cấu hình

Từ root sau khi clone:

```powershell
Copy-Item .env.example .env
```

Điền database/Redis/admin/JWT secret riêng và AI_API_KEY nếu dùng provider. Không dùng placeholder hoặc default credentials trên môi trường public.

```powershell
docker compose up -d --build
```

README mô tả frontend localhost:3000 và backend docs localhost:8000/docs khi giữ port tương ứng. Compose dùng .env, chạy migrations qua backend entrypoint và tạo volumes riêng; lệnh chạy app chưa được thực thi trong lượt import.

Không chạy docker compose down -v hoặc migration cũ vào database đang có dữ liệu để xử lý sự khác biệt schema. Muốn chuyển dữ liệu từ app trước phải có kế hoạch migration riêng và backup.

## Checks của lượt import

- Python syntax: python -m compileall -q backend tests — PASS.
- JavaScript syntax: node --input-type=module --check qua stdin, 52 module frontend/js — PASS.
- Compose model: docker compose --env-file .env.example config --no-env-resolution --quiet — PASS, không resolve .env cá nhân và không tạo/chạy container.
- Source parity: đủ 218 file, không thiếu hoặc thay nội dung ngoài packaging/whitespace đã nêu; 21 snapshot kế hoạch khớp stash — PASS.
- Index: không file .env/secrets/cache hoặc merge marker; không match token/private-key phổ biến — PASS. Pattern scan không chứng nhận không còn mọi loại secret.
- Git diff whitespace trước stage PASS cho file tracked; --cached check sau khi thêm file mới cảnh báo whitespace/blank-EOF có sẵn, gồm Markdown hard line breaks. Giữ format source, không rewrite hàng loạt hoặc che warnings.
- So sánh file import, loại secrets/generated artifacts và xem staged diff trước commit; Git remote SHA được kiểm tra lại sau push.

Không install dependencies, chạy app/test nghiệp vụ, gọi AI thật, deploy cloud hoặc sửa database trong lượt này. Không lấy các báo cáo JSON/test có sẵn làm kết quả mới.

## Security và limitations

.env giữ ở folder nguồn, không copy/upload. .env.*, venv/node_modules, cache/logs, .local, private-key files bị ignore; .env.example là cấu hình mẫu.

Có default admin/password/JWT fallback trong source và token lưu localStorage. Chưa audit toàn bộ authorization/AI/OTP/admin; không mô tả bản này an toàn tuyệt đối. Phải đổi secrets và đánh giá các luồng bảo mật trước public deployment.

Dependency requirements còn dùng version ranges, không phải reproducible lock đầy đủ. CI/Render config cũ bị gỡ vì không tương thích bản mới; lượt push này không chứng nhận remote CI hoặc deployment thành công.
