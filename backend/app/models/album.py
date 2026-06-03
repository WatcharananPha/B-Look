from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

if TYPE_CHECKING:
    from app.models.order import Order
    from app.models.user import User


class OrderAlbum(Base):
    """A named collection of images attached to one order.

    Admin_B creates albums per order (e.g. "แบบร่าง", "แบบสุดท้าย")
    so that multiple design iterations can be grouped and viewed together.
    """

    __tablename__ = "order_albums"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order: Mapped["Order"] = relationship("Order", back_populates="albums")

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_by_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    created_by: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[created_by_id]
    )

    created_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    images: Mapped[List["AlbumImage"]] = relationship(
        "AlbumImage",
        back_populates="album",
        cascade="all, delete-orphan",
        order_by="AlbumImage.id",
    )


class AlbumImage(Base):
    """One image (or file) inside an OrderAlbum."""

    __tablename__ = "album_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    album_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("order_albums.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    album: Mapped["OrderAlbum"] = relationship("OrderAlbum", back_populates="images")

    url: Mapped[str] = mapped_column(String, nullable=False)
    caption: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    uploaded_by_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    uploaded_by: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[uploaded_by_id]
    )

    created_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
