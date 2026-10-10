import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getCurrentUser, homeFor, safeNext } from "@/lib/auth";
import { isPlanId } from "@/lib/plans";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string; plan?: string; type?: string }> }) {
  const { next, plan, type } = await searchParams;
  const user = await getCurrentUser();
  const target = safeNext(next, "") || (isPlanId(plan) && plan !== "free" ? `/onboarding?plan=${plan}` : "");
  if (user) redirect(target || (await homeFor(user)));

  return (
    <>
      <h1 className="display text-5xl">Create your account.</h1>
      <p className="mb-8 mt-3 text-muted">Free to join. You need an account to book a seat.</p>
      <AuthForm mode="signup" next={target || undefined} type={type === "organizer" || (isPlanId(plan) && plan !== "free") ? "organizer" : "attendee"} />
    </>
  );
}
