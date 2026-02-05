from sqlalchemy.orm import Session
from decimal import Decimal

# แก้ไข Import: ใช้ PricingRule แทน PriceTier
from app.models.pricing_rule import PricingRule, ShippingRate
from app.models.product import (
    FabricType,
    NeckType,
    SleeveType,
    AddOnOption,
    ProductType,
)

# Allowed necks for oversize
OVERSIZE_ALLOWED_NECKS = ["คอกลม", "คอวี", "คอวีตัด", "คอวีปก"]


class PricingService:
    @staticmethod
    def calculate_shipping(
        db: Session, total_weight_kg: float, provider: str = "Standard"
    ) -> Decimal:
        """หาค่าส่งที่ถูกที่สุดที่ Cover น้ำหนักของ Order"""
        rate = (
            db.query(ShippingRate)
            .filter(
                ShippingRate.min_weight_kg <= total_weight_kg,
                ShippingRate.max_weight_kg >= total_weight_kg,
                ShippingRate.is_active == 1,
            )
            .order_by(ShippingRate.base_price.asc())
            .first()
        )

        return Decimal(rate.base_price) if rate else Decimal(0)

    @staticmethod
    def calculate_order_price(
        db: Session,
        total_qty: int,
        product_type_id: int,
        quantity_matrix: dict = None,
        product_is_oversize: bool = False,
        fabric_id: int = None,
        neck_id: int = None,
        sleeve_id: int = None,
        addon_ids: list[int] = [],
        is_vat_included: bool = False,
    ):
        base_price = Decimal(0)
        weight_per_unit_g = 0

        # 1. Base Price & Weight from ProductType
        prod_type = (
            db.query(ProductType).filter(ProductType.id == product_type_id).first()
        )
        if prod_type:
            base_price = Decimal(prod_type.base_price)
            weight_per_unit_g = prod_type.average_weight_g

        # 2. Pricing Rule (Tier Price) Overwrite
        fabric_name = None
        if fabric_id:
            fabric = db.query(FabricType).filter(FabricType.id == fabric_id).first()
            if fabric:
                fabric_name = fabric.name
                # ค้นหาราคาตามช่วง (PricingRule)
                rule = (
                    db.query(PricingRule)
                    .filter(
                        PricingRule.min_qty <= total_qty,
                        PricingRule.max_qty >= total_qty,
                        PricingRule.fabric_type == fabric_name,
                    )
                    .first()
                )

                if rule:
                    base_price = Decimal(rule.unit_price)  # ใช้ราคาตามช่วง
                elif fabric.price_adjustment:
                    base_price += Decimal(fabric.price_adjustment)

        # 3. Option Adjustments
        if neck_id:
            neck = db.query(NeckType).filter(NeckType.id == neck_id).first()
            if neck:
                base_price += Decimal(neck.price_adjustment)
            # Oversize validation: if product marked oversize, ensure neck supports it
            if product_is_oversize:
                neck_name = (neck.name or "") if neck else ""
                if not any(nk in neck_name for nk in OVERSIZE_ALLOWED_NECKS):
                    raise ValueError(
                        f"ทรงโอเวอร์ไซส์ทำได้เฉพาะ {', '.join(OVERSIZE_ALLOWED_NECKS)}; คอที่ให้มา: {neck_name}"
                    )

        if sleeve_id:
            sleeve = db.query(SleeveType).filter(SleeveType.id == sleeve_id).first()
            if sleeve:
                base_price += Decimal(sleeve.price_adjustment)

        # 4. Add-ons (per unit)
        item_addon_total = Decimal(0)
        for addon_id in addon_ids:
            addon = db.query(AddOnOption).filter(AddOnOption.id == addon_id).first()
            if addon:
                base_price += Decimal(addon.price_per_unit)
                item_addon_total += Decimal(addon.price_per_unit) * Decimal(total_qty)

        final_price_per_unit = max(Decimal(0), base_price)

        # 5. Sizing surcharge based on quantity matrix and oversize flag
        sizing_surcharge = Decimal(0)
        if quantity_matrix and isinstance(quantity_matrix, dict):
            oversize_qty = 0
            if product_is_oversize:
                # oversize: surcharge applies from 2XL upwards
                for size_name, n in quantity_matrix.items():
                    try:
                        if (
                            size_name.startswith("2XL")
                            or size_name.startswith("3XL")
                            or size_name.startswith("4XL")
                            or size_name.startswith("5XL")
                        ):
                            oversize_qty += int(n)
                    except Exception:
                        continue
            else:
                # normal: surcharge applies from 4XL upwards
                for size_name, n in quantity_matrix.items():
                    try:
                        if size_name.startswith("4XL") or size_name.startswith("5XL"):
                            oversize_qty += int(n)
                    except Exception:
                        continue

            sizing_surcharge = Decimal(oversize_qty) * Decimal(100)

        subtotal = final_price_per_unit * total_qty

        # 5. VAT Calculation
        vat_amount = Decimal(0)
        grand_total = subtotal + sizing_surcharge + item_addon_total

        if not is_vat_included:
            vat_amount = grand_total * Decimal("0.07")
            grand_total += vat_amount
        else:
            vat_amount = (grand_total * 7) / 107

        # 6. Shipping Estimation
        total_weight_kg = (weight_per_unit_g * total_qty) / 1000
        estimated_shipping = PricingService.calculate_shipping(db, total_weight_kg)

        return {
            "price_per_unit": round(final_price_per_unit, 2),
            "total_qty": total_qty,
            "subtotal": round(subtotal, 2),
            "item_addon_total": round(item_addon_total, 2),
            "sizing_surcharge": round(sizing_surcharge, 2),
            "vat_amount": round(vat_amount, 2),
            "shipping_cost": round(estimated_shipping, 2),
            "grand_total": round(grand_total + estimated_shipping, 2),
            "active_tier": (
                f"{fabric_name} (Qty {total_qty})" if fabric_name else "Standard"
            ),
        }
