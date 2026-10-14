/**
 * Reschedule inside a Coach chat thread (M6): the request card drawn for `request` message bodies, the "Request
 * reschedule" chip next to the composer, and the form it opens. `createScheduleThreadExtras(opts)` returns the hook
 * ThreadView calls; `ChatWithExtras` composes it with the share / notes extras (M5).
 */
import { useState } from 'react';
import { Chip } from '../../components/ui/Chip';
import { Sheet } from '../../components/ui/Overlays';
import { useScheduleT } from '../../i18n/coachSchedule';
import type { ThreadExtras, ThreadExtrasCtx } from '../chat/ThreadView';
import type { CoachRoute } from '../routes';
import { usePeople } from './people';
import type { SchedulePort } from './port';
import { RescheduleForm } from './RescheduleForm';
import { ScheduleRequestCard } from './ScheduleRequestCard';
import { dayOfTs } from './time';
import { useSchedule } from './useSchedule';

export interface ScheduleThreadExtrasOpts {
  port?: SchedulePort;
  onNavigate?: (r: CoachRoute) => void;
}

export function createScheduleThreadExtras(opts: ScheduleThreadExtrasOpts = {}) {
  return function useScheduleThreadExtras(ctx: ThreadExtrasCtx): ThreadExtras {
    const { s: t, locale } = useScheduleT();
    const people = usePeople();
    const sch = useSchedule(opts.port);
    const [form, setForm] = useState<{ counter?: string } | null>(null);
    const counterOf = form?.counter ? sch.requests.find((r) => r.id === form.counter) : undefined;
    return {
      card: (m) =>
        m.body.kind === 'request' ? (
          <ScheduleRequestCard
            reqId={m.body.reqId}
            people={people}
            port={opts.port}
            side="trainer"
            onCounter={(id) => setForm({ counter: id })}
            onOpenCalendar={(day) => {
              window.location.assign(`#/c/schedule?d=${day}`);
            }}
          />
        ) : undefined,
      chips: (
        <Chip icon="swap" aria-label={t.rcChipAria} title={t.rcChip} onClick={() => setForm({})} />
      ),
      overlay: form ? (
        <Sheet onClose={() => setForm(null)} label={t.rfTitle} padded className="sc-sheet">
          <RescheduleForm
            store={sch.store}
            people={people}
            slots={sch.slots}
            requests={sch.requests}
            t={t}
            locale={locale}
            now={sch.now}
            today={dayOfTs(sch.now)}
            mode={counterOf ? 'counter' : 'pick'}
            clientId={ctx.clientId}
            counterOf={counterOf}
            onClose={() => setForm(null)}
          />
        </Sheet>
      ) : undefined,
    };
  };
}
