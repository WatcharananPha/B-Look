from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from app.db.session import get_db
from app.models.product import FabricType

router = APIRouter()

class FabricResponse(BaseModel):
    id: int
    name: str
    price_adjustment: float
    class Config:
        from_attributes = True

@router.get("/fabrics", response_model=List[FabricResponse])
def get_fabrics(db: Session = Depends(get_db)):
    return db.query(FabricType).filter(FabricType.is_active == True).all()
