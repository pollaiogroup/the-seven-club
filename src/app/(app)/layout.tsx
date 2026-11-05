import { requireMember } from '@/lib/auth';
import { BottomNav } from '@/components/bottom-nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMember();
  return (
    <div className="min-h-dvh bg-ivory md:pl-24">
      {children}
      <BottomNav handle={me.handle} />
    </div>
  );
}
