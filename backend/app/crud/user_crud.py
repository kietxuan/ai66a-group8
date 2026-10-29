from sqlalchemy import select

from app.models import User


def by_email(db, email):
    return db.scalar(select(User).where(User.email == email))
