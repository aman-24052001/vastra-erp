from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import Product, Variant, StockMovement, MovementType, User, Role
from app.schemas import ProductCreate, ProductUpdate, VariantCreate, VariantUpdate, StockMovementCreate
from app.auth import get_current_user, require_roles

router = APIRouter(prefix="/inventory", tags=["inventory"])


# ---------- Products ----------

@router.get("/products")
def list_products(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    return session.exec(select(Product)).all()


@router.post("/products")
def create_product(
    payload: ProductCreate,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.owner, Role.staff)),
):
    product = Product(**payload.dict())
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


@router.patch("/products/{product_id}")
def update_product(
    product_id: int,
    payload: ProductUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.owner, Role.staff)),
):
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = payload.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    for key, value in update_data.items():
        setattr(product, key, value)

    session.add(product)
    session.commit()
    session.refresh(product)
    return product


# ---------- Variants ----------

@router.get("/variants")
def list_variants(
    low_stock_only: bool = False,
    search: Optional[str] = None,
    show_inactive: bool = False,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    statement = select(Variant)
    variants = session.exec(statement).all()

    if not show_inactive:
        variants = [v for v in variants if v.is_active]

    if search:
        s = search.lower()
        variants = [
            v for v in variants
            if s in v.design_code.lower() or s in v.color.lower() or s in v.fabric.lower()
        ]

    if low_stock_only:
        variants = [v for v in variants if v.stock_qty <= v.low_stock_threshold]

    return variants


@router.post("/variants")
def create_variant(
    payload: VariantCreate,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.owner, Role.staff)),
):
    product = session.get(Product, payload.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    variant = Variant(**payload.dict())
    session.add(variant)
    session.commit()
    session.refresh(variant)

    if variant.stock_qty > 0:
        session.add(StockMovement(
            variant_id=variant.id,
            type=MovementType.stock_in,
            quantity=variant.stock_qty,
            reference="initial stock",
        ))
        session.commit()

    return variant


@router.patch("/variants/{variant_id}")
def update_variant(
    variant_id: int,
    payload: VariantUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.owner, Role.staff)),
):
    variant = session.get(Variant, variant_id)
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(variant, key, value)

    session.add(variant)
    session.commit()
    session.refresh(variant)
    return variant


# ---------- Stock movements ----------

@router.get("/stock-movements")
def list_stock_movements(
    variant_id: Optional[int] = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    statement = select(StockMovement)
    if variant_id:
        statement = statement.where(StockMovement.variant_id == variant_id)
    return session.exec(statement.order_by(StockMovement.created_at.desc())).all()


@router.post("/stock-movements")
def create_stock_movement(
    payload: StockMovementCreate,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.owner, Role.staff)),
):
    variant = session.get(Variant, payload.variant_id)
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    if payload.type == MovementType.stock_out and variant.stock_qty < payload.quantity:
        raise HTTPException(status_code=400, detail="Not enough stock for this movement")

    delta = payload.quantity if payload.type == MovementType.stock_in else -payload.quantity
    variant.stock_qty += delta

    movement = StockMovement(
        variant_id=variant.id,
        type=payload.type,
        quantity=payload.quantity,
        reference=payload.reference,
    )

    session.add(variant)
    session.add(movement)
    session.commit()
    session.refresh(movement)
    return movement
