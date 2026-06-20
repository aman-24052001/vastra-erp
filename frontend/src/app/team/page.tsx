"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";
import { api, UserAccount, Role, ApiError } from "@/lib/api";

const ROLES: Role[] = ["staff", "accountant", "owner"];

function TeamContent() {
  const { session } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff" as Role });

  const [resettingId, setResettingId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setUsers(await api.listUsers(session.token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load team");
    }
  }, [session]);

  useEffect(() => {
    if (session && session.role !== "owner") {
      router.replace("/dashboard");
      return;
    }
    load();
  }, [session, router, load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setError("");
    try {
      await api.createUser(session.token, form);
      setForm({ name: "", email: "", password: "", role: "staff" });
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create account");
    }
  };

  const handleRoleChange = async (userId: number, role: Role) => {
    if (!session) return;
    setError("");
    try {
      await api.updateUser(session.token, userId, { role });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not change role");
    }
  };

  const handleToggleActive = async (u: UserAccount) => {
    if (!session) return;
    setError("");
    try {
      await api.updateUser(session.token, u.id, { is_active: !u.is_active });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update account");
    }
  };

  const handleResetPassword = async (userId: number) => {
    if (!session || !resetPassword) return;
    setError("");
    try {
      await api.updateUser(session.token, userId, { password: resetPassword });
      setResettingId(null);
      setResetPassword("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reset password");
    }
  };

  if (session && session.role !== "owner") return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold">Team</h1>
        <button onClick={() => setShowForm((s) => !s)} className="brutal-btn-accent px-4 py-2 text-sm">
          {showForm ? "Cancel" : "+ Add Staff"}
        </button>
      </div>

      {error && <p className="text-accent-deep font-bold mb-4">{error}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="brutal-panel p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            required
            placeholder="Name"
            className="brutal-input w-full"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            required
            type="email"
            placeholder="Email"
            className="brutal-input w-full"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            required
            type="password"
            placeholder="Temporary password"
            className="brutal-input w-full"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <select
            className="brutal-input w-full"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <div className="sm:col-span-2">
            <button type="submit" className="brutal-btn px-4 py-2 text-sm">Create Account</button>
          </div>
        </form>
      )}

      <div className="brutal-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-ink text-left uppercase text-xs">
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              return (
                <tr key={u.id} className={`border-b border-ink/20 ${!u.is_active ? "opacity-50" : ""}`}>
                  <td className="p-3 font-bold">{u.name}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                      className="brutal-input py-1 text-xs"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <span className={`brutal-badge ${u.is_active ? "bg-ok text-cream border-ink" : "bg-accent text-cream border-ink"}`}>
                      {u.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <button onClick={() => handleToggleActive(u)} className="brutal-btn px-2 py-1 text-xs">
                        {u.is_active ? "Disable" : "Enable"}
                      </button>
                      {resettingId === u.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="password"
                            placeholder="New password"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            className="brutal-input w-32 py-1 text-xs"
                          />
                          <button onClick={() => handleResetPassword(u.id)} className="brutal-btn-accent px-2 py-1 text-xs">
                            Set
                          </button>
                          <button onClick={() => setResettingId(null)} className="brutal-btn px-2 py-1 text-xs">
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setResettingId(u.id)} className="brutal-btn px-2 py-1 text-xs">
                          Reset Password
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center opacity-60">No accounts found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TeamPage() {
  return (
    <RequireAuth>
      <Navbar />
      <TeamContent />
    </RequireAuth>
  );
}
