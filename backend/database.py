from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent

# Load .env file
load_dotenv(BASE_DIR / ".env")

# SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
# MYSQL_DATABASE_URL = os.getenv("MYSQL_DATABASE_URL") # Format: mysql+pymysql://user:password@host:port/dbname
MYSQL_DATABASE_URL = os.getenv("MYSQL_DATABASE_URL")

# Construct URL for PyMySQL
if MYSQL_DATABASE_URL:
    # Ensure pymysql dialect is explicitly used
    if MYSQL_DATABASE_URL.startswith("mysql://"):
        db_url = MYSQL_DATABASE_URL.replace("mysql://", "mysql+pymysql://")
    else:
        db_url = MYSQL_DATABASE_URL
    SQLALCHEMY_DATABASE_URL = db_url
else:
    SQLALCHEMY_DATABASE_URL = "sqlite:///./depilarte.db"

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, 
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_pre_ping=True, # Recommended for remote DBs to handle disconnects
        pool_recycle=3600
    )
    
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
