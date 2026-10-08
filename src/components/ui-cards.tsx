import type { ReactNode } from "react";

interface SummaryCardProps {
  icon: ReactNode;
  label: string;
  value: string | number | null;
  subtitle?: string;
  variant?: "default" | "primary" | "accent";
}

export function SummaryCard({
  icon,
  label,
  value,
  subtitle,
  variant = "default",
}: SummaryCardProps) {
  const bg =
    variant === "primary"
      ? "bg-primary/10 border-primary/20"
      : variant === "accent"
        ? "bg-accent border-accent"
        : "bg-card border-border";

  return (
    <div className={`rounded-2xl border p-4 ${bg}`}>
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm text-foreground">{value ?? "—"}</p>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed bg-card/60 px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary [&_svg]:h-6 [&_svg]:w-6">
        {icon}
      </div>
      <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

// Shared "premium" building blocks, matching the dashboard design.
export const HERO_GRADIENT =
  "bg-gradient-to-br from-[hsl(212_78%_38%)] via-[hsl(214_72%_30%)] to-[hsl(218_65%_20%)]";

/** Gradient page header: eyebrow + title + subtitle, with optional extra content. */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  icon,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-3xl ${HERO_GRADIENT} p-5 text-white shadow-lg shadow-primary/20`}
    >
      <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-300/20 blur-2xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/70">
                {eyebrow}
              </p>
            )}
            <h2 className="mt-1 font-display text-2xl font-bold leading-tight">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-white/75">{subtitle}</p>}
          </div>
          {icon && (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 [&_svg]:h-5 [&_svg]:w-5">
              {icon}
            </span>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Frosted stat tile for use inside PageHero. */
export function HeroStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15 backdrop-blur-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">{label}</p>
      <p className="mt-0.5 font-display text-lg font-bold leading-tight">{value}</p>
      {hint && <p className="text-[11px] text-white/70">{hint}</p>}
    </div>
  );
}

/** White content card with an icon chip header. */
export function SectionCard({
  icon,
  iconClassName = "bg-primary/10 text-primary",
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  icon?: ReactNode;
  iconClassName?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border bg-card p-5 shadow-sm ${className}`}>
      {(title || icon || action) && (
        <div className="mb-4 flex items-center gap-2.5">
          {icon && (
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl [&_svg]:h-[18px] [&_svg]:w-[18px] ${iconClassName}`}
            >
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
            )}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary/15 border-t-primary" />
    </div>
  );
}

// Shown when a user is signed in but has no linked client record, so pages
// don't sit on a spinner waiting for a profile that will never arrive.
export function NoClientProfile({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <h2 className="font-display text-lg font-semibold text-foreground">Account not linked</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        You're signed in, but we couldn't find a client profile for this account. Please contact
        your nutritionist to get it linked.
      </p>
      <button
        type="button"
        onClick={onSignOut}
        className="mt-6 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Sign out
      </button>
    </div>
  );
}
