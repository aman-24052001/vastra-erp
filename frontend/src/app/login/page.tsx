"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("owner@anushreevastralay.in");
  const [password, setPassword] = useState("owner123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="brutal-panel w-full max-w-sm p-8">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">
          VASTRA <span className="text-accent">ERP</span>
        </h1>
        <p className="text-xs uppercase opacity-70 mb-6">Apparel retail operations</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase block mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="brutal-input w-full"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase block mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="brutal-input w-full"
            />
          </div>

          {error && (
            <p className="text-sm font-bold text-accent-deep border-2 border-accent-deep p-2">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="brutal-btn-accent w-full py-2 disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-xs opacity-60 mt-6">
          Demo: owner@anushreevastralay.in / owner123
        </p>
      </div>
    </div>
  );
}
