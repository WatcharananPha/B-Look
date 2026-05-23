import pytest
import io
from app.core.security import create_access_token, get_password_hash
from app.models.user import User
from decimal import Decimal

def get_role_headers(role_name: str, db):
    username = f"test_{role_name.lower()}"
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            username=username,
            password_hash=get_password_hash("password123"),
            full_name=f"Test {role_name}",
            role=role_name,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    token = create_access_token({"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def db_session():
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_complete_logic_flow(client, db_session):
    # 1. Admin_A (SALES_ADMIN) creates order
    headers_a = get_role_headers("SALES_ADMIN", db_session)
    headers_b = get_role_headers("ADMIN_OPS", db_session)
    headers_g = get_role_headers("GRAPHIC_DESIGNER", db_session)
    headers_c = get_role_headers("PRODUCTION", db_session)
    headers_d = get_role_headers("SHIPPING_ADMIN", db_session)

    order_data = {
        "customer_name": "Full Flow Customer",
        "phone": "0991234567",
        "contact_channel": "Facebook",
        "address": "123 Test St",
        "product_type": "shirt",
        "items": [
            {
                "product_name": "Test Shirt",
                "fabric_type": "Cotton",
                "neck_type": "คอกลม",
                "quantity_matrix": {"M": 10, "L": 10},
            }
        ],
        "shipping_cost": 50,
        "is_vat_included": True,
    }

    res = client.post("/api/v1/orders", json=order_data, headers=headers_a)
    assert res.status_code == 201
    order = res.json()
    order_id = order["id"]
    assert order["status"] == "WAITING_BOOKING"

    # 2. Admin_A approves booking slip -> WAITING_DEPOSIT
    res = client.patch(f"/api/v1/orders/{order_id}/approve-slip", 
                       json={"installment": "booking", "approved": True}, 
                       headers=headers_a)
    assert res.status_code == 200
    assert res.json()["status"] == "WAITING_DEPOSIT"

    # 3. Admin_B (ADMIN_OPS) approves deposit slip -> WAITING_ARTWORK
    res = client.patch(f"/api/v1/orders/{order_id}/approve-slip", 
                       json={"installment": "deposit", "approved": True}, 
                       headers=headers_b)
    assert res.status_code == 200
    assert res.json()["status"] == "WAITING_ARTWORK"

    # 4. Graphic (GRAPHIC_DESIGNER) uploads artwork -> WAITING_CUSTOMER_APPROVAL
    dummy_file = ("artwork.png", io.BytesIO(b"fake artwork"), "image/png")
    res = client.post(f"/api/v1/orders/{order_id}/artwork", 
                      files={"artwork": dummy_file}, 
                      headers=headers_g)
    assert res.status_code == 200
    assert res.json()["status"] == "WAITING_CUSTOMER_APPROVAL"

    # 5. Admin_B requests edit -> EDIT_ROUND_1
    res = client.patch(f"/api/v1/orders/{order_id}/status", 
                       json={"status": "EDIT_ROUND_1"}, 
                       headers=headers_b)
    assert res.status_code == 200
    assert res.json()["status"] == "EDIT_ROUND_1"

    # 6. Graphic uploads artwork again -> WAITING_ARTWORK -> WAITING_CUSTOMER_APPROVAL
    res = client.patch(f"/api/v1/orders/{order_id}/status", 
                       json={"status": "WAITING_ARTWORK"}, 
                       headers=headers_g)
    assert res.status_code == 200
    
    dummy_file_2 = ("artwork2.png", io.BytesIO(b"fake artwork v2"), "image/png")
    res = client.post(f"/api/v1/orders/{order_id}/artwork", 
                      files={"artwork": dummy_file_2}, 
                      headers=headers_g)
    assert res.status_code == 200
    assert res.json()["status"] == "WAITING_CUSTOMER_APPROVAL"

    # 7. Admin_B approves artwork -> ARTWORK_APPROVED
    res = client.patch(f"/api/v1/orders/{order_id}/status", 
                       json={"status": "ARTWORK_APPROVED"}, 
                       headers=headers_b)
    assert res.status_code == 200
    assert res.json()["status"] == "ARTWORK_APPROVED"

    # 8. Admin_B issues production ticket -> READY_FOR_PRODUCTION
    res = client.post(f"/api/v1/orders/{order_id}/production-ticket", 
                      json={"note": "Go go go"}, 
                      headers=headers_b)
    assert res.status_code == 200
    assert res.json()["status"] == "READY_FOR_PRODUCTION"

    # 9. Graphic uploads print file -> IN_PRODUCTION
    dummy_print = ("print.pdf", io.BytesIO(b"fake print file"), "application/pdf")
    res = client.post(f"/api/v1/orders/{order_id}/print-file", 
                      files={"print_file": dummy_print}, 
                      headers=headers_g)
    assert res.status_code == 200
    assert res.json()["status"] == "IN_PRODUCTION"

    # 10. Admin_C (PRODUCTION) completes production (QC) -> READY_FOR_SHIPPING
    res = client.patch(f"/api/v1/orders/{order_id}/qc", 
                       json={"passed": True, "note": "Perfect"}, 
                       headers=headers_c)
    assert res.status_code == 200
    assert res.json()["status"] == "READY_FOR_SHIPPING"

    # 11. Admin_D (SHIPPING_ADMIN) receives queue -> QUEUE_RECEIVED
    res = client.post(f"/api/v1/orders/{order_id}/queue/receive", 
                      json={"queue_number": 123}, 
                      headers=headers_d)
    assert res.status_code == 200
    assert res.json()["status"] == "QUEUE_RECEIVED"

    # 12. Admin_D notifies queue -> QUEUE_NOTIFIED
    res = client.post(f"/api/v1/orders/{order_id}/queue/notify", 
                      json={}, 
                      headers=headers_d)
    assert res.status_code == 200
    assert res.json()["status"] == "QUEUE_NOTIFIED"

    # 13. Admin_D receives image -> IMAGE_RECEIVED
    res = client.post(f"/api/v1/orders/{order_id}/image-received", 
                      headers=headers_d)
    assert res.status_code == 200
    assert res.json()["status"] == "IMAGE_RECEIVED"

    # 14. Admin_D collects COD -> COD_PENDING -> COD_COLLECTED
    res = client.patch(f"/api/v1/orders/{order_id}/status", 
                       json={"status": "COD_PENDING"}, 
                       headers=headers_d)
    assert res.status_code == 200
    
    res = client.post(f"/api/v1/orders/{order_id}/collect-cod", 
                      json={"amount": 1000.0}, 
                      headers=headers_d)
    assert res.status_code == 200
    assert res.json()["status"] == "COD_COLLECTED"

    # 15. Admin_D ships -> SHIPPED
    res = client.patch(f"/api/v1/orders/{order_id}/shipping", 
                       json={"tracking_number": "TRACK123"}, 
                       headers=headers_d)
    assert res.status_code == 200
    assert res.json()["status"] == "SHIPPED"
