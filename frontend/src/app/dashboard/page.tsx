"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import Navbar from "@/components/Navbar";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/lib/auth-context";
import { api, DashboardSummary } from "@/lib/api";

function DashboardContent() {
  const { session } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    api
      .dashboardSummary(session.token)
      .then(setSummary)
      .catch((e) => setError(e.message || "Failed to load dashboard"));
  }, [session]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold mb-6">Today&apos;s Overview</h1>

      {error && <p className="text-accent-deep font-bold mb-4">{error}</p>}

      {summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Today's Sales" value={`₹${summary.today_sales_total.toLocaleString()}`} accent />
            <StatCard label="Invoices Today" value={String(summary.today_invoice_count)} />
            <StatCard label="Low Stock Items" value={String(summary.low_stock_count)} />
            <StatCard
              label="Total Outstanding Dues"
              value={`₹${summary.top_dues_customers.reduce((s, c) => s + c.total_dues, 0).toLocaleString()}`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="brutal-panel p-5">
              <h2 className="font-bold uppercase text-sm mb-3 border-b-2 border-ink pb-2">
                Low Stock Alerts
              </h2>
              {summary.low_stock_variants.length === 0 ? (
                <p className="text-sm opacity-60">Nothing running low.</p>
              ) : (
                <ul className="space-y-2">
                  {summary.low_stock_variants.map((v) => (
                    <li key={v.id} className="flex justify-between text-sm border-b border-ink/20 pb-1">
                      <span>{v.design_code} — {v.color}</span>
                      <span className="font-bold text-accent-deep">{v.stock_qty} left</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="brutal-panel p-5">
              <h2 className="font-bold uppercase text-sm mb-3 border-b-2 border-ink pb-2">
                Top Dues
              </h2>
              {summary.top_dues_customers.length === 0 ? (
                <p className="text-sm opacity-60">No outstanding dues.</p>
              ) : (
                <ul className="space-y-2">
                  {summary.top_dues_customers.map((c) => (
                    <li key={c.id} className="flex justify-between text-sm border-b border-ink/20 pb-1">
                      <span>{c.name} · {c.phone}</span>
                      <span className="font-bold text-accent-deep">₹{c.total_dues.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="brutal-panel p-5 lg:col-span-2">
              <h2 className="font-bold uppercase text-sm mb-3 border-b-2 border-ink pb-2">
                Top Selling Variants
              </h2>
              {summary.top_selling_variants.length === 0 ? (
                <p className="text-sm opacity-60">No sales recorded yet.</p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {summary.top_selling_variants.map((v) => (
                    <li key={v.variant_id} className="flex justify-between text-sm border-b border-ink/20 pb-1">
                      <span>{v.design_code} — {v.color}</span>
                      <span className="font-bold">{v.quantity_sold} sold</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Navbar />
      <DashboardContent />
    </RequireAuth>
  );
}
