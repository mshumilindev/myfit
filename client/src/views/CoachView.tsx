/**
 * Atlas — the coach screen (#/coach). First visit: a short setup (temper →
 * the Merciless fine print → role → only the data that's missing → push).
 * After that: his notes as a chat thread, newest at the bottom, plus settings.
 */
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FLAGS, LOCALES, setLocale, useT } from '../i18n';
import { Icon, Sheet, Switch } from '../ui';
import { latestWeight, setCoach, updateBodyMetrics, useSelfTrainerId, useStore } from '../store';
import { AtlasFace, TemperHeat } from '../components/AtlasFace';
import { useAtlasFmt, useAtlasNotes, useMinuteClock } from '../atlas/notes';
import {
  extrasFor,
  momAllowed,
  swearAllowed,
  TEMPER_COLOR,
  TEMPERS,
  temperIndex,
  type CoachRole,
  type Temper,
} from '../atlas/types';
import { enablePush, pushState } from '../push';
import { computePlaybook } from '../playbook';
import { blockWeek, isDeloadWeek, proposePlan, type CoachPlan } from '../atlas/plan';
import { askAtlas, classifyTopic } from '../atlas/chat';
import { answerAs, answerLocally, didYouMean, topicMenu, type Convo } from '../atlas/intents';
import { clearSaid, loadSaid, mergeMemory, rememberSaid } from '../atlas/memory';
import { teach, unteach } from '../atlas/teach';
import { runAction } from '../atlas/actions';
import { ChatChart } from '../components/ChatChart';
import { buildChatFacts } from '../atlas/chatFacts';
import { clearChat, pushChat, updateChat, useChatLog, type ChatMsg } from '../atlas/chatLog';
import { useChatAccess } from '../atlas/chatAccess';
import { langOffer, loadOfferState, saveOfferState } from '../atlas/langOffer';
import { fmtBodyWeightKg } from '../i18n';

/** Answers not worth a 👍 / 👎 (small talk, "did you mean…", memory notes). */
const UNRATED = new Set(['did_you_mean', 'emoji', 'memory_note']);

/** Wall clock for event handlers (kept out of render). */
const wallClock = (): number => Date.now();

type Step = 'meet' | 'temper' | 'fine' | 'role' | 'data' | 'push';

export function CoachView({
  onClose,
  onOpenSession,
}: {
  onClose: () => void;
  /** Open a workout (when Atlas starts one from chat). */
  onOpenSession?: (workoutId: string) => void;
}) {
  const store = useStore();
  return store.coach.enabled ? (
    <CoachThread onClose={onClose} onOpenSession={onOpenSession} />
  ) : (
    <CoachSetup onClose={onClose} />
  );
}

// ---------------------------------------------------------------------------
// Setup

