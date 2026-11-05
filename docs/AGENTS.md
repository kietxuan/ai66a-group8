# Working with this repository

`README.md` is the local setup guide. `docs/PROJECT.md` is the compact description of the current product, API and acceptance cases. The application code is the final source of truth when documentation and implementation disagree.

## Current stack

- Frontend: static HTML/CSS and Vanilla JavaScript ES Modules under `frontend/`; Nginx proxies `/api/v1` to backend.
- Backend: FastAPI, SQLAlchemy async, asyncpg, Alembic under `backend/`.
- Data: PostgreSQL and Redis. Auth uses Bearer JWT stored by the frontend in `localStorage`.
- AI behavior is implemented through backend services and tools; the payment screen is a UI simulation only.

The former React/Vite, FullCalendar and cookie-auth plans are historical and must not be used as implementation instructions for this source.

## Change rules

- Keep task, event, list and conversation access scoped to the authenticated owner. Hash passwords before storage; never expose `.env`, tokens or API keys.
- Validate business changes in the backend. Preserve conflict handling, recurrence and the shared task data used by To Do and Calendar.
- Use Alembic for schema changes. Do not reset a database with user data to fix migrations. Integration tests must use a separate test database.
- Run relevant backend/frontend tests and inspect runtime behavior for changes that affect the UI. Record what was actually verified; old test reports do not prove the current checkout passes.
- Keep active project documentation in `README.md` and `docs/PROJECT.md`. Do not revive removed planning documents as current guidance.
