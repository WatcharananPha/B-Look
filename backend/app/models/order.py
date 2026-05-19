from typing import Optional, List, TYPE_CHECKING
from decimal import Decimal
from datetime import datetime
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.user import User


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_no: Mapped[str] = mapped_column(
        String, unique=True, index=True, nullable=False
    )

    # Customer Info Snapshot
    customer_name: Mapped[Optional[str]] = mapped_column(
        String, index=True, nullable=True
    )
    brand: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    customer_code: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    graphic_code: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    product_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    contact_channel: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    customer_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("customers.id"), nullable=True
    )
    customer: Mapped[Optional["Customer"]] = relationship(
        "Customer", back_populates="orders"
    )

    deadline: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    usage_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    urgency_level: Mapped[str] = mapped_column(
        String, default="normal"
    )  # normal, warning, critical
    # New status values for payment flow: WAITING_BOOKING, WAITING_DEPOSIT, WAITING_BALANCE, etc.
    status: Mapped[str] = mapped_column(String, default="WAITING_BOOKING")

    # Financials
    is_vat_included: Mapped[bool] = mapped_column(Boolean, default=True)
    shipping_cost: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )
    add_on_cost: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )
    sizing_surcharge: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )
    add_on_options_total: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )
    design_fee: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )

    discount_type: Mapped[str] = mapped_column(String, default="THB")  # THB or PERCENT
    discount_value: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )
    discount_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )

    vat_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )
    grand_total: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )

    deposit_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )  # Total Deposit
    deposit_1: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )
    deposit_2: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )

    balance_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )

    # Public payment link secret and slip URLs
    order_uuid: Mapped[Optional[str]] = mapped_column(
        String, unique=True, index=True, nullable=True
    )
    slip_booking_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    slip_deposit_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    slip_balance_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Mockup image URLs (front/back) for order preview/uploads
    mockup_front_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mockup_back_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Artwork / Print files stored as URLs to /static
    artwork_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    print_file_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Production ticket / tracking
    production_ticket_issued: Mapped[bool] = mapped_column(Boolean, default=False)
    tracking_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Cost & Profit
    total_cost: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )
    estimated_profit: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )

    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    created_by_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    created_by: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[created_by_id]
    )

    items: Mapped[List["OrderItem"]] = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("orders.id"), nullable=False
    )

    product_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    fabric_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    neck_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sleeve_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    quantity_matrix: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # JSON string e.g. {"S": 10, "M": 5}

    total_qty: Mapped[int] = mapped_column(Integer, default=0)
    price_per_unit: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )
    total_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )

    # Persist per-item add-ons and oversize flag for audit and recalculation
    selected_add_ons: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # JSON array of add-on ids
    is_oversize: Mapped[bool] = mapped_column(Boolean, default=False)

    # Optional: Store per-item addon totals and sizing surcharge for reporting
    item_addon_total: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )
    item_sizing_surcharge: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )

    cost_per_unit: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )
    total_cost: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )

    order: Mapped["Order"] = relationship("Order", back_populates="items")
