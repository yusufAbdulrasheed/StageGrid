import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getCurrentUser, homeFor, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next, reset } = await searchParams;
  const target = safeNext(next, "");
  const user = await getCurrentUser();
  if (user) redirect(target || (await homeFor(user)));

  return (
    <>
      <h1 className="display text-5xl">Welcome back.</h1>
      <p className="mb-8 mt-3 text-muted">Sign in to your StageGrid workspace.</p>
      {reset && (
        <p role="status" className="mb-6 rounded-[var(--radius-card)] border border-ok/30 bg-ok/10 px-4 py-3 text-sm">
          Password updated. Sign in with your new password.
        </p>
      )}
      <AuthForm mode="login" next={target || undefined} />
    </>
  );
}
