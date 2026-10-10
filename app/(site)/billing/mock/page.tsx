import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth";
import { getBillingProvider } from "@/lib/billing";
import { confirmMockPaymentAction } from "@/app/actions/billing";
import { PLANS, formatNaira } from "@/lib/plans";

export const metadata = { title: "Test checkout", robots: { index: false } };

/** Stand-in for Paystack's hosted checkout. Only exists when no PAYSTACK_SECRET_KEY is set outside production. */
export default async function MockCheckout({ searchParams }: { searchParams: Promise<{ ref?: string; org?: string }> }) {
  const { ref, org: slug } = await searchParams;
  const provider = getBillingProvider();
  if (!provider || provider.id !== "mock" || !ref || !slug) notFound();
  const { org } = await requireOrg(slug, "billing");
  const order = await provider.verify(ref);
  if (!order || order.orgId !== org.id) notFound();
  const plan = PLANS[order.plan];

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16">
      <p className="eyebrow text-accent">Test mode · no real payment</p>
      <h1 className="display mt-3 text-5xl">Confirm upgrade.</h1>
      <dl className="mt-8 divide-y divide-line border-y border-line text-sm">
        <div className="flex justify-between py-3"><dt className="text-muted">Workspace</dt><dd>{org.name}</dd></div>
        <div className="flex justify-between py-3"><dt className="text-muted">Plan</dt><dd>{plan.name} · {order.interval}</dd></div>
        <div className="flex justify-between py-3"><dt className="text-muted">Amount</dt><dd className="tabular-nums">{formatNaira(order.amount / 100)}</dd></div>
      </dl>
      <p className="mt-5 text-xs text-faint">
        Add <code className="font-mono">PAYSTACK_SECRET_KEY</code> to switch this screen for Paystack&apos;s real checkout.
      </p>
      <form action={confirmMockPaymentAction.bind(null, org.slug, ref)} className="mt-8">
        <button type="submit" className="btn btn-primary btn-lg w-full">Simulate successful payment</button>
      </form>
    </div>
  );
}
