
import logging
import json
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.order import Order
from app.models.notification import Notification
from app.models.user import User

logger = logging.getLogger(__name__)

def check_smart_alerts():
    """
    Background task to check for critical order events and create system notifications.
    Requirements:
    - Design Cycle: Alert after 1-2 days without progress.
    - Customer Usage: Pre-alert 1-2 days before usage date.
    """
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        
        # 1. PRE-ALERT: Customer Usage (Deadline Critical)
        # Alert when usage_date is within 2 days.
        usage_threshold = now + timedelta(days=2)
        near_usage = db.query(Order).filter(
            Order.usage_date != None,
            Order.usage_date <= usage_threshold,
            Order.usage_date >= now - timedelta(days=1), # avoid alerting for very old ones
            Order.status.notin_(["SHIPPED", "CANCELLED", "COMPLETED"])
        ).all()
        
        for o in near_usage:
            _create_alert(
                db, 
                o, 
                "USAGE_DATE_NEAR", 
                f"🚨 แผนส่งงานด่วน: ออเดอร์ {o.order_no or o.id} ถึงวันใช้งานลูกค้าใน 2 วัน ({o.usage_date.date()})"
            )

        # 2. FOLLOW-UP: Design Cycle (1-2 days in WAITING_ARTWORK or WAITING_CUSTOMER_APPROVAL)
        # Check AuditLogs or just updated_at (if Order had it)
        # Since Order doesn't have updated_at in schema shown, we use created_at as fallback or assume status hasn't moved.
        # Let's check status age.
        followup_threshold = now - timedelta(days=2)
        # This is a bit tricky without a dedicated status_changed_at field.
        # We can look at the latest AuditLog for the order.
        from app.models.audit_log import AuditLog
        
        design_statuses = ["WAITING_ARTWORK", "WAITING_CUSTOMER_APPROVAL", "EDIT_ROUND_1", "EDIT_ROUND_2", "EDIT_ROUND_3"]
        stagnant_orders = db.query(Order).filter(
            Order.status.in_(design_statuses)
        ).all()
        
        for o in stagnant_orders:
            last_audit = db.query(AuditLog).filter(
                AuditLog.target_type == "order",
                AuditLog.target_id == str(o.id)
            ).order_by(AuditLog.created_at.desc()).first()
            
            if last_audit and last_audit.created_at <= followup_threshold:
                _create_alert(
                    db,
                    o,
                    "DESIGN_FOLLOWUP",
                    f"⏰ ติดตามงานออกแบบ: ออเดอร์ {o.order_no or o.id} ค้างอยู่ที่สถานะ {o.status} นานกว่า 2 วันแล้ว"
                )

        db.commit()
    except Exception as e:
        logger.exception("Error during smart alerts check")
    finally:
        db.close()

def _create_alert(db: Session, order: Order, alert_type: str, message: str):
    # Avoid duplicate alerts for the same order/type within a short window
    existing = db.query(Notification).filter(
        Notification.payload.like(f'%"order_id": {order.id}%'),
        Notification.type == alert_type,
        Notification.created_at >= datetime.utcnow() - timedelta(hours=23)
    ).first()
    
    if existing:
        return

    # Create notification for relevant roles (Admins/Sales)
    # For simplicity, we create a global notification (user_id=None) or notify all Admins
    # Here we'll create a generic notification that appears on the Dashboard for everyone with access
    notif = Notification(
        type=alert_type,
        message=message,
        payload=json.dumps({"order_id": order.id, "order_no": order.order_no}),
        is_read=False
    )
    db.add(notif)
    logger.info(f"Created smart alert: {alert_type} for Order {order.id}")

def start_scheduler():
    scheduler = BackgroundScheduler()
    # Run every 6 hours to avoid spamming but keep it updated
    scheduler.add_job(check_smart_alerts, 'interval', hours=6)
    # Also run once at startup
    scheduler.add_job(check_smart_alerts, 'date', run_date=datetime.now() + timedelta(seconds=10))
    scheduler.start()
    logger.info("APScheduler started for smart alerts.")
