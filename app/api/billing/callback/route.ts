import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { applyPayment, getBillingProvider } from "@/lib/billing";
import { getOrgContext } from "@/lib/orgs";
import { atLeast } from "@/lib/plans";
import { siteUrl } from "@/lib/utils";
import { listOrgNotifyEmails } from "@/lib/orgs";
import { notify } from "@/lib/notify";
import { PLANS, formatNaira } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const slug = sp.get("org") ?? "";
  const reference = sp.get("tx_ref") ?? sp.get("reference");
  const back = (q: string) => NextResponse.redirect(siteUrl(`/app/${slug}/billing?${q}`));

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(siteUrl(`/login?next=${encodeURIComponent(`/app/${slug}/billing`)}`));
  const ctx = await getOrgContext(user.id, slug);
  if (!ctx || !atLeast(ctx.role, "owner")) return NextResponse.redirect(siteUrl("/app"));
  if (!reference) return back("error=checkout");

  try {
    const provider = getBillingProvider();
    const verified = await provider?.verify(reference);
    if (!provider || !verified || verified.orgId !== ctx.org.id) return back("error=verify");
    const result = await applyPayment(verified, provider.id);
    if (result.applied) {
      notify.subscriptionReceipt(await listOrgNotifyEmails(ctx.org.id), {
        org: ctx.org.name,
        plan: PLANS[verified.plan].name,
        amount: formatNaira(verified.amount / 100),
        renews: new Date(Date.now() + (verified.interval === "yearly" ? 365 : 30) * 86_400_000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        billingPath: `/app/${ctx.org.slug}/billing`,
      });
    }
    if (result.previous) await provider.cancelSubscription(result.previous).catch(() => undefined);
    return back("upgraded=1");
  } catch (err) {
    console.error("[billing callback]", err);
    return back("error=verify");
  }
}
