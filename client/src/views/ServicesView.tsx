/**
 * Services — design S-07…S-09, plus a Settings block (documented addition:
 * the boards have no settings screen; the language picker lives here).
 */
import { useState } from 'react';
import { clearAuth } from '../api';
import { resetLocalData, type useStore } from '../store';
import { FLAGS, LOCALE_IDS, LOCALES, setLocale, useT } from '../i18n';
import { Dialog, Icon, LanguageSelector } from '../ui';

type Store = ReturnType<typeof useStore>;

export function ServicesView(props: {
  store: Store;
  onSignedOut: () => void;
  onOpenTraining: () => void;
}) {
  const { t, locale } = useT();
  const { store } = props;
  const [confirm, setConfirm] = useState(false);
  const [nowTs] = useState(() => Date.now());

  const weekAgo = nowTs - 7 * 24 * 3600 * 1000;
  const thisWeek = store.workouts.filter(
    (w) => w.finishedAt !== null && w.startedAt >= weekAgo,
  ).length;

  const status = store.syncStatus;

  return (
    <div className="screen" style={{ padding: '14px 20px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="h1">{t.services}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LanguageSelector />
          <button className="link" onClick={() => setConfirm(true)}>
            {t.signOut}
          </button>
        </div>
      </div>

      {status === 'offline' && store.queue.length > 0 && (
        <div className="banner offline">
          <Icon name="cloud-slash" />
          <span>{t.offlineQueuedLong(store.queue.length)}</span>
        </div>
      )}

      <button className="service-tile active" onClick={props.onOpenTraining}>
        <span className="plate">
          <Icon name="barbell" />
        </span>
        <span style={{ flex: 1 }}>
          <div className="t">{t.training}</div>
          <div className="s">
            {status === 'offline' && store.queue.length > 0
              ? t.worksOffline(store.queue.length)
              : t.trainingSub}
          </div>
        </span>
        {thisWeek > 0 && <span className="tag tag-accent">{t.nThisWeek(thisWeek)}</span>}
      </button>

      <div className="service-tile soon">
        <span className="plate">
          <Icon name="carrot" />
        </span>
        <span style={{ flex: 1 }}>
          <div className="t">{t.nutrition}</div>
          <div className="s">{t.soon}</div>
        </span>
      </div>

      <div className="service-tile soon">
        <span className="plate">
          <Icon name="robot" />
        </span>
        <span style={{ flex: 1 }}>
          <div className="t">{t.aiBodyScan}</div>
          <div className="s">{t.soon}</div>
        </span>
      </div>

      <div>
        <div className="section-label" style={{ marginBottom: 10 }}>
          {t.language}
        </div>
        <div className="seg">
          {LOCALE_IDS.map((id) => (
            <button
              key={id}
              className={locale === id ? 'active' : ''}
              onClick={() => setLocale(id)}
            >
              <span aria-hidden style={{ marginRight: 6 }}>
                {FLAGS[id]}
              </span>
              {LOCALES[id].locale}
            </button>
          ))}
        </div>
      </div>

      <div className="footer-status">
        <span
          className="dot"
          style={{
            background:
              status === 'synced'
                ? 'var(--color-ok)'
                : status === 'offline'
                  ? 'var(--color-danger)'
                  : 'var(--color-neutral-600)',
          }}
        />
        <span style={status === 'offline' ? { color: 'var(--color-danger-text)' } : undefined}>
          {status === 'synced'
            ? t.synced
            : status === 'offline'
              ? store.lastSyncAt
                ? t.offlineLastSync(t.minAgo(Math.round((nowTs - store.lastSyncAt) / 60000)))
                : t.offline
              : t.syncing}
        </span>
      </div>

      {confirm && (
        <Dialog
          title={t.signOutTitle}
          onClose={() => setConfirm(false)}
          actions={
            <>
              <button className="btn btn-secondary" onClick={() => setConfirm(false)}>
                {t.stay}
              </button>
              <button
                className="danger-outline"
                onClick={() => {
                  clearAuth();
                  resetLocalData();
                  props.onSignedOut();
                }}
              >
                {t.signOut}
              </button>
            </>
          }
        >
          {store.queue.length > 0 ? t.signOutQueueBody(store.queue.length) : t.signOutCleanBody}
        </Dialog>
      )}
    </div>
  );
}
