"""
Tests for the ตั้งค่าระบบ (Settings) page API endpoints:
  - GET  /api/v1/company/config     — fetch VAT rate & default shipping cost
  - PUT  /api/v1/company/config     — update config (admin only)
  - GET  /api/v1/company/addons     — fetch addon list & prices
  - GET  /api/v1/pricing-rules/     — fetch pricing rules (public)
  - POST /api/v1/pricing-rules/     — create pricing rule (admin only)
  - DELETE /api/v1/pricing-rules/{id} — delete pricing rule (admin only)
"""

import pytest

# ══════════════════════════════════════════════════════════════════════════════
# 1. Company Config  (GET & PUT /api/v1/company/config)
# ══════════════════════════════════════════════════════════════════════════════


class TestCompanyConfigGet:
    def test_get_returns_200(self, client, seeded_db):
        resp = client.get("/api/v1/company/config")
        assert resp.status_code == 200

    def test_get_returns_required_fields(self, client, seeded_db):
        data = client.get("/api/v1/company/config").json()
        assert "id" in data
        assert "vat_rate" in data
        assert "default_shipping_cost" in data

    def test_vat_rate_stored_as_decimal(self, client, seeded_db):
        """Backend stores 0.07 (not 7). Settings page multiplies ×100 for display."""
        data = client.get("/api/v1/company/config").json()
        assert data["vat_rate"] == pytest.approx(0.07), (
            "vat_rate must be stored as 0.07, not 7. "
            "The Settings page converts ×100 for display."
        )

    def test_default_shipping_cost_is_float(self, client, seeded_db):
        data = client.get("/api/v1/company/config").json()
        assert isinstance(data["default_shipping_cost"], (int, float))

    def test_get_is_public_no_auth_needed(self, client, seeded_db):
        """GET must succeed without an Authorization header."""
        resp = client.get("/api/v1/company/config")
        assert resp.status_code == 200


