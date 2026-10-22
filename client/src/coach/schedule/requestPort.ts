import { useEffect, useMemo } from 'react';
import type { RescheduleRequestPort } from '../today/requestPort';
import { useScheduleStore } from './useSchedule';
import { scheduleHref } from './useScheduleParams';
import { setHash } from '../../route';

/**
 * The reschedule-request port Today and Client 360 use, backed by the schedule store: Accept / Decline / Cancel answer
 * the stored request (the session moves, the chat card follows), "Suggest another time" opens the counter form.
 * A failed answer rejects, so the card shows its error and stays.
 */
export function useScheduleRequestPort(): RescheduleRequestPort {
  const store = useScheduleStore();
  useEffect(() => {
    store.start();
  }, [store]);
  return useMemo<RescheduleRequestPort>(() => {
    const answer = (reqId: string, to: 'accepted' | 'declined' | 'cancelled') =>
      store.respond(reqId, to, 'trainer').then((ok) => {
        if (!ok) throw new Error('answer');
      });
    return {
      accept: (a) => answer(a.reqId, 'accepted'),
      decline: (a) => answer(a.reqId, 'declined'),
      cancel: (a) => answer(a.reqId, 'cancelled'),
      propose: (a) => setHash(scheduleHref({ form: 'counter', req: a.reqId })),
    };
  }, [store]);
}
