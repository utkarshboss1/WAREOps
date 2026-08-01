from pydantic_settings import BaseSettings
from pydantic import Field, model_validator

class Settings(BaseSettings):
    DATABASE_URL: str = Field(default="postgresql+asyncpg://warehouse_admin:warehouse_secret@localhost:5432/warehouse_platform", env="DATABASE_URL")
    REDIS_URL: str = Field(default="redis://:redis_secret@localhost:6379/1", env="REDIS_URL")
    KAFKA_BOOTSTRAP_SERVERS: str = Field(default="", env="KAFKA_BOOTSTRAP_SERVERS")
    TOPOLOGY_SERVICE_URL: str = Field(default="http://topology-service:8001", env="TOPOLOGY_SERVICE_URL")
    SERVICE_NAME: str = "mission-service"
    LOG_LEVEL: str = "INFO"
    PORT: int = 8002
    ROBOT_HEARTBEAT_TIMEOUT_SECS: int = 180
    MISSION_LOCK_TTL_SECS: int = 300

    # ── Railway DATABASE_URL auto-fix ─────────────────────────────────────────
    @model_validator(mode="after")
    def _fix_database_url_scheme(self) -> "Settings":
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            self.DATABASE_URL = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            self.DATABASE_URL = url.replace("postgres://", "postgresql+asyncpg://", 1)
        return self

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
