# Vastra ERP — Apparel Retail ERP
**One-liner:** A login-protected, multi-role ERP for an apparel/saree retail business — inventory by variant, GST billing, customer dues ledger, and reporting, in the spirit of BlueCherry/SAP but scoped for a real SMB.

---

## 1. Problem
Saree/apparel retail has specific operational pain points generic POS or inventory tools don't handle well:
- Stock isn't one SKU — it's fabric × color × design × size combinations
- Customers often buy on credit ("khata") — dues need tracking, not just sales
- GST-compliant billing is mandatory, not optional
- Owners need a quick read on what's selling and what's dead stock

Vastra ERP is built around these realities instead of being a generic "products + cart" app.

## 2. Why this beats a generic clone
- Real domain modeling (variant matrix, credit ledger) — not learnable from a tutorial
- Full-stack ownership: auth, roles, DB design, reporting — not just a CRUD wrapper
- A working business behind it — demoable with real-sounding data, not seeded placeholder text
- Frontend stack (Next.js/TS/Tailwind) matches what frontend-internship JDs actually ask for; backend (Python/FastAPI) is a legitimate, modern, in-demand choice

## 3. Target users (roles)
- **Owner** — full access, reports, user management
- **Staff** — billing, inventory lookup, customer ledger entry
- **Accountant** — reports, dues, GST exports (read-mostly)

## 4. Core modules

### 4.1 Inventory
- Variant matrix: fabric type × color × design code × size → stock count
- Low-stock threshold alerts
- Stock-in (from supplier) / stock-out (sale) movement log

### 4.2 Billing / POS
- Search item by name/code/variant
- Cart → GST-compliant invoice (CGST/SGST split)
- Print or share invoice (WhatsApp link/PDF)
- Payment mode: cash / UPI / credit (adds to customer ledger)

### 4.3 Customer ledger
- Purchase history per customer
- Outstanding dues, partial payments, due-date reminders
- Searchable by name/phone

### 4.4 Procurement
- Supplier directory
- Purchase orders → received stock updates inventory automatically

### 4.5 Reports & dashboard
- Sales trend (daily/weekly/monthly)
- Top-selling variants, dead stock (no movement in X days)
- Dues aging report
- GST summary export

### 4.6 Auth & roles
- Login (email/password or phone OTP)
- Role-based access control
- Audit log on edits (who changed what, when)

## 5. Core user flow (billing — the primary loop)
1. Staff logs in
2. Searches a saree by design code or browses variant matrix
3. Adds to cart, system shows live stock check
4. Selects payment mode — if credit, links to customer record
5. Invoice generated (GST split shown), printed/shared
6. Inventory and customer ledger update automatically
7. Owner later sees this reflected in the dashboard, same day

## 6. MVP feature list (v1)
- Auth + roles (owner/staff)
- Inventory CRUD with variant matrix
- Billing flow with GST invoice generation
- Customer ledger with dues tracking
- Basic dashboard (today's sales, low stock, top dues)

## 7. Stretch features (v2)
- Accountant role + GST export
- Supplier/PO module
- Barcode/QR scan for billing
- WhatsApp invoice auto-send
- Multi-store support

## 8. Tech stack
- **Backend:** Python, FastAPI, SQLModel/SQLAlchemy, Pydantic for validation, JWT auth
- **DB:** PostgreSQL
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Charts/reports:** Recharts
- **Deploy:** Backend → Railway/Render, Frontend → Vercel, DB → Neon/Supabase
- **Docs:** FastAPI auto-generates OpenAPI/Swagger — good artifact to show in interviews

## 9. Data model (entities)
- **User** — id, name, role, credentials
- **Product** — id, name, category (e.g., saree, dupatta)
- **Variant** — productId, fabric, color, design code, size, stock count
- **StockMovement** — variantId, type (in/out), quantity, timestamp, reference (PO or invoice)
- **Customer** — id, name, phone, total dues
- **Invoice** — id, customerId (nullable for walk-in), items, GST breakdown, paymentMode, status
- **Supplier** — id, name, contact
- **PurchaseOrder** — id, supplierId, items, status

## 10. Suggested build timeline (5–6 weeks)
- **Week 1:** Auth + roles + DB schema + basic inventory CRUD
- **Week 2:** Variant matrix UI + stock movement logic
- **Week 3:** Billing flow + GST invoice generation
- **Week 4:** Customer ledger + dues tracking
- **Week 5:** Dashboard + reports
- **Week 6:** Polish, deploy, demo video, README

## 11. How to talk about it in interviews
- Lead with the domain modeling decision: "stock isn't a flat SKU — it's a variant matrix, which is closer to how real apparel retail works."
- Mention the credit-ledger design as evidence of understanding a real business constraint, not just textbook e-commerce.
- FastAPI's auto-generated API docs are a quick way to show backend rigor without reading code line by line.

## 12. Risks / mitigations
- **Scope creep into "build SAP"** → hard-stop at the v1 module list above; everything else is v2.
- **GST calculation correctness** → use a fixed, documented CGST/SGST split for v1 rather than full tax-rule coverage.
- **Demo data feeling fake** → seed with realistic saree names/codes/prices, not "Product 1, Product 2."
