"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, homeFor, safeNext } from "@/lib/auth";
import { authenticate, createUser, getUserByEmail } from "@/lib/users";
import { flattenErrors, forgotSchema, loginSchema, resetSchema, signupSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { formValues, type FormState } from "@/lib/action-types";
import { consumeResetToken, createResetToken } from "@/lib/password-reset";
import { notify } from "@/lib/notify";

export async function signupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  const parsed = signupSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: flattenErrors(parsed.error), values };

  const limit = rateLimit(`signup:${await clientIp()}`, 5, 60 * 60_000);
  if (!limit.ok) return { error: "Too many sign-ups from this network. Try again later.", values };

  const user = await createUser(parsed.data);
  if (!user) return { fieldErrors: { email: ["An account with this email already exists"] }, values };

  const organizer = fd.get("type") === "organizer";
  await createSession(user.id);
  notify.welcome(user.email, user.name, organizer);

  const next = safeNext(fd.get("next"), "");
  redirect(next || (organizer ? "/onboarding" : "/events"));
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  const parsed = loginSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: flattenErrors(parsed.error), values };

  const limit = rateLimit(`login:${await clientIp()}:${parsed.data.email}`, 8, 10 * 60_000);
  if (!limit.ok) {
    return { error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} min.`, values };
  }

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) return { error: "That email and password don't match.", values };

  await createSession(user.id);
  const next = safeNext(fd.get("next"), "");
  redirect(next || (await homeFor(user)));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function forgotPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  const parsed = forgotSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: flattenErrors(parsed.error), values };

  const limit = rateLimit(`forgot:${await clientIp()}`, 5, 15 * 60_000);
  if (!limit.ok) return { error: "Too many requests. Try again in a few minutes.", values };

  // Same response whether or not the account exists, so emails can't be enumerated.
  const user = await getUserByEmail(parsed.data.email);
  if (user) {
    const token = await createResetToken(user.id);
    notify.reset(user.email, `/reset-password/${token}`);
  }
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

export async function resetPasswordAction(token: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: flattenErrors(parsed.error) };
  const ok = await consumeResetToken(token, parsed.data.password);
  if (!ok) return { error: "This reset link is invalid or has expired. Request a new one." };
  redirect("/login?reset=1");
}
