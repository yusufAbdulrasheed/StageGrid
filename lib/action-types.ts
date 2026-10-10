import type { FieldErrors } from "@/lib/validation";

export interface FormState {
  ok?: boolean;
  message?: string;
  error?: string;
  /** Set when the error is a plan limit, so the UI can offer an upgrade link. */
  upgrade?: boolean;
  /** Set when the organizer needs to add a payout account first. */
  payouts?: boolean;
  fieldErrors?: FieldErrors;
  values?: Record<string, string>;
}

export function formValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string" && !k.startsWith("$ACTION") && !k.toLowerCase().includes("password")) out[k] = v;
  }
  return out;
}
