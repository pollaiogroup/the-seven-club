import { SevenStar } from '@/components/ui/icons';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-safe pb-safe relative min-h-dvh overflow-hidden bg-burgundy text-ivory">
      <SevenStar className="pointer-events-none absolute -top-24 -right-28 h-96 w-96 text-burgundy-soft/60" />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-6">
        <div className="flex flex-col items-center pt-14 pb-10 text-center">
          <SevenStar className="h-9 w-9 text-dusty" />
          <p className="font-display mt-4 text-[26px] tracking-[0.2em] uppercase">The Seven Club</p>
          <div className="mt-3 flex items-center gap-3 text-dusty">
            <span className="h-px w-10 bg-dusty/50" />
            <span className="text-[11px] tracking-brand uppercase">Born to lead.</span>
            <span className="h-px w-10 bg-dusty/50" />
          </div>
        </div>
        <div className="flex-1 pb-10">{children}</div>
      </div>
    </div>
  );
}
