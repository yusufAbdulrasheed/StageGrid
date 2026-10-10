import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { passwordResets } from "@/lib/db/schema";
import { randomToken, sha256 } from "@/lib/tokens";
import { setPassword } from "@/lib/users";

export async function createResetToken(userId: string): Promise<string> {
  const db = await getDb();
  const token = randomToken();
  await db.insert(passwordResets).values({ userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3_600_000) });
  return token;
}

export async function isResetTokenValid(token: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ id: passwordResets.id })
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, sha256(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
    .limit(1);
  return !!row;
}

export async function consumeResetToken(token: string, newPassword: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResets.tokenHash, sha256(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
    .returning({ userId: passwordResets.userId });
  if (!row) return false;
  await setPassword(row.userId, newPassword);
  return true;
}
