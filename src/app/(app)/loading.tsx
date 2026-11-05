export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="pt-safe bg-burgundy"><div className="mx-auto max-w-2xl px-5 pt-5 pb-8"><div className="h-7 w-40 rounded-lg bg-white/10" /><div className="mt-2 h-4 w-56 rounded bg-white/10" /></div></div>
      <div className="relative -mt-3 rounded-t-[28px] bg-ivory">
        <div className="mx-auto max-w-2xl space-y-4 px-4 pt-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3 rounded-[var(--radius-card)] bg-paper p-4">
              <div className="flex items-center gap-3"><div className="skeleton h-10 w-10 !rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-3 w-1/3" /><div className="skeleton h-3 w-1/4" /></div></div>
              <div className="skeleton h-3 w-full" /><div className="skeleton h-3 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
