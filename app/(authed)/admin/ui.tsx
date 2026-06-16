// Shared presentational helpers for the admin tables.

export const thCls =
  "sticky top-0 z-10 bg-zinc-900 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-white/50 whitespace-nowrap";
export const tdCls = "px-3 py-3 align-top";

export function Pills({ values }: { values?: string[] | null }) {
  if (!values || values.length === 0)
    return <span className="text-white/30">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((v) => (
        <span
          key={v}
          className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-white/80"
        >
          {v}
        </span>
      ))}
    </div>
  );
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 shadow-2xl shadow-black/40">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}
