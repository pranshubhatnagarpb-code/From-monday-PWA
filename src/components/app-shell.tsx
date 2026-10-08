import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Utensils, TrendingUp, FlaskConical, User, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/diet-plan", label: "Diet", icon: Utensils },
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/blood-reports", label: "Reports", icon: FlaskConical },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card/90 shadow-[0_-4px_24px_-12px_hsl(215_30%_15%/0.15)] backdrop-blur-xl safe-area-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 pb-1.5 pt-2">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                  active ? "bg-primary/10" : ""
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
              </span>
              <span className={active ? "font-semibold" : ""}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppHeader({ title }: { title: string }) {
  const { signOut, clientProfile } = useAuth();
  const firstName = clientProfile?.name?.split(" ")[0] ?? "Client";

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <div>
          <h1 className="font-display text-lg font-bold text-foreground">{title}</h1>
        </div>
        <button
          onClick={signOut}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

export function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-24">
      <AppHeader title={title} />
      <main className="mx-auto max-w-lg px-4 py-5">{children}</main>
      <BottomNav />
    </div>
  );
}
