"""
Run with: python -m app.seed
Populates the DB with a believable saree-shop dataset — an owner login,
a handful of products/variants, customers (some with dues), and a few
historical invoices — so the dashboard and reports don't look empty
on first run.

Login credentials are NEVER hardcoded here. Set them via env vars:
  VASTRA_OWNER_EMAIL, VASTRA_OWNER_PASSWORD
  VASTRA_STAFF_EMAIL, VASTRA_STAFF_PASSWORD

If a password env var isn't set, a random one is generated and printed
ONCE to this script's output (visible only in your own terminal / your
private Render build logs — never committed to git).
"""
import os
import secrets
import string

from sqlmodel import Session, select

from app.database import engine, create_db_and_tables
from app.models import (
    User, Role, Product, Variant, StockMovement, MovementType,
    Customer, Invoice, InvoiceItem, PaymentMode,
)
from app.auth import hash_password
from app.routers.billing import CGST_RATE, SGST_RATE


def _generate_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _resolve_credential(env_var: str, default: str | None = None, generate: bool = False) -> str:
    value = os.environ.get(env_var)
    if value:
        return value
    if default is not None:
        return default
    generated = _generate_password()
    print(f"[seed] {env_var} not set — generated a random value: {generated}")
    return generated


def seed():
    create_db_and_tables()
    with Session(engine) as session:
        if session.exec(select(User)).first():
            print("Database already seeded — skipping.")
            return

        owner_email = _resolve_credential("VASTRA_OWNER_EMAIL", default="owner@anushreevastralay.in")
        owner_password = _resolve_credential("VASTRA_OWNER_PASSWORD", generate=True)
        staff_email = _resolve_credential("VASTRA_STAFF_EMAIL", default="staff@anushreevastralay.in")
        staff_password = _resolve_credential("VASTRA_STAFF_PASSWORD", generate=True)

        owner = User(
            name="Anushree",
            email=owner_email,
            hashed_password=hash_password(owner_password),
            role=Role.owner,
        )
        staff = User(
            name="Shop Staff",
            email=staff_email,
            hashed_password=hash_password(staff_password),
            role=Role.staff,
        )
        session.add(owner)
        session.add(staff)
        session.commit()

        saree = Product(name="Banarasi Silk Saree", category="saree")
        dupatta = Product(name="Cotton Dupatta", category="dupatta")
        session.add(saree)
        session.add(dupatta)
        session.commit()
        session.refresh(saree)
        session.refresh(dupatta)

        variants_data = [
            dict(product_id=saree.id, fabric="Silk", color="Maroon", design_code="BNS-101", price=4200, stock_qty=8),
            dict(product_id=saree.id, fabric="Silk", color="Royal Blue", design_code="BNS-102", price=4500, stock_qty=2),
            dict(product_id=saree.id, fabric="Silk", color="Mustard", design_code="BNS-103", price=3900, stock_qty=5),
            dict(product_id=dupatta.id, fabric="Cotton", color="White", design_code="CTD-201", price=650, stock_qty=1),
            dict(product_id=dupatta.id, fabric="Cotton", color="Pink", design_code="CTD-202", price=700, stock_qty=12),
        ]

        variants = []
        for data in variants_data:
            variant = Variant(**data, low_stock_threshold=3)
            session.add(variant)
            variants.append(variant)
        session.commit()

        for v in variants:
            session.refresh(v)
            session.add(StockMovement(
                variant_id=v.id, type=MovementType.stock_in,
                quantity=v.stock_qty, reference="initial stock",
            ))
        session.commit()

        c1 = Customer(name="Priya Sharma", phone="9800000001", total_dues=4200.0)
        c2 = Customer(name="Lakshmi Iyer", phone="9800000002", total_dues=0.0)
        session.add(c1)
        session.add(c2)
        session.commit()
        session.refresh(c1)

        # One historical credit invoice that matches c1's dues, for a realistic ledger.
        line_total = variants[0].price * 1
        subtotal = line_total
        cgst = round(subtotal * CGST_RATE, 2)
        sgst = round(subtotal * SGST_RATE, 2)
        total = round(subtotal + cgst + sgst, 2)

        invoice = Invoice(
            customer_id=c1.id, payment_mode=PaymentMode.credit,
            subtotal=subtotal, cgst=cgst, sgst=sgst, total=total,
        )
        session.add(invoice)
        session.commit()
        session.refresh(invoice)

        session.add(InvoiceItem(
            invoice_id=invoice.id, variant_id=variants[0].id,
            quantity=1, unit_price=variants[0].price, line_total=line_total,
        ))
        session.commit()

        print("Seed complete.")
        print(f"Owner login: {owner_email}")
        print(f"Staff login: {staff_email}")
        print("(Passwords are not printed here unless they were auto-generated above — "
              "they're whatever you set in VASTRA_OWNER_PASSWORD / VASTRA_STAFF_PASSWORD.)")


if __name__ == "__main__":
    seed()
