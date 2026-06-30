import type { ApprovalStatus } from "@/lib/approval";
import { IconCircleCheck, IconWarning, IconBan } from "@/components/icons";

// Compact verified / unverified / declined pill. `status = null` means the
// signed-in user has no family signup yet. Pure (safe in server components).
export function VerifiedBadge({
  status,
  className = "",
}: {
  status: ApprovalStatus | null;
  className?: string;
}) {
  const config = {
    approved: {
      label: "Verified",
      Icon: IconCircleCheck,
      cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    },
    pending: {
      label: "Unverified",
      Icon: IconWarning,
      cls: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    },
    denied: {
      label: "Not verified",
      Icon: IconBan,
      cls: "border-red-400/30 bg-red-400/10 text-red-300",
    },
  } as const;
  const { label, Icon, cls } = config[status ?? "pending"];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cls} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
