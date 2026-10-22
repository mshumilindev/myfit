/** The setup's "what I know" step (SPO-286: split out of CoachView.tsx, unchanged). */
import { Chip } from '../components/ui/Chip';
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { fmtBodyWeightKg, useT } from '../i18n';
import { Icon } from '../ui';
import { latestWeight, updateBodyMetrics, useStore } from '../store';
import { AtlasFace } from '../components/AtlasFace';
import type { Temper } from '../atlas/types';

export function Bubble({
  temper,
  time,
  children,
}: {
  temper: Temper;
  /** When Atlas said it ("14:05"); omitted while still typing. */
  time?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="atl-say">
      <AtlasFace temper={temper} size={28} />
      <div className="atl-bubble">
        {children}
        {time && <time className="atl-time">{time}</time>}
      </div>
    </div>
  );
}

/** "What I know" + inline pickers for only what's missing (each skippable). */
export function DataStep({ temper, onDone }: { temper: Temper; onDone: () => void }) {
  const { t } = useT();
  const store = useStore();
  const bm = store.bodyMetrics;
  const finished = store.workouts.filter((w) => w.finishedAt !== null).length;
  const w = latestWeight(bm);
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(thisYear - 30);
  const [height, setHeight] = useState<number>(bm.heightCm ?? 178);
  const [asked, setAsked] = useState<{ sex: boolean; dob: boolean; height: boolean }>({
    sex: !bm.sex,
    dob: !bm.dob,
    height: !bm.heightCm,
  });
  const missing = (v: unknown) => (v ? null : t.atlasMissing);
  const rows: [string, string | null][] = [
    [t.atlasKnowSessions, String(finished)],
    [t.atlasKnowWeight, w ? fmtBodyWeightKg(w.weight) : t.atlasMissing],
    [t.atlasKnowSex, bm.sex ? (bm.sex === 'male' ? t.atlasMale : t.atlasFemale) : missing(bm.sex)],
    [t.atlasKnowBirth, bm.dob ? bm.dob.slice(0, 4) : missing(bm.dob)],
    [t.atlasKnowHeight, bm.heightCm ? `${bm.heightCm} cm` : missing(bm.heightCm)],
  ];
  const years = [year - 2, year - 1, year, year + 1, year + 2].filter((y) => y <= thisYear - 12);

  return (
    <div className="atl-body atl-chat">
      <Bubble temper={temper}>{t.atlasKnowIntro}</Bubble>
      <div className="atl-card static">
        {rows.map(([k, v]) => (
          <div key={k} className="atl-kv">
            <span>{k}</span>
            <b className={v === t.atlasMissing ? 'miss' : ''}>{v}</b>
          </div>
        ))}
      </div>
      {asked.sex && (
        <>
          <Bubble temper={temper}>{t.atlasAskSex}</Bubble>
          <div className="atl-replies">
            <Chip
              tone="atlas"
              onClick={() => {
                updateBodyMetrics({ sex: 'male' });
                setAsked((a) => ({ ...a, sex: false }));
              }}
            >
              {t.atlasMale}
            </Chip>
            <Chip
              tone="atlas"
              onClick={() => {
                updateBodyMetrics({ sex: 'female' });
                setAsked((a) => ({ ...a, sex: false }));
              }}
            >
              {t.atlasFemale}
            </Chip>
            <Chip tone="atlas" onClick={() => setAsked((a) => ({ ...a, sex: false }))}>
              {t.atlasSkip}
            </Chip>
          </div>
        </>
      )}
      {!asked.sex && asked.dob && (
        <>
          <Bubble temper={temper}>{t.atlasAskBirth}</Bubble>
          <div className="atl-years">
            <Chip tone="atlas" aria-label="−" onClick={() => setYear((y) => y - 5)}>
              <Icon name="caret-left" />
            </Chip>
            {years.map((y) => (
              <Chip
                tone="atlas"
                key={y}
                onClick={() => {
                  updateBodyMetrics({ dob: `${y}-07-01` });
                  setAsked((a) => ({ ...a, dob: false }));
                }}
              >
                {y}
              </Chip>
            ))}
            <Chip tone="atlas" aria-label="+" onClick={() => setYear((y) => y + 5)}>
              <Icon name="caret-right" />
            </Chip>
          </div>
          <div className="atl-replies">
            <Chip tone="atlas" onClick={() => setAsked((a) => ({ ...a, dob: false }))}>
              {t.atlasSkip}
            </Chip>
          </div>
        </>
      )}
      {!asked.sex && !asked.dob && asked.height && (
        <>
          <Bubble temper={temper}>{t.atlasAskHeight}</Bubble>
          <div className="atl-stepper">
            <Chip tone="atlas" aria-label="−" onClick={() => setHeight((h) => h - 1)}>
              −
            </Chip>
            <b className="tnum">{height} cm</b>
            <Chip tone="atlas" aria-label="+" onClick={() => setHeight((h) => h + 1)}>
              +
            </Chip>
          </div>
          <div className="atl-replies">
            <Chip
              tone="atlas"
              onClick={() => {
                updateBodyMetrics({ heightCm: height });
                setAsked((a) => ({ ...a, height: false }));
              }}
            >
              {t.atlasSave}
            </Chip>
            <Chip tone="atlas" onClick={() => setAsked((a) => ({ ...a, height: false }))}>
              {t.atlasSkip}
            </Chip>
          </div>
        </>
      )}
      <p className="atl-hint">{t.atlasSkipHint}</p>
      <Button variant="primary" className="atl-cta" onClick={onDone}>
        {t.atlasNext}
      </Button>
    </div>
  );
}
