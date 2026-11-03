from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.user_crud import user_crud
from app.schemas.user_schema import UserCreate, UserUpdate, PasswordChange, UserErrors
from app.models.user_model import User
from app.models.calendar_model import Calendar
from app.models.task_model import TaskList
from app.core.security import hash_password, verify_password

class UserService:
    async def get_all_users(self, page: int, limit: int, current_user: User, db: AsyncSession) -> List[User]:
        return await user_crud.get_all_users(page=page, limit=limit, current_user_id=current_user.id, db=db)

    async def register_new_user(self, db: AsyncSession, user_in: UserCreate, redis=None) -> User:
        existing_user = await user_crud.get_by_email(db, email=user_in.email)
        if existing_user:
            raise UserErrors.EMAIL_ALREADY_EXISTS.throw()

        from app.helper.otp import verify_action_token
        from app.services.auth_service import auth_service
        from fastapi import HTTPException
        if redis is None:
            raise HTTPException(503, "Dịch vụ xác minh email chưa sẵn sàng.")
        proof = user_in.verified_token
        if not proof and user_in.otp:
            proof = await auth_service.verify_otp_email(user_in.email, "verify-email", user_in.otp, redis)
        if not proof:
            raise HTTPException(400, "Cần xác minh email trước khi đăng ký.")
        await verify_action_token(user_in.email, "verify-email", proof, redis)

        hashed_pwd = await hash_password(user_in.password)
        new_user = await user_crud.create(db, obj_in=user_in, hashed_password=hashed_pwd)

        # Auto-seed default Calendar and TaskList for new user
        default_cal = Calendar(
            user_id=new_user.id,
            name="Lịch của tôi",
            color="#4285F4",
            is_default=True,
            is_visible=True
        )
        default_list = TaskList(
            user_id=new_user.id,
            name="Tasks",
            color="#4285F4",
            is_default=True,
            position=0
        )
        db.add(default_cal)
        db.add(default_list)
        await db.commit()

        return new_user

    async def update_profile(self, db: AsyncSession, current_user: User, user_in: UserUpdate, redis = None) -> User:
        if user_in.email and user_in.email.lower() != current_user.email.lower():
            existing = await user_crud.get_by_email(db, email=user_in.email)
            if existing and existing.id != current_user.id:
                raise UserErrors.EMAIL_ALREADY_EXISTS.throw()

            from app.helper.otp import verify_action_token
            from app.services.auth_service import auth_service
            proof = user_in.verified_token
            if not proof and user_in.otp and redis:
                proof = await auth_service.verify_otp_email(user_in.email, "verify-email", user_in.otp, redis)
            if not proof:
                raise UserErrors.OTP_REQUIRED.throw()
            if proof and redis:
                await verify_action_token(user_in.email, "verify-email", proof, redis)

            current_user.email = user_in.email

        return await user_crud.update_profile(db, user=current_user, obj_in=user_in)

    async def change_password(self, db: AsyncSession, current_user: User, password_in: PasswordChange) -> None:
        if not await verify_password(password_in.current_password, current_user.password_hashed):
            raise UserErrors.INVALID_CURRENT_PASSWORD.throw()

        hashed_pwd = await hash_password(password_in.new_password)
        await user_crud.update_password(db, user=current_user, hashed_password=hashed_pwd)

user_service = UserService()
