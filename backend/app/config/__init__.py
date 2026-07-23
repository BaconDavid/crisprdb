from dotenv import load_dotenv
from functools import lru_cache

from .app_config import AppConfigSettings

import os

load_dotenv()  # 加载 .env 文件中的环境变量

@lru_cache()
def get_app_settings() -> AppConfigSettings:
    return AppConfigSettings(
        db_host=os.getenv("DB_HOST"),
        db_port=int(os.getenv("DB_PORT")),
        db_user=os.getenv("DB_USER"),
        db_password=os.getenv("DB_PASSWORD"),
        db_database=os.getenv("DB_DATABASE"),
    )
app_settings = get_app_settings()

