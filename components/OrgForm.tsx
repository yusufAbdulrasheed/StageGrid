"use client";

import { useActionState } from "react";
import Field, { FormError } from "@/components/Field";
import { createOrgAction, updateOrgAction } from "@/app/actions/org";
import type { FormState } from "@/lib/action-types";

export function CreateOrgForm({ plan }: { plan?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createOrgAction, {});
  return (
    <form action={action} className="space-y-5" noValidate>
      {plan && <input type="hidden" name="plan" value={plan} />}
      <FormError message={state.error} />
      <Field name="name" label="Organization name" errors={state.fieldErrors} hint="Your community, company or event series. You can change it later.">
        {(p) => <input {...p} name="name" className="input" placeholder="e.g. Lagos JS" defaultValue={state.values?.name} required autoFocus />}
      </Field>
      <button type="submit" disabled={pending} className="btn btn-primary btn-lg w-full">
        {pending ? "Creating…" : "Create workspace"}
      </button>
    </form>
  );
}

export function OrgSettingsForm({
  slug,
  initial,
}: {
  slug: string;
  initial: { name: string; description: string; website: string; logoUrl: string };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateOrgAction.bind(null, slug), {});
  const v = { ...initial, ...(state.values ?? {}) };
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormError message={state.error} />
      {state.ok && (
        <p role="status" className="rounded-[var(--radius-card)] border border-ok/30 bg-ok/10 px-3.5 py-2.5 text-sm">
          {state.message}
        </p>
      )}
      <Field name="name" label="Organization name" errors={state.fieldErrors}>
        {(p) => <input {...p} name="name" className="input" defaultValue={v.name} required />}
      </Field>
      <Field name="description" label="About" errors={state.fieldErrors} optional hint="Shown on your public page.">
        {(p) => <textarea {...p} name="description" rows={3} className="input" defaultValue={v.description} maxLength={300} />}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="website" label="Website" errors={state.fieldErrors} optional>
          {(p) => <input {...p} name="website" className="input" placeholder="https://" defaultValue={v.website} />}
        </Field>
        <Field name="logoUrl" label="Logo URL" errors={state.fieldErrors} optional>
          {(p) => <input {...p} name="logoUrl" className="input" placeholder="https://…/logo.png" defaultValue={v.logoUrl} />}
        </Field>
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
