from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
import json

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8')

    APP_NAME: str = "pack-captures"
    API_PREFIX: str = "/api"
    SECRET_KEY: str = "dev-secret-key-change-me"
    CORS_ORIGINS: List[str] = ["http://localhost:5173","http://127.0.0.1:5173"]
    STORAGE_DIR: str = "./data/images"
    ENABLE_WATERMARK: bool = True

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v):
        if isinstance(v, list): return v
        if isinstance(v, str):
            s = v.strip()
            if s.startswith("[") and s.endswith("]"):
                try:
                    return list(json.loads(s))
                except Exception:
                    pass
            return [x.strip() for x in s.split(",") if x.strip()]
        return []

settings = Settings()
