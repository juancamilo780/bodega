from datetime import datetime, timedelta, timezone
from typing import Dict, Any
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from .config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")
ALGO = "HS256"
EXP_MIN = 60 * 24 * 7  # 7 days

def create_token(sub: str, role: str, name: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "role": role,
        "name": name,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=EXP_MIN)).timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGO)

def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    try:
        data = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGO])
        return {"id": data.get("sub"), "role": data.get("role"), "name": data.get("name")}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
