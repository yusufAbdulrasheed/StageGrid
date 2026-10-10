import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";
import { applyPayment, findOrgByBilling, markOrgBilling, setSubscription, getBillingProvider } from "@/lib/billing";
import { toVerified } from "@/lib/billing/paystack";
import { fulfillOrder } from "@/lib/orders";
import { getOrgById, listOrgNotifyEmails } from "@/lib/orgs";
import { notify } from "@/lib/notify";
import { PLANS, formatNaira } from "@/lib/plans";

interface PaystackEvent {
  event: string;
  data: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** Returns false if this delivery was already processed. Safe to call repeatedly. */
export async function handlePaystackEvent(evt: PaystackEvent): Promise<boolean> {
  const d = evt.data ?? {};
  const key = `paystack:${evt.event}:${d.id ?? d.reference ?? d.subscription_code ?? d.invoice_code ?? JSON.stringify(d).length}`;
  const db = await getDb();
  const [fresh] = await db.insert(webhookEvents).values({ key }).onConflictDoNothing().returning({ key: webhookEvents.key });
  if (!fresh) return false;

  try {
    await dispatch(evt, d);
  } catch (err) {
    // Release the idempotency key so Paystack's retry is processed rather than skipped.
    await db.delete(webhookEvents).where(eq(webhookEvents.key, key));
    throw err;
  }
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dispatch(evt: PaystackEvent, d: Record<string, any>) {
  switch (evt.event) {
    case "charge.success": {
      if (d.metadata?.kind === "ticket") {
        const result = await fulfillOrder(String(d.reference));
        // Not settled yet (another worker holds the claim, or a transient error): let Paystack redeliver.
        if (result.status === "failed") throw new Error(`ticket fulfilment failed for ${d.reference}`);
        break;
      }
      const org = d.metadata?.orgId ? null : await findOrgByBilling({ customerCode: d.customer?.customer_code });
      const verified = toVerified(
        d as Parameters<typeof toVerified>[0],
        org ? { orgId: org.id, plan: org.plan, interval: org.planInterval } : undefined,
      );
      if (!verified) break;
      const result = await applyPayment(verified, "paystack");
      if (result.applied) {
        const paidOrg = await findOrgByBilling({ customerCode: verified.customerCode });
        const target = paidOrg ?? (await getOrgById(verified.orgId));
        if (target) {
          notify.subscriptionReceipt(await listOrgNotifyEmails(target.id), {
            org: target.name,
            plan: PLANS[verified.plan].name,
            amount: formatNaira(verified.amount / 100),
            renews: new Date(Date.now() + (verified.interval === "yearly" ? 365 : 30) * 86_400_000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
            billingPath: `/app/${target.slug}/billing`,
          });
        }
      }
      if (result.previous) {
        await getBillingProvider()?.cancelSubscription(result.previous.code, result.previous.token).catch(() => undefined);
      }
      break;
    }
    case "subscription.create": {
      const org = await findOrgByBilling({ customerCode: d.customer?.customer_code });
      if (org && d.subscription_code && d.email_token) {
        await setSubscription(org.id, { code: d.subscription_code, token: d.email_token, customerCode: d.customer?.customer_code });
      }
      break;
    }
    case "subscription.not_renew":
    case "subscription.disable": {
      const org = await findOrgByBilling({ subscriptionCode: d.subscription_code ?? d.subscription?.subscription_code, customerCode: d.customer?.customer_code });
      if (org) await markOrgBilling(org.id, { cancelAtPeriodEnd: true, planStatus: "canceled" });
      break;
    }
    case "invoice.payment_failed": {
      const org = await findOrgByBilling({ subscriptionCode: d.subscription?.subscription_code, customerCode: d.customer?.customer_code });
      if (org) {
        await markOrgBilling(org.id, { planStatus: "past_due" });
        notify.paymentFailed(await listOrgNotifyEmails(org.id), org.name, `/app/${org.slug}/billing`);
      }
      break;
    }
  }
}
