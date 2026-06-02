#!/usr/bin/env python3
"""End-to-end pipeline smoke test (API-level) for Order → Production → Queue/COD flow.

This script uses FastAPI's TestClient and overrides the `get_current_user`
dependency to simulate actions by different roles without needing JWTs.

Run from the repository root:
  cd backend
  PYTHONPATH=. ../blook/bin/python scripts/e2e_flow_test.py
"""

import os
from types import SimpleNamespace
from decimal import Decimal
import uuid

# Ensure we point to the local dev DB unless env var already set
os.environ.setdefault(
    "DATABASE_URL",
    "sqlite:////home/kongla/Documents/GitHub/B-Look/backend/blook_dev.db",
)

from app.db.session import SessionLocal
from app.models.user import User
from app.models.customer import Customer
from app.models.order import Order as OrderModel
from app.main import app
from fastapi.testclient import TestClient
import app.api.deps as deps


def ensure_user(db, username, role):
    u = db.query(User).filter(User.username == username).first()
    if u:
        u.role = role
        db.add(u)
        db.commit()
        db.refresh(u)
        return {"id": int(u.id), "username": u.username}
    # create minimal user (no password required for this scripted test)
    u = User(
        username=username,
        password_hash="",
        full_name=username,
        role=role,
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return {"id": int(u.id), "username": u.username}


def create_order(db):
    cust = Customer(
        name="E2E Customer", phone="0812345678", channel="LINE", address="Bangkok"
    )
    db.add(cust)
    db.flush()
    o = OrderModel(
        order_no=f"E2E-{uuid.uuid4().hex[:6].upper()}",
        order_uuid=uuid.uuid4().hex,
        customer_id=cust.id,
        customer_name=cust.name,
        contact_channel=cust.channel,
        address=cust.address,
        phone=cust.phone,
        status="WAITING_BOOKING",
        grand_total=Decimal("1000.00"),
        total_cost=Decimal("500.00"),
        vat_amount=Decimal("70.00"),
        shipping_cost=Decimal("0.00"),
        add_on_cost=Decimal("0.00"),
        balance_amount=Decimal("1000.00"),
    )
    db.add(o)
    db.commit()
    db.refresh(o)
    # return lightweight data to avoid detached instance issues
    return {"id": int(o.id), "status": o.status}


def set_actor(role_name, user_obj):
    # Extract primitive id/username at definition time to avoid DetachedInstanceError
    if isinstance(user_obj, dict):
        u_id = int(user_obj.get("id") or 0)
        u_name = user_obj.get("username")
    else:
        u_id = int(getattr(user_obj, "id", 0))
        u_name = getattr(user_obj, "username", None)

    def _override():
        return SimpleNamespace(id=u_id, role=role_name, username=u_name, is_active=True)

    app.dependency_overrides[deps.get_current_user] = _override


def clear_override():
    app.dependency_overrides.pop(deps.get_current_user, None)


def main():
    db = SessionLocal()
    try:
        # Ensure users for roles exist
        users = {}
        users["ADMIN"] = ensure_user(db, "e2e_admin", "ADMIN")
        users["ADMIN_A"] = ensure_user(db, "e2e_a", "ADMIN_A")
        users["ADMIN_B"] = ensure_user(db, "e2e_b", "ADMIN_B")
        users["GRAPHIC"] = ensure_user(db, "e2e_g", "GRAPHIC")
        users["ADMIN_C"] = ensure_user(db, "e2e_c", "ADMIN_C")
        users["ADMIN_D"] = ensure_user(db, "e2e_d", "ADMIN_D")

        order = create_order(db)
        print(f"Created order id={order['id']} status={order['status']}")
    finally:
        db.close()

    client = TestClient(app)

    try:
        # 1. Admin_A: WAITING_BOOKING -> WAITING_DEPOSIT
        set_actor("ADMIN_A", users["ADMIN_A"])
        r = client.patch(
            f"/api/v1/orders/{order['id']}/status", json={"status": "WAITING_DEPOSIT"}
        )
        print("Admin_A -> WAITING_DEPOSIT", r.status_code, r.json())

        # 2. Admin_B: WAITING_DEPOSIT -> WAITING_ARTWORK
        set_actor("ADMIN_B", users["ADMIN_B"])
        r = client.patch(
            f"/api/v1/orders/{order['id']}/status", json={"status": "WAITING_ARTWORK"}
        )
        print("Admin_B -> WAITING_ARTWORK", r.status_code, r.json())

        # 3. Graphic: WAITING_ARTWORK -> WAITING_CUSTOMER_APPROVAL
        set_actor("GRAPHIC", users["GRAPHIC"])
        r = client.patch(
            f"/api/v1/orders/{order['id']}/status",
            json={"status": "WAITING_CUSTOMER_APPROVAL"},
        )
        print("Graphic -> WAITING_CUSTOMER_APPROVAL", r.status_code, r.json())

        # 3.1 Admin_B: WAITING_CUSTOMER_APPROVAL -> EDIT_ROUND_1 (ขอแก้ไขรอบที่ 1)
        set_actor("ADMIN_B", users["ADMIN_B"])
        r = client.patch(
            f"/api/v1/orders/{order['id']}/status", json={"status": "EDIT_ROUND_1"}
        )
        print("Admin_B -> EDIT_ROUND_1 (ลูกค้าขอแก้ไขแบบ)", r.status_code, r.json())

        # 3.2 Graphic: EDIT_ROUND_1 -> WAITING_ARTWORK (เริ่มแก้ไข)
        set_actor("GRAPHIC", users["GRAPHIC"])
        r = client.patch(
            f"/api/v1/orders/{order['id']}/status", json={"status": "WAITING_ARTWORK"}
        )
        print("Graphic -> WAITING_ARTWORK (เริ่มทำการแก้ไข)", r.status_code, r.json())

        # 3.3 Graphic: WAITING_ARTWORK -> WAITING_CUSTOMER_APPROVAL (ส่งแบบที่แก้ไขแล้ว)
        set_actor("GRAPHIC", users["GRAPHIC"])
        r = client.patch(
            f"/api/v1/orders/{order['id']}/status",
            json={"status": "WAITING_CUSTOMER_APPROVAL"},
        )
        print(
            "Graphic -> WAITING_CUSTOMER_APPROVAL (ส่งแบบที่แก้แล้ว)",
            r.status_code,
            r.json(),
        )

        # 4. Admin_B: WAITING_CUSTOMER_APPROVAL -> ARTWORK_APPROVED
        set_actor("ADMIN_B", users["ADMIN_B"])
        r = client.patch(
            f"/api/v1/orders/{order['id']}/status", json={"status": "ARTWORK_APPROVED"}
        )
        print("Admin_B -> ARTWORK_APPROVED", r.status_code, r.json())

        # 5. Admin_C: ARTWORK_APPROVED -> READY_FOR_PRODUCTION
        set_actor("ADMIN_C", users["ADMIN_C"])
        r = client.patch(
            f"/api/v1/orders/{order['id']}/status",
            json={"status": "READY_FOR_PRODUCTION"},
        )
        print("Admin_C -> READY_FOR_PRODUCTION", r.status_code, r.json())

        # 6. Admin_C: READY_FOR_PRODUCTION -> IN_PRODUCTION
        set_actor("ADMIN_C", users["ADMIN_C"])
        r = client.patch(
            f"/api/v1/orders/{order['id']}/status", json={"status": "IN_PRODUCTION"}
        )
        print("Admin_C -> IN_PRODUCTION", r.status_code, r.json())

        # 7. Admin_C: IN_PRODUCTION -> READY_FOR_SHIPPING
        set_actor("ADMIN_C", users["ADMIN_C"])
        r = client.patch(
            f"/api/v1/orders/{order['id']}/status",
            json={"status": "READY_FOR_SHIPPING"},
        )
        print("Admin_C -> READY_FOR_SHIPPING", r.status_code, r.json())

        # 8. Admin_D: READY_FOR_SHIPPING -> QUEUE_RECEIVED (queue/receive)
        set_actor("ADMIN_D", users["ADMIN_D"])
        r = client.post(
            f"/api/v1/orders/{order['id']}/queue/receive", json={"queue_number": 123}
        )
        print("Admin_D queue_receive", r.status_code, r.json())

        # 9. Admin_D: QUEUE_RECEIVED -> QUEUE_NOTIFIED
        set_actor("ADMIN_D", users["ADMIN_D"])
        r = client.post(f"/api/v1/orders/{order['id']}/queue/notify", json={})
        print("Admin_D queue_notify", r.status_code, r.json())

        # 10. Admin_D: QUEUE_NOTIFIED -> IMAGE_RECEIVED
        set_actor("ADMIN_D", users["ADMIN_D"])
        r = client.post(f"/api/v1/orders/{order['id']}/image-received")
        print("Admin_D image_received", r.status_code, r.json())

        # 11. Admin_D: IMAGE_RECEIVED -> COD_PENDING
        set_actor("ADMIN_D", users["ADMIN_D"])
        r = client.patch(
            f"/api/v1/orders/{order['id']}/status", json={"status": "COD_PENDING"}
        )
        print("Admin_D -> COD_PENDING", r.status_code, r.json())

        # 12. Admin_D: collect COD
        set_actor("ADMIN_D", users["ADMIN_D"])
        r = client.post(
            f"/api/v1/orders/{order['id']}/collect-cod", json={"amount": 500.0}
        )
        print("Admin_D collect_cod", r.status_code, r.json())

        # 13. Admin_D: COD_COLLECTED -> SHIPPED
        set_actor("ADMIN_D", users["ADMIN_D"])
        r = client.patch(
            f"/api/v1/orders/{order['id']}/status", json={"status": "SHIPPED"}
        )
        print("Admin_D -> SHIPPED", r.status_code, r.json())

    finally:
        clear_override()


if __name__ == "__main__":
    main()
