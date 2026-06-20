"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import RequireAuth from "@/components/RequireAuth";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";
import { api, Customer, Invoice, AgingInfo, ApiError } from "@/lib/api";
import { compressImage } from "@/lib/image";

const SHOP_NAME = "Anushree Vastralaya";

interface Ledger {
  customer: Customer;
  outstanding_dues: number;
  aging: AgingInfo | null;
  invoices: Invoice[];
  payments: { id: number; amount: number; created_at: string }[];
}

function agingBadgeClasses(urgency: AgingInfo["urgency"]) {
  if (urgency === "urgent") return "bg-accent text-cream border-ink";
  if (urgency === "warn") return "bg-warn text-cream border-ink";
  return "bg-ok text-cream border-ink";
}

function waReminderUrl(phone: string, name: string, dues: number) {
  const amt = dues.toLocaleString("en-IN");
  const msg =
    `Namaste ${name} ji,\n\n` +
    `Your outstanding balance is ₹${amt}.\n` +
    `Kindly make the payment at your earliest convenience.\n\n` +
    `Thank you,\n${SHOP_NAME}`;
  return `https://wa.me/91${phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
}

function Avatar({ photo, name, size = 40 }: { photo: string | null; name: string; size?: number }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={photo}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="object-cover border-2 border-ink"
      />
    );
  }
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      style={{ width: size, height: size }}
      className="border-2 border-ink bg-accent text-cream flex items-center justify-center font-extrabold"
    >
      {initial}
    </div>
  );
}

function CustomersContent() {
  const { session } = useAuth();
  const canEdit = session?.role === "owner" || session?.role === "staff";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPhoto, setNewPhoto] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [error, setError] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const newPhotoInputRef = useRef<HTMLInputElement>(null);
  const ledgerPhotoInputRef = useRef<HTMLInputElement>(null);

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
    setEditing(false);
  }, [selectedId, loadLedger]);

  const handleNewPhotoSelected = async (file: File | undefined) => {
    if (!file) return;
    try {
      setNewPhoto(await compressImage(file));
    } catch {
      setError("Could not process that photo — try a different one.");
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setError("");
    try {
      const c = await api.createCustomer(session.token, newName, newPhone, newPhoto);
      setNewName("");
      setNewPhone("");
      setNewPhoto(null);
      setShowForm(false);
      await loadCustomers();
      setSelectedId(c.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create customer");
    }
  };

  const handleLedgerPhotoSelected = async (file: File | undefined) => {
    if (!file || !session || !selectedId) return;
    setUploadingPhoto(true);
    setError("");
    try {
      const photo = await compressImage(file);
      await api.updateCustomerPhoto(session.token, selectedId, photo);
      await loadLedger(selectedId);
      await loadCustomers();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleStartEdit = () => {
    if (!ledger) return;
    setEditName(ledger.customer.name);
    setEditPhone(ledger.customer.phone);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!session || !selectedId) return;
    setSavingEdit(true);
    setError("");
    try {
      await api.updateCustomer(session.token, selectedId, { name: editName, phone: editPhone });
      setEditing(false);
      await loadLedger(selectedId);
      await loadCustomers();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update customer");
    } finally {
      setSavingEdit(false);
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
            <div className="flex items-center gap-3">
              <Avatar photo={newPhoto} name={newName || "?"} size={48} />
              <div className="flex-1 space-y-2">
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
              </div>
            </div>

            <input
              ref={newPhotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleNewPhotoSelected(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => newPhotoInputRef.current?.click()}
              className="brutal-btn w-full py-1.5 text-xs"
            >
              📷 {newPhoto ? "Retake Photo" : "Take Photo"}
            </button>

            <button type="submit" className="brutal-btn-accent w-full py-1.5 text-sm">Save</button>
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
              className={`flex items-center gap-3 w-full text-left p-3 border-b border-ink/20 last:border-b-0 ${
                selectedId === c.id ? "bg-accent text-cream" : "hover:bg-ink/5"
              }`}
            >
              <Avatar photo={c.photo} name={c.name} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{c.name}</p>
                <p className="text-xs opacity-80">{c.phone}</p>
                {c.total_dues > 0 && (
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-xs font-bold">₹{c.total_dues.toLocaleString()}</span>
                    {c.aging && (
                      <span className={`brutal-badge ${agingBadgeClasses(c.aging.urgency)}`}>
                        {c.aging.days}d
                      </span>
                    )}
                  </div>
                )}
              </div>
              <a
                href={`tel:${c.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="brutal-btn px-2 py-1.5 text-sm shrink-0"
                title="Call"
              >
                📞
              </a>
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
            <div className="brutal-panel p-5 mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar photo={ledger.customer.photo} name={ledger.customer.name} size={56} />
                {editing ? (
                  <div className="flex-1 space-y-2">
                    <input
                      className="brutal-input w-full text-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Name"
                    />
                    <input
                      className="brutal-input w-full text-sm"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Phone"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        disabled={savingEdit}
                        className="brutal-btn-accent px-3 py-1 text-xs disabled:opacity-50"
                      >
                        {savingEdit ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => setEditing(false)} className="brutal-btn px-3 py-1 text-xs">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-extrabold">{ledger.customer.name}</h2>
                      {session?.role === "owner" && (
                        <button onClick={handleStartEdit} className="text-xs underline opacity-70 hover:opacity-100">
                          Edit
                        </button>
                      )}
                    </div>
                    <p className="text-sm opacity-70">{ledger.customer.phone}</p>
                    {ledger.aging && (
                      <span className={`brutal-badge mt-1 ${agingBadgeClasses(ledger.aging.urgency)}`}>
                        {ledger.aging.label}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs uppercase font-bold opacity-70">Outstanding</p>
                <p className="text-2xl font-extrabold text-accent-deep">
                  ₹{ledger.outstanding_dues.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <a href={`tel:${ledger.customer.phone}`} className="brutal-btn px-4 py-2 text-sm flex-1 text-center">
                📞 Call
              </a>
              {ledger.outstanding_dues > 0 && (
                <a
                  href={waReminderUrl(ledger.customer.phone, ledger.customer.name, ledger.outstanding_dues)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="brutal-btn-accent px-4 py-2 text-sm flex-1 text-center"
                >
                  💬 WhatsApp Reminder
                </a>
              )}
              {canEdit && (
                <>
                  <input
                    ref={ledgerPhotoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleLedgerPhotoSelected(e.target.files?.[0])}
                  />
                  <button
                    onClick={() => ledgerPhotoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="brutal-btn px-4 py-2 text-sm flex-1 disabled:opacity-50"
                  >
                    {uploadingPhoto ? "Uploading…" : `📷 ${ledger.customer.photo ? "Update" : "Add"} Photo`}
                  </button>
                </>
              )}
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
