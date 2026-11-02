# 🚀 Production Operations, Architecture & Maintenance Guide

> **Document Identifier:** `docs/13-production-operations-guide.md`  
> **Version:** 3.1.0 — Production Infrastructure & Operations Manual  
> **Target Environment:** Multi-Container Docker Stack (Production / Staging)  
> **Component Stack:** Nginx (Alpine) + FastAPI (Python 3.11) + PostgreSQL 15 + Redis 7 + Groq LPU Cloud

---

## 1. Production Architecture & Network Topology

Planify is deployed as a resilient, decoupled micro-services stack orchestrated via Docker Compose. The architecture isolates stateful data layers within an internal container bridge network while exposing single-port access for static web traffic and API routing.

### 1.1. Physical Architecture Topology
```
                             [ CLIENT BROWSER / MOBILE ]
                                          │
                      HTTP / HTTPS :3000   │  (Reverse Proxy /api/ -> backend:8000)
                                          ▼
                         ┌─────────────────────────────────┐
                         │       frontend (Nginx 1.25)     │
                         │    Port 3000:80 (Alpine Linux)  │
                         └────────────────┬────────────────┘
                                          │
              Internal Docker Bridge Network (web-template_default)
                                          │
                     ┌────────────────────┴────────────────────┐
                     ▼                                         ▼
   ┌───────────────────────────────────┐     ┌───────────────────────────────────┐
   │       backend (FastAPI / Uvicorn) │     │      External AI Cloud Provider   │
   │    Port 8000:8000 (Python 3.11)   │────>│   Groq LPU (openai/gpt-oss-120b)  │
   └─────────────┬───────────────┬─────┘     └───────────────────────────────────┘
                 │               │
      AsyncPG    ▼               ▼  Redis-py
  ┌───────────────────────┐   ┌───────────────────────┐
  │  db-postgre (PG 15)   │   │     redis (Redis 7)   │
  │  Port 15432:5432      │   │  Port 6379:6379       │
  │  Volume: postgres_data│   │  Volume: redis_data   │
  └───────────────────────┘   └───────────────────────┘
```

### 1.2. Component Responsibilities & Port Matrix

| Container Service | Base Image | Internal Port | Host Port | Volume Mounts | Primary Responsibility |
|---|---|:---:|:---:|---|---|
| **`frontend`** | `nginx:alpine` | `80` | `3000` | `./frontend:/usr/share/nginx/html:ro`<br>`nginx.conf:/etc/nginx/conf.d/default.conf:ro` | Serves Vanilla JS SPA assets; proxies `/api/` upstream; enforces no-cache on code assets. |
| **`backend`** | `python:3.11-slim` | `8000` | `8000` | `./backend:/app`<br>`.:/workspace` | Core FastAPI REST API; SQLAlchemy 2.0 async engine; AI Agent tool executor; RFC 5545 calculation. |
| **`db-postgre`** | `postgres:15-alpine` | `5432` | `15432` / `5432` | `postgres_data:/var/lib/postgresql/data` | Relational persistence (Users, Calendars, Events, Tasks, Subtasks, AI Conversations). |
| **`redis`** | `redis:7-alpine` | `6379` | `6379` | `redis_data:/data` | Session cache; AI rate limiter (30 req/min); background task synchronization. |

---

## 2. Environment Configuration & Secret Management

All operational parameters are governed through `.env` located at the project root. Never commit production secrets to source control.

### 2.1. Complete Environment Variable Reference

