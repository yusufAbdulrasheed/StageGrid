"use client";

import { useActionState, useRef, useEffect } from "react";
import Link from "next/link";
import Field, { FormError } from "@/components/Field";
import { inviteMemberAction, savePayoutsAction } from "@/app/actions/org";
import type { FormState } from "@/lib/action-types";

export function InviteForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(inviteMemberAction.bind(null, slug), {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      {state.upgrade && (
        <Link href={`/app/${slug}/billing`} className="btn btn-primary btn-sm">View plans</Link>
      )}
      {state.ok && (
        <p role="status" className="break-words rounded-[var(--radius-card)] border border-ok/30 bg-ok/10 px-3.5 py-2.5 text-sm">{state.message}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-[1fr_160px_auto] sm:items-end">
        <Field name="email" label="Email" errors={state.fieldErrors}>
          {(p) => <input {...p} name="email" type="email" className="input" placeholder="teammate@company.com" required />}
        </Field>
        <Field name="role" label="Role" errors={state.fieldErrors}>
          {(p) => (
            <select {...p} name="role" className="input" defaultValue="member">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          )}
        </Field>
        <button type="submit" disabled={pending} className="btn btn-primary h-11">
          {pending ? "Inviting…" : "Send invite"}
        </button>
      </div>
    </form>
  );
}

export function PayoutForm({ slug, banks, hasAccount, available }: { slug: string; banks: { name: string; code: string }[]; hasAccount: boolean; available: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePayoutsAction.bind(null, slug), {});
  if (!available) {
    return <p className="text-sm text-muted">Payments aren&apos;t configured on this deployment. Set <code className="font-mono text-xs">FLUTTERWAVE_SECRET_KEY</code> first.</p>;
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      {state.ok && <p role="status" className="rounded-[var(--radius-card)] border border-ok/30 bg-ok/10 px-3.5 py-2.5 text-sm">{state.message}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="bankCode" label="Bank" errors={state.fieldErrors}>
          {(p) => (
            <select {...p} name="bankCode" className="input" defaultValue="">
              <option value="" disabled>Choose your bank</option>
              {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
          )}
        </Field>
        <Field name="accountNumber" label="Account number" errors={state.fieldErrors}>
          {(p) => <input {...p} name="accountNumber" inputMode="numeric" maxLength={10} className="input font-mono" placeholder="0123456789" autoComplete="off" />}
        </Field>
      </div>
      <Field name="businessMobile" label="Business phone" errors={state.fieldErrors} hint="Flutterwave requires a contact number for payouts.">
        {(p) => <input {...p} name="businessMobile" type="tel" inputMode="tel" className="input sm:max-w-xs" placeholder="08012345678" autoComplete="tel" />}
      </Field>
      <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Verifying…" : hasAccount ? "Replace payout account" : "Save payout account"}</button>
    </form>
  );
}
