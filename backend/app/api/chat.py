from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.database import get_db
from app.schemas.chat import ChatRequest,Confirmation
from app.services import chat_service
from app.services.ai_provider import get_provider
from app.schemas.responses import Envelope, ChatResponse, ContextOut

router=APIRouter(prefix="/api/chat",tags=["Chat"])


@router.get("/context",response_model=Envelope[ContextOut],response_model_exclude_unset=True)
def context(user=Depends(current_user),db:Session=Depends(get_db)):
    return {"data":{"flow":chat_service.recover(user.id,db)}}


@router.post("",response_model=Envelope[ChatResponse],response_model_exclude_unset=True)
def chat(payload:ChatRequest,user=Depends(current_user),db:Session=Depends(get_db),provider=Depends(get_provider)):
    return {"data":chat_service.handle(db,user.id,payload,provider)}


@router.post("/confirm",response_model=Envelope[ChatResponse],response_model_exclude_unset=True)
def confirm(payload:Confirmation,user=Depends(current_user),db:Session=Depends(get_db)):
    return {"data":chat_service.confirm(db,user.id,payload)}
