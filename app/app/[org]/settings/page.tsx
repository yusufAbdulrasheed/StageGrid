import type { Metadata } from "next";
import PageHeader from "@/components/app/PageHeader";
import { OrgSettingsForm } from "@/components/OrgForm";
import { ApiKeyForm } from "@/components/app/TeamForms";
import ConfirmDelete from "@/components/app/ConfirmDelete";
import { requireOrg } from "@/lib/auth";
import { effectivePlan, limitsFor } from "@/lib/orgs";
import { listApiKeys } from "@/lib/api-keys";
import { revokeApiKeyAction } from "@/app/actions/org";
import { PayoutForm } from "@/components/app/TeamForms";
import { getBillingProvider } from "@/lib/billing";
import { PLANS, can } from "@/lib/plans";
import { siteUrl } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params;
  const { org, role } = await requireOrg(slug, "settings");
  const provider = getBillingProvider();
  const banks = provider ? await provider.listBanks().catch(() => []) : [];
  const apiEnabled = limitsFor(org).apiAccess;
  const keys = apiEnabled ? await listApiKeys(org.id) : [];

  return (
    <>
      <PageHeader title="Settings" description="Your public profile and developer access." />

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
          Ticket sales are paid straight to this account by Paystack. We keep {PLANS[effectivePlan(org)].limits.ticketFeePercent}% of each paid ticket on your current plan.
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

      <section className="mt-8 max-w-2xl rounded-[var(--radius-card)] border border-line bg-surface p-6" aria-labelledby="api">
        <h2 id="api" className="mb-1 text-[15px] font-medium">API keys</h2>
        <p className="mb-5 text-sm text-muted">
          Read your events and attendees from your own tools. Send the key as <code className="font-mono text-xs">Authorization: Bearer …</code> to{" "}
          <code className="font-mono text-xs">GET /api/v1/events</code> or <code className="font-mono text-xs">/api/v1/events/:slug/attendees</code>.
        </p>
        <ApiKeyForm slug={slug} enabled={apiEnabled} />
        {keys.length > 0 && (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{k.name}</p>
                  <p className="font-mono text-xs text-faint">{k.prefix}… · {k.lastUsedAt ? `used ${k.lastUsedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "never used"}</p>
                </div>
                <ConfirmDelete action={revokeApiKeyAction.bind(null, slug, k.id)} title={k.name} noun="key">Revoke</ConfirmDelete>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
