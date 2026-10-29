from sqlalchemy import or_, select

from app.core.errors import AppError
from app.models import Category, Task


def categories(db, user_id):
    return db.scalars(select(Category).where(Category.user_id == user_id).order_by(Category.id)).all()


def own_category(db, user_id, category_id):
    if category_id is not None and not db.scalar(select(Category.id).where(
            Category.id == category_id, Category.user_id == user_id)):
        raise AppError(404, "NOT_FOUND", "Không tìm thấy danh mục")


def own_task(db, user_id, task_id):
    task = db.scalar(select(Task).where(Task.id == task_id, Task.user_id == user_id)
                     .execution_options(populate_existing=True))
    if task is None:
        raise AppError(404, "NOT_FOUND", "Không tìm thấy công việc")
    return task


def list_tasks(db, user_id, filters):
    own_category(db, user_id, filters.category_id)
    query = select(Task).where(Task.user_id == user_id)
    for field in ("task_date", "status", "priority", "category_id", "start_time", "end_time"):
        value = getattr(filters, field)
        if value is not None:
            query = query.where(getattr(Task, field) == value)
    if filters.all_day is not None:
        query = query.where(Task.start_time.is_(None) if filters.all_day else Task.start_time.is_not(None))
    if filters.date_from:
        query = query.where(Task.task_date >= filters.date_from)
    if filters.date_to:
        query = query.where(Task.task_date <= filters.date_to)
    if filters.search:
        term = '%' + filters.search.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
        query = query.where(or_(Task.title.ilike(term, escape='\\'), Task.description.ilike(term, escape='\\')))
    return db.scalars(query.order_by(Task.task_date, Task.start_time.asc().nulls_last(), Task.id)).all()


def conflicts(db, user_id, fields, exclude_id=None):
    if fields["start_time"] is None:
        return []
    query = select(Task).where(Task.user_id == user_id, Task.status == "pending",
        Task.task_date == fields["task_date"], Task.start_time < fields["end_time"],
        Task.end_time > fields["start_time"])
    if exclude_id is not None:
        query = query.where(Task.id != exclude_id)
    return db.scalars(query.order_by(Task.id).execution_options(populate_existing=True)).all()
