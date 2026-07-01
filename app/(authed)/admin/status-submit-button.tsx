"use client";

import { useFormStatus } from "react-dom";

// A submit button for the admin triage <form action={…}> controls (feedback +
// reports status changes). The parent forms are force-dynamic and each action
// does a DB write + revalidatePath round-trip, so on a slow connection a bare
// button gives no feedback and an admin naturally double-clicks — firing the
// mutation twice. useFormStatus() disables the button and swaps in a "Saving…"
// label while the enclosing form's action is pending, so double-submits are
// impossible and the admin gets immediate feedback.
//
// Must live inside a <form> (it reads that form's pending state). `pendingLabel`
// defaults to "Saving…" but callers can override for a tighter fit.
export function StatusSubmitButton({
  children,
  className,
  pendingLabel = "Saving…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
