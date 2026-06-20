"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

const MAX_ATTEMPTS = 9;
const RETRY_DELAY_MS = 6000; // 9 attempts * 6s ≈ 54s — comfortably covers a 30–50s Render free-tier cold start

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStatusMessage("");
    setBusy(true);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await login(email, password);
        router.replace("/dashboard");
        return;
      } catch (err) {
        if (err instanceof ApiError) {
          // A real response came back (wrong password, disabled account, etc.) —
          // retrying won't change that, so fail immediately.
          setError(err.message);
          setBusy(false);
          return;
        }

        // No response at all — almost certainly the free-tier backend is still
        // waking up from a cold start, not a real outage.
        if (attempt < MAX_ATTEMPTS) {
          setStatusMessage(`Waking up the server… (attempt ${attempt}/${MAX_ATTEMPTS})`);
          await sleep(RETRY_DELAY_MS);
        } else {
          setStatusMessage("");
          setError("Still couldn't reach the server after about a minute. Please try again shortly.");
        }
      }
    }

    setBusy(false);
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

          {statusMessage && (
            <p className="text-sm font-bold text-ink border-2 border-ink p-2 bg-warn/10">
              ⏳ {statusMessage}
            </p>
          )}

          {error && (
            <p className="text-sm font-bold text-accent-deep border-2 border-accent-deep p-2">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="brutal-btn-accent w-full py-2 disabled:opacity-60">
            {busy ? (statusMessage ? "Waking up…" : "Signing in…") : "Sign in"}
          </button>
        </form>

        <p className="text-xs opacity-60 mt-6">
          Owner/staff accounts are provisioned separately — contact your admin for access.
        </p>
        <p className="text-xs opacity-50 mt-1">
          First sign-in after a quiet period can take up to a minute while the server wakes up.
        </p>
      </div>
    </div>
  );
}
