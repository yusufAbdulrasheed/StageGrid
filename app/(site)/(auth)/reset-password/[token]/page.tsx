import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "@/components/AuthForm";
import { isResetTokenValid } from "@/lib/password-reset";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await isResetTokenValid(token);

  if (!valid) {
    return (
      <>
        <h1 className="display text-5xl">Link expired.</h1>
        <p className="mb-8 mt-3 text-muted">This reset link is invalid or has already been used.</p>
        <Link href="/forgot-password" className="btn btn-primary btn-lg w-full">Request a new link</Link>
      </>
    );
  }
  return (
    <>
      <h1 className="display text-5xl">New password.</h1>
      <p className="mb-8 mt-3 text-muted">Choose something you haven&apos;t used elsewhere.</p>
      <ResetForm token={token} />
    </>
  );
}
