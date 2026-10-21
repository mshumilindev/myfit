import { useEffect, useRef, useState } from 'react';
import { SuiteTabBar } from '../components/SuiteTabBar';
import { useMinWidth, APP_BREAKPOINT } from '../components/ui/breakpoints';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { UndoToast } from '../components/ui/UndoToast';
import { UNDO_MS } from '../coach/domain/signalConfig';
import { BrandBar, BellButton } from '../components/ui/BrandBar';
import { BrandAccount } from '../components/suite/BrandAccount';
import { AddFlow } from './addflow';
import { Sheet } from './components';
import { round, sumMacros } from './calc';
import { useT } from './i18n';
import { store, useStore } from './store';
import { GoalView, HistoryView, TodayView } from './views';
import type { Entry } from './types';
import { AppRail } from '../components/AppRail';
import { NotificationsView } from '../views/NotificationsView';
import type { Notif, NotifState } from '../notifications';
import { SUITE_ICON, SUITE_TONE } from '../components/suite/suiteTone';

type Tab = 'today' | 'history' | 'goal' | 'feed';

/** Entry detail: view macros, edit amount (single-item entries), or delete. */
function EntryDetail({
  entry,
  onClose,
  onDelete,
}: {
  entry: Entry;
  onClose: () => void;
  onDelete: (e: Entry) => void;
}) {
  const { t } = useT();
  const single = entry.items.length === 1 ? entry.items[0] : null;
  const [amount, setAmount] = useState(single?.amount ?? 0);

  function save() {
    if (!single) return;
    const factor = single.amount > 0 ? amount / single.amount : 1;
    const item = {
      ...single,
      amount,
      macros: {
        kcal: round(single.macros.kcal * factor),
        protein: round(single.macros.protein * factor, 1),
        fat: round(single.macros.fat * factor, 1),
        carbs: round(single.macros.carbs * factor, 1),
      },
    };
    store.updateEntry({ ...entry, items: [item], macros: sumMacros([item]) });
    onClose();
  }

  const unit = single
    ? single.basis === 'portion'
      ? t('portions')
      : single.basis === '100ml'
        ? t('ml')
        : t('grams')
    : '';

  return (
    <Sheet title={entry.name} onClose={onClose}>
      <div className="card tnum">
        <div className="list-head">
          <b>
            {round(entry.macros.kcal)} {t('kcal')}
          </b>
          <span className="muted">
            {round(entry.macros.protein)}
            {t('grams')} · {round(entry.macros.fat)}
            {t('grams')} · {round(entry.macros.carbs)}
            {t('grams')}
          </span>
        </div>
        {entry.alcoholG ? (
          <div className="muted mt3">
            {t('alcohol')}: {entry.alcoholG} {t('grams')}
          </div>
        ) : null}
      </div>

      {single && (
        <div className="mt4">
          <Field
            className="tnum"
            label={`${t('amount')} (${unit})`}
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
          />
          <Button variant="primary" fullWidth className="mt3" disabled={!amount} onClick={save}>
            {t('save')}
          </Button>
        </div>
      )}

      <Button variant="danger" fullWidth className="mt4" onClick={() => onDelete(entry)}>
        {t('delete')}
      </Button>
    </Sheet>
  );
}

