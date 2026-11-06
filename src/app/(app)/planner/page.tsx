import { clubToday } from '@/lib/planner';
import { affirmationFor, itemsBetween, monthMarks, pickDay } from '@/lib/planner-server';
import { DayView } from '@/components/planner/day-view';

export const metadata = { title: 'Meu dia' };

export default async function PlannerDay({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const day = pickDay((await searchParams).dia);
  const [items, { marks, events }, affirmation] = await Promise.all([itemsBetween(day, day), monthMarks(day), affirmationFor(day)]);
  return (
    <DayView key={day} day={day} today={clubToday()} initial={items} affirmation={affirmation}
      events={events.filter((e) => e.day === day)} marks={marks} />
  );
}
