from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CaptureOutItem(BaseModel):
    id: str
    photo_url: str
    captured_at: datetime
    operator: Optional[str] = None
    station: Optional[str] = None
    note: str
    responsible: str
    voided: bool
    class Config:
        from_attributes = True

class VoidReq(BaseModel):
    reason: str

class LoginRes(BaseModel):
    access_token: str
    token_type: str = "bearer"
    operator_id: str
    operator_name: str
    role: str

class OrderListItem(BaseModel):
    order_no: str
    last_capture_at: datetime
    count: int
