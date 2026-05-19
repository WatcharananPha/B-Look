"""
Tests for pricing calculations:
  - calculate_shipping() — all tier boundaries and edge cases
  - POST /api/v1/pricing/calc — unit prices, add-ons, oversize, multi-item
"""

import math
import pytest
from app.api.pricing import calculate_shipping

# ══════════════════════════════════════════════════════════════════════════════
# 1. calculate_shipping() — pure function, no DB needed
# ══════════════════════════════════════════════════════════════════════════════


class TestCalculateShipping:
    """Every tier boundary of the shipping cost table."""

    # ── Below minimum qty ────────────────────────────────────────────────────
    @pytest.mark.parametrize("qty", [0, 1, 5, 9])
    def test_below_10_is_free(self, qty):
        assert calculate_shipping(qty) == 0

    # ── Tier 10-15 : 60 ฿ ────────────────────────────────────────────────────
    @pytest.mark.parametrize(
        "qty,expected",
        [
            (10, 60),
            (12, 60),
            (15, 60),
        ],
    )
    def test_tier_10_15(self, qty, expected):
        assert calculate_shipping(qty) == expected

    # ── Tier 16-20 : 80 ฿ ────────────────────────────────────────────────────
    @pytest.mark.parametrize(
        "qty,expected",
        [
            (16, 80),
            (18, 80),
            (20, 80),
        ],
    )
    def test_tier_16_20(self, qty, expected):
        assert calculate_shipping(qty) == expected

    # ── Tier 21-30 : 100 ฿ ───────────────────────────────────────────────────
    @pytest.mark.parametrize(
        "qty,expected",
        [
            (21, 100),
            (25, 100),
            (30, 100),
        ],
    )
    def test_tier_21_30(self, qty, expected):
        assert calculate_shipping(qty) == expected

    # ── Tier 31-40 : 120 ฿ ───────────────────────────────────────────────────
    @pytest.mark.parametrize(
        "qty,expected",
        [
            (31, 120),
            (35, 120),
            (40, 120),
        ],
    )
    def test_tier_31_40(self, qty, expected):
        assert calculate_shipping(qty) == expected

    # ── Tier 41-50 : 180 ฿ ───────────────────────────────────────────────────
    @pytest.mark.parametrize(
        "qty,expected",
        [
            (41, 180),
            (45, 180),
            (50, 180),
        ],
    )
    def test_tier_41_50(self, qty, expected):
        assert calculate_shipping(qty) == expected

    # ── Tier 51-70 : 200 ฿ ───────────────────────────────────────────────────
    @pytest.mark.parametrize(
        "qty,expected",
        [
            (51, 200),
            (60, 200),
            (70, 200),
        ],
    )
    def test_tier_51_70(self, qty, expected):
        assert calculate_shipping(qty) == expected

    # ── Tier 71-100 : 230 ฿ ──────────────────────────────────────────────────
    @pytest.mark.parametrize(
        "qty,expected",
        [
            (71, 230),
            (79, 230),
            (80, 230),
            (100, 230),
        ],
    )
    def test_tier_71_100(self, qty, expected):
        assert calculate_shipping(qty) == expected

    # ── Over 100 : 230 + (qty-100) × 50 ─────────────────────────────────────
    @pytest.mark.parametrize(
        "qty,expected",
        [
            (101, 280),  # 230 + 1×50
            (102, 330),  # 230 + 2×50
            (110, 730),  # 230 + 10×50
            (120, 1230),  # 230 + 20×50
            (150, 2730),  # 230 + 50×50 = 2730
        ],
    )
    def test_over_100_linear(self, qty, expected):
        assert calculate_shipping(qty) == expected

    # ── Explicit boundary transitions (n-1 vs n) ─────────────────────────────
    def test_all_boundaries(self):
        cases = [
            (9, 0),
            (10, 60),
            (15, 60),
            (16, 80),
            (20, 80),
            (21, 100),
            (30, 100),
            (31, 120),
            (40, 120),
            (41, 180),
            (50, 180),
            (51, 200),
            (70, 200),
            (71, 230),
            (100, 230),
            (101, 280),
        ]
        for qty, expected in cases:
            result = calculate_shipping(qty)
            assert result == expected, f"qty={qty}: expected {expected}, got {result}"


# ══════════════════════════════════════════════════════════════════════════════
# 2. POST /api/v1/pricing/calc — pricing endpoint
# ══════════════════════════════════════════════════════════════════════════════


def _item(neck: str, qty: int, add_ons=None, is_oversize=False):
    """Build a single PricingRequestItem dict."""
    return {
        "product_type": "shirt",
        "neck_type": neck,
        "quantity_matrix": {"M": qty},
        "selected_add_ons": add_ons or [],
        "is_oversize": is_oversize,
    }


def post_calc(client, items):
    return client.post("/api/v1/pricing/calc", json={"items": items})


# ── Round / V-neck tier pricing ───────────────────────────────────────────────