class TestCompanyConfigPut:
    def test_put_requires_auth(self, client, seeded_db):
        resp = client.put(
            "/api/v1/company/config",
            json={"vat_rate": 0.07, "default_shipping_cost": 0.0},
        )
        assert resp.status_code == 401

    def test_put_updates_vat_rate(self, client, seeded_db, admin_headers):
        resp = client.put(
            "/api/v1/company/config",
            json={"vat_rate": 0.10, "default_shipping_cost": 0.0},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["vat_rate"] == pytest.approx(0.10)

    def test_put_updates_default_shipping_cost(self, client, seeded_db, admin_headers):
        resp = client.put(
            "/api/v1/company/config",
            json={"vat_rate": 0.07, "default_shipping_cost": 150.0},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["default_shipping_cost"] == pytest.approx(150.0)

    def test_vat_rate_round_trip(self, client, seeded_db, admin_headers):
        """
        Simulate the Settings page workflow:
          1. GET  → backend returns 0.07 → frontend displays 7
          2. User edits to 10 in UI
          3. PUT  → frontend sends 10/100 = 0.10
          4. GET  → backend returns 0.10 → frontend displays 10
        """
        # Step 3: save
        client.put(
            "/api/v1/company/config",
            json={"vat_rate": 0.10, "default_shipping_cost": 0.0},
            headers=admin_headers,
        )
        # Step 4: verify round-trip
        data = client.get("/api/v1/company/config").json()
        assert data["vat_rate"] == pytest.approx(0.10)
        # Restore to original
        client.put(
            "/api/v1/company/config",
            json={"vat_rate": 0.07, "default_shipping_cost": 0.0},
            headers=admin_headers,
        )

    def test_vat_display_conversion(self, client, seeded_db, admin_headers):
        """
        Frontend display math:
          stored=0.07  →  displayed = stored × 100 = 7
          user types 7 → saved = 7 / 100 = 0.07
        """
        stored = 0.07
        displayed = round(stored * 100, 6)
        assert displayed == pytest.approx(7.0), "0.07 → display as 7"
        saved = displayed / 100
        assert saved == pytest.approx(0.07), "7 → save as 0.07"

    def test_put_zero_vat_is_valid(self, client, seeded_db, admin_headers):
        """VAT rate of 0 (tax-exempt) should be accepted."""
        resp = client.put(
            "/api/v1/company/config",
            json={"vat_rate": 0.0, "default_shipping_cost": 0.0},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["vat_rate"] == pytest.approx(0.0)
        # Restore
        client.put(
            "/api/v1/company/config",
            json={"vat_rate": 0.07, "default_shipping_cost": 0.0},
            headers=admin_headers,
        )

    def test_put_non_zero_default_shipping_persists(
        self, client, seeded_db, admin_headers
    ):
        client.put(
            "/api/v1/company/config",
            json={"vat_rate": 0.07, "default_shipping_cost": 80.0},
            headers=admin_headers,
        )
        data = client.get("/api/v1/company/config").json()
        assert data["default_shipping_cost"] == pytest.approx(80.0)
        # Restore
        client.put(
            "/api/v1/company/config",
            json={"vat_rate": 0.07, "default_shipping_cost": 0.0},
            headers=admin_headers,
        )


# ══════════════════════════════════════════════════════════════════════════════
# 2. Add-ons  (GET /api/v1/company/addons)
# ══════════════════════════════════════════════════════════════════════════════


class TestAddonsEndpoint:
    EXPECTED_ADDONS = {
        "longSleeve": 40,
        "pocket": 20,
        "numberName": 20,
        "slopeShoulder": 40,
        "collarTongue": 10,
        "shortSleeveAlt": 20,
        "oversizeSlopeShoulder": 60,
    }

    def test_get_addons_returns_200(self, client):
        assert client.get("/api/v1/company/addons").status_code == 200

    def test_get_addons_is_public(self, client):
        """No auth header required."""
        assert client.get("/api/v1/company/addons").status_code == 200

    def test_returns_all_seven_addons(self, client):
        data = client.get("/api/v1/company/addons").json()
        assert len(data) == 7

    def test_each_addon_has_id_name_price(self, client):
        for addon in client.get("/api/v1/company/addons").json():
            assert "id" in addon
            assert "name" in addon
            assert "price" in addon

    @pytest.mark.parametrize(
        "addon_id,expected_price",
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
    def test_addon_price_correct(self, client, addon_id, expected_price):
        addons = {
            a["id"]: a["price"] for a in client.get("/api/v1/company/addons").json()
        }
        assert addon_id in addons, f"addon '{addon_id}' missing from response"
        assert addons[addon_id] == pytest.approx(
            expected_price
        ), f"{addon_id}: expected {expected_price}, got {addons[addon_id]}"


# ══════════════════════════════════════════════════════════════════════════════
# 3. Pricing Rules  (/api/v1/pricing-rules/)
# ══════════════════════════════════════════════════════════════════════════════


class TestPricingRulesGet:
    def test_get_is_public(self, client, seeded_db):
        resp = client.get("/api/v1/pricing-rules/")
        assert resp.status_code == 200

    def test_get_returns_list(self, client, seeded_db):
        data = client.get("/api/v1/pricing-rules/").json()
        assert isinstance(data, list)


class TestPricingRulesCRUD:
    NEW_RULE = {
        "min_qty": 10,
        "max_qty": 30,
        "fabric_type": "เสื้อยืด",
        "unit_price": 240.0,
    }

    def test_post_without_auth_returns_401(self, client, seeded_db):
        resp = client.post("/api/v1/pricing-rules/", json=self.NEW_RULE)
        assert resp.status_code == 401

    def test_post_with_admin_creates_rule(self, client, seeded_db, admin_headers):
        resp = client.post(
            "/api/v1/pricing-rules/", json=self.NEW_RULE, headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["min_qty"] == 10
        assert data["max_qty"] == 30
        assert data["fabric_type"] == "เสื้อยืด"
        assert data["unit_price"] == pytest.approx(240.0)
        assert "id" in data

    def test_created_rule_appears_in_list(self, client, seeded_db, admin_headers):
        # Create a uniquely-named rule so we can find it in the list
        rule = {**self.NEW_RULE, "fabric_type": "ผ้าคอตตอน_test"}
        create_resp = client.post(
            "/api/v1/pricing-rules/", json=rule, headers=admin_headers
        )
        assert create_resp.status_code == 200
        rule_id = create_resp.json()["id"]

        rules = client.get("/api/v1/pricing-rules/").json()
        ids = [r["id"] for r in rules]
        assert rule_id in ids

    def test_delete_without_auth_returns_401(self, client, seeded_db, admin_headers):
        # Create a rule first
        resp = client.post(
            "/api/v1/pricing-rules/",
            json={**self.NEW_RULE, "fabric_type": "to_delete"},
            headers=admin_headers,
        )
        rule_id = resp.json()["id"]
        # Delete without auth
        del_resp = client.delete(f"/api/v1/pricing-rules/{rule_id}")
        assert del_resp.status_code == 401

    def test_delete_with_admin_removes_rule(self, client, seeded_db, admin_headers):
        # Create
        resp = client.post(
            "/api/v1/pricing-rules/",
            json={**self.NEW_RULE, "fabric_type": "delete_me"},
            headers=admin_headers,
        )
        rule_id = resp.json()["id"]
        # Delete
        del_resp = client.delete(
            f"/api/v1/pricing-rules/{rule_id}", headers=admin_headers
        )
        assert del_resp.status_code == 200
        assert del_resp.json() == {"ok": True}
        # Verify not in list
        rules = client.get("/api/v1/pricing-rules/").json()
        ids = [r["id"] for r in rules]
        assert rule_id not in ids

    def test_delete_nonexistent_rule_returns_404(
        self, client, seeded_db, admin_headers
    ):
        resp = client.delete("/api/v1/pricing-rules/999999", headers=admin_headers)
        assert resp.status_code == 404

    def test_rule_fields_in_response(self, client, seeded_db, admin_headers):
        resp = client.post(
            "/api/v1/pricing-rules/",
            json={**self.NEW_RULE, "fabric_type": "field_check"},
            headers=admin_headers,
        )
        data = resp.json()
        assert set(data.keys()) >= {
            "id",
            "min_qty",
            "max_qty",
            "fabric_type",
            "unit_price",
        }
