import os
import uuid
import hashlib
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm

from sqlalchemy.orm import Session
from sqlalchemy import func

from .config import settings
from .db import Base, engine, get_db
from .models import PackCapture, Operator
from .schemas import CaptureOutItem, VoidReq, LoginRes, OrderListItem
from .auth import create_token, get_current_user
from .watermark import apply_watermark

# Init storage and DB
os.makedirs(settings.STORAGE_DIR, exist_ok=True)
os.makedirs("./data", exist_ok=True)
Base.metadata.create_all(bind=engine)

# patch: ensure 'responsible' exists (if DB already there)
try:
    import sqlite3
    db_file = "./data/app.db"
    if os.path.exists(db_file):
        con = sqlite3.connect(db_file)
        cur = con.cursor()
        cur.execute("PRAGMA table_info(pack_captures)")
        cols = [r[1] for r in cur.fetchall()]
        if "responsible" not in cols:
            cur.execute("ALTER TABLE pack_captures ADD COLUMN responsible VARCHAR")
            con.commit()
        con.close()
except Exception as e:
    print("schema patch warn:", e)

app = FastAPI(title="Pack Captures API", version="2.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=getattr(settings, "CORS_ORIGINS", []) or [],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

USERS = {
    "admin":      {"password": "admin",         "id": "admin",      "name": "Administrador", "role": "admin"},
    "bodega":     {"password": "bodega2025",    "id": "bodega",     "name": "Bodega",        "role": "bodega"},
    "callcenter": {"password": "callcenter123", "id": "callcenter", "name": "Call Center",   "role": "callcenter"},
}

def ensure_user_exists(db: Session, u: dict):
    op = db.query(Operator).filter(Operator.id == u["id"]).first()
    if not op:
        db.add(Operator(id=u["id"], name=u["name"], role=u["role"], active=True))
        db.commit()

@app.post("/token", response_model=LoginRes)
def token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    u = USERS.get(form_data.username)
    if u and u["password"] == form_data.password:
        ensure_user_exists(db, u)
        return {
            "access_token": create_token(u["id"], u["role"], u["name"]),
            "operator_id": u["id"],
            "operator_name": u["name"],
            "role": u["role"],
        }
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.get("/health")
def health():
    return {"status": "ok"}

def ensure_role(user, allowed: List[str]):
    if user["role"] not in allowed:
        raise HTTPException(status_code=403, detail="Not enough permissions")

def save_with_watermark(raw_bytes: bytes, order_no: str, operator_id: Optional[str]) -> str:
    uid = str(uuid.uuid4())
    folder = os.path.join(settings.STORAGE_DIR, order_no)
    os.makedirs(folder, exist_ok=True)
    orig_path = os.path.join(folder, f"{uid}_orig.jpg")
    wm_path   = os.path.join(folder, f"{uid}.jpg")
    with open(orig_path, "wb") as f:
        f.write(raw_bytes)
    if str(settings.ENABLE_WATERMARK).lower() == "true":
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        wm_text = f"PEDIDO #{order_no} | {ts} | Operador: {operator_id or 'N/A'}"
        try:
            apply_watermark(orig_path, wm_path, wm_text)
        except Exception:
            wm_path = orig_path
    else:
        wm_path = orig_path
    return wm_path

@app.options(f"{settings.API_PREFIX}/captures")
def captures_options() -> Response:
    return Response(status_code=204)

@app.post(f"{settings.API_PREFIX}/captures", response_model=List[CaptureOutItem])
async def create_capture(
    order_no: str = Form(...),
    responsible: str = Form(...),
    note: str = Form(...),
    files: List[UploadFile] = File(...),
    user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_role(user, ["admin", "bodega"])
    if not order_no.strip():
        raise HTTPException(400, "order_no requerido")
    if not responsible.strip():
        raise HTTPException(400, "responsible requerido")
    if not note.strip():
        raise HTTPException(400, "note requerido")
    if not files:
        raise HTTPException(400, "Sin archivos")
    MAX_FILES = 10
    out_items: List[CaptureOutItem] = []
    for uf in files[:MAX_FILES]:
        data = await uf.read()
        checksum = hashlib.sha256(data).hexdigest()
        abs_path = save_with_watermark(data, order_no, user["id"])
        cap = PackCapture(
            id=str(uuid.uuid4()),
            order_no=order_no,
            photo_path=abs_path,
            captured_at=datetime.now(timezone.utc),
            operator_id=user["id"],
            note=note,
            responsible=responsible,
            checksum=checksum,
            voided=False,
        )
        db.add(cap)
        db.commit()
        db.refresh(cap)
        out_items.append(CaptureOutItem(
            id=cap.id,
            photo_url=f"/files/{order_no}/{os.path.basename(abs_path)}",
            captured_at=cap.captured_at,
            operator=cap.operator.name if cap.operator else None,
            station=cap.station,
            note=cap.note or "",
            responsible=cap.responsible or "",
            voided=cap.voided,
        ))
    return out_items

@app.get(f"{settings.API_PREFIX}/captures", response_model=List[CaptureOutItem])
def query_captures(order_no: str, user = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_role(user, ["admin", "callcenter"])
    rows = db.query(PackCapture).filter(PackCapture.order_no == order_no).order_by(PackCapture.captured_at.desc()).all()
    return [CaptureOutItem(
        id=r.id,
        photo_url=f"/files/{order_no}/{os.path.basename(r.photo_path)}",
        captured_at=r.captured_at,
        operator=r.operator.name if r.operator else None,
        station=r.station,
        note=r.note or "",
        responsible=r.responsible or "",
        voided=r.voided,
    ) for r in rows ]

@app.get(f"{settings.API_PREFIX}/orders", response_model=List[OrderListItem])
def list_orders(user = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_role(user, ["admin", "callcenter"])
    from sqlalchemy import func
    q = (db.query(
            PackCapture.order_no.label("order_no"),
            func.max(PackCapture.captured_at).label("last_capture_at"),
            func.count(PackCapture.id).label("count")
        ).group_by(PackCapture.order_no)
         .order_by(func.max(PackCapture.captured_at).desc())
         .all())
    return [OrderListItem(order_no=row.order_no, last_capture_at=row.last_capture_at, count=row.count) for row in q]

app.mount("/files", StaticFiles(directory=settings.STORAGE_DIR), name="files")
