from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import Customer, DuesPayment, Invoice, User, Role
from app.schemas import CustomerCreate, DuesPaymentCreate
from app.auth import get_current_user, require_roles

router = APIRouter(prefix="/customers", tags=["customers"])


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
    return customers


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
