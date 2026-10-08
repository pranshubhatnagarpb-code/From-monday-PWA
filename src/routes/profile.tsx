import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { PageShell } from "@/components/app-shell";
import { LoadingSpinner, HERO_GRADIENT, HeroStat, SectionCard } from "@/components/ui-cards";
import { InstallAppCard } from "@/components/install-prompt";
import { User, Mail, Phone, MapPin, Heart, Target, Calendar, IdCard, Activity } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfileField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 break-words text-sm text-foreground">{String(value)}</p>
      </div>
    </div>
  );
}

function ProfilePage() {
  const { clientProfile, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading || !isAuthenticated) return <LoadingSpinner />;

  const p = clientProfile;

  const age = p?.date_of_birth
    ? Math.floor(
        (Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
      )
    : null;

  const initials =
    (p?.name ?? "C")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "C";

  return (
    <PageShell title="My Profile">
      <div className="space-y-4">
        {/* Identity hero */}
        <section
          className={`relative overflow-hidden rounded-3xl ${HERO_GRADIENT} p-5 text-white shadow-lg shadow-primary/20`}
        >
          <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-300/20 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white font-display text-xl font-bold text-primary shadow-md">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl font-bold">{p?.name ?? "Client"}</h2>
              {p?.email && <p className="truncate text-sm text-white/75">{p.email}</p>}
              {p?.goal && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-white/20">
                  <Target className="h-3 w-3" /> {p.goal}
                </span>
              )}
            </div>
          </div>
          <div className="relative mt-5 grid grid-cols-3 gap-2">
            <HeroStat
              label="Height"
              value={p?.height ? `${p.height}` : "—"}
              hint={p?.height ? "cm" : undefined}
            />
            <HeroStat
              label="Weight"
              value={p?.weight ? `${p.weight}` : "—"}
              hint={p?.weight ? "kg" : undefined}
            />
            <HeroStat label="Age" value={age ?? "—"} hint={age ? "years" : undefined} />
          </div>
        </section>

        {/* Personal info */}
        <SectionCard icon={<IdCard />} title="Personal details">
          <div className="divide-y divide-border">
            <ProfileField icon={<Mail className="h-4 w-4" />} label="Email" value={p?.email} />
            <ProfileField icon={<Phone className="h-4 w-4" />} label="Phone" value={p?.phone} />
            <ProfileField
              icon={<Calendar className="h-4 w-4" />}
              label="Date of Birth"
              value={
                p?.date_of_birth
                  ? new Date(p.date_of_birth).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : null
              }
            />
            <ProfileField icon={<User className="h-4 w-4" />} label="Gender" value={p?.gender} />
            <ProfileField
              icon={<MapPin className="h-4 w-4" />}
              label="Address"
              value={p?.address}
            />
          </div>
        </SectionCard>

        {/* Health info */}
        <SectionCard
          icon={<Activity />}
          iconClassName="bg-rose-100 text-rose-600"
          title="Health summary"
        >
          <div className="divide-y divide-border">
            <ProfileField icon={<Target className="h-4 w-4" />} label="Goal" value={p?.goal} />
            <ProfileField
              icon={<Heart className="h-4 w-4" />}
              label="Health Conditions"
              value={p?.health_conditions?.length ? p.health_conditions.join(", ") : null}
            />
          </div>
          {!p?.goal && !p?.health_conditions?.length && (
            <p className="text-sm text-muted-foreground">
              Your nutritionist hasn't added health details yet.
            </p>
          )}
        </SectionCard>

        <InstallAppCard />
      </div>
    </PageShell>
  );
}
