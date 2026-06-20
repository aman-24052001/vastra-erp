from datetime import datetime
from typing import Optional, List
from enum import Enum

from sqlmodel import SQLModel, Field, Relationship


class Role(str, Enum):
    owner = "owner"
    staff = "staff"
    accountant = "accountant"


class PaymentMode(str, Enum):
    cash = "cash"
    upi = "upi"
    credit = "credit"


class MovementType(str, Enum):
    stock_in = "in"
    stock_out = "out"


# ---------- Users ----------

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(index=True, unique=True)
    hashed_password: str
    role: Role = Field(default=Role.staff)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ---------- Products & Variants ----------

class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    category: str = Field(default="saree")  # saree, dupatta, blouse-piece, etc.

    variants: List["Variant"] = Relationship(back_populates="product")


class Variant(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="product.id")
    fabric: str
    color: str
    design_code: str = Field(index=True)
    size: str = Field(default="standard")
    price: float
    stock_qty: int = Field(default=0)
    low_stock_threshold: int = Field(default=3)
    is_active: bool = Field(default=True)  # discontinued variants are hidden, not deleted

    product: Optional[Product] = Relationship(back_populates="variants")


class StockMovement(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    variant_id: int = Field(foreign_key="variant.id")
    type: MovementType
    quantity: int
    reference: str = Field(default="")  # e.g. invoice number or "manual restock"
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ---------- Customers ----------

class Customer(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    phone: str = Field(index=True)
    total_dues: float = Field(default=0.0)
    photo: Optional[str] = Field(default=None)  # base64 data URL, client-compressed before upload
    created_at: datetime = Field(default_factory=datetime.utcnow)


class DuesPayment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    customer_id: int = Field(foreign_key="customer.id")
    amount: float
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ---------- Billing ----------

class Invoice(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    customer_id: Optional[int] = Field(default=None, foreign_key="customer.id")
    payment_mode: PaymentMode
    subtotal: float
    cgst: float
    sgst: float
    total: float
    created_at: datetime = Field(default_factory=datetime.utcnow)

    items: List["InvoiceItem"] = Relationship(back_populates="invoice")


class InvoiceItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    invoice_id: int = Field(foreign_key="invoice.id")
    variant_id: int = Field(foreign_key="variant.id")
    quantity: int
    unit_price: float
    line_total: float

    invoice: Optional[Invoice] = Relationship(back_populates="items")
