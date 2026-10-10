"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/Logo";
import { logoutAction } from "@/app/actions/auth";
import { can, PLANS, type PlanId, type Role } from "@/lib/plans";
import { cn } from "@/lib/utils";

interface Props {
  user: { name: string; email: string };
  org: { name: string; slug: string };
  orgs: { name: string; slug: string }[];
  role: Role;
  plan: PlanId;
  usage: { live: number; liveMax: number | null; seats: number; seatsMax: number };
}

const icons = {
  overview: <path d="M2.5 2.5h4.5v5H2.5zM9 2.5h4.5v3H9zM9 7.5h4.5v6H9zM2.5 9.5H7v4H2.5z" />,
  events: <path d="M2.5 4.5h11v9h-11zM2.5 7.5h11M5.5 2.5v3M10.5 2.5v3" />,
  attendees: <path d="M5.5 7a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM1.5 13.5c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5M10.5 6.5a2 2 0 1 0 0-4M12 10.2c1.4.4 2.5 1.5 2.5 3.3" />,
  team: <path d="M8 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 13.5c0-2.4 2.2-4 5-4s5 1.6 5 4" />,
  billing: <path d="M1.5 4.5h13v8h-13zM1.5 7.5h13M4 10.5h2" />,
  settings: <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />,
};

export default function AppSidebar({ user, org, orgs, role, plan, usage }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const base = `/app/${org.slug}`;

  const nav = [
    { href: base, label: "Overview", icon: icons.overview, exact: true },
    { href: `${base}/events`, label: "Events", icon: icons.events },
    { href: `${base}/attendees`, label: "Attendees", icon: icons.attendees },
    ...(can(role, "team") ? [{ href: `${base}/team`, label: "Team", icon: icons.team }] : []),
    ...(can(role, "billing") ? [{ href: `${base}/billing`, label: "Billing", icon: icons.billing }] : []),
    ...(can(role, "settings") ? [{ href: `${base}/settings`, label: "Settings", icon: icons.settings }] : []),
  ];
  const active = (n: { href: string; exact?: boolean }) => (n.exact ? pathname === n.href : pathname.startsWith(n.href));
  const livePct = usage.liveMax ? Math.min(100, (usage.live / usage.liveMax) * 100) : 0;

  return (
    <aside className="border-b border-line lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between px-5 py-3 lg:hidden">
        <Logo />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <div className={cn("flex-col gap-6 px-3 pb-5 lg:flex lg:min-h-full lg:py-5", open ? "flex" : "hidden")}>
        <div className="hidden px-3 pt-1 lg:block">
          <Logo />
        </div>
        <details className="group relative px-1">
          <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-md px-2 py-2 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
            <span className="grid size-7 shrink-0 place-items-center rounded bg-accent text-[13px] font-semibold text-accent-ink">{org.name[0]?.toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium leading-tight">{org.name}</span>
              <span className="block text-[11px] capitalize leading-tight text-faint">{role}</span>
            </span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-faint" aria-hidden><path d="m3 4.5 3 3 3-3" /></svg>
          </summary>
          <div className="absolute inset-x-1 top-full z-20 mt-1 rounded-md border border-line-strong bg-surface p-1.5 shadow-2xl shadow-black/50">
            {orgs.map((o) => (
              <Link key={o.slug} href={`/app/${o.slug}`} className={cn("flex items-center gap-2 rounded px-2.5 py-2 text-sm hover:bg-surface-2", o.slug === org.slug && "text-accent")}>
                <span className="truncate">{o.name}</span>
              </Link>
            ))}
            <Link href="/onboarding?new=1" className="mt-1 block rounded border-t border-line px-2.5 pb-2 pt-3 text-sm text-muted hover:text-ink">
              + New workspace
            </Link>
          </div>
        </details>

        <nav aria-label="Workspace" className="flex flex-col gap-0.5">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              aria-current={active(n) ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active(n) ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface hover:text-ink",
              )}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" aria-hidden className={active(n) ? "text-accent" : ""}>
                {n.icon}
              </svg>
              {n.label}
            </Link>
          ))}
          <Link href={`/o/${org.slug}`} target="_blank" className="mt-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-faint hover:text-ink">
            <span aria-hidden className="w-4 text-center">↗</span> Public page
          </Link>
        </nav>

        <div className="mt-auto space-y-4">
          <div className="rounded-md border border-line bg-surface p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium">{PLANS[plan].name} plan</span>
              {plan !== "business" && can(role, "billing") && (
                <Link href={`${base}/billing`} className="text-xs text-accent hover:underline">Upgrade</Link>
              )}
            </div>
            <p className="mt-3 text-xs text-muted">
              Live events <span className="float-right tabular-nums text-ink">{usage.live}{usage.liveMax ? ` / ${usage.liveMax}` : ""}</span>
            </p>
            {usage.liveMax && (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
                <div className={cn("h-full rounded-full", livePct >= 100 ? "bg-danger" : "bg-accent")} style={{ width: `${livePct}%` }} />
              </div>
            )}
            <p className="mt-2.5 text-xs text-muted">
              Seats <span className="float-right tabular-nums text-ink">{usage.seats} / {usage.seatsMax}</span>
            </p>
          </div>

          <div className="border-t border-line px-2 pt-4">
            <p className="truncate text-sm">{user.name}</p>
            <p className="truncate text-xs text-faint">{user.email}</p>
            <div className="mt-3 flex gap-2 text-xs text-muted">
              <Link href="/tickets" className="hover:text-ink">My tickets</Link>
              <span aria-hidden>·</span>
              <form action={logoutAction}><button type="submit" className="hover:text-ink">Sign out</button></form>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
