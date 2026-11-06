import { requireMember } from '@/lib/auth';
import { PlannerShell } from '@/components/planner/planner-shell';

export const metadata = { title: { default: 'The Seven Club Planner', template: '%s · Planner' } };

/** O planner é particular: só a dona da conta lê e grava (RLS em planner_items e planner_pages). */
export default async function PlannerLayout({ children }: { children: React.ReactNode }) {
  await requireMember();
  return <PlannerShell>{children}</PlannerShell>;
}
