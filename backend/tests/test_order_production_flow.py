import json
from app.core.security import create_access_token


def test_order_production_end_to_end(client, admin_headers):
    # Create users for each role in the pipeline using admin privileges
    roles = [
        ("admin_a", "SALES_ADMIN"),
        ("admin_b", "ADMIN_OPS"),
        ("graphic", "GRAPHIC_DESIGNER"),
        ("admin_c", "PRODUCTION"),
        ("admin_d", "SHIPPING_ADMIN"),
    ]

    created = {}
    for username, role in roles:
        r = client.post(
            "/api/v1/admin/users",
            headers=admin_headers,
            json={"username": username, "password": "pass", "role": role},
        )
        assert r.status_code == 201, r.text
        uid = r.json()["id"]
        created[role] = uid

    # Create bearer headers for each role user
    tokens = {}
    for role, uid in created.items():
        tok = create_access_token({"sub": str(uid)})
        tokens[role] = {"Authorization": f"Bearer {tok}"}

    # 1) Admin A (SALES_ADMIN) creates an order
    payload = {
        "customer_name": "Customer One",
        "phone": "0812345678",
        "items": [{"product_name": "Test Shirt", "quantity_matrix": {"M": 2}}],
    }
    r = client.post("/api/v1/orders", headers=tokens["SALES_ADMIN"], json=payload)
    assert r.status_code == 201, r.text
    order = r.json()
    order_id = order["id"]

    # 2) Admin A approves booking -> WAITING_DEPOSIT
    r = client.patch(
        f"/api/v1/orders/{order_id}/approve-slip",
        headers=tokens["SALES_ADMIN"],
        json={"installment": "booking", "approved": True},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "WAITING_DEPOSIT"

    # 3) Admin B approves deposit -> WAITING_ARTWORK
    r = client.patch(
        f"/api/v1/orders/{order_id}/approve-slip",
        headers=tokens["ADMIN_OPS"],
        json={"installment": "deposit", "approved": True},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "WAITING_ARTWORK"

    # 4) Graphic uploads artwork (image)
    files = {"artwork": ("art.png", b"\x89PNG\r\n\x1a\n", "image/png")}
    r = client.post(
        f"/api/v1/orders/{order_id}/artwork",
        headers=tokens["GRAPHIC_DESIGNER"],
        files=files,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    assert body.get("status") == "WAITING_CUSTOMER_APPROVAL"

    # 5) Admin B approves artwork -> ARTWORK_APPROVED
    r = client.patch(
        f"/api/v1/orders/{order_id}/status",
        headers=tokens["ADMIN_OPS"],
        json={"status": "ARTWORK_APPROVED"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "ARTWORK_APPROVED"

    # 6) Admin B issues production ticket -> READY_FOR_PRODUCTION
    r = client.post(
        f"/api/v1/orders/{order_id}/production-ticket",
        headers=tokens["ADMIN_OPS"],
        json={},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "READY_FOR_PRODUCTION"

    # 7) Graphic uploads print file -> IN_PRODUCTION
    files = {"print_file": ("print.pdf", b"%PDF-1.4\n%test", "application/pdf")}
    r = client.post(
        f"/api/v1/orders/{order_id}/print-file",
        headers=tokens["GRAPHIC_DESIGNER"],
        files=files,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "IN_PRODUCTION"

    # 8) Admin C (PRODUCTION) marks READY_FOR_SHIPPING via status patch
    r = client.patch(
        f"/api/v1/orders/{order_id}/status",
        headers=tokens["PRODUCTION"],
        json={"status": "READY_FOR_SHIPPING"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "READY_FOR_SHIPPING"

    # 9) Admin D (SHIPPING_ADMIN) updates shipping -> SHIPPED
    r = client.patch(
        f"/api/v1/orders/{order_id}/shipping",
        headers=tokens["SHIPPING_ADMIN"],
        json={"tracking_number": "TRACK123"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "SHIPPED"

    # Final: fetch order and verify final status is SHIPPED
    r = client.get(f"/api/v1/orders/{order_id}", headers=tokens["SALES_ADMIN"])
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "SHIPPED"
