"""
JWT Token utilities for authentication
"""
from datetime import datetime, timedelta
from typing import Optional
import jwt
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database.models.user import User
from database.models.session import UserSession
import secrets
import os

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 30

security = HTTPBearer()

def create_access_token(user_id: str, role: str) -> str:
    """Create JWT access token"""
    expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.utcnow() + expires_delta
    
    to_encode = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access"
    }
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token() -> str:
    """Create a secure refresh token"""
    return secrets.token_urlsafe(64)

def verify_access_token(token: str) -> dict:
    """Verify JWT access token and return payload"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> User:
    """Get current authenticated user from JWT token"""
    token = credentials.credentials
    payload = verify_access_token(token)
    user_id = payload.get("sub")
    
    if user_id is None:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    user = User.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")
    
    return user

def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Ensure user is active and verified"""
    if not current_user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")
    return current_user

def require_role(allowed_roles: list):
    """Dependency to check user role"""
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403, 
                detail=f"Access forbidden. Required roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker

# Role-specific dependencies
def get_current_player(current_user: User = Depends(require_role(["PLAYER"]))) -> User:
    """Get current user ensuring they are a PLAYER"""
    return current_user

def get_current_coach(current_user: User = Depends(require_role(["COACH"]))) -> User:
    """Get current user ensuring they are a COACH"""
    return current_user

def get_current_admin(current_user: User = Depends(require_role(["ADMIN"]))) -> User:
    """Get current user ensuring they are an ADMIN"""
    return current_user
