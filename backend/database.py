from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent

# Load .env file
env_path = BASE_DIR / ".env"
if not env_path.exists():
    env_path = BASE_DIR.parent / ".env"
load_dotenv(env_path)

MYSQL_DATABASE_URL = os.getenv("MYSQL_DATABASE_URL")

# Construct URL for PyMySQL
if not MYSQL_DATABASE_URL:
    raise ValueError("MYSQL_DATABASE_URL not set in environment")

if MYSQL_DATABASE_URL.startswith("mysql://"):
    db_url = MYSQL_DATABASE_URL.replace("mysql://", "mysql+pymysql://")
else:
    db_url = MYSQL_DATABASE_URL

# Ensure utf8mb4 charset for emoji support (required for MySQL)
if "?" not in db_url:
    db_url += "?charset=utf8mb4"
elif "charset=" not in db_url:
    db_url += "&charset=utf8mb4"

SQLALCHEMY_DATABASE_URL = db_url

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args={"charset": "utf8mb4"}
)
    
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
