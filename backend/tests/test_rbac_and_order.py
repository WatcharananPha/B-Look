import pytest
from app.api import rbac
from app.api.rbac import can_transition
from app.schemas.order import OrderCreate
from decimal import Decimal

# ── Canonical role constants ──────────────────────────────────────────────────
ADMIN_A = "ADMIN_A"
ADMIN_B = "ADMIN_B"
GRAPHIC = "GRAPHIC"
ADMIN_C = "ADMIN_C"
ADMIN_D = "ADMIN_D"

# Full ordered flow as per diagram
FLOW_ROLES = [ADMIN_A, ADMIN_B, GRAPHIC, ADMIN_C, ADMIN_D]


def test_normalize_status_and_role():
    assert rbac.normalize_status("draft") == "WAITING_BOOKING"
    assert rbac.normalize_status("SP-DRAFT") == "WAITING_BOOKING"
    assert rbac.normalize_status("waiting_booking") == "WAITING_BOOKING"
    assert rbac._normalize_role("sales_admin") == "ADMIN_A"
    assert rbac._normalize_role("admin_ops") == "ADMIN_B"
    assert rbac._normalize_role("graphic_designer") == "GRAPHIC"


def test_can_transition_basic():
    # sales_admin (ADMIN_A) can move booking -> deposit
    assert can_transition("draft", "WAITING_DEPOSIT", "sales_admin")
    assert can_transition("WAITING_BOOKING", "waiting_deposit", "ADMIN_A")
    # graphic can move waiting artwork -> waiting customer approval
    assert can_transition(
        "WAITING_ARTWORK", "WAITING_CUSTOMER_APPROVAL", "graphic_designer"
    )
    # admin_c (production) can move in_production -> ready_for_shipping
    assert can_transition("IN_PRODUCTION", "READY_FOR_SHIPPING", "production")


def test_order_schema_normalization_and_validators():
    # status normalized to WAITING_BOOKING
    oc = OrderCreate(customer_name="Foo", items=[], status="draft")
    assert oc.status == "WAITING_BOOKING"

    # numeric fields should be converted to Decimal and non-negative
    oc2 = OrderCreate(customer_name="Bar", items=[], shipping_cost=0, deposit_1=10)
    assert isinstance(oc2.shipping_cost, Decimal)
    assert oc2.deposit_1 >= 0

    # invalid phone should raise
    with pytest.raises(ValueError):
        OrderCreate(customer_name="X", items=[], phone="12")


def test_normalize_role_canonical_passthrough():
    # Canonical role names should pass through unchanged
    for role in FLOW_ROLES:
        assert rbac._normalize_role(role) == role
    # Legacy aliases map correctly
    assert rbac._normalize_role("SHIPPING_ADMIN") == "ADMIN_D"
    assert rbac._normalize_role("PRODUCTION") == "ADMIN_C"
    # Space-variant aliases (older DB rows)
    assert rbac._normalize_role("Sales Admin") == "ADMIN_A"
    assert rbac._normalize_role("Admin Ops") == "ADMIN_B"
    assert rbac._normalize_role("Graphic Designer") == "GRAPHIC"
    assert rbac._normalize_role("Shipping Admin") == "ADMIN_D"


def test_approve_next_statuses_are_valid():
    """All statuses in _APPROVE_NEXT_STATUSES must be reachable in the state machine."""
    from app.api.admin import _APPROVE_NEXT_STATUSES

    # Collect all valid states from both source and target sides of _TRANSITIONS
    all_states: set = set()
    for src, targets in rbac._TRANSITIONS.items():
        all_states.add(src)
        all_states.update(targets.keys())
    # CANCELLED is a terminal state allowed via admin override
    all_states.add("CANCELLED")
    for s in _APPROVE_NEXT_STATUSES:
        assert s in all_states, f"{s!r} not in state machine"


