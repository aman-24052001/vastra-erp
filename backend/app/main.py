from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_db_and_tables
from app.routers import auth, inventory, customers, billing, dashboard

app = FastAPI(
    title="Vastra ERP",
    description="Apparel retail ERP — variant inventory, GST billing, customer dues ledger.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(inventory.router)
app.include_router(customers.router)
app.include_router(billing.router)
app.include_router(dashboard.router)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.get("/")
def root():
    return {"service": "vastra-erp-backend", "status": "ok"}
