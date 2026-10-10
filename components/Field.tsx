import type { FieldErrors } from "@/lib/validation";

interface FieldProps {
  name: string;
  label: string;
  errors?: FieldErrors;
  hint?: string;
  optional?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode;
}

export default function Field({ name, label, errors, hint, optional, className, children }: FieldProps) {
  const id = `f-${name}`;
  const error = errors?.[name]?.[0];
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={id}>
        {label}
        {optional && <span className="ml-1.5 font-normal text-faint">optional</span>}
      </label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-err`} className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[var(--radius-card)] border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
      {message}
    </p>
  );
}
