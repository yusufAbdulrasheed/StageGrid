"use client";

import { useRef } from "react";

/** Button + modal confirmation wrapping a server action passed as `action`. */
export default function ConfirmDelete({
  action,
  title,
  noun = "event",
  children = "Delete",
}: {
  action: () => Promise<void>;
  title: string;
  noun?: string;
  children?: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="btn btn-danger btn-sm" onClick={() => dialog.current?.showModal()}>
        {children}
      </button>
      <dialog
        ref={dialog}
        className="m-auto w-[min(92vw,26rem)] rounded-[var(--radius-card)] border border-line-strong bg-surface p-6 text-ink backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <h2 className="text-lg font-semibold tracking-tight">Delete this {noun}?</h2>
        <p className="mt-2 text-sm text-muted">
          &ldquo;{title}&rdquo; and everything attached to it will be permanently removed. This can&apos;t be undone.
        </p>
        <form action={action} className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()}>
            Keep it
          </button>
          <button type="submit" className="btn border-danger bg-danger text-bg hover:opacity-90">
            Delete {noun}
          </button>
        </form>
      </dialog>
    </>
  );
}
