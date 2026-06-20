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


class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: Role = Role.staff


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[Role] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


# ---------- Inventory ----------

class ProductCreate(BaseModel):
    name: str
    category: str = "saree"


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None


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
    fabric: Optional[str] = None
    color: Optional[str] = None
    design_code: Optional[str] = None
    size: Optional[str] = None
    price: Optional[float] = None
    low_stock_threshold: Optional[int] = None
    is_active: Optional[bool] = None


class StockMovementCreate(BaseModel):
    variant_id: int
    type: MovementType
    quantity: int
    reference: str = "manual adjustment"


# ---------- Customers ----------

class CustomerCreate(BaseModel):
    name: str
    phone: str
    photo: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None


class CustomerPhotoUpdate(BaseModel):
    photo: str


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
