import { useEffect, useRef, useState } from 'react';
import { AddFlow } from './addflow';
import { Sheet } from './components';
import { round, sumMacros } from './calc';
import { useT } from './i18n';
import { store, useStore } from './store';
import { GoalView, HistoryView, TodayView } from './views';
import type { Entry } from './types';
import { Icon } from '../ui';
import { AppRail } from '../components/AppRail';
import { NotificationsView } from '../views/NotificationsView';
import type { Notif, NotifState } from '../notifications';

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
        <div className="field mt4">
          <label>
            {t('amount')} ({unit})
          </label>
          <input
            className="input tnum"
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
          />
          <button className="btn acc block mt3" disabled={!amount} onClick={save}>
            {t('save')}
          </button>
        </div>
      )}

      <button className="btn danger block mt4" onClick={() => onDelete(entry)}>
        {t('delete')}
      </button>
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
  const [tab, setTab] = useState<Tab>('today');
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<Entry | null>(null);
  const [undo, setUndo] = useState<Entry | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  function del(entry: Entry) {
    setDetail(null);
    store.deleteEntry(entry.id);
    setUndo(entry);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  }

  // Primary nav mirrors the other sub-apps: icon rail on desktop, bottom nav on
  // phones, both ending in Apps. The Feed lives on the header bell, not a tab.
  const nav = [
    { id: 'today', icon: 'house', label: t('today') },
    { id: 'history', icon: 'clock-counter-clockwise', label: t('history') },
    { id: 'goal', icon: 'crosshair', label: t('goal') },
  ];

  if (!s.authReady || !s.uid) {
    return (
      <div className="app-nutrition apex-app">
        <div className="apex-col">
          <div
            className="screen center"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}
          >
            <span className="muted">{t('loadingLabel')}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-nutrition apex-app">
      <AppRail
        nav={nav}
        activeId={tab === 'feed' ? null : tab}
        onNav={(id) => setTab(id as Tab)}
        onOpenShell={onOpenShell}
        onOpenNotifications={() => setTab('feed')}
        onOpenProfile={onOpenProfile}
        notifUnread={notifUnread}
      />
      <div className="apex-col">
        <header className="app-brand apex-head">
          <div className="app-brand-lead">
            <span className="app-brand-word">spotter</span>
            <button className="app-brand-app" onClick={onOpenShell} aria-label={t('apps')}>
              {t('appName')}
            </button>
          </div>
          <div className="app-brand-actions">
            <button
              className="app-bell"
              onClick={() => setTab('feed')}
              aria-label={t('notifications')}
            >
              <Icon
                name="bell"
                weight={tab === 'feed' ? 'fill' : undefined}
                className="app-brand-icon"
              />
              {notifUnread > 0 && tab !== 'feed' && (
                <span className="app-bell-badge">{notifUnread > 9 ? '9+' : notifUnread}</span>
              )}
            </button>
          </div>
        </header>

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
            <button className="n-addpill" onClick={() => setAdding(true)}>
              <Icon name="plus" weight="bold" className="n-addpill-plus" />
              <span>{t('addEntry')}</span>
            </button>
          </div>
        )}

        <nav className="apex-nav" role="tablist">
          {nav.map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={tab === x.id}
              className={tab === x.id ? 'active' : ''}
              onClick={() => setTab(x.id as Tab)}
            >
              <Icon name={x.icon} weight={tab === x.id ? 'fill' : undefined} />
              <span>{x.label}</span>
            </button>
          ))}
          <button className="apex-nav-apps" onClick={onOpenShell} aria-label={t('apps')}>
            <Icon name="squares-four" />
            <span>{t('apps')}</span>
          </button>
        </nav>
      </div>

      {adding && <AddFlow onClose={() => setAdding(false)} />}

      {detail && <EntryDetail entry={detail} onClose={() => setDetail(null)} onDelete={del} />}

      {undo && (
        <div className="snack">
          <span>{t('deleted')}</span>
          <button
            className="u"
            onClick={() => {
              store.restoreEntry(undo);
              setUndo(null);
              if (undoTimer.current) clearTimeout(undoTimer.current);
            }}
          >
            {t('undo')}
          </button>
        </div>
      )}
    </div>
  );
}
