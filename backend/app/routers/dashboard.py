from datetime import datetime, timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.database import get_session
from app.models import Invoice, InvoiceItem, Variant, Customer, User
from app.auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def get_summary(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    all_invoices = session.exec(select(Invoice)).all()
    today_invoices = [i for i in all_invoices if i.created_at >= today_start]
    today_sales_total = round(sum(i.total for i in today_invoices), 2)

    variants = session.exec(select(Variant)).all()
    low_stock = [v for v in variants if v.stock_qty <= v.low_stock_threshold]

    customers = session.exec(select(Customer)).all()
    top_dues = sorted(
        [c for c in customers if c.total_dues > 0],
        key=lambda c: c.total_dues,
        reverse=True,
    )[:5]

    # Top-selling variants by quantity, all-time (good enough for a v1 dashboard).
    items = session.exec(select(InvoiceItem)).all()
    qty_by_variant: dict[int, int] = defaultdict(int)
    for item in items:
        qty_by_variant[item.variant_id] += item.quantity

    variants_by_id = {v.id: v for v in variants}
    top_selling = sorted(qty_by_variant.items(), key=lambda kv: kv[1], reverse=True)[:5]
    top_selling_resolved = [
        {
            "variant_id": vid,
            "design_code": variants_by_id[vid].design_code if vid in variants_by_id else "deleted",
            "color": variants_by_id[vid].color if vid in variants_by_id else "",
            "quantity_sold": qty,
        }
        for vid, qty in top_selling
    ]

    return {
        "today_sales_total": today_sales_total,
        "today_invoice_count": len(today_invoices),
        "low_stock_count": len(low_stock),
        "low_stock_variants": low_stock[:10],
        "top_dues_customers": top_dues,
        "top_selling_variants": top_selling_resolved,
    }
