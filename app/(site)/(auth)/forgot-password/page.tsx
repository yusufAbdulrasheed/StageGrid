import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="display text-5xl">Forgot it?</h1>
      <p className="mb-8 mt-3 text-muted">Enter your email and we&apos;ll send you a link to choose a new password.</p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="underline underline-offset-4 hover:text-ink">Back to sign in</Link>
      </p>
    </>
  );
}
