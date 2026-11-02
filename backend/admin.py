from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.user_model import User
from app.core.security import hash_password
from app.core.config import settings
from app.core.logger import logger

admin_username = settings.ADMIN_USERNAME
admin_useremail = settings.ADMIN_EMAIL
admin_password = settings.ADMIN_PASSWORD

async def create_admin_user(db: AsyncSession):
    try:
        # Đọn dẹp các tài khoản admin cũ
        stmt_delete = delete(User).where(User.is_developer == True, User.email != admin_useremail)
        await db.execute(stmt_delete)
        await db.commit()

        # Kiểm tra nếu tài khoản admin đã tồn tại
        stmt_select = select(User).where(User.email == admin_useremail)
        result = await db.execute(stmt_select)
        admin_exists = result.scalar_one_or_none()

        # Tạo tài khoản mới nếu chưa tồn tại
        if not admin_exists:
            new_admin = User(
                email=admin_useremail,
                nickname=admin_username,
                password_hashed= await hash_password(admin_password),
                is_developer=True
            )
            db.add(new_admin)
            await db.commit()
            logger.info(f"Tài khoản Admin {admin_useremail} đã được tạo thành công.")
        
        else:
            admin_exists.password_hashed = await hash_password(admin_password)
            admin_exists.nickname = admin_username
            await db.commit()
            logger.info(f"Cập nhật mật khẩu cho tài khoản Admin {admin_useremail} thành công.")

    except Exception as e:
        await db.rollback()
        raise e
