import logging
import uvicorn
from typing import List
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pathlib import Path
from sqlalchemy import text
from database.config import SessionLocal
from typing import List

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        logger.info("Starting up the Cricket Video Analytics API...")
        logger.info("Checking database connection...")
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        logger.info("Database connection successful.")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise
    yield
    logger.info("Shutting down the Cricket Video Analytics API...")


app = FastAPI(
    title="Cricket Video Analytics API",
    description="API for processing and analyzing cricket videos",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "Cricket Video Analytics API", "version": "1.0.0"}


@app.get("/api/v1/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/v1/db-health")
def db_health_check():
    try:
        logging.info("Checking database connection...")
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        logging.info("Database connection successful.")
        return {"status": "ok"}
    except Exception as e:
        logging.error(f"Database connection failed: {e}")
        return {"status": "error", "detail": str(e)}


from routes import auth

app.include_router(auth.router) 

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