export function NutritionRoot({
  now,
  onOpenShell,
  onOpenProfile,
  notifs,
  notifState,
  notifUnread,
  onNotifSeen,
  onNotifMarkAll,
}: {
  now: number;
  onOpenShell: () => void;
  onOpenProfile: () => void;
  notifs: Notif[];
  notifState: NotifState;
  notifUnread: number;
  onNotifSeen: (ids: string[]) => void;
  onNotifMarkAll: () => void;
}) {
  const s = useStore();
  const { t } = useT();
  const desktop = useMinWidth(APP_BREAKPOINT);
  const [tab, setTab] = useState<Tab>('today');
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<Entry | null>(null);
  const [undo, setUndo] = useState<Entry | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  function del(entry: Entry) {
    setDetail(null);
    store.deleteEntry(entry.id);
    setUndo(entry);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }

  // Primary nav mirrors the other sub-apps: icon rail on desktop, bottom nav on
  // phones, both ending in Apps. The Feed lives on the header bell, not a tab.
  const nav = [
    { id: 'today', icon: 'house', label: t('today') },
    { id: 'history', icon: 'clock-counter-clockwise', label: t('history') },
    { id: 'goal', icon: 'crosshair', label: t('goal') },
  ];

  /* The shell renders as soon as there is a uid (the cached session); only a device with no session at all waits. */
  if (!s.uid) {
    return (
      <div className="app-nutrition apex-app">
        <div className="apex-col">
          <div className="screen center ul-flex ua-center uj-center uf-1">
            <span className="muted">{t('loadingLabel')}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-nutrition apex-app">
      {desktop && (
        <AppRail
          app="nutrition"
          nav={nav}
          activeId={tab === 'feed' ? null : tab}
          onNav={(id) => setTab(id as Tab)}
          onOpenShell={onOpenShell}
          onOpenNotifications={() => setTab('feed')}
          onOpenProfile={onOpenProfile}
          notifUnread={notifUnread}
        />
      )}
      <div className="apex-col">
        <BrandBar
          avatar={(hidden) => (
            <BrandAccount app="nutrition" hidden={hidden} onOpenProfile={onOpenProfile} />
          )}
          header
          app={t('appName')}
          onApp={onOpenShell}
          appLabel={t('apps')}
          tone={SUITE_TONE.nutrition}
          icon={SUITE_ICON.nutrition}
          actions={
            <>
              <BellButton
                label={t('notifications')}
                onClick={() => setTab('feed')}
                active={tab === 'feed'}
                count={tab !== 'feed' ? notifUnread : 0}
              />
            </>
          }
        />

        <div className="apex-body">
          {tab === 'feed' ? (
            <NotificationsView
              embedded
              title={t('notifications')}
              notifs={notifs}
              now={now}
              state={notifState}
              onSeen={onNotifSeen}
              onMarkAll={onNotifMarkAll}
              onClose={() => setTab('today')}
            />
          ) : (
            <div className="apex-scroll">
              {tab === 'today' && (
                <TodayView
                  onOpenEntry={setDetail}
                  onGoal={() => setTab('goal')}
                  onAdd={() => setAdding(true)}
                />
              )}
              {tab === 'history' && <HistoryView onOpenEntry={setDetail} />}
              {tab === 'goal' && <GoalView />}
            </div>
          )}
        </div>

        {tab !== 'feed' && (
          <div className="n-addpill-wrap">
            <svg className="glass-defs" aria-hidden width="0" height="0">
              <filter
                id="liquid-glass"
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
                colorInterpolationFilters="sRGB"
              >
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.011 0.011"
                  numOctaves="2"
                  seed="7"
                  result="noise"
                />
                <feGaussianBlur in="noise" stdDeviation="1.4" result="soft" />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="soft"
                  scale="52"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            </svg>
            <Button
              variant="primary"
              icon="plus"
              className="n-addpill"
              onClick={() => setAdding(true)}
            >
              {t('addEntry')}
            </Button>
          </div>
        )}

        {!desktop && (
          <SuiteTabBar
            app="nutrition"
            noMore
            tabs
            activeFill
            items={nav.map((x) => ({ ...x, active: tab === x.id }))}
            onSelect={(id) => setTab(id as Tab)}
          />
        )}
      </div>

      {adding && <AddFlow onClose={() => setAdding(false)} />}

      {detail && <EntryDetail entry={detail} onClose={() => setDetail(null)} onDelete={del} />}

      {undo && (
        <UndoToast
          position="fixed"
          text={t('deleted')}
          undoLabel={t('undo')}
          countdownLabel={t('undoCountdown')}
          durationMs={UNDO_MS}
          onUndo={() => {
            store.restoreEntry(undo);
            setUndo(null);
            if (undoTimer.current) clearTimeout(undoTimer.current);
          }}
        />
      )}
    </div>
  );
}
