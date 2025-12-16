"""
Authentication Routes for Registration and Login
"""
from fastapi import APIRouter, HTTPException, Depends, status, Request
from schemas.auth import (
    UserRegisterRequest, 
    UserLoginRequest, 
    TokenResponse, 
    UserProfileResponse,
    PasswordResetRequest,
    PasswordResetConfirm,
    EmailVerificationRequest,
    RefreshTokenRequest
)
from database.models.user import User
from database.models.session import UserSession
from utils.auth import (
    create_access_token, 
    create_refresh_token, 
    get_current_user,
    verify_access_token
)
from datetime import datetime

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

@router.post("/register", response_model=UserProfileResponse, status_code=status.HTTP_201_CREATED)
async def register_user(request: UserRegisterRequest):
    """
    Register a new user (Player or Coach)
    
    - **name**: Full name of the user
    - **email**: Valid email address
    - **password**: Strong password (min 8 chars, uppercase, lowercase, digit)
    - **role**: PLAYER or COACH
    - **phone**: Optional phone number
    - **jersey_number**: Optional (for players)
    - **team**: Optional team name
    - **profile_bio**: Optional bio
    """
    # Check if user already exists
    existing_user = User.get_by_email(request.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    try:
        user = User(
            name=request.name,
            email=request.email,
            role=request.role,
            phone=request.phone,
            jersey_number=request.jersey_number,
            team=request.team,
            profile_bio=request.profile_bio,
            is_active=True,
            is_verified=False  # Email verification required
        )
        
        # Hash password
        user.set_password(request.password)
        
        # Generate email verification token
        verification_token = user.generate_email_verification_token()
        
        # Save user
        user.save()
        
        # TODO: Send verification email with token
        # send_verification_email(user.email, verification_token)
        
        return UserProfileResponse.model_validate(user)
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )

@router.post("/login", response_model=TokenResponse)
async def login(request: UserLoginRequest, http_request: Request):
    """
    Login with email and password
    
    Returns JWT access token and refresh token
    """
    # Get user by email
    user = User.get_by_email(request.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Check if account is locked
    if user.is_account_locked():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is locked due to too many failed login attempts. Try again later."
        )
    
    # Verify password
    if not user.verify_password(request.password):
        user.record_failed_login()
        user.save()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    # Record successful login
    user.record_login()
    user.save()
    
    # Create tokens
    access_token = create_access_token(user_id=str(user.id), role=user.role)
    refresh_token = create_refresh_token()
    
    # Store refresh token in database
    ip_address = http_request.client.host if http_request.client else None
    user_agent = http_request.headers.get("user-agent")
    
    UserSession.create_session(
        user_id=user.id,
        refresh_token=refresh_token,
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=1800  # 30 minutes
    )

@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(request: RefreshTokenRequest):
    """
    Refresh access token using refresh token
    """
    # Get session by refresh token
    session = UserSession.get_by_token(request.refresh_token)
    
    if not session or not session.is_valid():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    # Get user
    user = User.get_by_id(session.user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Create new access token
    access_token = create_access_token(user_id=str(user.id), role=user.role)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=request.refresh_token,  # Same refresh token
        token_type="bearer",
        expires_in=1800
    )

@router.post("/logout")
async def logout(request: RefreshTokenRequest):
    """
    Logout and revoke refresh token
    """
    session = UserSession.get_by_token(request.refresh_token)
    
    if session:
        session.revoke()
    
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user profile
    """
    return UserProfileResponse.model_validate(current_user)

@router.post("/verify-email")
async def verify_email(request: EmailVerificationRequest):
    """
    Verify user email with token
    """
    # Find user by verification token
    # TODO: Add method to find user by verification token
    # For now, this is a placeholder
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Email verification endpoint not fully implemented"
    )

@router.post("/password-reset/request")
async def request_password_reset(request: PasswordResetRequest):
    """
    Request password reset email
    """
    user = User.get_by_email(request.email)
    
    # Don't reveal if user exists
    if user:
        reset_token = user.generate_password_reset_token()
        user.save()
        
        # TODO: Send password reset email
        # send_password_reset_email(user.email, reset_token)
    
    return {"message": "If the email exists, a password reset link has been sent"}

@router.post("/password-reset/confirm")
async def confirm_password_reset(request: PasswordResetConfirm):
    """
    Reset password with token
    """
    # Find user by reset token
    # TODO: Add method to find user by reset token
    # For now, this is a placeholder
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Password reset confirmation endpoint not fully implemented"
    )