class TestRoundVNeckTiers:
    """
    roundVNeck pricing table:
      10-30  → 240 ฿/unit
      31-50  → 220
      51-100 → 190
      101-300→ 180
      301+   → 170
    """

    @pytest.mark.parametrize(
        "qty,expected_unit",
        [
            (10, 240),
            (20, 240),
            (30, 240),
            (31, 220),
            (40, 220),
            (50, 220),
            (51, 190),
            (75, 190),
            (100, 190),
            (101, 180),
            (200, 180),
            (300, 180),
            (301, 170),
            (500, 170),
        ],
    )
    def test_unit_price(self, client, seeded_db, qty, expected_unit):
        resp = post_calc(client, [_item("คอกลม", qty)])
        assert resp.status_code == 200, resp.text
        assert (
            resp.json()["price_per_unit"] == expected_unit
        ), f"qty={qty}: expected {expected_unit}, got {resp.json()['price_per_unit']}"

    @pytest.mark.parametrize("neck", ["คอกลม", "คอวี", "คอวีตัด", "คอวีชน", "คอวีไขว้"])
    def test_all_round_v_neck_types_use_same_table(self, client, seeded_db, neck):
        """All คอกลม/คอวี variants should land on the roundVNeck table."""
        resp = post_calc(client, [_item(neck, 20)])
        assert resp.status_code == 200
        assert resp.json()["price_per_unit"] == 240

    def test_total_price_equals_unit_times_qty(self, client, seeded_db):
        qty = 50
        resp = post_calc(client, [_item("คอกลม", qty)])
        assert resp.json()["total_price"] == pytest.approx(220 * qty)

    def test_shipping_in_response(self, client, seeded_db):
        # qty=25 → tier 21-30 → shipping=100
        resp = post_calc(client, [_item("คอกลม", 25)])
        assert resp.json()["shipping_cost"] == 100


# ── Collar / other neck tier pricing ─────────────────────────────────────────


class TestCollarOtherTiers:
    """
    collarOthers pricing table:
      10-30  → 300 ฿/unit
      31-50  → 260
      51-100 → 240
      101-300→ 220
      301+   → 200
    """

    @pytest.mark.parametrize(
        "qty,expected_unit",
        [
            (10, 300),
            (20, 300),
            (30, 300),
            (31, 260),
            (40, 260),
            (50, 260),
            (51, 240),
            (75, 240),
            (100, 240),
            (101, 220),
            (200, 220),
            (300, 220),
            (301, 200),
            (500, 200),
        ],
    )
    def test_unit_price(self, client, seeded_db, qty, expected_unit):
        resp = post_calc(client, [_item("คอปกเชิ้ต", qty)])
        assert resp.status_code == 200, resp.text
        assert (
            resp.json()["price_per_unit"] == expected_unit
        ), f"qty={qty}: expected {expected_unit}, got {resp.json()['price_per_unit']}"

    @pytest.mark.parametrize("neck", ["คอปกเชิ้ต", "คอปกโปโล"])
    def test_collar_necks_use_collar_table(self, client, seeded_db, neck):
        resp = post_calc(client, [_item(neck, 20)])
        assert resp.status_code == 200
        assert resp.json()["price_per_unit"] == 300


# ── Add-on prices ─────────────────────────────────────────────────────────────


class TestAddOnPrices:
    QTY = 20  # roundVNeck tier: 240/unit; tier is stable for this test class

    @pytest.mark.parametrize(
        "add_on,price_per_unit",
        [
            ("longSleeve", 40),
            ("pocket", 20),
            ("numberName", 20),
            ("slopeShoulder", 40),
            ("collarTongue", 10),
            ("shortSleeveAlt", 20),
            ("oversizeSlopeShoulder", 60),
        ],
    )
    def test_single_addon_price(self, client, seeded_db, add_on, price_per_unit):
        resp = post_calc(client, [_item("คอกลม", self.QTY, add_ons=[add_on])])
        assert resp.status_code == 200
        data = resp.json()
        assert data["item_addon_total"] == pytest.approx(price_per_unit * self.QTY), (
            f"{add_on}: expected {price_per_unit}×{self.QTY}={price_per_unit*self.QTY}, "
            f"got {data['item_addon_total']}"
        )
        assert data["total_price"] == pytest.approx((240 + price_per_unit) * self.QTY)

    def test_no_addons_addon_total_is_zero(self, client, seeded_db):
        resp = post_calc(client, [_item("คอกลม", self.QTY)])
        assert resp.json()["item_addon_total"] == 0
        assert resp.json()["total_price"] == pytest.approx(240 * self.QTY)

    def test_multiple_addons_accumulate(self, client, seeded_db):
        # longSleeve(40) + pocket(20) + numberName(20) = 80/unit
        resp = post_calc(
            client,
            [_item("คอกลม", self.QTY, add_ons=["longSleeve", "pocket", "numberName"])],
        )
        data = resp.json()
        assert data["item_addon_total"] == pytest.approx(80 * self.QTY)
        assert data["total_price"] == pytest.approx((240 + 80) * self.QTY)

    def test_all_addons_together(self, client, seeded_db):
        # 40+20+20+40+10+20 = 150/unit  (no oversizeSlopeShoulder — that replaces slopeShoulder)
        all_addons = [
            "longSleeve",
            "pocket",
            "numberName",
            "slopeShoulder",
            "collarTongue",
            "shortSleeveAlt",
        ]
        expected_addon = (40 + 20 + 20 + 40 + 10 + 20) * self.QTY
        resp = post_calc(client, [_item("คอกลม", self.QTY, add_ons=all_addons)])
        data = resp.json()
        assert data["item_addon_total"] == pytest.approx(expected_addon)

    def test_oversize_replaces_slope_shoulder_with_higher_price(
        self, client, seeded_db
    ):
        """is_oversize=True: slopeShoulder (40) → oversizeSlopeShoulder (60)."""
        resp_normal = post_calc(
            client,
            [_item("คอกลม", self.QTY, add_ons=["slopeShoulder"], is_oversize=False)],
        )
        resp_oversize = post_calc(
            client,
            [_item("คอกลม", self.QTY, add_ons=["slopeShoulder"], is_oversize=True)],
        )
        assert resp_normal.json()["item_addon_total"] == pytest.approx(40 * self.QTY)
        assert resp_oversize.json()["item_addon_total"] == pytest.approx(60 * self.QTY)

    def test_oversize_without_slope_still_adds_oversize_shoulder(
        self, client, seeded_db
    ):
        """is_oversize=True without any add-on should inject oversizeSlopeShoulder."""
        resp = post_calc(client, [_item("คอกลม", self.QTY, is_oversize=True)])
        data = resp.json()
        details = data["details"][0]
        assert "oversizeSlopeShoulder" in details["addons"]
        assert data["item_addon_total"] == pytest.approx(60 * self.QTY)


