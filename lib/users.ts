import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";

export interface User {
  id: string;
  name: string;
  email: string;
}

const byEmail = (email: string) => sql`lower(${users.email}) = ${email.toLowerCase()}`;

const DUMMY_HASH = hashPassword("not-a-real-password");

export async function createUser(input: { name: string; email: string; password: string }): Promise<User | null> {
  const db = await getDb();
  const [row] = await db
    .insert(users)
    .values({ name: input.name, email: input.email.toLowerCase(), passwordHash: hashPassword(input.password) })
    .onConflictDoNothing()
    .returning({ id: users.id, name: users.name, email: users.email });
  return row ?? null;
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  const db = await getDb();
  const [row] = await db.select().from(users).where(byEmail(email)).limit(1);
  const ok = verifyPassword(password, row ? row.passwordHash : DUMMY_HASH);
  if (!row || !ok) return null;
  return { id: row.id, name: row.name, email: row.email };
}

export async function getUserById(id: string): Promise<User | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const db = await getDb();
  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(byEmail(email))
    .limit(1);
  return row ?? null;
}

export async function setPassword(userId: string, password: string) {
  const db = await getDb();
  await db.update(users).set({ passwordHash: hashPassword(password) }).where(eq(users.id, userId));
}
