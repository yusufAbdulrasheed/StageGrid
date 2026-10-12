import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { getUserById, type User } from "@/lib/users";
import { getOrgContext, listUserOrgs, type OrgRecord } from "@/lib/orgs";
import { can, type Action, type Role } from "@/lib/plans";

const COOKIE = "sg_session";
const MAX_AGE = 60 * 60 * 24 * 14;

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters");
    }
    return new TextEncoder().encode("dev-only-secret-do-not-use-in-production!!");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.sub ? await getUserById(payload.sub) : null;
  } catch {
    return null;
  }
});

export async function requireUser(next?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

export interface OrgSession {
  user: User;
  org: OrgRecord;
  role: Role;
}

export const requireOrg = cache(async (orgSlug: string, action?: Action): Promise<OrgSession> => {
  const user = await requireUser(`/app/${orgSlug}`);
  const ctx = await getOrgContext(user.id, orgSlug);
  if (!ctx) notFound();
  if (action && !can(ctx.role, action)) redirect(`/app/${orgSlug}?denied=${action}`);
  return { user, ...ctx };
});

export async function homeFor(user: User): Promise<string> {
  const orgs = await listUserOrgs(user.id);
  return orgs.length ? `/app/${orgs[0].org.slug}` : "/events";
}

export { safeNext } from "@/lib/auth-paths";
