from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.session import get_db
from app.models.user import User
from app.models.order import Order as OrderModel
from app.api import deps
from fastapi import Body

router = APIRouter()


# Schema สำหรับรับค่า Update
class UserUpdate(BaseModel):
    role: str
    is_active: Optional[bool] = True


class UserOut(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    role: str
    is_active: bool

    class Config:
        from_attributes = True


# 1. ดูรายชื่อ User ทั้งหมด
@router.get("/users", response_model=List[UserOut])
def read_users(
    db: Session = Depends(get_db), current_user: User = Depends(deps.get_current_user)
):
    # เช็คสิทธิ์: เฉพาะ Admin หรือ Owner เท่านั้น
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    users = db.query(User).all()
    return users


# 2. เปลี่ยน Role / Approve User
@router.put("/users/{user_id}", response_model=UserOut)
def update_user_role(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = user_in.role
    if user_in.is_active is not None:
        user.is_active = user_in.is_active

    db.commit()
    db.refresh(user)
    return user


# --- Approve Order / Advance Status (Admin only) ---
class ApproveBody(BaseModel):
    next_status: Optional[str] = None


@router.post("/orders/{order_id}/approve")
def approve_order(
    order_id: int,
    body: ApproveBody = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    o = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")

    # Determine next status if not provided
    if body.next_status:
        o.status = body.next_status
    else:
        s = (o.status or "").upper()
        if s == "WAITING_BOOKING":
            o.status = "WAITING_DEPOSIT"
        elif s == "WAITING_DEPOSIT":
            o.status = "WAITING_BALANCE"
        else:
            o.status = "PAID"

    db.add(o)
    db.commit()
    db.refresh(o)
    return o
