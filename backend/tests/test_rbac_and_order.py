import pytest
from app.api import rbac
from app.api.rbac import can_transition
from app.schemas.order import OrderCreate
from decimal import Decimal


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
    for role in ("ADMIN_A", "ADMIN_B", "GRAPHIC", "ADMIN_C", "ADMIN_D"):
        assert rbac._normalize_role(role) == role
    # Legacy aliases map correctly
    assert rbac._normalize_role("SHIPPING_ADMIN") == "ADMIN_D"
    assert rbac._normalize_role("PRODUCTION") == "ADMIN_C"


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
