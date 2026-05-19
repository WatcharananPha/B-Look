from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict

from app.db.session import get_db
from app.models.user import User
from app.models.order import Order as OrderModel
from app.api import deps
from app.api.rbac import require_roles, can_transition
from app.core import security
from fastapi import Body

router = APIRouter()


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    role: str = "ADMIN_A"


class UserUpdate(BaseModel):
    role: str
    is_active: Optional[bool] = True


class UserOut(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    role: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


@router.get("/users", response_model=List[UserOut])
def read_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "OWNER")),
):
    users = db.query(User).all()
    return users


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "OWNER")),
):
    existing = db.query(User).filter(User.username == user_in.username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")
    hashed = security.pwd_context.hash(user_in.password)
    user = User(
        username=user_in.username,
        password_hash=hashed,
        full_name=user_in.full_name or user_in.username,
        role=user_in.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "OWNER")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    db.delete(user)
    db.commit()


@router.put("/users/{user_id}", response_model=UserOut)
def update_user_role(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "OWNER")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = user_in.role
    if user_in.is_active is not None:
        user.is_active = user_in.is_active

    db.commit()
    db.refresh(user)
    return user


class ApproveBody(BaseModel):
    next_status: Optional[str] = None


# Valid next-status values for the manual approve endpoint — must match state machine
_APPROVE_NEXT_STATUSES = {
    "WAITING_DEPOSIT",
    "WAITING_ARTWORK",
    "WAITING_CUSTOMER_APPROVAL",
    "ARTWORK_APPROVED",
    "READY_FOR_PRODUCTION",
    "IN_PRODUCTION",
    "READY_FOR_SHIPPING",
    "SHIPPED",
    "WAITING_BOOKING",
    "CANCELLED",
}


@router.post("/orders/{order_id}/approve")
def approve_order(
    order_id: int,
    body: ApproveBody = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "OWNER")),
):
    o = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")

    if body.next_status:
        target = body.next_status.upper()
        if target not in _APPROVE_NEXT_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid target status")
        if not can_transition(o.status, target, getattr(current_user, "role", None)):
            raise HTTPException(status_code=403, detail="Transition not allowed")
        o.status = target
    else:
        s = (o.status or "").upper()
        _auto_advance = {
            "WAITING_BOOKING": "WAITING_DEPOSIT",
            "WAITING_DEPOSIT": "WAITING_ARTWORK",
            "WAITING_ARTWORK": "WAITING_CUSTOMER_APPROVAL",
            "WAITING_CUSTOMER_APPROVAL": "ARTWORK_APPROVED",
            "ARTWORK_APPROVED": "READY_FOR_PRODUCTION",
            "READY_FOR_PRODUCTION": "IN_PRODUCTION",
            "IN_PRODUCTION": "READY_FOR_SHIPPING",
            "READY_FOR_SHIPPING": "SHIPPED",
        }
        next_s = _auto_advance.get(s)
        if not next_s:
            raise HTTPException(
                status_code=400, detail="No auto-advance available for current status"
            )
        o.status = next_s

    db.add(o)
    db.commit()
    db.refresh(o)
    return o
