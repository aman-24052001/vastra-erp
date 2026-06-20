"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inventory", label: "Inventory" },
  { href: "/billing", label: "Billing" },
  { href: "/customers", label: "Customers" },
];

const OWNER_LINKS = [{ href: "/team", label: "Team" }];

export default function Navbar() {
  const { session, logout } = useAuth();
  const pathname = usePathname();

  if (!session) return null;

  return (
    <header className="border-b-2 border-ink bg-cream-panel">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold tracking-tight">
            VASTRA <span className="text-accent">ERP</span>
          </span>
          <span className="brutal-badge">{session.role}</span>
        </div>

        <nav className="flex items-center gap-1 flex-wrap">
          {[...LINKS, ...(session.role === "owner" ? OWNER_LINKS : [])].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 text-sm font-bold uppercase border-2 border-ink ${
                pathname === link.href
                  ? "bg-ink text-cream"
                  : "bg-cream-panel hover:bg-accent hover:text-cream"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="text-sm">{session.name}</span>
          <button onClick={logout} className="brutal-btn px-3 py-1.5 text-xs">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
