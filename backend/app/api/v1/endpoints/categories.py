from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user_model import User
from app.schemas.category_schema import CategoryCreate, CategoryUpdate, CategoryResponse
from app.services.category_service import category_service

router = APIRouter()

@router.get("", response_model=List[CategoryResponse])
async def get_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy danh sách các nhãn màu (categories)"""
    return await category_service.get_categories(db, user_id=current_user.id)

@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    cat_in: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tạo nhãn mới"""
    return await category_service.create_category(db, user_id=current_user.id, cat_in=cat_in)

@router.put("/{cat_id}", response_model=CategoryResponse)
async def update_category(
    cat_id: int,
    cat_in: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cập nhật nhãn"""
    return await category_service.update_category(
        db, cat_id=cat_id, user_id=current_user.id, cat_in=cat_in
    )

@router.delete("/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    cat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Xóa nhãn"""
    await category_service.delete_category(db, cat_id=cat_id, user_id=current_user.id)

