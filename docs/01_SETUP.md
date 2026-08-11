# LOCAL SETUP

## Requirements

- Python 3.11.
- PostgreSQL local hoặc Neon development database.
- Git.
- Node.js/npm sẽ được cần khi setup React ở Week 2 cho Authentication UI.

## Backend environment

Từ thư mục `backend`:

```text
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
```

Copy `.env.example` thành `.env` ở project root và điền:
- `DATABASE_URL`.
- `JWT_SECRET_KEY`.
- `JWT_EXPIRE_MINUTES`.
- `CORS_ORIGINS`.
- `GEMINI_API_KEY` khi bắt đầu Week 6.

## Database

- Dùng PostgreSQL.
- Schema và migration dùng SQLAlchemy 2 + Alembic.
- Không commit `.env` hoặc credentials.

## Run checks

Sau khi Week 2 tạo FastAPI app trong `backend/main.py`:

```text
python -m uvicorn main:app --reload
pytest
```

## Scope note

Project hiện đang ở trạng thái planning/not started. Các lệnh chạy app chỉ có hiệu lực sau khi Week 2 implementation tạo application và database migration.
