from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import Customer, DuesPayment, Invoice, PaymentMode, User, Role
from app.schemas import CustomerCreate, CustomerUpdate, CustomerPhotoUpdate, DuesPaymentCreate
from app.auth import get_current_user, require_roles

router = APIRouter(prefix="/customers", tags=["customers"])


def _compute_aging(session: Session, customer_id: int, outstanding_dues: float):
    """Days since the customer's last relevant activity, plus a label and an
    urgency bucket (ok / warn / urgent) for UI colour-coding. Mirrors the
    aging logic from the anushree-vastralaya khata app: use the last payment
    date if one exists, otherwise fall back to the last credit sale date."""
    if outstanding_dues <= 0:
        return None

    last_payment = session.exec(
        select(DuesPayment).where(DuesPayment.customer_id == customer_id).order_by(DuesPayment.created_at.desc())
    ).first()
    last_credit_sale = session.exec(
        select(Invoice)
        .where(Invoice.customer_id == customer_id, Invoice.payment_mode == PaymentMode.credit)
        .order_by(Invoice.created_at.desc())
    ).first()

    ref_date, basis = None, None
    if last_payment:
        ref_date, basis = last_payment.created_at, "payment"
    elif last_credit_sale:
        ref_date, basis = last_credit_sale.created_at, "sale"

    if not ref_date:
        return None

    days = (datetime.utcnow() - ref_date).days
    urgency = "ok" if days < 14 else ("warn" if days < 30 else "urgent")
    label = f"Last payment {days}d ago" if basis == "payment" else f"Owing for {days}d"
    return {"days": days, "label": label, "urgency": urgency}


@router.get("")
def list_customers(
    search: Optional[str] = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    customers = session.exec(select(Customer)).all()
    if search:
        s = search.lower()
        customers = [c for c in customers if s in c.name.lower() or s in c.phone]

    result = []
    for c in customers:
        result.append({**c.dict(), "aging": _compute_aging(session, c.id, c.total_dues)})
    return result


@router.post("")
def create_customer(
    payload: CustomerCreate,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.owner, Role.staff)),
):
    customer = Customer(**payload.dict())
    session.add(customer)
    session.commit()
    session.refresh(customer)
    return customer


@router.get("/{customer_id}")
def get_customer(
    customer_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    customer = session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.patch("/{customer_id}")
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.owner)),
):
    customer = session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = payload.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    for key, value in update_data.items():
        setattr(customer, key, value)

    session.add(customer)
    session.commit()
    session.refresh(customer)
    return customer


@router.patch("/{customer_id}/photo")
def update_customer_photo(
    customer_id: int,
    payload: CustomerPhotoUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.owner, Role.staff)),
):
    customer = session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer.photo = payload.photo
    session.add(customer)
    session.commit()
    session.refresh(customer)
    return customer


@router.get("/{customer_id}/ledger")
def get_customer_ledger(
    customer_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    customer = session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    invoices = session.exec(
        select(Invoice).where(Invoice.customer_id == customer_id).order_by(Invoice.created_at.desc())
    ).all()
    payments = session.exec(
        select(DuesPayment).where(DuesPayment.customer_id == customer_id).order_by(DuesPayment.created_at.desc())
    ).all()

    return {
        "customer": customer,
        "outstanding_dues": customer.total_dues,
        "aging": _compute_aging(session, customer_id, customer.total_dues),
        "invoices": invoices,
        "payments": payments,
    }


@router.post("/{customer_id}/payments")
def record_dues_payment(
    customer_id: int,
    payload: DuesPaymentCreate,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.owner, Role.staff, Role.accountant)),
):
    customer = session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be positive")

    customer.total_dues = max(0.0, customer.total_dues - payload.amount)
    payment = DuesPayment(customer_id=customer_id, amount=payload.amount)

    session.add(customer)
    session.add(payment)
    session.commit()
    session.refresh(payment)
    return payment
