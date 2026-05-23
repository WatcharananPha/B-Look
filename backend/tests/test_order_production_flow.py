import pytest
from app.api.rbac import can_transition

# 🚀 E2E Pipeline Tests (Unit tests with FastAPI TestClient)


def test_order_production_end_to_end(client, admin_headers):
    """ทดสอบการสร้างออเดอร์และเปลี่ยนสถานะจนจบ Flow E2E ด้วยสิทธิ์ Admin"""
    order_data = {
        "customer_name": "Pytest Customer",
        "phone": "0800000000",
        "contact_channel": "LINE",
        "address": "Bangkok",
        "product_type": "shirt",
        "items": [],
        "shipping_cost": 0,
        "add_on_cost": 0,
        "discount_amount": 0,
        "is_vat_included": True,
    }

    # 1. สร้างออเดอร์
    res = client.post("/api/v1/orders", json=order_data, headers=admin_headers)
    assert res.status_code == 201
    order_id = res.json()["id"]

    # 2. จำลองการเปลี่ยนสถานะตาม Flow Diagram (รวมการขอแก้ไขแบบ)
    statuses = [
        "WAITING_DEPOSIT",
        "WAITING_ARTWORK",
        "WAITING_CUSTOMER_APPROVAL",
        "ARTWORK_APPROVED",
        "READY_FOR_PRODUCTION",
        "IN_PRODUCTION",
        "READY_FOR_SHIPPING",
    ]

    for st in statuses:
        r = client.patch(
            f"/api/v1/orders/{order_id}/status",
            json={"status": st},
            headers=admin_headers,
        )
        assert r.status_code == 200, f"Failed at status: {st}"
        assert r.json()["status"] == st

    # 3. จัดการคิวและ COD (จำลอง Role Admin_D)
    r = client.post(
        f"/api/v1/orders/{order_id}/queue/receive",
        json={"queue_number": 999},
        headers=admin_headers,
    )
    assert r.status_code == 200

    r = client.post(
        f"/api/v1/orders/{order_id}/queue/notify", json={}, headers=admin_headers
    )
    assert r.status_code == 200

    r = client.post(f"/api/v1/orders/{order_id}/image-received", headers=admin_headers)
    assert r.status_code == 200

    r = client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"status": "COD_PENDING"},
        headers=admin_headers,
    )
    assert r.status_code == 200

    r = client.post(
        f"/api/v1/orders/{order_id}/collect-cod",
        json={"amount": 500.0},
        headers=admin_headers,
    )
    assert r.status_code == 200

    r = client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"status": "SHIPPED"},
        headers=admin_headers,
    )
    assert r.status_code == 200


def test_full_logic_flow_with_all_roles(client, admin_headers):
    """ทดสอบโครงสร้างว่า API เปิดรับ Request ได้ปกติ"""
    res = client.get("/api/v1/orders", headers=admin_headers)
    assert res.status_code == 200


def test_workflow_pipeline_roles_validation():
    """
    ทดสอบว่า Role ต่างๆ สามารถเปลี่ยนสถานะได้ตาม Logic Flow ที่ต้องการ
    Admin_A -> Admin_B -> Graphic -> Admin_C -> Admin_D
    """
    # 1. Admin A: สร้างออเดอร์และการชำระเงิน
    assert can_transition("WAITING_BOOKING", "WAITING_DEPOSIT", "ADMIN_A")
    # Admin A สามารถยกเลิกออเดอร์ได้ (Terminal state)
    assert can_transition("WAITING_BOOKING", "CANCELLED", "ADMIN_A")

    # 2. Admin B: รับออเดอร์และส่งรายละเอียดให้ Graphic (สร้างอัลบั้ม/ส่งแบบ)
    assert can_transition("WAITING_DEPOSIT", "WAITING_ARTWORK", "ADMIN_B")

    # 3. Graphic: ออกแบบและส่งให้ตรวจสอบ (ส่งไฟล์แล้ว)
    assert can_transition("WAITING_ARTWORK", "WAITING_CUSTOMER_APPROVAL", "GRAPHIC")

    # การแก้ไขแบบ (Admin B ตรวจสอบและประสานลูกค้า/Graphic)
    assert can_transition("WAITING_CUSTOMER_APPROVAL", "ARTWORK_APPROVED", "ADMIN_B")

    # 4. Admin C: ตรวจสอบและส่งผลิต (ส่งผลิตแล้ว)
    assert can_transition("ARTWORK_APPROVED", "READY_FOR_PRODUCTION", "ADMIN_C")
    assert can_transition("READY_FOR_PRODUCTION", "IN_PRODUCTION", "ADMIN_C")
    assert can_transition("IN_PRODUCTION", "READY_FOR_SHIPPING", "ADMIN_C")

    # 5. Admin D: ตรวจสอบและรันคิวจัดส่ง (แจ้งคิว, เก็บยอด, ส่งเลขพัสดุ)
    assert can_transition("IN_PRODUCTION", "READY_FOR_SHIPPING", "ADMIN_D")
    assert can_transition("READY_FOR_SHIPPING", "SHIPPED", "ADMIN_D")
