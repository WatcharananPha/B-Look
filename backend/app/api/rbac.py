"""
Simple RBAC helpers and transition rules for Order lifecycle.
This file provides:
- require_roles(...): a FastAPI dependency to gate endpoints by role
- can_transition(current, target, role): check allowed state transitions
- mask_order_for_role(order_dict, role): hide sensitive fields for some roles (e.g. PRODUCTION)
"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from app.api.deps import get_current_user


def _is_superuser(role: Optional[str]) -> bool:
    if not role:
        return False
    return role.upper() in ("ADMIN", "SUPERADMIN", "ROOT", "SUPERUSER", "OWNER")


def _normalize_role(role: Optional[str]) -> str:
    """Normalize various role names to the canonical flow roles.

    Canonical roles used in the flow: ADMIN_A, ADMIN_B, GRAPHIC, ADMIN_C, ADMIN_D
    This function maps legacy/alternative role names to those canonical values
    so existing callers keep working while the state machine uses the new names.
    """
    if not role:
        return ""
    r = role.strip().upper()
    mapping = {
        "SALES_ADMIN": "ADMIN_A",
        "SALES": "ADMIN_A",
        "ADMIN_OPS": "ADMIN_B",
        "OPS": "ADMIN_B",
        "ADMIN_D": "ADMIN_D",
        "SHIPPING_ADMIN": "ADMIN_D",
        "GRAPHIC_DESIGNER": "GRAPHIC",
        "GRAPHIC": "GRAPHIC",
        "PRODUCTION": "ADMIN_C",
    }
    return mapping.get(r, r)


def normalize_status(s: Optional[str]) -> Optional[str]:
    """Normalize status values into canonical uppercase workflow states.

    Accepts legacy friendly values such as 'draft' and converts them to
    the canonical 'WAITING_BOOKING'. Returns None for falsy inputs.
    """
    if not s:
        return None
    su = str(s).strip().upper()
    if su in ("DRAFT", "SP-DRAFT", "SP_DRAFT"):
        return "WAITING_BOOKING"
    return su


def require_roles(*allowed_roles: str):
    # normalize allowed role names to canonical roles for comparison
    allowed_upper = [_normalize_role(r.upper()) for r in allowed_roles]

    def _dependency(current_user=Depends(get_current_user)):
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )
        raw_user_role = (getattr(current_user, "role", "") or "").upper()
        user_role = _normalize_role(raw_user_role)
        if _is_superuser(raw_user_role) or user_role in allowed_upper:
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role"
        )

    return _dependency


# Define allowed transitions with minimal set needed for flow
# Canonical role names: ADMIN_A, ADMIN_B, GRAPHIC, ADMIN_C, ADMIN_D
_TRANSITIONS = {
    "WAITING_BOOKING": {"WAITING_DEPOSIT": ["ADMIN_A", "ADMIN_B"]},
    "WAITING_DEPOSIT": {"WAITING_ARTWORK": ["ADMIN_B", "ADMIN_A"]},
    "WAITING_ARTWORK": {"WAITING_CUSTOMER_APPROVAL": ["GRAPHIC", "ADMIN_B"]},
    "WAITING_CUSTOMER_APPROVAL": {"ARTWORK_APPROVED": ["ADMIN_B", "ADMIN_A"]},
    "ARTWORK_APPROVED": {"READY_FOR_PRODUCTION": ["ADMIN_B", "ADMIN_C"]},
    "READY_FOR_PRODUCTION": {"IN_PRODUCTION": ["GRAPHIC", "ADMIN_C"]},
    "IN_PRODUCTION": {"READY_FOR_SHIPPING": ["ADMIN_C", "ADMIN_D"]},
    "READY_FOR_SHIPPING": {"SHIPPED": ["ADMIN_D"]},
    # Allow admins to reopen a slip-rejected order back to booking stage
    "SLIP_REJECTED": {"WAITING_BOOKING": ["ADMIN_A", "ADMIN_B", "ADMIN_D"]},
}


def can_transition(
    current_status: Optional[str], target_status: Optional[str], role: Optional[str]
) -> bool:
    # superusers can always transition
    if _is_superuser(role):
        return True
    if not current_status or not target_status:
        return False

    cur = normalize_status(current_status)
    tgt = normalize_status(target_status)
    role_up = _normalize_role(role)

    if not cur or not tgt:
        return False

    allowed = _TRANSITIONS.get(cur, {})
    allowed_roles = allowed.get(tgt, [])
    return role_up in [r.upper() for r in allowed_roles]


def mask_order_for_role(order: dict, role: Optional[str]) -> dict:
    """Return a shallow-masked copy of order for roles that must not see PII/finance.

    Currently masks for role == PRODUCTION by removing customer and financial fields
    and reducing item payloads to production-relevant fields.
    """
    if not role:
        return order
    # Normalize role and decide which roles must not see PII/finance
    role_up = _normalize_role(role)
    # Production (ADMIN_C) and Graphic (GRAPHIC) roles must not see price/payment/PII
    if role_up in ("ADMIN_C", "GRAPHIC"):
        masked = order.copy()
        for k in [
            "grand_total",
            "total_cost",
            "vat_amount",
            "deposit_amount",
            "deposit_1",
            "deposit_2",
            "balance_amount",
            "phone",
            "address",
            "customer_name",
            "contact_channel",
            "order_no",
            "slip_booking_url",
            "slip_deposit_url",
            "slip_balance_url",
        ]:
            if k in masked:
                masked.pop(k, None)

        items = []
        for it in masked.get("items", []) or []:
            it_mask = {
                "product_name": it.get("product_name"),
                "total_qty": it.get("total_qty"),
                "selected_add_ons": it.get("selected_add_ons"),
                "neck_type": it.get("neck_type"),
                "fabric_type": it.get("fabric_type"),
            }
            items.append(it_mask)
        masked["items"] = items
        return masked
    return order
