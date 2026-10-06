"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { signOut } from "@/app/(auth)/actions";
import { cn } from "@/components/ui";

export type NavItem = { href: string; label: string };

export function AppShell({
  nav,
  userLabel,
  roleLabel,
  children,
}: {
  nav: NavItem[];
  userLabel: string;
  roleLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const q = String(form.get("q") ?? "").trim();
    const field = String(form.get("field") ?? "");
    if (!q) return;
    const params = new URLSearchParams({ q });
    if (field) params.set("field", field);
    router.push(`/shipments?${params}`);
  }

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:p-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5">
          <button
            type="button"
            className="rounded-md p-2 lg:hidden"
            aria-label="Open navigation"
            aria-expanded={open}
            aria-controls="main-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-hidden="true">☰</span>
          </button>
          <Link href="/dashboard" className="font-display text-xl font-bold whitespace-nowrap">
            Ocean Control Tower
          </Link>

          <form role="search" onSubmit={onSearch} className="order-last flex w-full gap-1.5 sm:order-none sm:ml-auto sm:w-auto">
            <label htmlFor="global-field" className="sr-only">
              Search by
            </label>
            <select id="global-field" name="field" className="rounded-md border border-line bg-surface px-2 text-sm" defaultValue="">
              <option value="">All</option>
              <option value="invoice">Invoice</option>
              <option value="container">Container</option>
              <option value="bl">BL</option>
            </select>
            <label htmlFor="global-q" className="sr-only">
              Search shipments
            </label>
            <input
              id="global-q"
              name="q"
              type="search"
              placeholder="Invoice, container or BL"
              className="min-h-10 w-full min-w-0 rounded-md border border-line bg-surface px-3 text-sm sm:w-64"
            />
          </form>

          <div className="ml-auto flex items-center gap-3 text-sm sm:ml-0">
            <span className="hidden text-right leading-tight md:block">
              <span className="block font-semibold">{userLabel}</span>
              <span className="block text-xs text-muted">{roleLabel}</span>
            </span>
            <form action={signOut}>
              <button type="submit" className="rounded-md border border-line px-3 py-1.5 font-semibold hover:bg-surface-2">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4">
        <nav
          id="main-nav"
          aria-label="Main"
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-60 border-r border-line bg-surface p-4 pt-16 lg:static lg:block lg:w-48 lg:shrink-0 lg:border-0 lg:bg-transparent lg:p-0 lg:pt-6",
            open ? "block" : "hidden",
          )}
        >
          <ul className="flex flex-col gap-1">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm font-semibold",
                      active ? "bg-ink text-paper" : "text-muted hover:bg-surface hover:text-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
        <main id="main" className="min-w-0 flex-1 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
