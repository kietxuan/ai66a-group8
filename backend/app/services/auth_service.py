from sqlalchemy.exc import IntegrityError

from app.core.errors import AppError
from app.core.security import hash_password, verify_password
from app.crud.user_crud import by_email
from app.models import Category, User

# One valid dummy hash; missing users still pay a password verification cost.
DUMMY_HASH = hash_password("not-a-user-password")


def public_user(user):
    return {"id": user.id, "name": user.name, "email": user.email}


def register(db, payload):
    user = User(name=payload.name, email=str(payload.email), password=hash_password(payload.password))
    try:
        db.add(user)
        db.flush()
        for name in ("Học tập", "Công việc", "Cá nhân"):
            db.add(Category(user_id=user.id, name=name))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(409, "EMAIL_EXISTS", "Email đã được đăng ký") from None
    return user


def login(db, payload):
    user = by_email(db, str(payload.email))
    valid = verify_password(payload.password, user.password if user else DUMMY_HASH)
    if user is None or not valid:
        raise AppError(401, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng")
    return user
