"""Serialize writes of one owner while checking/writing schedule data (never during LLM calls)."""
from functools import wraps
from inspect import signature
from sqlalchemy import select
from fastapi import HTTPException
from app.models.user_model import User

class AtomicBatchSession:
    """Keep CRUD flushes in one owner-locked transaction for a batch action."""
    def __init__(self, session):
        self.session = session

    def __getattr__(self, name):
        return getattr(self.session, name)

    async def commit(self):
        await self.session.flush()

async def lock_owner(db, user_id):
    if (await db.execute(select(User.id).where(User.id == user_id).with_for_update())).scalar_one_or_none() is None:
        raise HTTPException(404, "Không tìm thấy người dùng.")

def serialized_write(function):
    parameters = signature(function)
    @wraps(function)
    async def wrapped(*args, **kwargs):
        values = parameters.bind(*args, **kwargs).arguments
        await lock_owner(values["db"], values["user_id"])
        return await function(*args, **kwargs)
    return wrapped
