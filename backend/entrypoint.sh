#!/bin/sh
set -e

echo "=== [1/2] Tự động cập nhật cấu trúc Database (Alembic Migration)... ==="
alembic upgrade head

echo "=== [2/2] Khởi chạy ứng dụng FastAPI... ==="
exec "$@"
