# PROJECT PROGRESS

> File này được cập nhật sau mỗi tuần/session handoff.

## Current Status
- Current week: `WEEK_02`
- Overall status: `IN PROGRESS`
- Current Git checkpoint: Planning decisions resolved; ready for Week 2 implementation

## Technology Decisions
- [x] Database: PostgreSQL.
- [x] Backend: Python + FastAPI + Uvicorn.
- [x] LLM provider/model: Google Gemini API + Gemini 2.5 Flash.
- [x] AI integration: Gemini API + Structured Output / Function Calling.
- [x] Authentication: JWT access token trong HttpOnly cookie + bcrypt; không refresh token trong MVP.
- [x] Testing: Vitest + React Testing Library + pytest + HTTPX/FastAPI TestClient; Postman/REST Client cho manual testing.
- [x] Deployment: Render frontend/backend + Neon PostgreSQL.
- [x] Project duration: 10 tuần = 10 phase.

## Weekly Progress

### Week 01 — Planning
Status: `COMPLETED`
- [x] Requirements reviewed
- [x] UI design direction
- [x] Database design reviewed
- [x] API design reviewed
- [x] Critical MVP decisions resolved

### Week 02 — Authentication & Backend Foundation
Status: `NOT STARTED`

### Week 03 — Backend & Database Task Foundation
Status: `NOT STARTED`

### Week 04 — Todo List
Status: `NOT STARTED`

### Week 05 — Calendar
Status: `NOT STARTED`

### Week 06 — AI Chatbot Foundation
Status: `NOT STARTED`

### Week 07 — Chatbot Task Management
Status: `NOT STARTED`

### Week 08 — Conflict Detection Hardening & Optional Features
Status: `NOT STARTED`

### Week 09 — Testing
Status: `NOT STARTED`

### Week 10 — Deployment
Status: `NOT STARTED`

---

## Latest Handoff

### Completed
- Chốt FastAPI + Uvicorn + SQLAlchemy 2 + Alembic + psycopg.
- Chốt Authentication ở Week 2 trước Task CRUD ở Week 3.
- Chốt task field names, API response/error contract và conflict contract.
- Chốt conflict detection core ở Week 3, Week 8 là hardening.
- Bổ sung UI direction và local setup documentation.

### Files / Modules Changed
- `docs/PROJECT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/API_SPEC.md`
- `docs/ROADMAP.md`
- `docs/UI_DIRECTION.md`
- `docs/01_SETUP.md`
- `docs/weeks/WEEK_01.md` đến `WEEK_08.md` liên quan.
- `backend/requirements.txt`

### Checks / Tests Run
- Rà soát consistency giữa specification, architecture, database, API và roadmap.
- Kiểm tra route placeholder FastAPI dùng `{id}`.
- Kiểm tra không còn reference thứ tự tuần cũ hoặc quyết định MVP chưa chốt.

### Known Issues
- Code implementation chưa bắt đầu; backend/frontend entrypoints vẫn là skeleton.
- Gemini API key sẽ cấu hình ở Week 6.

### Deviations From Plan
- Authentication được đưa lên Week 2 trước Task CRUD.
- Conflict detection core được đưa vào Week 3; Week 8 chỉ hardening và kiểm thử.

### Next Action
Start Week 2 Authentication & Backend Foundation.