# ── Multi-item orders ─────────────────────────────────────────────────────────


class TestMultiItemOrders:
    def test_total_qty_is_sum_of_all_items(self, client, seeded_db):
        resp = post_calc(client, [_item("คอกลม", 20), _item("คอปกเชิ้ต", 15)])
        assert resp.json()["total_qty"] == 35

    def test_shipping_based_on_total_qty(self, client, seeded_db):
        # 20 + 15 = 35 → tier 31-40 → 120 ฿
        resp = post_calc(client, [_item("คอกลม", 20), _item("คอปกเชิ้ต", 15)])
        assert resp.json()["shipping_cost"] == 120

    def test_price_per_unit_reflects_first_item(self, client, seeded_db):
        """price_per_unit always reflects the first item's unit price."""
        resp = post_calc(client, [_item("คอกลม", 20), _item("คอปกเชิ้ต", 15)])
        # First item: คอกลม qty=20 → roundVNeck, but total_qty=35 → tier 31-50 → 220?
        # No — each item's unit price is calculated using ITS OWN qty.
        # คอกลม qty=20: total_qty_for_this_item=20, roundVNeck tier 10-30 → 240
        assert resp.json()["price_per_unit"] == 240

    def test_two_items_total_price(self, client, seeded_db):
        # คอกลม qty=20 → 240×20=4800
        # คอปกเชิ้ต qty=15 → 300×15=4500
        # total_price = 4800+4500 = 9300
        resp = post_calc(client, [_item("คอกลม", 20), _item("คอปกเชิ้ต", 15)])
        assert resp.json()["total_price"] == pytest.approx(9300)

    def test_details_has_entry_per_item(self, client, seeded_db):
        resp = post_calc(client, [_item("คอกลม", 20), _item("คอปกเชิ้ต", 15)])
        assert len(resp.json()["details"]) == 2


# ── Edge cases ────────────────────────────────────────────────────────────────


class TestEdgeCases:
    def test_empty_items_returns_400(self, client):
        resp = post_calc(client, [])
        assert resp.status_code == 400

    def test_single_item_qty_10_first_shipping_tier(self, client, seeded_db):
        resp = post_calc(client, [_item("คอกลม", 10)])
        assert resp.json()["shipping_cost"] == 60

    def test_single_item_qty_9_free_shipping(self, client, seeded_db):
        # qty=9 → skipped (qty <= 0 check passes but shipping is still calculated
        # Note: qty=9 < 10, so calculate_shipping returns 0
        # But the item itself: qty=9 → no tier in STEP_PRICING (min=10)
        # unit = table[0]["price"] since qty < 10 skips the tier match
        resp = post_calc(client, [_item("คอกลม", 9)])
        assert resp.json()["shipping_cost"] == 0

    def test_response_shape(self, client, seeded_db):
        resp = post_calc(client, [_item("คอกลม", 20)])
        data = resp.json()
        assert set(data.keys()) >= {
            "price_per_unit",
            "item_addon_total",
            "shipping_cost",
            "total_qty",
            "total_price",
            "details",
        }

    def test_details_shape(self, client, seeded_db):
        resp = post_calc(client, [_item("คอกลม", 20, add_ons=["pocket"])])
        detail = resp.json()["details"][0]
        assert set(detail.keys()) >= {
            "neck",
            "qty",
            "unit_price",
            "addon_unit_price",
            "addons",
            "line_total",
        }
        assert detail["qty"] == 20
        assert detail["unit_price"] == 240
        assert detail["addon_unit_price"] == 20
        assert detail["line_total"] == pytest.approx((240 + 20) * 20)
