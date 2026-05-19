from typing import Optional, TYPE_CHECKING
from decimal import Decimal
from sqlalchemy import Integer, String, Boolean, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base

if TYPE_CHECKING:
    from app.models.supplier import Supplier


class FabricType(Base):
    __tablename__ = "fabric_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    price_adjustment: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    cost_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )
    cost_per_yard: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    supplier_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("suppliers.id"), nullable=True
    )
    supplier: Mapped[Optional["Supplier"]] = relationship(
        "Supplier", back_populates="fabrics"
    )


class NeckType(Base):
    __tablename__ = "neck_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    price_adjustment: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    cost_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )

    additional_cost: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )
    force_slope: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class SleeveType(Base):
    __tablename__ = "sleeve_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    price_adjustment: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )

    quantity: Mapped[int] = mapped_column(Integer, default=0)
    cost_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )

    additional_cost: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=Decimal("0")
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