function CoachSetup({ onClose }: { onClose: () => void }) {
  const { t, locale } = useT();
  const store = useStore();
  const [step, setStep] = useState<Step>('meet');
  const [temper, setTemper] = useState<Temper>(store.coach.temper);
  // With a human coach, Atlas can only be the extra coach.
  const human = !!useSelfTrainerId();
  const [role, setRole] = useState<CoachRole>(human ? 'extra' : store.coach.role);
  const [yoMama, setYoMama] = useState(store.coach.yoMama);
  const [swearing, setSwearing] = useState(store.coach.swearing);
  const [pushHint, setPushHint] = useState<string | null>(null);
  const name = t.atlasTemper[temperIndex(temper)];
  const color = TEMPER_COLOR[temper];

  const finish = () => {
    setCoach({
      enabled: true,
      temper,
      role,
      yoMama: yoMama && momAllowed(temper),
      swearing: swearing && swearAllowed(temper),
      startedAt: Date.now(),
      readAt: 0,
    });
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
                onClick={() => {
                  setTemper(i);
                  const x = extrasFor(i);
                  setYoMama(x.yoMama);
                  setSwearing(x.swearing);
                }}
              >
                <span className="atl-temper-bar" />
                <AtlasFace temper={i} size={40} />
                <span className="atl-temper-text">
                  <span className="atl-temper-name">
                    <b>{t.atlasTemper[temperIndex(i)]}</b>
                    <TemperHeat temper={i} />
                  </span>
                  <span className="atl-temper-tag">{t.atlasTemperTag[temperIndex(i)]}</span>
                  <span className="atl-temper-quote">{t.atlasTemperQuote[temperIndex(i)]}</span>
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
              disabled={human && r === 'main'}
              onClick={() => setRole(r)}
            >
              <b>{r === 'main' ? t.atlasRoleMain : t.atlasRoleExtra}</b>
              <span>
                {r === 'main'
                  ? human
                    ? t.atlasRoleHumanCoach
                    : t.atlasRoleMainSub
                  : t.atlasRoleExtraSub}
              </span>
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

function CoachThread({
  onClose,
  onOpenSession,
}: {
  onClose: () => void;
  onOpenSession?: (workoutId: string) => void;
}) {
  const { t, locale } = useT();
  const store = useStore();
  const { notes, temper } = useAtlasNotes();
  const [settings, setSettings] = useState(false);
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    if (!portrait) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPortrait(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [portrait]);
  const endRef = useRef<HTMLDivElement>(null);
  const chosen = store.coach.temper;
  const now = useMinuteClock();

  // Notes are read as they scroll into view (like notifications). The read
  // mark at open time is frozen so a note keeps its highlight while you read.
  const [readSnap] = useState(() => store.coach.readAt);
  const feedRef = useRef<HTMLDivElement>(null);
  const readTo = useRef(store.coach.readAt);
  const readTimer = useRef<number | null>(null);
  useEffect(() => {
    const root = feedRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        let top = readTo.current;
        for (const e of entries)
          if (e.isIntersecting)
            top = Math.max(top, Number((e.target as HTMLElement).dataset.noteAt));
        if (top <= readTo.current) return;
        readTo.current = top;
        // One write per burst of scrolling, not per bubble.
        if (readTimer.current) window.clearTimeout(readTimer.current);
        readTimer.current = window.setTimeout(() => setCoach({ readAt: readTo.current }), 500);
      },
      { threshold: 0.6 },
    );
    root.querySelectorAll<HTMLElement>('[data-note-at]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [notes.length]);
  useEffect(
    () => () => {
      if (readTimer.current) {
        window.clearTimeout(readTimer.current);
        setCoach({ readAt: readTo.current });
      }
    },
    [],
  );

  // A human coach owns the programme — Atlas steps back to extra coach.
  const human = !!useSelfTrainerId();
  useEffect(() => {
    if (human && store.coach.role === 'main') setCoach({ role: 'extra' });
  }, [human, store.coach.role]);

  const canChat = useChatAccess();
  const fmt = useAtlasFmt();
  const chat = useChatLog();
  const [draft, setDraft] = useState('');
  const [consent, setConsent] = useState<string | null>(null);
  const busy = chat.some((m) => m.pending);

  const convo = useRef<Convo>({});
  /** Reveal a local answer word by word — reads like a live reply, not a lookup. */
  const typeOut = (
    id: string,
    at: number,
    text: string,
    chips?: string[],
    extra: Partial<ChatMsg> = {},
  ) =>
    new Promise<void>((resolve) => {
      const words = text.split(' ');
      pushChat({ id, at, from: 'atlas', text: '…', pending: true });
      let i = 0;
      const step = Math.max(1, Math.round(words.length / 18));
      const tick = () => {
        i = Math.min(words.length, i + step);
        const done = i >= words.length;
        updateChat(id, {
          text: words.slice(0, i).join(' '),
          pending: !done,
          ...(done && chips?.length ? { chips } : {}),
          ...(done ? extra : {}),
        });
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
      pushChat({
        id: `lang-${at}`,
        at,
        from: 'atlas',
        text: t.atlasLangOffer(LOCALES[offer].locale),
        langOffer: offer,
      });
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
    const ctx = {
      s: store,
      now: at,
      locale,
      temper,
      fmt,
      mem: store.coach.memory,
      said: loadSaid(),
    };
    let local = answerLocally(q, ctx, convo.current);
    // Unsure which topic it is → Gemini only picks the topic (from Atlas's own
    // list); the answer is still built here, from your data.
    if (local?.intent === 'did_you_mean' && canChat && store.coach.chatConsent) {
      const id = await classifyTopic({ question: q, topics: topicMenu(q, ctx), now: at });
      const routed = id ? answerAs(id, q, ctx, convo.current) : null;
      if (routed) local = routed;
    }
    // Memory: what you told me now, and what I answered (for consistency).
    if (local?.learned) setCoach({ memory: mergeMemory(store.coach.memory, local.learned) });
    if (local?.said) rememberSaid(local.said);
    if (local && !(local.escalate && canChat)) {
      convo.current = local.convo;
      await typeOut(rid, at + 1, local.text, local.chips, {
        ...(local.chart ? { chart: local.chart } : {}),
        ...(local.action ? { action: local.action } : {}),
        ...(!local.action && !UNRATED.has(local.intent) ? { intent: local.intent, q } : {}),
      });
      return true;
    }
    if (local?.escalate) convo.current = local.convo;
    // 2) Nothing fits → Gemini (closed testing), seamlessly in the same thread.
    if (!canChat) {
      const guess = didYouMean(q, ctx);
      // Your pick among these teaches Atlas this wording.
      if (guess.length)
        convo.current = { ...convo.current, pendingTeach: { q, offered: guess.map((g) => g.id) } };
      await typeOut(
        rid,
        at + 1,
        guess.length ? t.atlasDidYouMean : t.atlasLocalUnknown,
        guess.length
          ? guess.map((g) => g.ask)
          : [t.atlasSuggestToday, t.atlasSuggestProgress, t.atlasSuggestRest],
      );
      return true;
    }
    if (!store.coach.chatConsent && !consented) {
      setConsent(q);
      return false;
    }
    await sendGemini(q, history);
    return true;
  };

  /**
   * 👍 — this wording means this topic; 👎 — it doesn't: Atlas remembers and
   * offers the closest other topics (your pick teaches it the right one).
   */
  const rate = (n: Item, up: boolean) => {
    if (!n.intent || !n.q) return;
    const now = wallClock();
    const mem = store.coach.memory;
    const patch = up ? teach(mem, n.q, n.intent, now) : unteach(mem, n.q, n.intent, now);
    setCoach({ memory: mergeMemory(mem, patch) });
    updateChat(n.id, { rated: up ? 'up' : 'down' });
    if (up) return;
    const ctx = { s: store, now, locale, temper, fmt, mem: mergeMemory(mem, patch) };
    const alts = didYouMean(n.q, ctx, [n.intent]);
    convo.current = alts.length
      ? { ...convo.current, pendingTeach: { q: n.q, offered: alts.map((a) => a.id) } }
      : {};
    pushChat({
      id: `fix-${now}`,
      at: now,
      from: 'atlas',
      text: alts.length ? t.atlasWrongPick : t.atlasWrongNoted,
      ...(alts.length ? { chips: alts.map((a) => a.ask) } : {}),
    });
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
    chart?: ChatMsg['chart'];
    action?: ChatMsg['action'];
    intent?: string;
    q?: string;
    rated?: ChatMsg['rated'];
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
  // 👍 / 👎 only on Atlas's newest answer, until you write again.
  const last = items[items.length - 1];
  const rateId = last && last.from === 'atlas' && last.intent && !last.rated ? last.id : null;
  const noteIds = useMemo(() => new Set(notes.map((n) => n.id)), [notes]);
  const unreadCount = notes.filter((n) => n.at > readSnap).length;
  const firstUnreadId = notes.find((n) => n.at > readSnap)?.id ?? null;
  // Open at the first unread note; after that, follow the newest message.
  const opened = useRef(false);
  useEffect(() => {
    if (!opened.current) {
      opened.current = true;
      const mark = feedRef.current?.querySelector('.atl-new');
      if (mark) {
        mark.scrollIntoView({ block: 'start' });
        return;
      }
    }
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [items.length, lastText]);

  // Older messages load as you scroll up — not all at once.
  const PAGE = 30;
  const [limit, setLimit] = useState(() => {
    const firstUnread = items.findIndex((n) => n.id === firstUnreadId);
    return Math.max(PAGE, firstUnread >= 0 ? items.length - firstUnread + 5 : 0);
  });
  const screenRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const keepFromBottom = useRef<number | null>(null);
  const hasOlder = items.length > limit;
  useEffect(() => {
    const el = topRef.current;
    const root = screenRef.current;
    if (!el || !root || !hasOlder) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        keepFromBottom.current = root.scrollHeight - root.scrollTop;
        setLimit((l) => l + PAGE);
      },
      { root, rootMargin: '200px 0px 0px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasOlder, limit]);
  // Keep the view where it was when older messages appear above.
  useLayoutEffect(() => {
    const root = screenRef.current;
    if (root && keepFromBottom.current != null) {
      root.scrollTop = root.scrollHeight - keepFromBottom.current;
      keepFromBottom.current = null;
    }
  }, [limit]);
  const shown = useMemo(
    () => (hasOlder ? items.slice(items.length - limit) : items),
    [items, hasOlder, limit],
  );

  const groups = useMemo(() => {
    const out: { label: string; items: Item[] }[] = [];
    for (const n of shown) {
      const label = dayLabel(n.at, now, t, locale);
      if (out.length && out[out.length - 1].label === label) out[out.length - 1].items.push(n);
      else out.push({ label, items: [n] });
    }
    return out;
  }, [shown, now, t, locale]);

  return (
    <div
      ref={screenRef}
      className="screen atl-screen atl-thread"
      style={{ ['--atl' as string]: TEMPER_COLOR[temper] }}
    >
      <div className="atl-head">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <button
          type="button"
          className="atl-face-btn"
          onClick={() => setPortrait(true)}
          aria-label={t.atlasName}
        >
          <AtlasFace temper={temper} size={38} />
        </button>
        <span className="atl-head-text">
          <b>
            {t.atlasName}{' '}
            <span className="atl-temper-inline">· {t.atlasTemper[temperIndex(temper)]}</span>
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
      <div className="atl-feed" ref={feedRef}>
        {store.coach.role === 'main' && <PlanCard temper={temper} now={now} />}
        {notes.length === 0 && <p className="atl-empty">{t.atlasEmpty}</p>}
        {hasOlder && <div ref={topRef} className="atl-older" aria-hidden />}
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
                <Fragment key={n.id}>
                  {n.id === firstUnreadId && (
                    <div className="atl-new" role="status">
                      <span>{t.atlasNewNotes(unreadCount)}</span>
                    </div>
                  )}
                  <div
                    className={`atl-msg${noteIds.has(n.id) && n.at > readSnap ? ' unread' : ''}`}
                    data-note-at={noteIds.has(n.id) ? n.at : undefined}
                  >
                    <Bubble temper={temper}>
                      <span className={n.pending ? 'atl-typing' : undefined}>{n.text}</span>
                      {n.chart && !n.pending && <ChatChart chart={n.chart} locale={locale} />}
                    </Bubble>
                    {n.action && !busy && (
                      <div className="atl-suggest">
                        <button
                          type="button"
                          className="atl-chip atl-chip-do"
                          onClick={() => {
                            const act = n.action!;
                            updateChat(n.id, { action: undefined });
                            const L = (en: string, uk: string) => (locale === 'uk' ? uk : en);
                            const res = runAction(act, store, wallClock(), L, fmt.exercise);
                            const at = wallClock();
                            pushChat({ id: `act-${at}`, at, from: 'atlas', text: res.text });
                            if (res.openWorkoutId) onOpenSession?.(res.openWorkoutId);
                          }}
                        >
                          {t.atlasDoIt}
                        </button>
                        <button
                          type="button"
                          className="atl-chip"
                          onClick={() => updateChat(n.id, { action: undefined })}
                        >
                          {t.atlasCancel}
                        </button>
                      </div>
                    )}
                    {n.id === rateId && !busy && (
                      <div className="atl-rate">
                        <button
                          type="button"
                          aria-label={t.atlasRateUp}
                          title={t.atlasRateUp}
                          onClick={() => rate(n, true)}
                        >
                          <Icon name="thumbs-up" />
                        </button>
                        <button
                          type="button"
                          aria-label={t.atlasRateDown}
                          title={t.atlasRateDown}
                          onClick={() => rate(n, false)}
                        >
                          <Icon name="thumbs-down" />
                        </button>
                      </div>
                    )}
                    {n.chips && n.id === chipsId && !busy && (
                      <div className="atl-suggest">
                        {n.chips.map((ch) => (
                          <button
                            key={ch}
                            type="button"
                            className="atl-chip"
                            onClick={() => void send(ch, false, false)}
                          >
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
                            pushChat({
                              id: `lang-ok-${at}`,
                              at,
                              from: 'atlas',
                              text: LOCALES[to].atlasLangDone,
                            });
                          }}
                        >
                          {FLAGS[n.langOffer]} {LOCALES[n.langOffer].locale}
                        </button>
                        <button
                          type="button"
                          className="atl-chip"
                          onClick={() => updateChat(n.id, { langOffer: undefined })}
                        >
                          {t.atlasLangKeep}
                        </button>
                      </div>
                    )}
                  </div>
                </Fragment>
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
      {portrait && (
        <div
          className="atl-portrait"
          role="dialog"
          aria-label={`${t.atlasName} · ${t.atlasTemper[temperIndex(temper)]}`}
          onClick={() => setPortrait(false)}
        >
          <img src={`/atlas/atlas-${temper}-full.webp`} alt="" />
          <span className="atl-portrait-name">
            {t.atlasName}{' '}
            <span className="atl-temper-inline">· {t.atlasTemper[temperIndex(temper)]}</span>
          </span>
          <button type="button" className="atl-portrait-close" aria-label={t.backAction}>
            <Icon name="x" />
          </button>
        </div>
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
  const human = !!useSelfTrainerId();
  // A draft: nothing changes (and nothing is rebuilt) until Save.
  const [draft, setDraft] = useState(() => ({
    temper: coach.temper,
    role: human ? ('extra' as CoachRole) : coach.role,
    yoMama: coach.yoMama && momAllowed(coach.temper),
    swearing: coach.swearing && swearAllowed(coach.temper),
  }));
  const dirty =
    draft.temper !== coach.temper ||
    draft.role !== coach.role ||
    draft.yoMama !== (coach.yoMama && momAllowed(coach.temper)) ||
    draft.swearing !== (coach.swearing && swearAllowed(coach.temper));
  const edit = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));
  const [confirm, setConfirm] = useState<'off' | 'clear' | null>(null);
  const hard = momAllowed(draft.temper);

  if (confirm)
    return (
      <Sheet onClose={() => setConfirm(null)} className="atl-sheet">
        <div className="sheet-head">
          <h3>{confirm === 'off' ? t.atlasTurnOffAsk : t.atlasClearAsk}</h3>
        </div>
        <p className="atl-confirm-body">
          {confirm === 'off' ? t.atlasTurnOffBody : t.atlasClearBody}
        </p>
        <div className="sheet-actions">
          <button className="btn btn-secondary grow" onClick={() => setConfirm(null)}>
            {t.atlasCancel}
          </button>
          <button
            className="btn btn-danger grow"
            onClick={() => {
              if (confirm === 'off') setCoach({ enabled: false });
              else {
                // The conversation (and what Atlas said, for consistency) —
                // not your log, not what he remembers about you.
                clearChat();
                clearSaid();
                const now = Date.now();
                setCoach({ clearedAt: now, readAt: now });
              }
              onClose();
            }}
          >
            {confirm === 'off' ? t.atlasTurnOff : t.atlasClear}
          </button>
        </div>
      </Sheet>
    );

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
            aria-pressed={draft.temper === i}
            className={draft.temper === i ? 'on' : ''}
            style={{ ['--tc' as string]: TEMPER_COLOR[i] }}
            onClick={() => edit(i === draft.temper ? {} : { temper: i, ...extrasFor(i) })}
          >
            <AtlasFace temper={i} size={52} />
            <span>{t.atlasTemper[temperIndex(i)]}</span>
          </button>
        ))}
      </div>
      <div className="se-label">{t.atlasRoleLabel}</div>
      <div className="atl-seg">
        {(['main', 'extra'] as CoachRole[]).map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={draft.role === r}
            className={draft.role === r ? 'on' : ''}
            disabled={human && r === 'main'}
            onClick={() => edit({ role: r })}
          >
            {r === 'main' ? t.atlasRoleMain : t.atlasRoleExtra}
          </button>
        ))}
      </div>
      {human && <p className="atl-hint atl-hint-left">{t.atlasRoleHumanCoach}</p>}
      <div className="se-group">
        {/* Locked off for tempers that don't do it. */}
        <RuleRow
          label={t.atlasRuleMom}
          sub={hard ? t.atlasRuleMomSub : t.atlasRuleHardOnly}
          on={hard && draft.yoMama}
          locked={!hard}
          onToggle={() => edit({ yoMama: !draft.yoMama })}
        />
        <RuleRow
          label={t.atlasRuleSwear}
          sub={swearAllowed(draft.temper) ? t.atlasRuleSwearSub : t.atlasRuleMercilessOnly}
          on={swearAllowed(draft.temper) && draft.swearing}
          locked={!swearAllowed(draft.temper)}
          onToggle={() => edit({ swearing: !draft.swearing })}
        />
      </div>
      <div className="se-group atl-danger-group">
        <button
          type="button"
          className="toggle-row atl-act-row"
          onClick={() => setConfirm('clear')}
        >
          <span className="atl-act-ic">
            <Icon name="trash" />
          </span>
          <span className="rest-pref-text">
            <span className="lab">{t.atlasClear}</span>
            <span className="sub">{t.atlasClearSub}</span>
          </span>
          <Icon name="caret-right" />
        </button>
        <button
          type="button"
          className="toggle-row atl-act-row danger"
          onClick={() => setConfirm('off')}
        >
          <span className="atl-act-ic">
            <Icon name="sign-out" />
          </span>
          <span className="rest-pref-text">
            <span className="lab">{t.atlasTurnOff}</span>
            <span className="sub">{t.atlasTurnOffSub}</span>
          </span>
          <Icon name="caret-right" />
        </button>
      </div>
      <div className="sheet-actions">
        <button
          className="btn btn-primary grow"
          disabled={!dirty}
          onClick={() => {
            setCoach({
              ...draft,
              yoMama: draft.yoMama && momAllowed(draft.temper),
              swearing: draft.swearing && swearAllowed(draft.temper),
            });
            onClose();
          }}
        >
          {t.atlasSave}
        </button>
      </div>
    </Sheet>
  );
}
