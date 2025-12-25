class PricingService:
    @staticmethod
    def calculate_order_total(items, is_vat_included: bool, discount: float = 0):
        subtotal = 0
        total_qty = 0
        
        for item in items:
            # คำนวณจำนวนรวมจาก Matrix JSON {"S":10, "M":5} -> 15
            qty = sum(item.quantity_matrix.values())
            subtotal += qty * item.base_price
            total_qty += qty
            
        # Logic VAT
        grand_total = subtotal - discount
        vat_amount = 0
        
        if not is_vat_included:
            vat_amount = grand_total * 0.07
            grand_total += vat_amount
        else:
            # ถอด VAT (ถ้าต้องการแสดงแยก)
            vat_amount = (grand_total * 7) / 107
            
        return {
            "subtotal": subtotal,
            "vat_amount": vat_amount,
            "grand_total": grand_total,
            "total_qty": total_qty
        }