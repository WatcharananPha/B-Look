from sqlalchemy.orm import Session
from app.models.pricing_rule import PriceTier
from app.models.product import FabricType, NeckType, SleeveType, AddOnOption

class PricingService:
    @staticmethod
    def calculate_order_price(
        db: Session, 
        total_qty: int, 
        fabric_id: int = None,
        neck_id: int = None,
        sleeve_id: int = None,
        addon_ids: list[int] = [],
        is_vat_included: bool = False
    ):
        """
        คำนวณราคาต่อตัว และราคารวม ตาม Logic:
        Base Price (Fabric + Neck + Sleeve + Addons) - Discount (Tier)
        """
        
        # 1. หา Base Cost/Price จาก Fabric (สมมติว่าเป็นตัวตั้งหลัก)
        base_price = 0
        if fabric_id:
            fabric = db.query(FabricType).filter(FabricType.id == fabric_id).first()
            if fabric:
                base_price += float(fabric.price_adjustment) # หรือใช้ field อื่นถ้ามี base price หลัก

        # 2. บวกราคาเพิ่มจาก Neck, Sleeve
        if neck_id:
            neck = db.query(NeckType).filter(NeckType.id == neck_id).first()
            if neck: base_price += float(neck.price_adjustment)
            
        if sleeve_id:
            sleeve = db.query(SleeveType).filter(SleeveType.id == sleeve_id).first()
            if sleeve: base_price += float(sleeve.price_adjustment)

        # 3. บวก Add-ons
        for addon_id in addon_ids:
            addon = db.query(AddOnOption).filter(AddOnOption.id == addon_id).first()
            if addon: base_price += float(addon.price_per_unit)

        # 4. หา Discount Tier ตามจำนวนตัว (Dynamic Pricing)
        # หา Tier ที่ min_qty <= total_qty <= max_qty
        tier = db.query(PriceTier).filter(
            PriceTier.min_qty <= total_qty,
            PriceTier.max_qty >= total_qty
        ).first()

        discount_per_unit = 0
        if tier:
            if tier.discount_amount > 0:
                discount_per_unit = float(tier.discount_amount)
            elif tier.discount_percent > 0:
                discount_per_unit = base_price * (float(tier.discount_percent) / 100)

        final_price_per_unit = max(0, base_price - discount_per_unit)
        subtotal = final_price_per_unit * total_qty

        # 5. VAT Calculation
        vat_amount = 0
        grand_total = subtotal

        if not is_vat_included:
            # ราคาที่คำนวณมายังไม่รวม VAT -> บวกเพิ่ม
            vat_amount = grand_total * 0.07
            grand_total += vat_amount
        else:
            # ราคารวม VAT แล้ว -> ถอด VAT ออกมาโชว์เฉยๆ
            vat_amount = (grand_total * 7) / 107
            # subtotal ในเคสนี้คือราคารวม VAT แล้ว (ตาม Business logic ส่วนใหญ่)
            # หรือถ้าอยากให้ subtotal คือก่อน VAT ก็ต้องลบออก ขึ้นอยู่กับ requirement

        return {
            "price_per_unit": round(final_price_per_unit, 2),
            "total_qty": total_qty,
            "subtotal": round(subtotal, 2),
            "vat_amount": round(vat_amount, 2),
            "grand_total": round(grand_total, 2),
            "active_tier": tier.name if tier else None
        }