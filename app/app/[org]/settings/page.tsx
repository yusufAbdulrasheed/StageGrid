import type { Metadata } from "next";
import PageHeader from "@/components/app/PageHeader";
import { OrgSettingsForm } from "@/components/OrgForm";
import { PayoutForm } from "@/components/app/TeamForms";
import { requireOrg } from "@/lib/auth";
import { effectivePlan } from "@/lib/orgs";
import { getBillingProvider } from "@/lib/billing";
import { PLANS, can } from "@/lib/plans";
import { siteUrl } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params;
  const { org, role } = await requireOrg(slug, "settings");
  const provider = getBillingProvider();
  const banks = provider ? await provider.listBanks().catch(() => []) : [];

  return (
    <>
      <PageHeader title="Settings" description="Your public profile and payout account." />

      <section className="max-w-2xl rounded-[var(--radius-card)] border border-line bg-surface p-6" aria-labelledby="profile">
        <h2 id="profile" className="mb-1 text-[15px] font-medium">Organization profile</h2>
        <p className="mb-5 text-sm text-muted">
          Public page: <a className="text-accent hover:underline" href={`/o/${org.slug}`} target="_blank" rel="noopener noreferrer">{siteUrl(`/o/${org.slug}`)}</a>
        </p>
        <OrgSettingsForm slug={slug} initial={{ name: org.name, description: org.description, website: org.website, logoUrl: org.logoUrl }} />
      </section>

      <section id="payouts" className="mt-8 max-w-2xl scroll-mt-8 rounded-[var(--radius-card)] border border-line bg-surface p-6" aria-labelledby="pay">
        <h2 id="pay" className="mb-1 text-[15px] font-medium">Payouts</h2>
        <p className="mb-5 text-sm text-muted">
          Ticket sales are paid straight to this account by Flutterwave. We keep {PLANS[effectivePlan(org)].limits.ticketFeePercent}% of each paid ticket on your current plan.
        </p>
        {org.subaccountCode && (
          <p className="mb-5 rounded-[var(--radius-card)] border border-ok/30 bg-ok/10 px-4 py-3 text-sm">
            Paying out to <span className="font-medium">{org.payoutAccountName}</span> · {org.payoutBankName} ····{org.payoutAccountLast4}
          </p>
        )}
        {can(role, "billing") ? (
          <PayoutForm slug={slug} banks={banks} hasAccount={!!org.subaccountCode} available={!!provider} />
        ) : (
          <p className="text-sm text-muted">Only the workspace owner can change the payout account.</p>
        )}
      </section>
    </>
  );
}
