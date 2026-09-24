/**
 * Atlas — the coach screen (#/coach). First visit: a short setup (temper →
 * the Merciless fine print → role → only the data that's missing → push).
 * After that: his notes as a chat thread, newest at the bottom, plus settings.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { FLAGS, LOCALES, setLocale, useT } from '../i18n';
import { Icon, Sheet, Switch } from '../ui';
import { latestWeight, setCoach, updateBodyMetrics, useStore } from '../store';
import { AtlasFace, TemperHeat } from '../components/AtlasFace';
import { useAtlasFmt, useAtlasNotes, useMinuteClock } from '../atlas/notes';
import { TEMPER_COLOR, TEMPERS, type CoachRole, type Temper } from '../atlas/types';
import { enablePush, pushState } from '../push';
import { computePlaybook } from '../playbook';
import { blockWeek, isDeloadWeek, proposePlan, type CoachPlan } from '../atlas/plan';
import { askAtlas } from '../atlas/chat';
import { answerLocally, type Convo } from '../atlas/intents';
import { buildChatFacts } from '../atlas/chatFacts';
import { pushChat, updateChat, useChatLog, type ChatMsg } from '../atlas/chatLog';
import { useChatAccess } from '../atlas/chatAccess';
import { langOffer, loadOfferState, saveOfferState } from '../atlas/langOffer';
import { fmtBodyWeightKg } from '../i18n';

/** Wall clock for event handlers (kept out of render). */
const wallClock = (): number => Date.now();

type Step = 'meet' | 'temper' | 'fine' | 'role' | 'data' | 'push';

export function CoachView({ onClose }: { onClose: () => void }) {
  const store = useStore();
  return store.coach.enabled ? <CoachThread onClose={onClose} /> : <CoachSetup onClose={onClose} />;
}

// ---------------------------------------------------------------------------
// Setup

