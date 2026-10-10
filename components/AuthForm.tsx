"use client";

import { useActionState } from "react";
import Link from "next/link";
import Field, { FormError } from "@/components/Field";
import { forgotPasswordAction, loginAction, resetPasswordAction, signupAction } from "@/app/actions/auth";
import type { FormState } from "@/lib/action-types";

export default function AuthForm({ mode, next, type = "attendee" }: { mode: "login" | "signup"; next?: string; type?: "attendee" | "organizer" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? loginAction : signupAction, {});
  const v = state.values ?? {};
  const q = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <form action={action} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <FormError message={state.error} />

      {mode === "signup" && (
        <fieldset>
          <legend className="label mb-2">I want to</legend>
          <div className="grid grid-cols-2 gap-2">
            {([
              ["attendee", "Find and book events"],
              ["organizer", "Host events"],
            ] as const).map(([value, label]) => (
              <label key={value} className="cursor-pointer">
                <input type="radio" name="type" value={value} defaultChecked={type === value} className="peer sr-only" />
                <span className="block rounded-[var(--radius-card)] border border-line-strong px-3.5 py-2.5 text-center text-sm text-muted transition-colors peer-checked:border-accent peer-checked:bg-accent/[0.07] peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {mode === "signup" && (
        <Field name="name" label="Full name" errors={state.fieldErrors}>
          {(p) => <input {...p} name="name" className="input" autoComplete="name" defaultValue={v.name} required />}
        </Field>
      )}
      <Field name="email" label="Work email" errors={state.fieldErrors}>
        {(p) => <input {...p} name="email" type="email" className="input" autoComplete="email" defaultValue={v.email} required />}
      </Field>
      <Field
        name="password"
        label="Password"
        errors={state.fieldErrors}
        hint={mode === "signup" ? "At least 8 characters." : undefined}
      >
        {(p) => (
          <input {...p} name="password" type="password" className="input" autoComplete={mode === "login" ? "current-password" : "new-password"} required />
        )}
      </Field>
      {mode === "login" && (
        <p className="-mt-2 text-right text-[13px]">
          <Link href="/forgot-password" className="text-muted underline underline-offset-4 hover:text-ink">
            Forgot password?
          </Link>
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary btn-lg w-full">
        {pending ? "One moment…" : mode === "login" ? "Sign in" : "Create account"}
      </button>

      <p className="text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            New to StageGrid?{" "}
            <Link href={`/signup${q}`} className="text-ink underline underline-offset-4 hover:text-accent">Create an account</Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href={`/login${q}`} className="text-ink underline underline-offset-4 hover:text-accent">Sign in</Link>
          </>
        )}
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotPasswordAction, {});
  if (state.ok) {
    return (
      <p role="status" className="rounded-[var(--radius-card)] border border-ok/30 bg-ok/10 px-4 py-3.5 text-sm">
        {state.message}
      </p>
    );
  }
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormError message={state.error} />
      <Field name="email" label="Email" errors={state.fieldErrors}>
        {(p) => <input {...p} name="email" type="email" className="input" autoComplete="email" defaultValue={state.values?.email} required />}
      </Field>
      <button type="submit" disabled={pending} className="btn btn-primary btn-lg w-full">
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction.bind(null, token), {});
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormError message={state.error} />
      <Field name="password" label="New password" errors={state.fieldErrors} hint="At least 8 characters.">
        {(p) => <input {...p} name="password" type="password" className="input" autoComplete="new-password" required />}
      </Field>
      <button type="submit" disabled={pending} className="btn btn-primary btn-lg w-full">
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
