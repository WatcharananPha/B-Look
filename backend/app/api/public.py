from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
import os
import time
import imghdr
import uuid
from app.db.session import get_db
from app.models.order import Order
from app.models.audit_log import AuditLog

router = APIRouter()


def _amount_due_for_order(o: Order) -> float:
    st = (o.status or "").upper()
    # Prefer dedicated deposit fields when available
    if st == "WAITING_BOOKING":
        return float(o.deposit_1 or o.deposit_amount or 0)
    if st == "WAITING_DEPOSIT":
        return float(o.deposit_2 or 0)
    if st == "WAITING_BALANCE":
        return float(o.balance_amount or 0)
    # fallback: if nothing matched, return full remaining balance
    return float(o.balance_amount or o.grand_total or 0)


@router.get("/orders/{order_uuid}")
def public_get_order(order_uuid: str, db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.order_uuid == order_uuid).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")

    return {
        "order_no": o.order_no,
        "status": o.status,
        "amount_due": _amount_due_for_order(o),
        "deposit_1": float(o.deposit_1 or 0),
        "deposit_2": float(o.deposit_2 or 0),
        "balance_amount": float(o.balance_amount or 0),
        "slips": {
            "booking": o.slip_booking_url,
            "deposit": o.slip_deposit_url,
            "balance": o.slip_balance_url,
        },
    }


@router.post("/orders/{order_uuid}/slip")
def public_upload_slip(
    order_uuid: str,
    installment: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    o = db.query(Order).filter(Order.order_uuid == order_uuid).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")

    # Only allow expected installment types
    inst = installment.lower()
    if inst not in ("booking", "deposit", "balance"):
        raise HTTPException(status_code=400, detail="Invalid installment type")

    # Ensure storage directory exists
    static_dir = os.path.join(os.getcwd(), "static", "slips")
    os.makedirs(static_dir, exist_ok=True)

    # Basic validations
    MAX_BYTES = 5 * 1024 * 1024  # 5 MB
    allowed_ct = ("image/jpeg", "image/png")
    if (file.content_type or "").lower() not in allowed_ct:
        raise HTTPException(status_code=400, detail="Only JPEG/PNG images are allowed")

    data = file.file.read()
    size = len(data)
    if size == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if size > MAX_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    # Validate image content using imghdr
    detected = imghdr.what(None, h=data)
    if detected not in ("jpeg", "png"):
        raise HTTPException(
            status_code=400, detail="Uploaded file is not a valid JPEG/PNG image"
        )

    # derive extension
    ext = ".jpg" if detected == "jpeg" else ".png"
    fn = f"{order_uuid}_{inst}_{uuid.uuid4().hex}{ext}"
    dst = os.path.join(static_dir, fn)

    # Write file bytes to disk
    with open(dst, "wb") as f:
        f.write(data)

    url_path = f"/static/slips/{fn}"

    if inst == "booking":
        o.slip_booking_url = url_path
    elif inst == "deposit":
        o.slip_deposit_url = url_path
    else:
        o.slip_balance_url = url_path

    db.add(o)

    # Record AuditLog for the upload
    try:
        audit = AuditLog(
            action="UPLOAD_SLIP",
            target_type="order",
            target_id=str(o.id),
            details=f"installment={inst} filename={fn} size={size}",
        )
        db.add(audit)
    except Exception:
        # don't fail the upload for audit logging issues
        pass

    db.commit()

    return {"url": url_path}
