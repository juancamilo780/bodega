from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from .db import Base
from datetime import datetime, timezone

class Operator(Base):
    __tablename__ = "operators"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    active = Column(Boolean, default=True)

class PackCapture(Base):
    __tablename__ = "pack_captures"
    id = Column(String, primary_key=True)
    order_no = Column(String, index=True, nullable=False)
    photo_path = Column(String, nullable=False)
    captured_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    operator_id = Column(String, ForeignKey("operators.id"), nullable=True)
    station = Column(String, nullable=True)
    note = Column(Text, nullable=True)
    responsible = Column(String, nullable=True)
    checksum = Column(String, nullable=True)
    voided = Column(Boolean, default=False)
    void_reason = Column(Text, nullable=True)

    operator = relationship("Operator", lazy="joined")
