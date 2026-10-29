from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import AppError
from app.core.security import token_user_id
from app.models import User


def current_user(request: Request, db: Session = Depends(get_db)):
    user = db.get(User, token_user_id(request))
    if user is None:
        raise AppError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập lại")
    return user
