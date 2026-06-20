"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";
import { api, Variant, Customer, Invoice, ApiError } from "@/lib/api";

const CGST_RATE = 0.025;
const SGST_RATE = 0.025;

interface CartLine {
  variant: Variant;
  quantity: number;
}

function BillingContent() {
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Variant[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);

  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "credit">("cash");

  const [error, setError] = useState("");
  const [lastInvoice, setLastInvoice] = useState<Invoice | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!session || !search) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api.listVariants(session.token, { search }).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [session, search]);

  useEffect(() => {
    if (!session || !customerSearch) {
      setCustomers([]);
      return;
    }
    const t = setTimeout(() => {
      api.listCustomers(session.token, customerSearch).then(setCustomers).catch(() => setCustomers([]));
    }, 250);
    return () => clearTimeout(t);
  }, [session, customerSearch]);

  const addToCart = (variant: Variant) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.variant.id === variant.id);
      if (existing) {
        return prev.map((l) =>
          l.variant.id === variant.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { variant, quantity: 1 }];
    });
  };

  const updateQty = (variantId: number, quantity: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.variant.id === variantId ? { ...l, quantity } : l))
        .filter((l) => l.quantity > 0)
    );
  };

  const removeLine = (variantId: number) => {
    setCart((prev) => prev.filter((l) => l.variant.id !== variantId));
  };

  const subtotal = cart.reduce((s, l) => s + l.variant.price * l.quantity, 0);
  const cgst = Math.round(subtotal * CGST_RATE * 100) / 100;
  const sgst = Math.round(subtotal * SGST_RATE * 100) / 100;
  const total = Math.round((subtotal + cgst + sgst) * 100) / 100;

  const handleCheckout = async () => {
    if (!session || cart.length === 0) return;
    if (paymentMode === "credit" && !selectedCustomer) {
      setError("Credit sales need a customer selected first");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const invoice = await api.createInvoice(session.token, {
        customer_id: selectedCustomer?.id ?? null,
        payment_mode: paymentMode,
        items: cart.map((l) => ({ variant_id: l.variant.id, quantity: l.quantity })),
      });
      setLastInvoice(invoice);
      setCart([]);
      setSelectedCustomer(null);
      setCustomerSearch("");
      setPaymentMode("cash");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create invoice");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <h1 className="text-2xl font-extrabold mb-4">New Sale</h1>
        <input
          className="brutal-input w-full mb-3"
          placeholder="Search design code, color, fabric…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {results.length > 0 && (
          <div className="brutal-panel mb-6">
            {results.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3 border-b border-ink/20 last:border-b-0">
                <div>
                  <p className="font-bold">{v.design_code} — {v.color}</p>
                  <p className="text-xs opacity-70">{v.fabric} · {v.size} · ₹{v.price} · {v.stock_qty} in stock</p>
                </div>
                <button
                  onClick={() => addToCart(v)}
                  disabled={v.stock_qty === 0}
                  className="brutal-btn-accent px-3 py-1 text-xs disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        )}

        <h2 className="font-bold uppercase text-sm mb-2">Cart</h2>
        <div className="brutal-panel">
          {cart.length === 0 ? (
            <p className="p-4 text-sm opacity-60">Cart is empty — search and add items above.</p>
          ) : (
            cart.map((l) => (
              <div key={l.variant.id} className="flex items-center justify-between p-3 border-b border-ink/20 last:border-b-0">
                <div>
                  <p className="font-bold text-sm">{l.variant.design_code} — {l.variant.color}</p>
                  <p className="text-xs opacity-70">₹{l.variant.price} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={l.variant.stock_qty}
                    value={l.quantity}
                    onChange={(e) => updateQty(l.variant.id, Number(e.target.value))}
                    className="brutal-input w-16 py-1 text-sm"
                  />
                  <span className="text-sm font-bold w-20 text-right">
                    ₹{(l.variant.price * l.quantity).toLocaleString()}
                  </span>
                  <button onClick={() => removeLine(l.variant.id)} className="text-accent-deep font-bold text-xs">
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h2 className="font-bold uppercase text-sm mb-2">Customer (optional)</h2>
        <div className="brutal-panel p-3 mb-4">
          {selectedCustomer ? (
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">{selectedCustomer.name} · {selectedCustomer.phone}</span>
              <button onClick={() => setSelectedCustomer(null)} className="text-accent-deep text-xs font-bold">
                ✕
              </button>
            </div>
          ) : (
            <>
              <input
                className="brutal-input w-full mb-2"
                placeholder="Search name or phone…"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
              {customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); setCustomers([]); }}
                  className="block w-full text-left text-sm py-1 hover:text-accent"
                >
                  {c.name} · {c.phone}
                </button>
              ))}
            </>
          )}
        </div>

        <h2 className="font-bold uppercase text-sm mb-2">Payment</h2>
        <div className="brutal-panel p-3 mb-4 flex gap-2">
          {(["cash", "upi", "credit"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setPaymentMode(mode)}
              className={`flex-1 py-1.5 text-xs font-bold uppercase border-2 border-ink ${
                paymentMode === mode ? "bg-ink text-cream" : ""
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="brutal-panel p-4 mb-4">
          <div className="flex justify-between text-sm mb-1"><span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
          <div className="flex justify-between text-sm mb-1 opacity-70"><span>CGST (2.5%)</span><span>₹{cgst.toLocaleString()}</span></div>
          <div className="flex justify-between text-sm mb-2 opacity-70"><span>SGST (2.5%)</span><span>₹{sgst.toLocaleString()}</span></div>
          <div className="flex justify-between font-extrabold text-lg border-t-2 border-ink pt-2">
            <span>Total</span><span>₹{total.toLocaleString()}</span>
          </div>
        </div>

        {error && <p className="text-accent-deep font-bold text-sm mb-3">{error}</p>}

        <button
          onClick={handleCheckout}
          disabled={cart.length === 0 || submitting}
          className="brutal-btn-accent w-full py-3 disabled:opacity-40"
        >
          {submitting ? "Processing…" : "Generate Invoice"}
        </button>

        {lastInvoice && (
          <div className="brutal-panel p-4 mt-4">
            <p className="font-bold text-sm mb-1">Invoice #{lastInvoice.id} created ✓</p>
            <p className="text-sm">Total: ₹{lastInvoice.total.toLocaleString()} ({lastInvoice.payment_mode})</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <RequireAuth>
      <Navbar />
      <BillingContent />
    </RequireAuth>
  );
}
