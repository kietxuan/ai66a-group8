from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update

from app.crud.base import CRUDBase
from app.models.user_model import User

class CRUDDeveloper(CRUDBase[User]):
    pass