function CoachSetup({ onClose }: { onClose: () => void }) {
  const { t, locale } = useT();
  const store = useStore();
  const [step, setStep] = useState<Step>('meet');
  const [temper, setTemper] = useState<Temper>(store.coach.temper);
  const [role, setRole] = useState<CoachRole>(store.coach.role);
  const [yoMama, setYoMama] = useState(store.coach.yoMama);
  const [swearing, setSwearing] = useState(store.coach.swearing);
  const [pushHint, setPushHint] = useState<string | null>(null);
  const name = t.atlasTemper[temper - 1];
  const color = TEMPER_COLOR[temper];

  const finish = () => {
    setCoach({ enabled: true, temper, role, yoMama, swearing, startedAt: Date.now(), readAt: 0 });
  };
  const afterData = () => {
    const ps = pushState();
    if (ps === 'off' || ps === 'needs-install') setStep('push');
    else finish();
  };

  const back = () => {
    const order: Step[] = ['meet', 'temper', 'fine', 'role', 'data', 'push'];
    const i = order.indexOf(step);
    if (i <= 0) return onClose();
    let prev = order[i - 1];
    if (prev === 'fine' && temper < 5) prev = 'temper';
    setStep(prev);
  };

  return (
    <div className="screen atl-screen" style={{ ['--atl' as string]: color }}>
      <div className="atl-top">
        <button className="back" onClick={back} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
      </div>

      {step === 'meet' && (
        <div className="atl-meet">
          <AtlasFace temper={3} size={128} />
          <h2 className="atl-name">{t.atlasName}</h2>
          <p className="atl-lead">{t.atlasMeetText}</p>
          <div className="atl-faces">
            {TEMPERS.map((i) => (
              <AtlasFace key={i} temper={i} size={40} />
            ))}
          </div>
          <div className="atl-actions">
            <button className="btn btn-primary atl-cta" onClick={() => setStep('temper')}>
              {t.atlasChooseTemper}
            </button>
            <button className="btn btn-secondary atl-cta" onClick={onClose}>
              {t.atlasNotNow}
            </button>
          </div>
        </div>
      )}

      {step === 'temper' && (
        <div className="atl-body">
          <h2 className="title-26">{t.atlasTemperTitle}</h2>
          <p className="atl-sub">{t.atlasTemperSub}</p>
          <div className="atl-tempers" role="radiogroup" aria-label={t.atlasTemperTitle}>
            {TEMPERS.map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={temper === i}
                className={`atl-temper${temper === i ? ' on' : ''}`}
                style={{ ['--tc' as string]: TEMPER_COLOR[i] }}
                onClick={() => setTemper(i)}
              >
                <span className="atl-temper-bar" />
                <AtlasFace temper={i} size={40} />
                <span className="atl-temper-text">
                  <span className="atl-temper-name">
                    <b>{t.atlasTemper[i - 1]}</b>
                    <TemperHeat temper={i} />
                  </span>
                  <span className="atl-temper-tag">{t.atlasTemperTag[i - 1]}</span>
                  <span className="atl-temper-quote">{t.atlasTemperQuote[i - 1]}</span>
                </span>
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary atl-cta"
            onClick={() => setStep(temper === 5 ? 'fine' : 'role')}
          >
            {t.atlasTrainWith(name)}
          </button>
        </div>
      )}

      {step === 'fine' && (
        <div className="atl-body">
          <div className="atl-fine-head">
            <AtlasFace temper={5} size={84} />
            <h2 className="title-26">{t.atlasFineTitle}</h2>
            <p className="atl-sub">{t.atlasFineBody}</p>
          </div>
          <div className="atl-rules">
            <RuleRow label={t.atlasRuleEffort} sub={t.atlasRuleEffortSub} on locked />
            <RuleRow label={t.atlasRuleSoften} sub={t.atlasRuleSoftenSub} on locked />
            <RuleRow
              label={t.atlasRuleMom}
              sub={t.atlasRuleMomSub}
              on={yoMama}
              onToggle={() => setYoMama((v) => !v)}
            />
            <RuleRow
              label={t.atlasRuleSwear}
              sub={t.atlasRuleSwearSub}
              on={swearing}
              onToggle={() => setSwearing((v) => !v)}
            />
          </div>
          <div className="atl-actions">
            <button className="btn btn-primary atl-cta" onClick={() => setStep('role')}>
              {t.atlasTakeIt}
            </button>
            <button className="btn btn-secondary atl-cta" onClick={() => setStep('temper')}>
              {t.atlasSofter}
            </button>
          </div>
        </div>
      )}

      {step === 'role' && (
        <div className="atl-body atl-chat">
          <Bubble temper={temper}>{t.atlasRoleAsk}</Bubble>
          {(['main', 'extra'] as CoachRole[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`atl-card${role === r ? ' on' : ''}`}
              aria-pressed={role === r}
              onClick={() => setRole(r)}
            >
              <b>{r === 'main' ? t.atlasRoleMain : t.atlasRoleExtra}</b>
              <span>{r === 'main' ? t.atlasRoleMainSub : t.atlasRoleExtraSub}</span>
            </button>
          ))}
          <button className="btn btn-primary atl-cta" onClick={() => setStep('data')}>
            {t.atlasNext}
          </button>
        </div>
      )}

      {step === 'data' && <DataStep temper={temper} onDone={afterData} />}

      {step === 'push' && (
        <div className="atl-meet">
          <AtlasFace temper={temper} size={96} />
          <h2 className="title-26">{t.atlasPushTitle}</h2>
          <p className="atl-lead">{t.atlasPushBody}</p>
          {pushState() === 'needs-install' && <p className="atl-hint">{t.pushNeedsInstall}</p>}
          {pushHint && <p className="atl-hint">{pushHint}</p>}
          <div className="atl-actions">
            {pushState() !== 'needs-install' && (
              <button
                className="btn btn-primary atl-cta"
                onClick={async () => {
                  const st = await enablePush(locale);
                  if (st === 'on') finish();
                  else setPushHint(t.pushDenied);
                }}
              >
                {t.atlasPushOn}
              </button>
            )}
            <button className="btn btn-secondary atl-cta" onClick={finish}>
              {t.atlasNotNow}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RuleRow(props: {
  label: string;
  sub: string;
  on: boolean;
  locked?: boolean;
  onToggle?: () => void;
}) {
  return (
    <button
      type="button"
      className="toggle-row atl-rule"
      aria-pressed={props.on}
      aria-disabled={props.locked || undefined}
      onClick={props.locked ? undefined : props.onToggle}
    >
      <span className="rest-pref-text">
        <span className="lab">{props.label}</span>
        <span className="sub">{props.sub}</span>
      </span>
      {props.locked && <Icon name="lock" />}
      <Switch on={props.on} />
    </button>
  );
}

function Bubble({ temper, children }: { temper: Temper; children: React.ReactNode }) {
  return (
    <div className="atl-say">
      <AtlasFace temper={temper} size={28} />
      <div className="atl-bubble">{children}</div>
    </div>
  );
}

/** "What I know" + inline pickers for only what's missing (each skippable). */
function DataStep({ temper, onDone }: { temper: Temper; onDone: () => void }) {
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
            <button
              className="atl-chip"
              onClick={() => {
                updateBodyMetrics({ sex: 'male' });
                setAsked((a) => ({ ...a, sex: false }));
              }}
            >
              {t.atlasMale}
            </button>
            <button
              className="atl-chip"
              onClick={() => {
                updateBodyMetrics({ sex: 'female' });
                setAsked((a) => ({ ...a, sex: false }));
              }}
            >
              {t.atlasFemale}
            </button>
            <button className="atl-chip" onClick={() => setAsked((a) => ({ ...a, sex: false }))}>
              {t.atlasSkip}
            </button>
          </div>
        </>
      )}
      {!asked.sex && asked.dob && (
        <>
          <Bubble temper={temper}>{t.atlasAskBirth}</Bubble>
          <div className="atl-years">
            <button className="atl-chip" aria-label="−" onClick={() => setYear((y) => y - 5)}>
              <Icon name="caret-left" />
            </button>
            {years.map((y) => (
              <button
                key={y}
                className="atl-chip"
                onClick={() => {
                  updateBodyMetrics({ dob: `${y}-07-01` });
                  setAsked((a) => ({ ...a, dob: false }));
                }}
              >
                {y}
              </button>
            ))}
            <button className="atl-chip" aria-label="+" onClick={() => setYear((y) => y + 5)}>
              <Icon name="caret-right" />
            </button>
          </div>
          <div className="atl-replies">
            <button className="atl-chip" onClick={() => setAsked((a) => ({ ...a, dob: false }))}>
              {t.atlasSkip}
            </button>
          </div>
        </>
      )}
      {!asked.sex && !asked.dob && asked.height && (
        <>
          <Bubble temper={temper}>{t.atlasAskHeight}</Bubble>
          <div className="atl-stepper">
            <button className="atl-chip" aria-label="−" onClick={() => setHeight((h) => h - 1)}>
              −
            </button>
            <b className="tnum">{height} cm</b>
            <button className="atl-chip" aria-label="+" onClick={() => setHeight((h) => h + 1)}>
              +
            </button>
          </div>
          <div className="atl-replies">
            <button
              className="atl-chip on"
              onClick={() => {
                updateBodyMetrics({ heightCm: height });
                setAsked((a) => ({ ...a, height: false }));
              }}
            >
              {t.atlasSave}
            </button>
            <button className="atl-chip" onClick={() => setAsked((a) => ({ ...a, height: false }))}>
              {t.atlasSkip}
            </button>
          </div>
        </>
      )}
      <p className="atl-hint">{t.atlasSkipHint}</p>
      <button className="btn btn-primary atl-cta" onClick={onDone}>
        {t.atlasNext}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread

function dayLabel(at: number, now: number, t: ReturnType<typeof useT>['t'], locale: string) {
  const d0 = new Date(now).setHours(0, 0, 0, 0);
  if (at >= d0) return t.atlasToday;
  if (at >= d0 - 86_400_000) return t.atlasYesterday;
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(at);
}

function CoachThread({ onClose }: { onClose: () => void }) {
  const { t, locale } = useT();
  const store = useStore();
  const { notes, temper } = useAtlasNotes();
  const [settings, setSettings] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const chosen = store.coach.temper;
  const now = useMinuteClock();

  // Opening the thread reads everything in it.
  useEffect(() => {
    const newest = notes.reduce((m, n) => Math.max(m, n.at), 0);
    if (newest > store.coach.readAt) setCoach({ readAt: newest });
  }, [notes, store.coach.readAt]);

  const canChat = useChatAccess();
  const fmt = useAtlasFmt();
  const chat = useChatLog();
  const [draft, setDraft] = useState('');
  const [consent, setConsent] = useState<string | null>(null);
  const busy = chat.some((m) => m.pending);

  const convo = useRef<Convo>({});
  /** Reveal a local answer word by word — reads like a live reply, not a lookup. */
  const typeOut = (id: string, at: number, text: string, chips?: string[]) =>
    new Promise<void>((resolve) => {
      const words = text.split(' ');
      pushChat({ id, at, from: 'atlas', text: '…', pending: true });
      let i = 0;
      const step = Math.max(1, Math.round(words.length / 18));
      const tick = () => {
        i = Math.min(words.length, i + step);
        const done = i >= words.length;
        updateChat(id, { text: words.slice(0, i).join(' '), pending: !done, ...(done && chips?.length ? { chips } : {}) });
        if (done) resolve();
        else window.setTimeout(tick, 35);
      };
      window.setTimeout(tick, 280);
    });

  /** Typed in another language → answer in the app's language, then offer the switch once. */
  const send = async (text: string, consented = false, typed = true) => {
    const q = text.trim();
    if (!q || busy) return;
    let offer: ReturnType<typeof langOffer>['offer'] = null;
    if (typed) {
      const r = langOffer(q, locale, loadOfferState());
      saveOfferState(r.state);
      offer = r.offer;
    }
    const answered = await reply(q, consented);
    if (offer && answered) {
      const at = wallClock();
      pushChat({ id: `lang-${at}`, at, from: 'atlas', text: t.atlasLangOffer(LOCALES[offer].locale), langOffer: offer });
    }
  };

  /** Answer one message; false when it stopped for the Gemini consent sheet. */
  const reply = async (q: string, consented: boolean): Promise<boolean> => {
    setDraft('');
    const at = wallClock();
    const history = chat.filter((m) => !m.notice);
    pushChat({ id: `me-${at}`, at, from: 'me', text: q });
    const rid = `at-${at}`;
    // 1) Atlas's own answer base — instant, offline, from your data, and it
    //    follows the thread ("why?", "more", "and squat?").
    const local = answerLocally(q, { s: store, now: at, locale, temper, fmt }, convo.current);
    if (local && !(local.escalate && canChat)) {
      convo.current = local.convo;
      await typeOut(rid, at + 1, local.text, local.chips);
      return true;
    }
    if (local?.escalate) convo.current = local.convo;
    // 2) Nothing fits → Gemini (closed testing), seamlessly in the same thread.
    if (!canChat) {
      await typeOut(rid, at + 1, t.atlasLocalUnknown, [
        t.atlasSuggestToday,
        t.atlasSuggestProgress,
        t.atlasSuggestRest,
      ]);
      return true;
    }
    if (!store.coach.chatConsent && !consented) {
      setConsent(q);
      return false;
    }
    await sendGemini(q, history);
    return true;
  };

  /** The Gemini leg of a message (the question is already in the thread). */
  const sendGemini = async (q: string, history = chat.filter((m) => !m.notice)) => {
    const at = wallClock();
    const rid = `at-${at}`;
    pushChat({ id: rid, at, from: 'atlas', text: '…', pending: true });
    const res = await askAtlas({
      question: q,
      history: history.map((m) => ({ from: m.from, text: m.text })),
      temper,
      coach: { ...store.coach, chatConsent: true },
      locale,
      factsJson: buildChatFacts(store, notes, temper, at),
      now: at,
      onText: (partial) => updateChat(rid, { text: partial }),
    });
    if (!res.ok && res.reason === 'quota') {
      updateChat(rid, { pending: false, text: t.atlasLocalUnknown });
      const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
        res.until ?? at,
      );
      pushChat({
        id: `n-${at}`,
        at: at + 1,
        from: 'atlas',
        notice: true,
        text: t.atlasQuotaNotice(time),
      });
      return;
    }
    updateChat(rid, {
      pending: false,
      text: res.ok
        ? res.text
        : res.reason === 'offline'
          ? t.atlasChatOffline
          : res.reason === 'cap'
            ? t.atlasChatCap
            : res.reason === 'blocked'
              ? t.atlasChatBlocked
              : t.atlasChatError,
    });
  };

  type Item = {
    id: string;
    at: number;
    from: 'me' | 'atlas';
    text: string;
    pending?: boolean;
    notice?: boolean;
    chips?: string[];
    langOffer?: ChatMsg['langOffer'];
  };
  const items: Item[] = useMemo(
    () =>
      [
        ...notes.map((n) => ({ id: n.id, at: n.at, from: 'atlas' as const, text: n.text })),
        ...chat.map((m: ChatMsg) => m),
      ].sort((a, b) => a.at - b.at),
    [notes, chat],
  );

  const lastText = items[items.length - 1]?.text;
  // Follow-up chips live on the newest answer until you write again
  // (a language offer after it doesn't hide them).
  let chipsId: string | null = null;
  for (let i = items.length - 1; i >= 0 && items[i].from !== 'me'; i--)
    if (items[i].chips?.length) {
      chipsId = items[i].id;
      break;
    }
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [items.length, lastText]);

  const groups = useMemo(() => {
    const out: { label: string; items: Item[] }[] = [];
    for (const n of items) {
      const label = dayLabel(n.at, now, t, locale);
      if (out.length && out[out.length - 1].label === label) out[out.length - 1].items.push(n);
      else out.push({ label, items: [n] });
    }
    return out;
  }, [items, now, t, locale]);

  return (
    <div
      className="screen atl-screen atl-thread"
      style={{ ['--atl' as string]: TEMPER_COLOR[temper] }}
    >
      <div className="atl-head">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <AtlasFace temper={temper} size={38} />
        <span className="atl-head-text">
          <b>
            {t.atlasName} <span className="atl-temper-inline">· {t.atlasTemper[temper - 1]}</span>
          </b>
          <span>
            {store.coach.role === 'main' ? t.atlasRoleMainShort : t.atlasRoleExtraShort}
            {temper < chosen ? ` · ${t.atlasSoftened}` : ''}
          </span>
        </span>
        <TemperHeat temper={temper} />
        <button
          className="atl-icon-btn"
          onClick={() => setSettings(true)}
          aria-label={t.atlasSettings}
        >
          <Icon name="gear" />
        </button>
      </div>
      <div className="atl-feed">
        {store.coach.role === 'main' && <PlanCard temper={temper} now={now} />}
        {notes.length === 0 && <p className="atl-empty">{t.atlasEmpty}</p>}
        {groups.map((g) => (
          <div key={g.label} className="atl-group">
            <span className="atl-day">{g.label}</span>
            {g.items.map((n) =>
              n.notice ? (
                <div key={n.id} className="atl-notice" role="status">
                  {n.text}
                </div>
              ) : n.from === 'me' ? (
                <div key={n.id} className="atl-me">
                  {n.text}
                </div>
              ) : (
                <div key={n.id} className="atl-msg">
                  <Bubble temper={temper}>
                    <span className={n.pending ? 'atl-typing' : undefined}>{n.text}</span>
                  </Bubble>
                  {n.chips && n.id === chipsId && !busy && (
                    <div className="atl-suggest">
                      {n.chips.map((ch) => (
                        <button key={ch} type="button" className="atl-chip" onClick={() => void send(ch, false, false)}>
                          {ch}
                        </button>
                      ))}
                    </div>
                  )}
                  {n.langOffer && !busy && (
                    <div className="atl-suggest">
                      <button
                        type="button"
                        className="atl-chip"
                        onClick={() => {
                          const to = n.langOffer!;
                          updateChat(n.id, { langOffer: undefined });
                          setLocale(to);
                          const at = wallClock();
                          pushChat({ id: `lang-ok-${at}`, at, from: 'atlas', text: LOCALES[to].atlasLangDone });
                        }}
                      >
                        {FLAGS[n.langOffer]} {LOCALES[n.langOffer].locale}
                      </button>
                      <button type="button" className="atl-chip" onClick={() => updateChat(n.id, { langOffer: undefined })}>
                        {t.atlasLangKeep}
                      </button>
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        ))}
        <div ref={endRef} className="atl-end" />
      </div>
      <form
        className="atl-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <label className="sr-only" htmlFor="atl-input">
          {t.atlasAsk}
        </label>
        <input
          id="atl-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t.atlasAsk}
          maxLength={400}
          autoComplete="off"
          enterKeyHint="send"
        />
        <button type="submit" aria-label={t.atlasSend} disabled={!draft.trim() || busy}>
          <Icon name="arrow-up" />
        </button>
      </form>
      {consent !== null && (
        <Sheet onClose={() => setConsent(null)} className="atl-sheet">
          <div className="sheet-head">
            <h3>{t.atlasConsentTitle}</h3>
          </div>
          <p className="atl-consent">{t.atlasConsentBody}</p>
          <div className="sheet-actions">
            <button className="btn btn-secondary grow" onClick={() => setConsent(null)}>
              {t.atlasNotNow}
            </button>
            <button
              className="btn btn-primary grow"
              onClick={() => {
                const q = consent;
                setCoach({ chatConsent: true });
                setConsent(null);
                void sendGemini(q);
              }}
            >
              {t.atlasConsentOk}
            </button>
          </div>
        </Sheet>
      )}
      {settings && <CoachSettingsSheet onClose={() => setSettings(false)} />}
    </div>
  );
}

/** The programme: offer to write it, or show the block and its weekdays. */
function PlanCard({ temper, now }: { temper: Temper; now: number }) {
  const { t, locale } = useT();
  const store = useStore();
  const plan = store.coach.plan ?? null;
  const write = () => {
    const finished = store.workouts.filter((w) => w.finishedAt !== null);
    const next: CoachPlan = proposePlan({
      finished,
      plays: computePlaybook(finished, now).plays,
      now,
    });
    setCoach({ plan: next });
  };
  if (!plan)
    return (
      <div className="atl-group">
        <Bubble temper={temper}>{t.atlasPlanOffer}</Bubble>
        <div className="atl-replies">
          <button className="atl-chip on" onClick={write}>
            {t.atlasPlanWrite}
          </button>
        </div>
      </div>
    );
  const week = blockWeek(plan, now);
  const done = week > plan.weeks;
  const today = new Date(now).getDay();
  const wd = (d: number) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2026, 0, 4 + d));
  const mName = (m: string) => (t.muscleGroups as Record<string, string>)[m] ?? m;
  return (
    <div className="atl-plan">
      <span className="atl-plan-kicker">
        {done ? t.atlasPlanDone : t.atlasPlanKicker(week, plan.weeks, plan.days.length)}
        {!done && isDeloadWeek(plan, now) ? ` · ${t.atlasPlanDeload}` : ''}
      </span>
      <span className="atl-plan-bar" aria-hidden>
        {Array.from({ length: plan.weeks }, (_, i) => (
          <span key={i} className={i + 1 < week ? 'done' : i + 1 === week ? 'now' : ''} />
        ))}
      </span>
      {plan.days.map((d) => (
        <div key={d.weekday} className={`atl-plan-day${d.weekday === today ? ' today' : ''}`}>
          <span className="atl-plan-wd">{wd(d.weekday)}</span>
          <span className="atl-plan-name">
            <b>{d.name ?? t.splitNames[d.split]}</b>
            <span>{d.muscles.map(mName).join(' · ')}</span>
          </span>
          {d.weekday === today && <span className="atl-plan-today">{t.atlasToday}</span>}
        </div>
      ))}
      <div className="atl-plan-meta">
        {t.atlasPlanMeta(plan.lengthMin, plan.warmup)}
        <button className="atl-link" onClick={write}>
          {done ? t.atlasPlanNewBlock : t.atlasPlanRewrite}
        </button>
      </div>
    </div>
  );
}

function CoachSettingsSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const { coach } = useStore();
  return (
    <Sheet onClose={onClose} className="atl-sheet">
      <div className="sheet-head">
        <h3>{t.atlasSettings}</h3>
      </div>
      <div className="se-label se-label-first">{t.atlasTemperLabel}</div>
      <div className="atl-temper-pick">
        {TEMPERS.map((i) => (
          <button
            key={i}
            type="button"
            aria-pressed={coach.temper === i}
            className={coach.temper === i ? 'on' : ''}
            style={{ ['--tc' as string]: TEMPER_COLOR[i] }}
            onClick={() => setCoach({ temper: i })}
          >
            <AtlasFace temper={i} size={34} />
            <span>{t.atlasTemper[i - 1]}</span>
          </button>
        ))}
      </div>
      <div className="se-label">{t.atlasRoleLabel}</div>
      <div className="atl-seg">
        {(['main', 'extra'] as CoachRole[]).map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={coach.role === r}
            className={coach.role === r ? 'on' : ''}
            onClick={() => setCoach({ role: r })}
          >
            {r === 'main' ? t.atlasRoleMain : t.atlasRoleExtra}
          </button>
        ))}
      </div>
      <div className="se-group">
        <RuleRow
          label={t.atlasRuleMom}
          sub={t.atlasRuleMomSub}
          on={coach.yoMama}
          onToggle={() => setCoach({ yoMama: !coach.yoMama })}
        />
        <RuleRow label={t.atlasRuleEffort} sub={t.atlasRuleEffortSub} on locked />
        <RuleRow label={t.atlasRuleSoften} sub={t.atlasRuleSoftenSub} on locked />
      </div>
      <div className="sheet-actions">
        <button
          className="btn btn-secondary grow"
          onClick={() => {
            setCoach({ enabled: false });
            onClose();
          }}
        >
          {t.atlasTurnOff}
        </button>
        <button className="btn btn-primary grow" onClick={onClose}>
          {t.done}
        </button>
      </div>
    </Sheet>
  );
}
