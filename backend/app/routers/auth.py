from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import User, Role
from app.schemas import RegisterRequest, LoginRequest, TokenResponse, UserCreate, UserUpdate
from app.auth import hash_password, verify_password, create_access_token, get_current_user, require_roles

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, session: Session = Depends(get_session)):
    """
    Bootstrap-only. This creates the FIRST account (always as owner) when the
    database is empty. Once any user exists, this endpoint is closed — every
    subsequent account must be created by an owner via POST /auth/users.

    (Previously this trusted a client-supplied `role` field for every
    registration after the first, which meant anyone with the URL could
    self-register as `owner` or `accountant`. That's now impossible.)
    """
    any_user_exists = session.exec(select(User)).first()
    if any_user_exists:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is closed. Ask an owner to create your account.",
        )

    existing = session.exec(select(User).where(User.email == payload.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=Role.owner,  # the bootstrap account is always the owner, regardless of payload.role
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, role=user.role, name=user.name)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == payload.email)).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been disabled")

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, role=user.role, name=user.name)


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}


@router.get("/users")
def list_users(user: User = Depends(require_roles(Role.owner)), session: Session = Depends(get_session)):
    users = session.exec(select(User)).all()
    return [
        {"id": u.id, "name": u.name, "email": u.email, "role": u.role, "is_active": u.is_active}
        for u in users
    ]


@router.post("/users")
def create_staff_user(
    payload: UserCreate,
    owner: User = Depends(require_roles(Role.owner)),
    session: Session = Depends(get_session),
):
    """Owner-only: provision a new staff/accountant (or owner) account."""
    existing = session.exec(select(User).where(User.email == payload.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "is_active": user.is_active}


@router.patch("/users/{user_id}")
def update_staff_user(
    user_id: int,
    payload: UserUpdate,
    owner: User = Depends(require_roles(Role.owner)),
    session: Session = Depends(get_session),
):
    """Owner-only: change a user's name/role/active-status, or reset their password."""
    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.id == owner.id and payload.is_active is False:
        raise HTTPException(status_code=400, detail="You can't deactivate your own account")
    if target.id == owner.id and payload.role is not None and payload.role != Role.owner:
        raise HTTPException(status_code=400, detail="You can't change your own role")

    update_data = payload.dict(exclude_unset=True, exclude={"password"})
    for key, value in update_data.items():
        setattr(target, key, value)
    if payload.password:
        target.hashed_password = hash_password(payload.password)

    session.add(target)
    session.commit()
    session.refresh(target)
    return {"id": target.id, "name": target.name, "email": target.email, "role": target.role, "is_active": target.is_active}
