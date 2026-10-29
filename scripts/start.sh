#!/usr/bin/env bash
set -euo pipefail
cd backend
# One service/one worker: migration completes before the new process serves.
# Do not run multiple replicas of this startup command concurrently.
python -m alembic upgrade head
exec python -m uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1
