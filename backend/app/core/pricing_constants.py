"""
Shared pricing constants for the B-Look OMS.

Centralised here so the /pricing/calc endpoint and the order-creation path
always reference the same tables and never silently diverge.

Tier dicts use the canonical keys ``min_qty`` / ``max_qty`` / ``price``.
"""

from decimal import Decimal
from typing import Any, Dict, List

# ---------------------------------------------------------------------------
# Shirt tier tables
# ---------------------------------------------------------------------------
# Each entry: {min_qty, max_qty, price}  (both bounds inclusive)
_ROUND_V_NECK_TIERS: List[Dict[str, Any]] = [
    {"min_qty": 10, "max_qty": 30, "price": Decimal(240)},
    {"min_qty": 31, "max_qty": 50, "price": Decimal(220)},
    {"min_qty": 51, "max_qty": 100, "price": Decimal(190)},
    {"min_qty": 101, "max_qty": 300, "price": Decimal(180)},
    {"min_qty": 301, "max_qty": 99999, "price": Decimal(170)},
]

_COLLAR_OTHER_TIERS: List[Dict[str, Any]] = [
    {"min_qty": 10, "max_qty": 30, "price": Decimal(300)},
    {"min_qty": 31, "max_qty": 50, "price": Decimal(260)},
    {"min_qty": 51, "max_qty": 100, "price": Decimal(240)},
    {"min_qty": 101, "max_qty": 300, "price": Decimal(220)},
    {"min_qty": 301, "max_qty": 99999, "price": Decimal(200)},
]

STEP_PRICING: Dict[str, Any] = {
    "roundVNeck": _ROUND_V_NECK_TIERS,
    "collarOthers": _COLLAR_OTHER_TIERS,
    # Flat-rate non-shirt product types
    "sportsPants": Decimal(210),
    "fashionPants": Decimal(280),
}

# ---------------------------------------------------------------------------
# Add-on prices
# ---------------------------------------------------------------------------
ADDON_PRICES: Dict[str, Decimal] = {
    "longSleeve": Decimal(40),
    "pocket": Decimal(20),
    "numberName": Decimal(20),
    "slopeShoulder": Decimal(40),
    "collarTongue": Decimal(10),
    "shortSleeveAlt": Decimal(20),
    "oversizeSlopeShoulder": Decimal(60),
}

# ---------------------------------------------------------------------------
# Slope-shoulder defaults
# ---------------------------------------------------------------------------
# Used when db_neck.additional_cost is 0 or unset (SQLAlchemy column default).
# A truthy additional_cost value on the NeckType row overrides this.
DEFAULT_SLOPE_COST: Decimal = Decimal(40)

# ---------------------------------------------------------------------------
# Special neck shapes
# ---------------------------------------------------------------------------
# Necks that visually present as base(300) + slope-addon in the UI but
# are always priced from the collarOthers table with slopeShoulder forced on.
SPECIAL_SLOPE_NECKS: List[str] = [
    "คอปกคางหมู",
    "คอหยดน้ำ",
    "คอห้าเหลี่ยมคางหมู",
]
