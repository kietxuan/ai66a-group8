from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.database import get_db
from app.core.security import clear_cookie, set_cookie
from app.schemas.auth import Login, Register
from app.services import auth_service
from app.services.chat_context import store
from app.schemas.responses import Envelope, UserOut

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", status_code=201, response_model=Envelope[UserOut])
def register(payload: Register, db: Session = Depends(get_db)):
    return {"data": auth_service.public_user(auth_service.register(db, payload))}


@router.post("/login", response_model=Envelope[UserOut])
def login(payload: Login, response: Response, db: Session = Depends(get_db)):
    user = auth_service.login(db, payload)
    set_cookie(response, user.id)
    return {"data": auth_service.public_user(user)}


@router.get("/me", response_model=Envelope[UserOut])
def me(user=Depends(current_user)):
    return {"data": auth_service.public_user(user)}


@router.post("/logout", status_code=204)
def logout(user=Depends(current_user)):
    with store.guard(user.id):
        store.clear(user.id, forget=True)
    response = Response(status_code=204)
    clear_cookie(response)
    return response
