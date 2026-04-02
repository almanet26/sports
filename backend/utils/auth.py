"""
JWT Token utilities for authentication
"""

from datetime import datetime, timedelta
from typing import Optional
import jwt
from passlib.context import CryptContext
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database.models.user import User
from database.models.session import UserSession
from database.config import get_db
from sqlalchemy.orm import Session
import os

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv(
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        os.getenv("JWT_EXPIRATION_MINUTES", "10080"),
    )
)
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = verify_access_token(token)
    email = payload.get("sub")

    if not email:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

    max_retries = 3
    for attempt in range(max_retries):
        try:
            user = db.query(User).filter(User.email == email).first()
            if user is None:
                raise HTTPException(
                    status_code=401,
                    detail="User account not found. Please log in again.",
                )
            return user
        except HTTPException:
            raise
        except Exception:
            if attempt < max_retries - 1:
                import time
                time.sleep(0.5 * (attempt + 1))
                try:
                    db.rollback()
                except Exception:
                    pass
            continue

    raise HTTPException(status_code=503, detail="Database unavailable. Please try again.")


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(optional_security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if credentials is None:
        return None
    try:
        token = credentials.credentials
        payload = verify_access_token(token)
        email = payload.get("sub")
        if not email:
            return None
        return db.query(User).filter(User.email == email).first()
    except Exception:
        return None


def require_role(allowed_roles: list):
    def role_checker(current_user: User = Depends(get_current_user)):
        current_role = (current_user.role or "").upper()
        normalized = [r.upper() for r in allowed_roles]
        if current_role not in normalized:
            raise HTTPException(
                status_code=403,
                detail=f"Access forbidden. Required roles: {', '.join(allowed_roles)}",
            )
        return current_user
    return role_checker


def get_current_player(current_user: User = Depends(require_role(["PLAYER"]))) -> User:
    return current_user


def get_current_coach(current_user: User = Depends(require_role(["COACH"]))) -> User:
    return current_user


def get_current_admin(current_user: User = Depends(require_role(["ADMIN"]))) -> User:
    return current_user
