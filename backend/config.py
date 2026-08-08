from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/postgres"

    api_token: str = "ganti-token-esp32"
    wa_gateway_url: str = "http://localhost:4100"
    wa_auth_token: str = "ganti-token-gateway"
    whatsapp_to: str = "6281234567890"

    threshold_fan_on: float = 32.0
    threshold_fan_off: float = 25.0
    threshold_humid_on: float = 61.0
    threshold_humid_off: float = 83.0
    extreme_temp: float = 40.0
    extreme_humidity: float = 50.0
    cooldown_minutes: int = 15


settings = Settings()
