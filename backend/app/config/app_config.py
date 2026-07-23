from pydantic_settings import BaseSettings



class AppConfigSettings(BaseSettings):
    #应用配置#
    app_name: str = "crisprdb"
    app_port: int = 5432
    app_env: str = "dev"
    app_debug: bool = False
    #数据库配置#
    db_host: str
    db_port: int
    db_user: str
    db_password: str
    db_database: str

