import type { Metadata } from "next";
import AppSidebar from "@/components/app/AppSidebar";
import { requireOrg } from "@/lib/auth";
import { listUserOrgs, activeEventCount, effectivePlan, limitsFor, memberSeatsUsed } from "@/lib/orgs";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const { org: slug } = await params;
  const { user, org, role } = await requireOrg(slug);
  const [orgs, live, seats] = await Promise.all([listUserOrgs(user.id), activeEventCount(org.id), memberSeatsUsed(org.id)]);
  const limits = limitsFor(org);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <AppSidebar
        user={{ name: user.name, email: user.email }}
        org={{ name: org.name, slug: org.slug }}
        orgs={orgs.map((o) => ({ name: o.org.name, slug: o.org.slug }))}
        role={role}
        plan={effectivePlan(org)}
        usage={{ live, liveMax: limits.activeEvents, seats, seatsMax: limits.members }}
      />
      <div className="min-w-0 px-5 pb-16 pt-8 sm:px-8 lg:px-12 lg:pt-10">{children}</div>
    </div>
  );
}