| Variable Name | Required | Default / Example | Security Scope | Operational Description |
|---|:---:|---|:---:|---|
| `PROJECT_NAME` | No | `"Planify Production"` | Public | Human-readable service identifier in logs and API docs. |
| `COMPOSE_PROJECT_NAME` | Yes | `web-template` | Public | Docker container naming prefix (`web-template-backend-1`, etc.). |
| `HOST_PORT_FRONTEND` | Yes | `3000` | Public | Host port binding for the Nginx web application. |
| `HOST_PORT_BACKEND` | Yes | `8000` | Internal/VPN | Direct host port binding for FastAPI REST documentation and healthchecks. |
| `HOST_PORT_DB` | Yes | `15432` (or `5432`) | Restricted | PostgreSQL host port (keep restricted behind firewall in production). |
| `HOST_PORT_REDIS` | Yes | `6379` | Restricted | Redis host port (keep restricted behind firewall in production). |
| `POSTGRES_USER` | Yes | `postgres` | Sensitive | Master database username. |
| `POSTGRES_PASSWORD` | Yes | *Strong Random String* | **Critical** | Database master authentication password. |
| `POSTGRES_DB` | Yes | `web_base` | Internal | Primary database catalog name. |
| `REDIS_PASSWORD` | Yes | *Strong Random String* | **Critical** | Redis server authentication password (`--requirepass`). |
| `SECRET_KEY` | Yes | *Min 64-char Hex String* | **Critical** | HMAC-SHA256 secret key for signing JWT bearer tokens. |
| `ALGORITHM` | Yes | `HS256` | Internal | Cryptographic algorithm for JWT encoding/decoding. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Yes | `11520` (8 days) | Internal | Lifetime of authenticated JWT tokens before re-login is required. |
| `AI_API_KEY` | Yes | `gsk_...` | **Critical** | Groq Cloud API authentication key for LLM tool invocation. |
| `AI_MODEL` | Yes | `openai/gpt-oss-120b` | Public | Upstream model identifier running on Groq LPU hardware. |
| `ADMIN_USERNAME` | No | `admin` | Sensitive | Initial administrator username provisioned on cold start. |
| `ADMIN_EMAIL` | No | `admin@planify.local` | Sensitive | Initial administrator email. |
| `ADMIN_PASSWORD` | No | *Strong Random String* | Sensitive | Initial administrator password. |

---

## 3. System Lifecycle & Standard Docker Operations

### 3.1. Cold Startup Procedure
1. Verify configuration:
   ```bash
   cp .env.example .env
   # Edit .env with production passwords and valid AI_API_KEY
   ```
2. Build and launch containers in detached mode:
   ```bash
   docker compose up -d --build
   ```
3. Run database migrations:
   ```bash
   docker compose exec backend alembic upgrade head
   ```
4. Verify all 4 containers report `healthy` or `running`:
   ```bash
   docker compose ps
   ```

### 3.2. Graceful Shutdown & Container Teardown
To prevent corrupted database writes or truncated client connections:
```bash
# Graceful stop with 15-second SIGTERM drainage timeout
docker compose stop -t 15

# Complete teardown (retaining data volumes)
docker compose down

# Teardown including orphan container removal
docker compose down --remove-orphans
```

### 3.3. Database Migration Management with Alembic
All schema alterations must be managed via Alembic within the backend container.
```bash
# 1. Apply all pending migrations to head
docker compose exec backend alembic upgrade head

# 2. Check current database migration revision
docker compose exec backend alembic current

# 3. View full migration history
docker compose exec backend alembic history --verbose

# 4. Rollback exactly one revision (emergency rollback)
docker compose exec backend alembic downgrade -1

# 5. Generate new autogenerated migration script after model change
docker compose exec backend alembic revision --autogenerate -m "add_column_name"
```

---

## 4. Health Checks, Monitoring & Diagnostics

### 4.1. Health Probe Specification (`GET /health`)
The backend provides a lightweight, unauthenticated health endpoint (`BUG-19`):
- **Request**: `GET http://localhost:8000/health`
- **Response**: `HTTP 200 OK`
- **Body**: `{"status": "ok"}`
- **Docker Healthcheck Integration**:
  ```yaml
  healthcheck:
    test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/health')\""]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 15s
  ```

### 4.2. Diagnostic Probes via Command-Line
```bash
# 1. Check frontend web server availability
curl -I http://localhost:3000

# 2. Check backend healthcheck endpoint
curl -s http://localhost:8000/health

# 3. Check PostgreSQL readiness via pg_isready
docker compose exec db-postgre pg_isready -U postgres -d web_base

# 4. Check Redis responsiveness with authentication
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" ping
```

