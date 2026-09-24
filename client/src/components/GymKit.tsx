/**
 * "You've used this here, but it isn't on the gym's list" — the tray, card,
 * review sheet and undo, all in the graphite liquid-glass material.
 *
 * Design (canvas V8 · Tray + undo): one quiet floating tray at the moment of
 * evidence (after a set), one tap adds straight to the gym's shared list, an
 * Undo stays in the same place for a few seconds. Lists (gym page, recap) open
 * a review sheet with a switch per item; items seen at least twice are on.
 */
import { useEffect, useState } from 'react';
import { Icon, Sheet } from '../ui';
import { useT } from '../i18n';
import { addGymKit, markGymKitNotHere, restoreGymKit } from '../store';
import { equipmentById } from '../data/equipmentCatalog';
import { localizedEquipName } from '../data/equipmentI18n';
import { EVIDENCE_DOTS, type KitEvidence } from '../gymEvidence';
import type { Gym } from '../types';

type Prev = { items: string[]; inventory: string[] };

function useKitName() {
  const { locale } = useT();
  return (id: string) => {
    const item = equipmentById(id);
    return item ? localizedEquipName(item, locale) : id;
  };
}
const kitImg = (id: string) => equipmentById(id)?.image?.thumbUrl ?? null;

function Thumb({ id, size = 40 }: { id: string; size?: number }) {
  const src = kitImg(id);
  return src ? (
    <img className="gk-thumb" src={src} alt="" style={{ width: size, height: size }} />
  ) : (
    <span className="gk-thumb gk-thumb-empty" style={{ width: size, height: size }}>
      <Icon name="barbell" />
    </span>
  );
}

/** One dot per recent session here, filled when the kit was used. */
export function KitDots({ used }: { used: boolean[] }) {
  const pad = Math.max(0, EVIDENCE_DOTS - used.length);
  return (
    <span className="gk-dots" aria-hidden>
      {Array.from({ length: pad }, (_, i) => (
        <span key={`p${i}`} className="gk-dot none" />
      ))}
      {used.map((u, i) => (
        <span key={i} className={`gk-dot${u ? ' on' : ''}`} />
      ))}
    </span>
  );
}

/** "Added to X · Undo" — shown for a few seconds where the action happened. */
export function GymKitUndo(props: {
  gym: Gym;
  prev: Prev;
  count: number;
  floating?: boolean;
  onDone: () => void;
}) {
  const { t } = useT();
  const { onDone } = props;
  useEffect(() => {
    const id = window.setTimeout(onDone, 6000);
    return () => window.clearTimeout(id);
  }, [onDone]);
  return (
    <div className={`gk-glass gk-tray gk-undo${props.floating ? ' floating' : ''}`} role="status">
      <span className="gk-ok">
        <Icon name="check" weight="bold" />
      </span>
      <span className="gk-tray-text">
        <b>
          {props.count > 1 ? t.gkUpdated(props.gym.name, props.count) : t.gkAdded(props.gym.name)}
        </b>
      </span>
      <button
        type="button"
        className="gk-link"
        onClick={() => {
          restoreGymKit(props.gym.id, props.prev);
          props.onDone();
        }}
      >
        {t.undo}
      </button>
    </div>
  );
}

/** The in-session tray: this lift's kit isn't on the gym's list. The parent
 *  shows <GymKitUndo> in its place after Add (the evidence is gone by then). */
export function GymKitTray(props: {
  gym: Gym;
  ev: KitEvidence;
  onDismiss: () => void;
  onAdded: (prev: Prev) => void;
}) {
  const { t } = useT();
  const name = useKitName();
  return (
    <div className="gk-glass gk-tray floating" role="status">
      <Thumb id={props.ev.itemId} size={38} />
      <span className="gk-tray-text">
        <b>{t.gkNotOnList(name(props.ev.itemId), props.gym.name)}</b>
        <span>{t.gkSeen(props.ev.sessions)}</span>
      </span>
      <button
        type="button"
        className="gk-x"
        aria-label={t.gkDismiss}
        title={t.gkDismiss}
        onClick={props.onDismiss}
      >
        <Icon name="x" />
      </button>
      <button
        type="button"
        className="gk-add"
        onClick={() => {
          const prev = addGymKit(props.gym.id, [props.ev.itemId]);
          if (prev) props.onAdded(prev);
        }}
      >
        {t.add}
      </button>
    </div>
  );
}

