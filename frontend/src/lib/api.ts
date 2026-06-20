const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type Role = "owner" | "staff" | "accountant";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // response had no JSON body
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: Role;
  name: string;
}

export interface Variant {
  id: number;
  product_id: number;
  fabric: string;
  color: string;
  design_code: string;
  size: string;
  price: number;
  stock_qty: number;
  low_stock_threshold: number;
}

export interface Product {
  id: number;
  name: string;
  category: string;
}

export interface AgingInfo {
  days: number;
  label: string;
  urgency: "ok" | "warn" | "urgent";
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  total_dues: number;
  photo: string | null;
  created_at: string;
  aging?: AgingInfo | null;
}

export interface Invoice {
  id: number;
  customer_id: number | null;
  payment_mode: "cash" | "upi" | "credit";
  subtotal: number;
  cgst: number;
  sgst: number;
  total: number;
  created_at: string;
}

export interface DashboardSummary {
  today_sales_total: number;
  today_invoice_count: number;
  low_stock_count: number;
  low_stock_variants: Variant[];
  top_dues_customers: Customer[];
  top_selling_variants: {
    variant_id: number;
    design_code: string;
    color: string;
    quantity_sold: number;
  }[];
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (
    name: string,
    email: string,
    password: string,
    role: Role = "staff"
  ) =>
    request<LoginResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, role }),
    }),

  dashboardSummary: (token: string) =>
    request<DashboardSummary>("/dashboard/summary", {}, token),

  listProducts: (token: string) =>
    request<Product[]>("/inventory/products", {}, token),

  listVariants: (token: string, params?: { lowStockOnly?: boolean; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.lowStockOnly) qs.set("low_stock_only", "true");
    if (params?.search) qs.set("search", params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<Variant[]>(`/inventory/variants${suffix}`, {}, token);
  },

  createProduct: (token: string, name: string, category: string) =>
    request<Product>("/inventory/products", {
      method: "POST",
      body: JSON.stringify({ name, category }),
    }, token),

  createVariant: (
    token: string,
    payload: {
      product_id: number;
      fabric: string;
      color: string;
      design_code: string;
      size: string;
      price: number;
      stock_qty: number;
      low_stock_threshold: number;
    }
  ) =>
    request<Variant>("/inventory/variants", {
      method: "POST",
      body: JSON.stringify(payload),
    }, token),

  recordStockMovement: (
    token: string,
    variant_id: number,
    type: "in" | "out",
    quantity: number,
    reference: string
  ) =>
    request("/inventory/stock-movements", {
      method: "POST",
      body: JSON.stringify({ variant_id, type, quantity, reference }),
    }, token),

  listCustomers: (token: string, search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    return request<Customer[]>(`/customers${qs}`, {}, token);
  },

  createCustomer: (token: string, name: string, phone: string, photo?: string | null) =>
    request<Customer>("/customers", {
      method: "POST",
      body: JSON.stringify({ name, phone, photo: photo ?? null }),
    }, token),

  updateCustomer: (token: string, customerId: number, payload: { name?: string; phone?: string }) =>
    request<Customer>(`/customers/${customerId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }, token),

  updateCustomerPhoto: (token: string, customerId: number, photo: string) =>
    request<Customer>(`/customers/${customerId}/photo`, {
      method: "PATCH",
      body: JSON.stringify({ photo }),
    }, token),

  getCustomerLedger: (token: string, customerId: number) =>
    request<{
      customer: Customer;
      outstanding_dues: number;
      aging: AgingInfo | null;
      invoices: Invoice[];
      payments: { id: number; amount: number; created_at: string }[];
    }>(`/customers/${customerId}/ledger`, {}, token),

  recordDuesPayment: (token: string, customerId: number, amount: number) =>
    request(`/customers/${customerId}/payments`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    }, token),

  listInvoices: (token: string) =>
    request<Invoice[]>("/billing/invoices", {}, token),

  createInvoice: (
    token: string,
    payload: {
      customer_id?: number | null;
      payment_mode: "cash" | "upi" | "credit";
      items: { variant_id: number; quantity: number }[];
    }
  ) =>
    request<Invoice>("/billing/invoices", {
      method: "POST",
      body: JSON.stringify(payload),
    }, token),
};