### 4.3. Real-Time Log Monitoring
```bash
# Tail logs across all services
docker compose logs -f --tail=100

# Tail backend service logs exclusively
docker compose logs -f --tail=100 backend

# Monitor for unhandled 500 exceptions
docker compose logs backend | grep -i "error" | grep -v "INFO"
```

### 4.4. PostgreSQL Connection Pool Diagnostics
To verify connection pool health and prevent connection leaks:
```bash
docker compose exec db-postgre psql -U postgres -d web_base -c "
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
"
```

---

## 5. Zero-Downtime Maintenance & Upgrades

### 5.1. Non-Destructive Database Schema Expansion
When introducing schema modifications in production, adhere to the **Expand / Contract Pattern**:
1. **Phase 1 (Expand)**: Add new columns as `nullable=True` or with server defaults. Never rename or drop existing columns in use by running code.
2. **Phase 2 (Migrate)**: Deploy the updated backend code that populates both old and new fields.
3. **Phase 3 (Contract)**: After verification, apply a final migration removing deprecated columns.

### 5.2. Rolling Container Rebuild Procedure
To update the application without dropping active user sessions:
```bash
# 1. Pull / update source code
git pull origin main

# 2. Build the new backend image without taking down active containers
docker compose build backend frontend

# 3. Apply any additive database migrations
docker compose exec backend alembic upgrade head

# 4. Re-create the backend service container (minimal sub-second swap)
docker compose up -d --no-deps --build backend

# 5. Re-create the frontend service container
docker compose up -d --no-deps --build frontend
```

---

## 6. Backup, Disaster Recovery & Restore Procedures

### 6.1. Automated PostgreSQL Backup (`pg_dump`)
Run regular compressed database dumps:
```bash
# Create backup directory
mkdir -p ./backups/postgres

# Generate timestamped compressed dump
BACKUP_FILE="./backups/postgres/planify_db_$(date +%Y%m%d_%H%M%S).sql.gz"
docker compose exec -T db-postgre pg_dump -U postgres -d web_base | gzip > "$BACKUP_FILE"

echo "Backup created successfully at: $BACKUP_FILE"
```

#### Production Cron Automation (`/etc/cron.d/planify-backup`)
```cron
# Execute daily full backup at 02:00 AM and retain for 30 days
0 2 * * * root docker compose -f /path/to/todo-list/docker-compose.yml exec -T db-postgre pg_dump -U postgres -d web_base | gzip > /var/backups/planify/planify_$(date +\%F).sql.gz
0 3 * * * root find /var/backups/planify/ -name "*.sql.gz" -mtime +30 -delete
```

### 6.2. Disaster Recovery Database Restoration
To restore a snapshot in the event of hardware or storage failure:
```bash
# 1. Stop backend service to prevent write conflicts
docker compose stop backend

# 2. Drop existing database and recreate clean database
docker compose exec -T db-postgre psql -U postgres -c "DROP DATABASE web_base;"
docker compose exec -T db-postgre psql -U postgres -c "CREATE DATABASE web_base;"

# 3. Decompress and pipe SQL dump into psql
gunzip -c ./backups/postgres/planify_db_20261102_000000.sql.gz | docker compose exec -T db-postgre psql -U postgres -d web_base

# 4. Restart backend service
docker compose start backend

# 5. Verify data integrity
curl -s http://localhost:8000/health
```

### 6.3. Redis State Persistence & Backup
Redis writes append-only files (AOF) and snapshot dumps (`dump.rdb`) to the `redis_data` volume.
```bash
# Force background snapshot creation
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" BGSAVE

# Inspect last save status
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" LASTSAVE
```

---

## 7. Security Hardening & Production Compliance

1. **Authentication Token Lifecycle**:
   - JWT tokens are signed using `HS256` with a high-entropy secret (`SECRET_KEY`).
   - Tokens are stored in browser `localStorage` and sent via `Authorization: Bearer <token>`.
   - Logging out calls `auth.logout()`, strictly clearing authentication keys while preserving theme and user preferences (`BUG-06`).
