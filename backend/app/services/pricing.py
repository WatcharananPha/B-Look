from sqlalchemy.orm import Session
from decimal import Decimal
from app.models.pricing_rule import PriceTier, ShippingRate
from app.models.product import FabricType, NeckType, SleeveType, AddOnOption, ProductType

class PricingService:
    @staticmethod
    def calculate_shipping(db: Session, total_weight_kg: float, provider: str = "Standard") -> Decimal:
        """หาค่าส่งที่ถูกที่สุดที่ Cover น้ำหนักของ Order"""
        rate = db.query(ShippingRate).filter(
            ShippingRate.min_weight_kg <= total_weight_kg,
            ShippingRate.max_weight_kg >= total_weight_kg,
            ShippingRate.is_active == True
        ).order_by(ShippingRate.base_price.asc()).first()
        
        return rate.base_price if rate else Decimal(0)

    @staticmethod
    def calculate_order_price(
        db: Session, 
        total_qty: int, 
        product_type_id: int, # <--- ต้องรับ Product Type เพื่อหาน้ำหนัก
        fabric_id: int = None,
        neck_id: int = None,
        sleeve_id: int = None,
        addon_ids: list[int] = [],
        is_vat_included: bool = False
    ):
        # 1. Base Price from ProductType (Polo/T-Shirt)
        base_price = Decimal(0)
        weight_per_unit_g = 0
        
        prod_type = db.query(ProductType).filter(ProductType.id == product_type_id).first()
        if prod_type:
            base_price += prod_type.base_price
            weight_per_unit_g = prod_type.average_weight_g

        # 2. Fabric Adjustment
        if fabric_id:
            fabric = db.query(FabricType).filter(FabricType.id == fabric_id).first()
            if fabric: base_price += fabric.price_adjustment

        # 3. Option Adjustments
        if neck_id:
            neck = db.query(NeckType).filter(NeckType.id == neck_id).first()
            if neck: base_price += neck.price_adjustment
            
        if sleeve_id:
            sleeve = db.query(SleeveType).filter(SleeveType.id == sleeve_id).first()
            if sleeve: base_price += sleeve.price_adjustment

        # 4. Add-ons
        for addon_id in addon_ids:
            addon = db.query(AddOnOption).filter(AddOnOption.id == addon_id).first()
            if addon: base_price += addon.price_per_unit

        # 5. Quantity Discount (Tier)
        tier = db.query(PriceTier).filter(
            PriceTier.min_qty <= total_qty,
            PriceTier.max_qty >= total_qty
        ).first()

        discount_per_unit = Decimal(0)
        if tier:
            if tier.discount_amount > 0:
                discount_per_unit = tier.discount_amount
            elif tier.discount_percent > 0:
                discount_per_unit = base_price * (tier.discount_percent / Decimal(100))

        final_price_per_unit = max(Decimal(0), base_price - discount_per_unit)
        subtotal = final_price_per_unit * total_qty

        # 6. VAT Calculation
        vat_amount = Decimal(0)
        grand_total = subtotal

        if not is_vat_included:
            vat_amount = grand_total * Decimal("0.07")
            grand_total += vat_amount
        else:
            vat_amount = (grand_total * 7) / 107
        
        # 7. Shipping Estimation (Optional return)
        total_weight_kg = (weight_per_unit_g * total_qty) / 1000
        estimated_shipping = PricingService.calculate_shipping(db, total_weight_kg)

        return {
            "price_per_unit": round(final_price_per_unit, 2),
            "total_qty": total_qty,
            "subtotal": round(subtotal, 2),
            "vat_amount": round(vat_amount, 2),
            "shipping_cost": round(estimated_shipping, 2),
            "grand_total": round(grand_total + estimated_shipping, 2), # รวมค่าส่ง
            "active_tier": tier.name if tier else None
        }