/** Review sheet: a switch per item (on = seen at least twice), one Add. */
export function GymKitReviewSheet(props: {
  gym: Gym;
  items: KitEvidence[];
  title?: string;
  onClose: () => void;
  onAdded: (prev: Prev, count: number) => void;
}) {
  const { t } = useT();
  const name = useKitName();
  const [gone, setGone] = useState<string[]>([]);
  const [on, setOn] = useState<Set<string>>(
    () => new Set(props.items.filter((e) => e.medium).map((e) => e.itemId)),
  );
  const rows = props.items.filter((e) => !gone.includes(e.itemId));
  const picked = rows.filter((e) => on.has(e.itemId)).map((e) => e.itemId);
  return (
    <Sheet onClose={props.onClose} className="gk-sheet">
      <div className="sheet-label">{props.title ?? t.gkReviewTitle(props.gym.name)}</div>
      <p className="gk-lead">{t.gkReviewLead(props.gym.name)}</p>
      <div className="gk-rows">
        {rows.map((e) => (
          <div key={e.itemId} className="gk-row">
            <Thumb id={e.itemId} size={44} />
            <span className="gk-row-text">
              <b>{name(e.itemId)}</b>
              <span className="gk-row-meta">
                <KitDots used={e.used} />
                {e.lifts.slice(0, 2).join(', ')}
              </span>
              <button
                type="button"
                className="gk-link small"
                onClick={() => {
                  markGymKitNotHere(props.gym.id, e.itemId);
                  setGone((g) => [...g, e.itemId]);
                }}
              >
                {t.gkNotHere}
              </button>
            </span>
            <button
              type="button"
              className={`gk-switch${on.has(e.itemId) ? ' on' : ''}`}
              aria-pressed={on.has(e.itemId)}
              aria-label={name(e.itemId)}
              onClick={() =>
                setOn((s) => {
                  const n = new Set(s);
                  if (n.has(e.itemId)) n.delete(e.itemId);
                  else n.add(e.itemId);
                  return n;
                })
              }
            >
              <span />
            </button>
          </div>
        ))}
      </div>
      <p className="gk-shared">{t.gkShared(props.gym.name)}</p>
      <button
        type="button"
        className="btn btn-primary gk-primary"
        disabled={picked.length === 0}
        onClick={() => {
          const prev = addGymKit(props.gym.id, picked);
          props.onClose();
          if (prev) props.onAdded(prev, picked.length);
        }}
      >
        {t.gkAddN(picked.length)}
      </button>
    </Sheet>
  );
}

/** Card for the gym page / workout recap: the evidence at a glance + Review. */
export function GymKitCard(props: { gym: Gym; items: KitEvidence[]; title: string; sub: string }) {
  const { t } = useT();
  const name = useKitName();
  const [open, setOpen] = useState(false);
  const [undo, setUndo] = useState<{ prev: Prev; n: number } | null>(null);
  if (undo)
    return (
      <GymKitUndo gym={props.gym} prev={undo.prev} count={undo.n} onDone={() => setUndo(null)} />
    );
  if (props.items.length === 0) return null;
  return (
    <div className="gk-glass gk-card">
      <div className="gk-card-head">
        <b>{props.title}</b>
        <span>{props.sub}</span>
      </div>
      {props.items.slice(0, 3).map((e) => (
        <div key={e.itemId} className="gk-row compact">
          <Thumb id={e.itemId} size={40} />
          <span className="gk-row-text">
            <b>{name(e.itemId)}</b>
            <span className="gk-row-meta">
              <KitDots used={e.used} />
              {t.gkSeen(e.sessions)}
            </span>
          </span>
        </div>
      ))}
      <button type="button" className="btn btn-primary gk-primary" onClick={() => setOpen(true)}>
        {t.gkReview(props.items.length)}
      </button>
      {open && (
        <GymKitReviewSheet
          gym={props.gym}
          items={props.items}
          onClose={() => setOpen(false)}
          onAdded={(prev, n) => setUndo({ prev, n })}
        />
      )}
    </div>
  );
}
