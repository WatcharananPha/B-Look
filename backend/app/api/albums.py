"""Albums API — Admin_B (ADMIN_OPS) workflow: สร้างอัลบั้มรูปภาพสำหรับ Order

Endpoints:
  POST   /api/v1/orders/{order_id}/albums            — สร้างอัลบั้มใหม่
  GET    /api/v1/orders/{order_id}/albums            — ดูรายการอัลบั้มทั้งหมดของ order
  GET    /api/v1/orders/{order_id}/albums/{album_id} — ดูรายละเอียดอัลบั้ม (พร้อมรูปภาพ)
  POST   /api/v1/orders/{order_id}/albums/{album_id}/images — อัพโหลดรูปเข้าอัลบั้ม
  DELETE /api/v1/orders/{order_id}/albums/{album_id}/images/{image_id} — ลบรูปออกจากอัลบั้ม
  DELETE /api/v1/orders/{order_id}/albums/{album_id} — ลบอัลบั้ม
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session, selectinload
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid
import json
import logging

from app.db.session import get_db
from app.models.order import Order as OrderModel
from app.models.album import OrderAlbum, AlbumImage
from app.models.audit_log import AuditLog
from app.models.user import User
from app.api.rbac import require_roles
from app.core.storage import save_upload

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

_MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB
_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


class AlbumImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    album_id: int
    url: str
    caption: Optional[str] = None
    uploaded_by_id: Optional[int] = None
    created_at: Optional[datetime] = None


class AlbumOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    name: str
    description: Optional[str] = None
    created_by_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    images: List[AlbumImageOut] = []


class AlbumCreate(BaseModel):
    name: str
    description: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_order_or_404(order_id: int, db: Session) -> OrderModel:
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="ไม่พบ Order ที่ระบุ")
    return order


def _get_album_or_404(album_id: int, order_id: int, db: Session) -> OrderAlbum:
    album = (
        db.query(OrderAlbum)
        .options(selectinload(OrderAlbum.images))
        .filter(OrderAlbum.id == album_id, OrderAlbum.order_id == order_id)
        .first()
    )
    if not album:
        raise HTTPException(status_code=404, detail="ไม่พบอัลบั้มที่ระบุ")
    return album


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/{order_id}/albums", response_model=AlbumOut, status_code=201)
def create_album(
    order_id: int,
    payload: AlbumCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN_OPS", "ADMIN")),
):
    """Admin_B สร้างอัลบั้มรูปภาพใหม่สำหรับ order."""
    _get_order_or_404(order_id, db)

    album = OrderAlbum(
        order_id=order_id,
        name=payload.name.strip(),
        description=payload.description,
        created_by_id=getattr(current_user, "id", None),
    )
    db.add(album)
    db.flush()  # get album.id before audit

    db.add(
        AuditLog(
            action="CREATE_ALBUM",
            target_type="order_album",
            target_id=str(album.id),
            details=json.dumps({"order_id": order_id, "name": payload.name}),
            user_id=getattr(current_user, "id", None),
        )
    )
    db.commit()
    db.refresh(album)
    return album


@router.get("/{order_id}/albums", response_model=List[AlbumOut])
def list_albums(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(
        require_roles(
            "ADMIN_OPS",
            "ADMIN",
            "SALES_ADMIN",
            "PRODUCTION",
            "SHIPPING_ADMIN",
            "GRAPHIC_DESIGNER",
            "ADMIN_A",
            "ADMIN_B",
            "ADMIN_C",
            "ADMIN_D",
            "GRAPHIC",
        )
    ),
):
    """ดูรายการอัลบั้มทั้งหมดของ order (ทุก role ที่ login แล้ว)."""
    _get_order_or_404(order_id, db)
    albums = (
        db.query(OrderAlbum)
        .options(selectinload(OrderAlbum.images))
        .filter(OrderAlbum.order_id == order_id)
        .order_by(OrderAlbum.id)
        .all()
    )
    return albums


@router.get("/{order_id}/albums/{album_id}", response_model=AlbumOut)
def get_album(
    order_id: int,
    album_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(
        require_roles(
            "ADMIN_OPS",
            "ADMIN",
            "SALES_ADMIN",
            "PRODUCTION",
            "SHIPPING_ADMIN",
            "GRAPHIC_DESIGNER",
            "ADMIN_A",
            "ADMIN_B",
            "ADMIN_C",
            "ADMIN_D",
            "GRAPHIC",
        )
    ),
):
    """ดูรายละเอียดอัลบั้ม พร้อมรายการรูปภาพทั้งหมด."""
    return _get_album_or_404(album_id, order_id, db)


@router.post(
    "/{order_id}/albums/{album_id}/images",
    response_model=AlbumImageOut,
    status_code=201,
)
async def upload_album_image(
    order_id: int,
    album_id: int,
    caption: Optional[str] = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN_OPS", "ADMIN")),
):
    """Admin_B อัพโหลดรูปภาพเข้าอัลบั้ม (JPG / PNG / WEBP, ไม่เกิน 10 MB)."""
    _get_order_or_404(order_id, db)
    album = _get_album_or_404(album_id, order_id, db)

    # Validate content type
    content_type = file.content_type or ""
    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="ประเภทไฟล์ไม่รองรับ — กรุณาใช้ JPG, PNG หรือ WEBP เท่านั้น",
        )

    data = await file.read()
    if len(data) > _MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="ไฟล์ใหญ่เกิน 10 MB",
        )

    # Build unique filename and save
    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    fname = f"album_{album_id}_{uuid.uuid4().hex}.{ext}"
    url = save_upload(data, "albums", fname, content_type)

    image = AlbumImage(
        album_id=album.id,
        url=url,
        caption=caption,
        uploaded_by_id=getattr(current_user, "id", None),
    )
    db.add(image)
    db.flush()

    db.add(
        AuditLog(
            action="UPLOAD_ALBUM_IMAGE",
            target_type="album_image",
            target_id=str(image.id),
            details=json.dumps(
                {
                    "order_id": order_id,
                    "album_id": album_id,
                    "filename": fname,
                }
            ),
            user_id=getattr(current_user, "id", None),
        )
    )
    db.commit()
    db.refresh(image)
    return image


@router.delete("/{order_id}/albums/{album_id}/images/{image_id}", status_code=204)
def delete_album_image(
    order_id: int,
    album_id: int,
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN_OPS", "ADMIN")),
):
    """Admin_B ลบรูปภาพออกจากอัลบั้ม."""
    _get_album_or_404(album_id, order_id, db)  # ensures album belongs to order

    image = (
        db.query(AlbumImage)
        .filter(AlbumImage.id == image_id, AlbumImage.album_id == album_id)
        .first()
    )
    if not image:
        raise HTTPException(status_code=404, detail="ไม่พบรูปภาพที่ระบุ")

    db.add(
        AuditLog(
            action="DELETE_ALBUM_IMAGE",
            target_type="album_image",
            target_id=str(image_id),
            details=json.dumps({"order_id": order_id, "album_id": album_id}),
            user_id=getattr(current_user, "id", None),
        )
    )
    db.delete(image)
    db.commit()


@router.delete("/{order_id}/albums/{album_id}", status_code=204)
def delete_album(
    order_id: int,
    album_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN_OPS", "ADMIN")),
):
    """Admin_B ลบอัลบั้ม (และรูปภาพทั้งหมดในอัลบั้มนั้น)."""
    album = _get_album_or_404(album_id, order_id, db)

    db.add(
        AuditLog(
            action="DELETE_ALBUM",
            target_type="order_album",
            target_id=str(album_id),
            details=json.dumps({"order_id": order_id, "name": album.name}),
            user_id=getattr(current_user, "id", None),
        )
    )
    db.delete(album)
    db.commit()
