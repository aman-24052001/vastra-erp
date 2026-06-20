"use client";

import { useEffect, useState, useCallback } from "react";
import RequireAuth from "@/components/RequireAuth";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";
import { api, Variant, Product, ApiError } from "@/lib/api";

interface VariantDraft {
  fabric: string;
  color: string;
  design_code: string;
  size: string;
  price: string;
  low_stock_threshold: string;
}

function InventoryContent() {
  const { session } = useAuth();
  const canEdit = session?.role === "owner" || session?.role === "staff";

  const [variants, setVariants] = useState<Variant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [restockingId, setRestockingId] = useState<number | null>(null);
  const [restockQty, setRestockQty] = useState("1");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<VariantDraft | null>(null);

  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editProductName, setEditProductName] = useState("");

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
        api.listVariants(session.token, { lowStockOnly, search: search || undefined, showInactive }),
        api.listProducts(session.token),
      ]);
      setVariants(v);
      setProducts(p);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load inventory");
    }
  }, [session, lowStockOnly, search, showInactive]);

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

  const startEdit = (v: Variant) => {
    setEditingId(v.id);
    setEditDraft({
      fabric: v.fabric,
      color: v.color,
      design_code: v.design_code,
      size: v.size,
      price: String(v.price),
      low_stock_threshold: String(v.low_stock_threshold),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveEdit = async (variantId: number) => {
    if (!session || !editDraft) return;
    setError("");
    try {
      await api.updateVariant(session.token, variantId, {
        fabric: editDraft.fabric,
        color: editDraft.color,
        design_code: editDraft.design_code,
        size: editDraft.size,
        price: Number(editDraft.price),
        low_stock_threshold: Number(editDraft.low_stock_threshold),
      });
      cancelEdit();
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update variant");
    }
  };

  const toggleActive = async (v: Variant) => {
    if (!session) return;
    setError("");
    try {
      await api.updateVariant(session.token, v.id, { is_active: !v.is_active });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update variant");
    }
  };

  const saveProductRename = async (productId: number) => {
    if (!session || !editProductName.trim()) return;
    setError("");
    try {
      await api.updateProduct(session.token, productId, { name: editProductName.trim() });
      setEditingProductId(null);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not rename product");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-extrabold">Inventory</h1>
        <div className="flex gap-2">
          {canEdit && (
            <button onClick={() => setShowProducts((s) => !s)} className="brutal-btn px-4 py-2 text-sm">
              {showProducts ? "Hide Products" : "Manage Products"}
            </button>
          )}
          {canEdit && (
            <button onClick={() => setShowForm((s) => !s)} className="brutal-btn-accent px-4 py-2 text-sm">
              {showForm ? "Cancel" : "+ Add Variant"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-accent-deep font-bold mb-4">{error}</p>}

      {showProducts && (
        <div className="brutal-panel p-4 mb-6">
          <h2 className="font-bold uppercase text-xs mb-3">Products</h2>
          <ul className="space-y-2">
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm border-b border-ink/20 pb-2 last:border-b-0">
                {editingProductId === p.id ? (
                  <>
                    <input
                      className="brutal-input flex-1 py-1"
                      value={editProductName}
                      onChange={(e) => setEditProductName(e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => saveProductRename(p.id)} className="brutal-btn-accent px-2 py-1 text-xs">
                      Save
                    </button>
                    <button onClick={() => setEditingProductId(null)} className="brutal-btn px-2 py-1 text-xs">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{p.name} <span className="opacity-50 text-xs">({p.category})</span></span>
                    <button
                      onClick={() => { setEditingProductId(p.id); setEditProductName(p.name); }}
                      className="text-xs underline opacity-70 hover:opacity-100"
                    >
                      Rename
                    </button>
                  </>
                )}
              </li>
            ))}
            {products.length === 0 && <p className="text-sm opacity-60">No products yet.</p>}
          </ul>
        </div>
      )}

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

      <div className="flex flex-wrap items-center gap-4 mb-4">
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
        {canEdit && (
          <label className="flex items-center gap-2 text-sm font-bold uppercase">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show discontinued
          </label>
        )}
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
              const isEditing = editingId === v.id;

              if (isEditing && editDraft) {
                return (
                  <tr key={v.id} className="border-b border-ink/20 bg-accent/10">
                    <td className="p-2"><input className="brutal-input w-full py-1" value={editDraft.design_code} onChange={(e) => setEditDraft({ ...editDraft, design_code: e.target.value })} /></td>
                    <td className="p-2"><input className="brutal-input w-full py-1" value={editDraft.fabric} onChange={(e) => setEditDraft({ ...editDraft, fabric: e.target.value })} /></td>
                    <td className="p-2"><input className="brutal-input w-full py-1" value={editDraft.color} onChange={(e) => setEditDraft({ ...editDraft, color: e.target.value })} /></td>
                    <td className="p-2"><input className="brutal-input w-full py-1" value={editDraft.size} onChange={(e) => setEditDraft({ ...editDraft, size: e.target.value })} /></td>
                    <td className="p-2"><input type="number" className="brutal-input w-20 py-1" value={editDraft.price} onChange={(e) => setEditDraft({ ...editDraft, price: e.target.value })} /></td>
                    <td className="p-2 opacity-50">{v.stock_qty}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <button onClick={() => saveEdit(v.id)} className="brutal-btn-accent px-2 py-1 text-xs">Save</button>
                        <button onClick={cancelEdit} className="brutal-btn px-2 py-1 text-xs">Cancel</button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={v.id} className={`border-b border-ink/20 ${!v.is_active ? "opacity-50" : ""}`}>
                  <td className="p-3 font-bold">
                    {v.design_code}
                    {!v.is_active && <span className="brutal-badge ml-2">Discontinued</span>}
                  </td>
                  <td className="p-3">{v.fabric}</td>
                  <td className="p-3">{v.color}</td>
                  <td className="p-3">{v.size}</td>
                  <td className="p-3">₹{v.price.toLocaleString()}</td>
                  <td className="p-3">
                    <span className={low ? "font-bold text-accent-deep" : ""}>{v.stock_qty}</span>
                    {low && v.is_active && <span className="brutal-badge ml-2">Low</span>}
                  </td>
                  {canEdit && (
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-1">
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
                          <button onClick={() => setRestockingId(v.id)} className="brutal-btn px-2 py-1 text-xs">
                            + Stock
                          </button>
                        )}
                        <button onClick={() => startEdit(v)} className="brutal-btn px-2 py-1 text-xs">
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(v)}
                          className="brutal-btn px-2 py-1 text-xs"
                        >
                          {v.is_active ? "Discontinue" : "Reactivate"}
                        </button>
                      </div>
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
