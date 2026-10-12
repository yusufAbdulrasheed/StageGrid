import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";
import { applyPayment, findOrgByBilling, markOrgBilling, getBillingProvider } from "@/lib/billing";
import { fulfillOrder } from "@/lib/orders";
import { getOrgById, listOrgNotifyEmails } from "@/lib/orgs";
import { notify } from "@/lib/notify";
import { PLANS, formatNaira } from "@/lib/plans";

interface FlutterwaveData {
  id?: number | string;
  tx_ref?: string;
  status?: string;
  payment_plan?: number | string | null;
  customer?: { email?: string; customer_email?: string };
}

interface FlutterwaveEvent {
  event: string;
  data: FlutterwaveData;
}

const emailOf = (d: FlutterwaveData) => (d.customer?.email ?? d.customer?.customer_email)?.toLowerCase() ?? null;

export async function handleFlutterwaveEvent(evt: FlutterwaveEvent): Promise<boolean> {
  const d = evt.data ?? {};
  const key = `flutterwave:${evt.event}:${d.id ?? d.tx_ref ?? JSON.stringify(d).length}`;
  const db = await getDb();
  const [fresh] = await db.insert(webhookEvents).values({ key }).onConflictDoNothing().returning({ key: webhookEvents.key });
  if (!fresh) return false;

  try {
    await dispatch(evt, d);
  } catch (err) {
    await db.delete(webhookEvents).where(eq(webhookEvents.key, key));
    throw err;
  }
  return true;
}

async function dispatch(evt: FlutterwaveEvent, d: FlutterwaveData) {
  switch (evt.event) {
    case "charge.completed": {
      const reference = String(d.tx_ref ?? "");
      const email = emailOf(d);

      if (d.status !== "successful") {
        if (d.payment_plan && email) {
          const org = await findOrgByBilling({ customerCode: email });
          if (org) {
            await markOrgBilling(org.id, { planStatus: "past_due" });
            notify.paymentFailed(await listOrgNotifyEmails(org.id), org.name, `/app/${org.slug}/billing`);
          }
        }
        break;
      }

      if (reference.startsWith("tkt_")) {
        const result = await fulfillOrder(reference);
        if (result.status === "failed") throw new Error(`ticket fulfilment failed for ${reference}`);
        break;
      }

      const provider = getBillingProvider();
      if (!provider || !reference) break;
      const known = email ? await findOrgByBilling({ customerCode: email }) : null;
      const verified = await provider.verify(reference, known ? { orgId: known.id, plan: known.plan, interval: known.planInterval } : undefined);
      if (!verified) break;

      const result = await applyPayment(verified, provider.id);
      if (result.applied) {
        const target = await getOrgById(verified.orgId);
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
      if (result.previous) await provider.cancelSubscription(result.previous).catch(() => undefined);
      break;
    }
    case "subscription.cancelled": {
      const email = emailOf(d);
      const org = email ? await findOrgByBilling({ customerCode: email }) : null;
      if (org) await markOrgBilling(org.id, { cancelAtPeriodEnd: true, planStatus: "canceled" });
      break;
    }
  }
}
