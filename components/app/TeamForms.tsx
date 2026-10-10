"use client";

import { useActionState, useRef, useEffect } from "react";
import Link from "next/link";
import Field, { FormError } from "@/components/Field";
import { createApiKeyAction, inviteMemberAction, savePayoutsAction } from "@/app/actions/org";
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

export function ApiKeyForm({ slug, enabled }: { slug: string; enabled: boolean }) {
  const [state, action, pending] = useActionState<FormState & { key?: string }, FormData>(createApiKeyAction.bind(null, slug), {});

  if (!enabled) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-accent/30 bg-accent/10 px-4 py-3 text-sm">
        <span>API access is available on the Business plan.</span>
        <Link href={`/app/${slug}/billing`} className="btn btn-primary btn-sm">View plans</Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {state.key && (
        <div role="status" className="rounded-[var(--radius-card)] border border-ok/30 bg-ok/10 p-4">
          <p className="text-sm font-medium">Copy your key now. You won&apos;t be able to see it again.</p>
          <code className="mt-2 block break-all rounded bg-bg px-3 py-2 font-mono text-xs">{state.key}</code>
        </div>
      )}
      <form action={action} className="flex flex-wrap items-end gap-3" noValidate>
        <FormError message={state.error} />
        <Field name="name" label="Key name" errors={state.fieldErrors} className="min-w-56 flex-1">
          {(p) => <input {...p} name="name" className="input" placeholder="e.g. Website sync" required />}
        </Field>
        <button type="submit" disabled={pending} className="btn btn-ghost h-11">{pending ? "Creating…" : "Create key"}</button>
      </form>
    </div>
  );
}

export function PayoutForm({ slug, banks, hasAccount, available }: { slug: string; banks: { name: string; code: string }[]; hasAccount: boolean; available: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePayoutsAction.bind(null, slug), {});
  if (!available) {
    return <p className="text-sm text-muted">Payments aren&apos;t configured on this deployment. Set <code className="font-mono text-xs">PAYSTACK_SECRET_KEY</code> first.</p>;
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
      <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Verifying…" : hasAccount ? "Replace payout account" : "Save payout account"}</button>
    </form>
  );
}
