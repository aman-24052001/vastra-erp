from typing import Optional, List
from pydantic import BaseModel

from app.models import Role, PaymentMode, MovementType


# ---------- Auth ----------

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: Role = Role.staff


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Role
    name: str


# ---------- Inventory ----------

class ProductCreate(BaseModel):
    name: str
    category: str = "saree"


class VariantCreate(BaseModel):
    product_id: int
    fabric: str
    color: str
    design_code: str
    size: str = "standard"
    price: float
    stock_qty: int = 0
    low_stock_threshold: int = 3


class VariantUpdate(BaseModel):
    price: Optional[float] = None
    low_stock_threshold: Optional[int] = None


class StockMovementCreate(BaseModel):
    variant_id: int
    type: MovementType
    quantity: int
    reference: str = "manual adjustment"


# ---------- Customers ----------

class CustomerCreate(BaseModel):
    name: str
    phone: str


class DuesPaymentCreate(BaseModel):
    amount: float


# ---------- Billing ----------

class InvoiceLineIn(BaseModel):
    variant_id: int
    quantity: int


class InvoiceCreate(BaseModel):
    customer_id: Optional[int] = None
    payment_mode: PaymentMode
    items: List[InvoiceLineIn]
