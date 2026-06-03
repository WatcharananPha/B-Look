
import pytest
import io
from app.models.user import User
from app.core.security import create_access_token, get_password_hash

@pytest.fixture
def admin_b_headers(client, seeded_db):
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        # ADMIN_OPS role
        username = "test_admin_ops_album"
        user = db.query(User).filter(User.username == username).first()
        if not user:
            user = User(
                username=username,
                password_hash=get_password_hash("password123"),
                full_name="Test Admin Ops",
                role="ADMIN_OPS",
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        token = create_access_token({"sub": str(user.id)})
        return {"Authorization": f"Bearer {token}"}
    finally:
        db.close()

@pytest.fixture
def sales_admin_headers(client, seeded_db):
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        # SALES_ADMIN role
        username = "test_sales_admin_album"
        user = db.query(User).filter(User.username == username).first()
        if not user:
            user = User(
                username=username,
                password_hash=get_password_hash("password123"),
                full_name="Test Sales Admin",
                role="SALES_ADMIN",
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        token = create_access_token({"sub": str(user.id)})
        return {"Authorization": f"Bearer {token}"}
    finally:
        db.close()

def test_album_workflow(client, admin_b_headers, sales_admin_headers, seeded_db):
    # 1. Create an order first
    order_data = {
        "customer_name": "Album Customer",
        "phone": "0812345678",
        "contact_channel": "Line",
        "address": "Bangkok",
        "product_type": "shirt",
        "items": [],
    }
    res = client.post("/api/v1/orders", json=order_data, headers=admin_b_headers)
    assert res.status_code == 201
    order_id = res.json()["id"]

    # 2. Create an album (ADMIN_OPS)
    album_data = {"name": "แบบร่าง", "description": "รวมแบบสเก็ตช์แรก"}
    res = client.post(f"/api/v1/orders/{order_id}/albums", json=album_data, headers=admin_b_headers)
    assert res.status_code == 201
    album = res.json()
    assert album["name"] == "แบบร่าง"
    album_id = album["id"]

    # 3. List albums (Any role)
    res = client.get(f"/api/v1/orders/{order_id}/albums", headers=sales_admin_headers)
    assert res.status_code == 200
    albums = res.json()
    assert len(albums) >= 1
    assert any(a["id"] == album_id for a in albums)

    # 4. Upload an image (ADMIN_OPS)
    img_data = {"caption": "หน้าเสื้อ"}
    files = {"file": ("test.png", io.BytesIO(b"fake-image-content"), "image/png")}
    res = client.post(
        f"/api/v1/orders/{order_id}/albums/{album_id}/images",
        data=img_data,
        files=files,
        headers=admin_b_headers
    )
    assert res.status_code == 201
    img = res.json()
    assert img["caption"] == "หน้าเสื้อ"
    assert "url" in img
    img_id = img["id"]

    # 5. Get album details (Any role)
    res = client.get(f"/api/v1/orders/{order_id}/albums/{album_id}", headers=sales_admin_headers)
    assert res.status_code == 200
    album_detail = res.json()
    assert len(album_detail["images"]) == 1
    assert album_detail["images"][0]["id"] == img_id

    # 6. Delete image (ADMIN_OPS)
    res = client.delete(f"/api/v1/orders/{order_id}/albums/{album_id}/images/{img_id}", headers=admin_b_headers)
    assert res.status_code == 204

    # Verify image is gone
    res = client.get(f"/api/v1/orders/{order_id}/albums/{album_id}", headers=sales_admin_headers)
    assert len(res.json()["images"]) == 0

    # 7. Delete album (ADMIN_OPS)
    res = client.delete(f"/api/v1/orders/{order_id}/albums/{album_id}", headers=admin_b_headers)
    assert res.status_code == 204

    # Verify album is gone
    res = client.get(f"/api/v1/orders/{order_id}/albums", headers=sales_admin_headers)
    assert all(a["id"] != album_id for a in res.json())

def test_album_rbac_restrictions(client, admin_b_headers, sales_admin_headers, seeded_db):
    # Create order
    order_data = {"customer_name": "RBAC Customer", "items": []}
    res = client.post("/api/v1/orders", json=order_data, headers=admin_b_headers)
    order_id = res.json()["id"]

    # SALES_ADMIN should NOT be able to create album
    album_data = {"name": "Forbidden Album"}
    res = client.post(f"/api/v1/orders/{order_id}/albums", json=album_data, headers=sales_admin_headers)
    assert res.status_code == 403
