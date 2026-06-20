"use client";

import { useEffect, useState, useCallback } from "react";
import RequireAuth from "@/components/RequireAuth";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";
import { api, Customer, Invoice, ApiError } from "@/lib/api";

interface Ledger {
  customer: Customer;
  outstanding_dues: number;
  invoices: Invoice[];
  payments: { id: number; amount: number; created_at: string }[];
}

function CustomersContent() {
  const { session } = useAuth();
  const canEdit = session?.role === "owner" || session?.role === "staff";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [error, setError] = useState("");

  const loadCustomers = useCallback(async () => {
    if (!session) return;
    try {
      setCustomers(await api.listCustomers(session.token, search || undefined));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load customers");
    }
  }, [session, search]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const loadLedger = useCallback(async (id: number) => {
    if (!session) return;
    try {
      setLedger(await api.getCustomerLedger(session.token, id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load ledger");
    }
  }, [session]);

  useEffect(() => {
    if (selectedId) loadLedger(selectedId);
  }, [selectedId, loadLedger]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setError("");
    try {
      const c = await api.createCustomer(session.token, newName, newPhone);
      setNewName("");
      setNewPhone("");
      setShowForm(false);
      await loadCustomers();
      setSelectedId(c.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create customer");
    }
  };

  const handleRecordPayment = async () => {
    if (!session || !selectedId || !paymentAmount) return;
    setError("");
    try {
      await api.recordDuesPayment(session.token, selectedId, Number(paymentAmount));
      setPaymentAmount("");
      await loadLedger(selectedId);
      await loadCustomers();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not record payment");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-extrabold">Customers</h1>
          {canEdit && (
            <button onClick={() => setShowForm((s) => !s)} className="brutal-btn-accent px-3 py-1.5 text-xs">
              {showForm ? "Cancel" : "+ Add"}
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleAddCustomer} className="brutal-panel p-4 mb-4 space-y-2">
            <input
              required
              placeholder="Name"
              className="brutal-input w-full"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              required
              placeholder="Phone"
              className="brutal-input w-full"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
            <button type="submit" className="brutal-btn w-full py-1.5 text-sm">Save</button>
          </form>
        )}

        <input
          className="brutal-input w-full mb-3"
          placeholder="Search name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="brutal-panel">
          {customers.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`block w-full text-left p-3 border-b border-ink/20 last:border-b-0 ${
                selectedId === c.id ? "bg-accent text-cream" : "hover:bg-ink/5"
              }`}
            >
              <p className="font-bold text-sm">{c.name}</p>
              <p className="text-xs opacity-80">{c.phone}</p>
              {c.total_dues > 0 && (
                <p className="text-xs font-bold mt-0.5">Dues: ₹{c.total_dues.toLocaleString()}</p>
              )}
            </button>
          ))}
          {customers.length === 0 && <p className="p-4 text-sm opacity-60">No customers yet.</p>}
        </div>
      </div>

      <div className="lg:col-span-2">
        {error && <p className="text-accent-deep font-bold mb-4">{error}</p>}

        {!ledger ? (
          <div className="brutal-panel p-8 text-center opacity-60">
            Select a customer to view their ledger.
          </div>
        ) : (
          <div>
            <div className="brutal-panel p-5 mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold">{ledger.customer.name}</h2>
                <p className="text-sm opacity-70">{ledger.customer.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase font-bold opacity-70">Outstanding</p>
                <p className="text-2xl font-extrabold text-accent-deep">
                  ₹{ledger.outstanding_dues.toLocaleString()}
                </p>
              </div>
            </div>

            {canEdit && ledger.outstanding_dues > 0 && (
              <div className="brutal-panel p-4 mb-4 flex items-center gap-2">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Amount received"
                  className="brutal-input flex-1"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
                <button onClick={handleRecordPayment} className="brutal-btn px-4 py-2 text-sm">
                  Record Payment
                </button>
              </div>
            )}

            <h3 className="font-bold uppercase text-sm mb-2">Invoice History</h3>
            <div className="brutal-panel mb-4">
              {ledger.invoices.length === 0 ? (
                <p className="p-4 text-sm opacity-60">No invoices yet.</p>
              ) : (
                ledger.invoices.map((inv) => (
                  <div key={inv.id} className="flex justify-between p-3 border-b border-ink/20 last:border-b-0 text-sm">
                    <span>Invoice #{inv.id} · {inv.payment_mode} · {new Date(inv.created_at).toLocaleDateString()}</span>
                    <span className="font-bold">₹{inv.total.toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>

            <h3 className="font-bold uppercase text-sm mb-2">Payments Received</h3>
            <div className="brutal-panel">
              {ledger.payments.length === 0 ? (
                <p className="p-4 text-sm opacity-60">No payments recorded yet.</p>
              ) : (
                ledger.payments.map((p) => (
                  <div key={p.id} className="flex justify-between p-3 border-b border-ink/20 last:border-b-0 text-sm">
                    <span>{new Date(p.created_at).toLocaleDateString()}</span>
                    <span className="font-bold text-ok">₹{p.amount.toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomersPage() {
  return (
    <RequireAuth>
      <Navbar />
      <CustomersContent />
    </RequireAuth>
  );
}
