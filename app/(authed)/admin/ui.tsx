// Shared presentational helpers for the admin tables.

export const thCls =
  "sticky top-0 z-10 bg-zinc-900 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-white/50 whitespace-nowrap";
export const tdCls = "px-3 py-3 align-top";

export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 shadow-2xl shadow-black/40">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}