2. **Rate Limiting & Abuse Prevention**:
   - Redis-backed rate limiter enforces a strict ceiling of **30 requests per minute** per user on AI endpoints.
   - Excessive requests return `HTTP 429 Too Many Requests` with `Retry-After` headers.
3. **Database Parameterization & SQL Injection Defense**:
   - All database interactions use SQLAlchemy 2.0 async select/insert expressions with parameter binding via `asyncpg`. No raw string formatting is permitted in query construction (`test_adv_17`).
4. **Cross-Origin Resource Sharing (CORS)**:
   - Configured in `backend/main.py` via `CORSMiddleware`. In production environments, restrict `allow_origins` to your specific domain (e.g. `https://planify.example.com`).
5. **Nginx Security Headers**:
   - `frontend/nginx.conf` sets `no-cache, no-store` on application code to prevent stale cached JavaScript execution across client releases.

---

## 8. Operational Troubleshooting Matrix

| Issue / Symptom | Root Cause | Immediate Diagnostic Command | Resolution Procedure |
|---|---|---|---|
| **Frontend displays 502 Bad Gateway on `/api/`** | Backend container is stopped or restarting | `docker compose ps backend` | Inspect `docker compose logs backend`. Ensure PostgreSQL and Redis healthchecks pass. |
| **Backend crash loop on startup** | Database credentials or connection timeout | `docker compose logs backend --tail 50` | Verify `DATABASE_URL` matches `POSTGRES_USER` and `POSTGRES_PASSWORD` in `.env`. Run `alembic upgrade head`. |
| **Login returns HTTP 401 Unauthorized** | Expired JWT or incorrect password | `curl -X POST http://localhost:8000/api/v1/auth/login -d "username=...&password=..."` | Check user record in database. Reset password via admin console if required. |
| **AI Chat returns HTTP 429 Too Many Requests** | Exceeded 30 requests/minute limit | `docker compose exec redis redis-cli -a "$REDIS_PASSWORD" keys "rate_limit*"` | Wait 60 seconds for rate limit window to expire, or clear specific key in Redis. |
| **AI Chat returns "Không thể kết nối tới mô hình AI"** | Invalid `AI_API_KEY` or upstream Groq network error | Inspect backend log for `groq.AuthenticationError` | Update `AI_API_KEY` in `.env` with a valid key and restart backend: `docker compose restart backend`. |
| **Database migration lock / alembic hangs** | Dangling connection holding table lock | `SELECT pid, query, state FROM pg_stat_activity WHERE state != 'idle';` | Terminate locking process: `SELECT pg_terminate_backend(pid);` then retry `alembic upgrade head`. |
| **Frontend changes do not appear in browser** | Browser caching stale JS modules | Inspect browser DevTools Network tab | Verify `nginx.conf` has `expires -1` for JS/CSS. Perform hard refresh (`Ctrl + Shift + R`). |
| **Port conflict on startup (`port is already allocated`)** | Another service is using 3000, 8000, or 5432 | `sudo lsof -i :3000` or `sudo lsof -i :8000` | Modify `HOST_PORT_FRONTEND` or `HOST_PORT_BACKEND` in `.env` to alternative ports (e.g. 3001, 8001). |

---

## 9. Comprehensive Test Suite Execution

Run the full verification suite against the running Docker stack:

```bash
# 1. Run full 4-Tier E2E Test Suite (89 tests)
docker compose exec backend python tests/test_e2e_suite.py

# 2. Run Tier 5 Adversarial Hardening Suite (25 tests)
docker compose exec backend python tests/test_tier5_adversarial_hardening.py

# 3. Run Recurrence Unit & Integration Fixes Suite
docker compose exec backend python tests/test_recurrence_fixes.py

# 4. Run Phase 1 Database & REST CRUD Suite
docker compose exec backend python tests/test_phase1_api.py

# 5. Run Phase 4 To-Do & Recurrence Suite
docker compose exec backend python tests/test_phase4_todo.py

# 6. Run Phase 5 AI Agent & Guardrails Suite
docker compose exec backend python tests/test_phase5_ai.py
```

---
*Authored for Planify Milestone M6 Documentation Suite. Certified against Production Commit Hash & Docker Stack.*