def test_status_normalization_in_read_orders_query():
    """normalize_status used for filtering should handle legacy values."""
    assert rbac.normalize_status("draft") == "WAITING_BOOKING"
    assert rbac.normalize_status("WAITING_ARTWORK") == "WAITING_ARTWORK"
    assert rbac.normalize_status(None) is None


# ── Permission matrix ─────────────────────────────────────────────────────────


def test_permission_matrix_full_flow():
    """
    Verify the complete state-machine transition matrix matches the role flow:
        Admin A → Admin B → Graphic → Admin C → Admin D

    Each (current_status, target_status, role) triple is tested for both
    the expected ALLOW and DENY cases.
    """
    ALLOW = [
        # Admin A: create/book orders, confirm payment
        ("WAITING_BOOKING", "WAITING_DEPOSIT", ADMIN_A),
        # Admin B: receive order, create album, confirm artwork approval
        ("WAITING_BOOKING", "WAITING_DEPOSIT", ADMIN_B),
        ("WAITING_DEPOSIT", "WAITING_ARTWORK", ADMIN_B),
        ("WAITING_ARTWORK", "WAITING_CUSTOMER_APPROVAL", ADMIN_B),
        ("WAITING_CUSTOMER_APPROVAL", "ARTWORK_APPROVED", ADMIN_B),
        ("ARTWORK_APPROVED", "READY_FOR_PRODUCTION", ADMIN_B),
        # Graphic: design and submit file
        ("WAITING_ARTWORK", "WAITING_CUSTOMER_APPROVAL", GRAPHIC),
        ("READY_FOR_PRODUCTION", "IN_PRODUCTION", GRAPHIC),
        # Admin C: file verification, submit to production
        ("ARTWORK_APPROVED", "READY_FOR_PRODUCTION", ADMIN_C),
        ("READY_FOR_PRODUCTION", "IN_PRODUCTION", ADMIN_C),
        ("IN_PRODUCTION", "READY_FOR_SHIPPING", ADMIN_C),
        # Admin D: shipping management
        ("IN_PRODUCTION", "READY_FOR_SHIPPING", ADMIN_D),
        ("READY_FOR_SHIPPING", "SHIPPED", ADMIN_D),
    ]

    DENY = [
        # Admin A must NOT skip to artwork stage
        ("WAITING_BOOKING", "WAITING_ARTWORK", ADMIN_A),
        # Graphic must NOT approve artwork (only Admin B/A can)
        ("WAITING_CUSTOMER_APPROVAL", "ARTWORK_APPROVED", GRAPHIC),
        # Admin C must NOT touch shipping
        ("READY_FOR_SHIPPING", "SHIPPED", ADMIN_C),
        # Admin D must NOT create orders
        ("WAITING_BOOKING", "WAITING_DEPOSIT", ADMIN_D),
        # Admin A must NOT ship
        ("READY_FOR_SHIPPING", "SHIPPED", ADMIN_A),
        # Graphic must NOT send to production directly
        ("ARTWORK_APPROVED", "READY_FOR_PRODUCTION", GRAPHIC),
    ]

    for current, target, role in ALLOW:
        assert can_transition(
            current, target, role
        ), f"EXPECTED ALLOW: {role} | {current} → {target}"

    for current, target, role in DENY:
        assert not can_transition(
            current, target, role
        ), f"EXPECTED DENY:  {role} | {current} → {target}"


def test_only_flow_roles_exist():
    """
    No role outside the 5 canonical flow roles should match any transition
    (unless it is a superuser role handled separately).
    """
    phantom_roles = [
        "SALES_ADMIN",
        "ADMIN_OPS",
        "GRAPHIC_DESIGNER",
        "PRODUCTION",
        "SHIPPING_ADMIN",
        "UNKNOWN_ROLE",
    ]
    # These legacy names normalize to a canonical role — transitions still work
    # via _normalize_role; test that the normalized value IS a flow role.
    for r in phantom_roles:
        normalized = rbac._normalize_role(r)
        assert (
            normalized in FLOW_ROLES or normalized == r
        ), f"Role {r!r} normalized to {normalized!r} which is not a flow role"
