import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink hover:opacity-90",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  danger: "bg-red text-white hover:opacity-90",
  ghost: "text-ink hover:bg-surface-2",
};
const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 min-h-10";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cn(BUTTON_BASE, VARIANTS[variant], className)} {...props} />;
}

export function ButtonLink({
  variant = "secondary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cn(BUTTON_BASE, VARIANTS[variant], className)} {...props} />;
}

export function Card({ className, children, ...props }: ComponentProps<"section">) {
  return (
    <section className={cn("rounded-lg border border-line bg-surface p-4 sm:p-5", className)} {...props}>
      {children}
    </section>
  );
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-lg font-semibold tracking-wide">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
      <div>
        <h1 className="font-display text-3xl font-bold leading-none sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

type Tone = "neutral" | "info" | "warning" | "progress" | "success" | "danger";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink border-line",
  info: "bg-sea-soft text-sea border-transparent",
  warning: "bg-amber-soft text-amber border-transparent",
  progress: "bg-teal-soft text-teal border-transparent",
  success: "bg-green-soft text-green border-transparent",
  danger: "bg-red-soft text-red border-transparent",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

const INPUT = "min-h-10 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(INPUT, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(INPUT, "pr-8", className)} {...props} />;
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warning"; children: ReactNode }) {
  const styles = {
    info: "bg-sea-soft text-sea",
    error: "bg-red-soft text-red",
    success: "bg-green-soft text-green",
    warning: "bg-amber-soft text-amber",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-md px-3.5 py-2.5 text-sm font-medium", styles)}>
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface p-8 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function StatTile({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "danger" | "warning" }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p
        className={cn(
          "tabular mt-1 font-display text-4xl font-bold leading-none",
          tone === "danger" && "text-red",
          tone === "warning" && "text-amber",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  );
}
