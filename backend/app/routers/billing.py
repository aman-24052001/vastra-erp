from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import (
    Invoice, InvoiceItem, Variant, StockMovement, Customer,
    MovementType, PaymentMode, User, Role,
)
from app.schemas import InvoiceCreate
from app.auth import get_current_user, require_roles

router = APIRouter(prefix="/billing", tags=["billing"])

# Fixed v1 GST split — documented in the PRD as a deliberate scope decision.
# Real-world rates vary by HSN code; this models the common 5% apparel slab
# split evenly across CGST/SGST.
CGST_RATE = 0.025
SGST_RATE = 0.025


@router.get("/invoices")
def list_invoices(
    customer_id: Optional[int] = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    statement = select(Invoice)
    if customer_id:
        statement = statement.where(Invoice.customer_id == customer_id)
    return session.exec(statement.order_by(Invoice.created_at.desc())).all()


@router.get("/invoices/{invoice_id}")
def get_invoice(
    invoice_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    invoice = session.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    items = session.exec(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice_id)).all()
    return {"invoice": invoice, "items": items}


@router.post("/invoices")
def create_invoice(
    payload: InvoiceCreate,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.owner, Role.staff)),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Invoice must have at least one item")

    if payload.payment_mode == PaymentMode.credit and not payload.customer_id:
        raise HTTPException(status_code=400, detail="Credit sales require a customer")

    customer = None
    if payload.customer_id:
        customer = session.get(Customer, payload.customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

    # Validate stock availability up front before mutating anything.
    variants_by_id = {}
    for line in payload.items:
        variant = session.get(Variant, line.variant_id)
        if not variant:
            raise HTTPException(status_code=404, detail=f"Variant {line.variant_id} not found")
        if variant.stock_qty < line.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {variant.design_code} ({variant.color}): "
                       f"have {variant.stock_qty}, need {line.quantity}",
            )
        variants_by_id[line.variant_id] = variant

    subtotal = sum(variants_by_id[line.variant_id].price * line.quantity for line in payload.items)
    cgst = round(subtotal * CGST_RATE, 2)
    sgst = round(subtotal * SGST_RATE, 2)
    total = round(subtotal + cgst + sgst, 2)

    invoice = Invoice(
        customer_id=payload.customer_id,
        payment_mode=payload.payment_mode,
        subtotal=round(subtotal, 2),
        cgst=cgst,
        sgst=sgst,
        total=total,
    )
    session.add(invoice)
    session.commit()
    session.refresh(invoice)

    for line in payload.items:
        variant = variants_by_id[line.variant_id]
        line_total = round(variant.price * line.quantity, 2)

        session.add(InvoiceItem(
            invoice_id=invoice.id,
            variant_id=variant.id,
            quantity=line.quantity,
            unit_price=variant.price,
            line_total=line_total,
        ))

        variant.stock_qty -= line.quantity
        session.add(variant)

        session.add(StockMovement(
            variant_id=variant.id,
            type=MovementType.stock_out,
            quantity=line.quantity,
            reference=f"invoice #{invoice.id}",
        ))

    if payload.payment_mode == PaymentMode.credit and customer:
        customer.total_dues += total
        session.add(customer)

    session.commit()
    session.refresh(invoice)
    return invoice
