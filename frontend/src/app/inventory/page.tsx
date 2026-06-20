"use client";

import { useEffect, useState, useCallback } from "react";
import RequireAuth from "@/components/RequireAuth";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";
import { api, Variant, Product, ApiError } from "@/lib/api";

function InventoryContent() {
  const { session } = useAuth();
  const canEdit = session?.role === "owner" || session?.role === "staff";

  const [variants, setVariants] = useState<Variant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [restockingId, setRestockingId] = useState<number | null>(null);
  const [restockQty, setRestockQty] = useState("1");

  const [form, setForm] = useState({
    product_id: "",
    newProductName: "",
    fabric: "",
    color: "",
    design_code: "",
    size: "standard",
    price: "",
    stock_qty: "0",
    low_stock_threshold: "3",
  });

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const [v, p] = await Promise.all([
        api.listVariants(session.token, { lowStockOnly, search: search || undefined }),
        api.listProducts(session.token),
      ]);
      setVariants(v);
      setProducts(p);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load inventory");
    }
  }, [session, lowStockOnly, search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setError("");
    try {
      let productId = Number(form.product_id);
      if (!productId && form.newProductName) {
        const newProduct = await api.createProduct(session.token, form.newProductName, "saree");
        productId = newProduct.id;
      }
      if (!productId) {
        setError("Pick an existing product or name a new one");
        return;
      }

      await api.createVariant(session.token, {
        product_id: productId,
        fabric: form.fabric,
        color: form.color,
        design_code: form.design_code,
        size: form.size,
        price: Number(form.price),
        stock_qty: Number(form.stock_qty),
        low_stock_threshold: Number(form.low_stock_threshold),
      });

      setForm({
        product_id: "",
        newProductName: "",
        fabric: "",
        color: "",
        design_code: "",
        size: "standard",
        price: "",
        stock_qty: "0",
        low_stock_threshold: "3",
      });
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create variant");
    }
  };

  const handleRestock = async (variantId: number) => {
    if (!session) return;
    setError("");
    try {
      await api.recordStockMovement(session.token, variantId, "in", Number(restockQty), "manual restock");
      setRestockingId(null);
      setRestockQty("1");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not record stock movement");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-extrabold">Inventory</h1>
        {canEdit && (
          <button onClick={() => setShowForm((s) => !s)} className="brutal-btn-accent px-4 py-2 text-sm">
            {showForm ? "Cancel" : "+ Add Variant"}
          </button>
        )}
      </div>

      {error && <p className="text-accent-deep font-bold mb-4">{error}</p>}

      {showForm && (
        <form onSubmit={handleAddVariant} className="brutal-panel p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold uppercase block mb-1">Existing product</label>
            <select
              className="brutal-input w-full"
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
            >
              <option value="">— select —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase block mb-1">Or new product name</label>
            <input
              className="brutal-input w-full"
              value={form.newProductName}
              onChange={(e) => setForm({ ...form, newProductName: e.target.value })}
              placeholder="e.g. Kanjivaram Saree"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase block mb-1">Design code</label>
            <input
              required
              className="brutal-input w-full"
              value={form.design_code}
              onChange={(e) => setForm({ ...form, design_code: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase block mb-1">Fabric</label>
            <input
              required
              className="brutal-input w-full"
              value={form.fabric}
              onChange={(e) => setForm({ ...form, fabric: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase block mb-1">Color</label>
            <input
              required
              className="brutal-input w-full"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase block mb-1">Size</label>
            <input
              className="brutal-input w-full"
              value={form.size}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase block mb-1">Price (₹)</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              className="brutal-input w-full"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase block mb-1">Opening stock</label>
            <input
              type="number"
              min="0"
              className="brutal-input w-full"
              value={form.stock_qty}
              onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase block mb-1">Low-stock alert below</label>
            <input
              type="number"
              min="0"
              className="brutal-input w-full"
              value={form.low_stock_threshold}
              onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
            />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className="brutal-btn px-4 py-2 text-sm">Save Variant</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          className="brutal-input"
          placeholder="Search design code, color, fabric…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm font-bold uppercase">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
          />
          Low stock only
        </label>
      </div>

      <div className="brutal-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-ink text-left uppercase text-xs">
              <th className="p-3">Design Code</th>
              <th className="p-3">Fabric</th>
              <th className="p-3">Color</th>
              <th className="p-3">Size</th>
              <th className="p-3">Price</th>
              <th className="p-3">Stock</th>
              {canEdit && <th className="p-3">Action</th>}
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const low = v.stock_qty <= v.low_stock_threshold;
              return (
                <tr key={v.id} className="border-b border-ink/20">
                  <td className="p-3 font-bold">{v.design_code}</td>
                  <td className="p-3">{v.fabric}</td>
                  <td className="p-3">{v.color}</td>
                  <td className="p-3">{v.size}</td>
                  <td className="p-3">₹{v.price.toLocaleString()}</td>
                  <td className="p-3">
                    <span className={low ? "font-bold text-accent-deep" : ""}>{v.stock_qty}</span>
                    {low && <span className="brutal-badge ml-2">Low</span>}
                  </td>
                  {canEdit && (
                    <td className="p-3">
                      {restockingId === v.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            value={restockQty}
                            onChange={(e) => setRestockQty(e.target.value)}
                            className="brutal-input w-16 py-1"
                          />
                          <button onClick={() => handleRestock(v.id)} className="brutal-btn-accent px-2 py-1 text-xs">
                            Add
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRestockingId(v.id)}
                          className="brutal-btn px-2 py-1 text-xs"
                        >
                          + Stock
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {variants.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center opacity-60">No variants found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <RequireAuth>
      <Navbar />
      <InventoryContent />
    </RequireAuth>
  );
}
