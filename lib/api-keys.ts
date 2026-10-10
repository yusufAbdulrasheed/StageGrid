import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { apiKeys, organizations } from "@/lib/db/schema";
import { randomToken, sha256 } from "@/lib/tokens";
import { effectivePlan, toOrg, type OrgRecord } from "@/lib/orgs";
import { PLANS } from "@/lib/plans";

export async function createApiKey(orgId: string, name: string, userId: string) {
  const db = await getDb();
  const key = `sg_live_${randomToken(24)}`;
  await db.insert(apiKeys).values({ orgId, name, prefix: key.slice(0, 15), hash: sha256(key), createdBy: userId });
  return key; // shown once; only the hash is stored
}

export async function listApiKeys(orgId: string) {
  const db = await getDb();
  return db
    .select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, lastUsedAt: apiKeys.lastUsedAt, createdAt: apiKeys.createdAt })
    .from(apiKeys)
    .where(eq(apiKeys.orgId, orgId))
    .orderBy(desc(apiKeys.createdAt));
}

export async function revokeApiKey(orgId: string, id: string) {
  const db = await getDb();
  await db.delete(apiKeys).where(and(eq(apiKeys.orgId, orgId), eq(apiKeys.id, id)));
}

/** Resolve `Authorization: Bearer sg_live_…` to an organization on a plan that includes API access. */
export async function authenticateApiKey(header: string | null): Promise<{ org: OrgRecord; keyId: string } | { error: "missing" | "invalid" | "plan" }> {
  const token = header?.match(/^Bearer\s+(sg_live_[A-Za-z0-9_-]+)$/)?.[1];
  if (!token) return { error: "missing" };
  const db = await getDb();
  const [row] = await db
    .select({ key: apiKeys, org: organizations })
    .from(apiKeys)
    .innerJoin(organizations, eq(organizations.id, apiKeys.orgId))
    .where(eq(apiKeys.hash, sha256(token)))
    .limit(1);
  if (!row) return { error: "invalid" };
  const org = toOrg(row.org);
  if (!PLANS[effectivePlan(org)].limits.apiAccess) return { error: "plan" };
  void db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.key.id)).catch(() => undefined);
  return { org, keyId: row.key.id };
}
