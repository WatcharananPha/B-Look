"""
Shared pytest fixtures for B-Look backend tests.

Uses an in-memory SQLite database (StaticPool) so tests are fully isolated
from the dev/production database.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import sys
import pathlib

# Ensure the `backend` package root is on sys.path so `import app` works
proj_root = pathlib.Path(__file__).resolve().parents[1]
if str(proj_root) not in sys.path:
    sys.path.insert(0, str(proj_root))

# ── Test engine (in-memory SQLite, single shared connection) ──────────────────
TEST_DATABASE_URL = "sqlite:///:memory:"

engine_test = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)

# Import app modules AFTER engine is defined to ensure they can be patched
from app.db.base import Base  # noqa: E402  (registers all ORM models)
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402

# Create all tables in the test DB
Base.metadata.create_all(bind=engine_test)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# Wire the test DB into the FastAPI app for the entire test session
app.dependency_overrides[get_db] = override_get_db


# ── Session-scoped fixtures ───────────────────────────────────────────────────


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session", autouse=True)
def seeded_db():
    """Populate the test DB with the data needed by all tests."""
    from app.models.product import NeckType
    from app.models.company import Company
    from app.models.user import User
    from app.core.security import get_password_hash

    db = TestingSessionLocal()
    try:
        # ── NeckTypes ────────────────────────────────────────────────────────
        # additional_cost=0 (SQLAlchemy default) → pricing engine uses fallback of 40
        # additional_cost=40/60 → pricing engine uses that specific cost
        db.add_all(
            [
                NeckType(name="คอกลม", force_slope=False),
                NeckType(name="คอวี", force_slope=False),
                NeckType(name="คอวีตัด", force_slope=False),
                NeckType(name="คอวีชน", force_slope=False),
                NeckType(name="คอวีไขว้", force_slope=False),
                NeckType(name="คอปกเชิ้ต", force_slope=False),
                NeckType(name="คอปกโปโล", force_slope=False),
                NeckType(name="คอปกคางหมู", force_slope=True, additional_cost=40),
                NeckType(name="คอหยดน้ำ", force_slope=True, additional_cost=40),
                NeckType(
                    name="คอห้าเหลี่ยมคางหมู", force_slope=True, additional_cost=40
                ),
            ]
        )

        # ── Company config ───────────────────────────────────────────────────
        db.add(Company(vat_rate=0.07, default_shipping_cost=0.0))

        # ── Admin user (for auth-protected endpoint tests) ───────────────────
        db.add(
            User(
                username="test_admin",
                password_hash=get_password_hash("testpass"),
                full_name="Test Admin",
                role="ADMIN",
                is_active=True,
            )
        )

        db.commit()
    finally:
        db.close()


@pytest.fixture(scope="session")
def admin_token(seeded_db):
    """Return a valid JWT Bearer token for the seeded admin user."""
    from app.core.security import create_access_token

    db = TestingSessionLocal()
    try:
        from app.models.user import User

        user = db.query(User).filter(User.username == "test_admin").first()
        assert user is not None, "Admin user not seeded"
        return create_access_token({"sub": str(user.id)})
    finally:
        db.close()


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}
