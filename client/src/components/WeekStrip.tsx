/**
 * Current-week strip (Monday-first): one dot per day, brass when a session was
 * logged, today ringed. Reusable across screens where a weekly rhythm helps
 * (Today, Progress). Reads finished workouts from the store itself.
 */
import { useStore } from '../store';
import { useT } from '../i18n';

export function WeekStrip() {
  const { t } = useT();
  const store = useStore();
  const finished = store.workouts.filter((w) => w.finishedAt !== null);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const monday = new Date(dayStart);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const start = d.getTime();
    const end = start + 24 * 3600 * 1000;
    return {
      letter: t.weekDayLetters[i],
      logged: finished.some((w) => w.startedAt >= start && w.startedAt < end),
      isToday: start === dayStart.getTime(),
    };
  });

  return (
    <div className="weekstrip">
      {days.map((d, i) => (
        <div key={i} className={`cell${d.isToday ? ' today-ring' : ''}`}>
          <div className="day">{d.letter}</div>
          <div className={`dot${d.logged ? ' on' : ''}`} />
        </div>
      ))}
    </div>
  );
}
