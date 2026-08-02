/** Onboarding — design O-01…O-09. Four steps ending inside a live session. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { request, setAuth, getToken, HttpError } from '../api';
import { startWorkout, upsertGym, getCurrentPositionOnce } from '../store';
import {
  searchGyms,
  haversineM,
  fmtDistance,
  cacheAddress,
  type Coords,
  type PlaceResult,
} from '../data/gymProviders';
import { fmtDayMonth, useT } from '../i18n';
import { Icon, LanguageSelector, Spinner } from '../ui';
import { GymThumb } from '../components/GymThumb';
import { Avatar } from '../components/Avatar';

interface InviteInfo {
  state: 'valid' | 'expired' | 'claimed' | 'revoked';
  kind: 'invite' | 'reset';
  inviter: string | null;
  name: string | null;
  email: string | null;
  expiresAt: number;
  claimedAt: number | null;
  revokedAt: number | null;
}

interface Resume {
  step: number;
  name: string;
  email: string;
  gymId?: string;
  gymName?: string;
  gymLat?: number;
  gymLng?: number;
  avatarDone?: boolean;
}

const resumeKey = (token: string) => `onb.${token}`;

function loadResume(token: string): Resume | null {
  try {
    const raw = localStorage.getItem(resumeKey(token));
    return raw ? (JSON.parse(raw) as Resume) : null;
  } catch {
    return null;
  }
}

export function OnboardingView({
  token,
  onDone,
}: {
  token: string;
  onDone: (workoutId?: string) => void;
}) {
  const { t, locale } = useT();
  const [info, setInfo] = useState<InviteInfo | null | 'error'>(null);
  const saved = useMemo(() => loadResume(token), [token]);
  // 0 = landing, 1..4 = steps.
  const [step, setStep] = useState(saved?.step ?? 0);
  const [name, setName] = useState(saved?.name ?? '');
  const [email, setEmail] = useState(saved?.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gym, setGym] = useState<Resume | null>(saved);
  const [requested, setRequested] = useState(false);

  // AC-ONB-06: persist on every meaningful change.
  function persist(patch: Partial<Resume>): void {
    const cur = loadResume(token) ?? { step, name, email };
    const next = { ...cur, step, name, email, ...patch };
    localStorage.setItem(resumeKey(token), JSON.stringify(next));
  }

  useEffect(() => {
    request<InviteInfo>('GET', `/api/auth/invite/${token}`)
      .then((i) => {
        setInfo(i);
        if (i.state === 'valid') {
          setName((n) => n || i.name || '');
          setEmail((e) => e || i.email || '');
        }
      })
      .catch(() => setInfo('error'));
  }, [token]);

  if (info === null) {
    return (
      <div className="onb-shell center">
        <Spinner size={22} />
      </div>
    );
  }

  const resumable = saved !== null && !!getToken();
  if (info === 'error' || (info.state !== 'valid' && !resumable)) {
    const when =
      info !== 'error' && (info.claimedAt ?? info.revokedAt ?? info.expiresAt)
        ? fmtDayMonth(info.claimedAt ?? info.revokedAt ?? info.expiresAt, locale)
        : '';
    return (
      <div className="onb-shell center">
        <div className="onb-card">
          <Icon name="warning-circle" className="onb-dead-icon" />
          <h1>{t.onbDead}</h1>
          <p className="lead">{t.onbDeadBody(when)}</p>
          <button
            className="btn btn-primary btn-big"
            disabled={requested}
            onClick={() => {
              void request('POST', `/api/auth/invite/${token}/request-new`).catch(() => {});
              setRequested(true);
            }}
          >
            {requested ? t.onbRequested : t.onbRequestNew}
          </button>
          <button className="footer-link" onClick={() => onDone()}>
            {t.onbHaveAccount}
          </button>
        </div>
      </div>
    );
  }

  const railBars = (upTo: number) => (
    <div className="onb-rail" aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={`bar${i <= upTo ? ' on' : ''}`} />
      ))}
    </div>
  );
  const stepNames = ['', t.onbWho, t.onbFace, t.onbGymStep, t.onbReady];
  const rail = (
    <div className="onb-steptop">
      {railBars(Math.max(step, 1))}
      <div className="row">
        <span className="k">{t.onbStepOf(Math.min(step, 4))}</span>
        <span className="k right">{stepNames[Math.min(step, 4)]}</span>
      </div>
    </div>
  );

  async function claim(): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await request<{
        token: string;
        username: string;
        email: string | null;
        role: 'member' | 'trainer' | 'admin';
      }>('POST', '/api/auth/claim', { token, password, username: name, email });
      setAuth(res.token, res.username, res.role);
      return true;
    } catch (e) {
      if (e instanceof HttpError && e.status === 409) setError(t.onbEmailTaken);
      else setError(e instanceof Error ? e.message : t.error);
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Reset links are a single step: set the new password, done.
  if (info.kind === 'reset' && step === 0) {
    return (
      <div className="onb-shell center">
        <div className="onb-card">
          <h1>{t.onbWho}</h1>
          <input
            className="input"
            type="password"
            placeholder={t.passwordMin}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <div className="field-error">
              <Icon name="warning-circle" />
              {error}
            </div>
          )}
          <button
            className="btn btn-primary btn-big"
            disabled={busy || password.length < 6}
            onClick={async () => {
              if (await claim()) onDone();
            }}
          >
            {busy && <Spinner onAccent />} {t.save}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="onb-shell">
      <div className="onb-top">
        {step > 1 ? (
          <button
            className="back"
            aria-label={t.onbBack}
            onClick={() => {
              setStep(step - 1);
              persist({ step: step - 1 });
            }}
          >
            <Icon name="caret-left" />
          </button>
        ) : (
          <span />
        )}
        <LanguageSelector />
      </div>

      {step === 0 && (
        <div className="onb-card landing">
          {info.inviter && (
            <div className="onb-inviter">
              <Avatar name={info.inviter} size={40} />
              <span>{t.onbInvited(info.inviter)}</span>
            </div>
          )}
          <Icon name="barbell" className="onb-wordmark" />
          <h1 className="display">{t.onbTitle}</h1>
          <p className="lead">{t.onbBody}</p>
          {railBars(1)}
          <button
            className="btn btn-primary btn-big"
            onClick={() => {
              setStep(1);
              persist({ step: 1 });
            }}
          >
            {t.onbStart} <Icon name="arrow-right" />
          </button>
          <div className="footnote center">
            {t.onbLinkValid(fmtDayMonth(info.expiresAt, locale))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="onb-card">
          {rail}
          <h1 className="display sm">{t.onbWhoLead}</h1>
          <input
            className="input"
            placeholder={t.username}
            value={name}
            onBlur={() => persist({})}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            type="email"
            placeholder={t.email}
            value={email}
            onBlur={() => persist({})}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className={`input${error ? ' error' : ''}`}
            type="password"
            placeholder={t.passwordMin}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <div className="field-error">
              <Icon name="warning-circle" />
              {error}
            </div>
          )}
          {info.name && (
            <div className="note-ok">
              <Icon name="check-circle" weight="fill" />
              <span>{t.onbPrefilled}</span>
            </div>
          )}
          <button
            className="btn btn-primary btn-big"
            disabled={busy || name.trim().length < 2 || password.length < 6}
            onClick={async () => {
              // Already claimed on a previous run → just advance.
              if (getToken() && loadResume(token)) {
                setStep(2);
                persist({ step: 2 });
                return;
              }
              if (await claim()) {
                setStep(2);
                persist({ step: 2 });
              }
            }}
          >
            {busy && <Spinner onAccent />} {t.onbContinue} <Icon name="arrow-right" />
          </button>
        </div>
      )}

      {step === 2 && (
        <AvatarStep
          rail={rail}
          onDone={(had) => {
            setStep(3);
            persist({ step: 3, avatarDone: had });
          }}
        />
      )}

      {step === 3 && (
        <GymStep
          rail={rail}
          onPick={(r) => {
            if (r) {
              const g = upsertGym({ name: r.name, lat: r.lat, lng: r.lng, radiusM: 150 });
              if (r.address) cacheAddress(r.lat, r.lng, r.address);
              setGym({
                step: 4,
                name,
                email,
                gymId: g.id,
                gymName: g.name,
                gymLat: g.lat,
                gymLng: g.lng,
              });
              persist({ step: 4, gymId: g.id, gymName: g.name, gymLat: g.lat, gymLng: g.lng });
            } else {
              setGym({ step: 4, name, email });
              persist({ step: 4, gymId: undefined, gymName: undefined });
            }
            setStep(4);
          }}
        />
      )}

      {step === 4 && (
        <div className="onb-final">
          {gym?.gymName && gym.gymLat !== undefined && gym.gymLng !== undefined && (
            <div className="onb-final-bg">
              <GymThumb name={gym.gymName} lat={gym.gymLat} lng={gym.gymLng} size={320} />
            </div>
          )}
          <div className="onb-final-scrim" />
          <div className="onb-card final">
            <div className="kicker onb-ready">
              <Icon name="check-circle" weight="fill" /> {t.onbReady}
              {gym?.gymName ? ` · ${gym.gymName}` : ''}
            </div>
            <div className="onb-me">
              <Avatar name={name} size={76} />
              <div>
                <div className="n">{name}</div>
                {info.inviter && (
                  <div className="s">
                    {t.roleAdmin} · {info.inviter}
                  </div>
                )}
              </div>
            </div>
            <h1 className="display">{t.onbWow}</h1>
            <p className="lead">{gym?.gymName ? t.onbWowBody(gym.gymName) : t.onbWowBodyNoGym}</p>
            <button
              className="btn btn-primary btn-big"
              onClick={() => {
                localStorage.removeItem(resumeKey(token));
                const w = startWorkout(gym?.gymId ?? null);
                onDone(w.id);
              }}
            >
              <Icon name="play" /> {t.onbStartTraining}
            </button>
            <button
              className="footer-link"
              onClick={() => {
                localStorage.removeItem(resumeKey(token));
                onDone();
              }}
            >
              {t.onbJustApp}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Step 2: avatar with circular crop + zoom (O-03/O-04, AC-AVATAR) --------

function AvatarStep({ rail, onDone }: { rail: React.ReactNode; onDone: (had: boolean) => void }) {
  const { t } = useT();
  const [file, setFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const libraryRef = useRef<HTMLInputElement | null>(null);

  function pick(f: File | undefined): void {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError(t.onbAvatarTooBig(`${Math.round(f.size / 1024 / 1024)} MB`));
      return;
    }
    if (!/^image\/(jpeg|png|webp|heic|heif)/.test(f.type)) {
      setError(t.onbAvatarType);
      return;
    }
    setError(null);
    setFile(f);
    setImgUrl(URL.createObjectURL(f));
    setZoom(1);
  }

  async function upload(): Promise<void> {
    const img = imgRef.current;
    if (!img || !file) return;
    setBusy(true);
    try {
      // AC-AVATAR-02/03: circular mask over the frame; output a 512px square.
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const base = Math.min(iw, ih) / zoom;
      const sx = (iw - base) / 2;
      const sy = (ih - base) / 2;
      ctx.drawImage(img, sx, sy, base, base, 0, 0, size, size);
      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.86),
      );
      const res = await fetch('/api/profile/me/avatar', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${getToken() ?? ''}`,
          'Content-Type': 'image/jpeg',
        },
        body: blob,
      });
      if (!res.ok) throw new Error(`upload ${res.status}`);
      onDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="onb-card">
      {rail}
      <h1 className="display sm">{t.onbFaceLead}</h1>

      {!imgUrl ? (
        <>
          <div className="onb-avatar-ring">
            <span className="cam-badge">
              <Icon name="plus" />
            </span>
          </div>
          <div className="onb-two">
            <button className="btn btn-secondary" onClick={() => cameraRef.current?.click()}>
              <Icon name="map-pin" /> {t.onbCamera}
            </button>
            <button className="btn btn-secondary" onClick={() => libraryRef.current?.click()}>
              <Icon name="copy" /> {t.onbLibrary}
            </button>
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="user"
            hidden
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <input
            ref={libraryRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            hidden
            onChange={(e) => pick(e.target.files?.[0])}
          />
          {error && (
            <div className="field-error">
              <Icon name="warning-circle" />
              {error}
            </div>
          )}
          <div className="footnote center">{t.onbFaceNote}</div>
          <button className="btn btn-primary btn-big" onClick={() => onDone(false)}>
            {t.onbContinue} <Icon name="arrow-right" />
          </button>
          <button className="footer-link" onClick={() => onDone(false)}>
            {t.onbSkipInitials}
          </button>
        </>
      ) : (
        <>
          <div className="kicker">{t.onbPosition}</div>
          <div className="onb-crop">
            <img ref={imgRef} src={imgUrl} alt="" style={{ transform: `scale(${zoom})` }} />
            <div className="mask" />
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
          {error && (
            <div className="field-error">
              <Icon name="warning-circle" />
              {error}
            </div>
          )}
          <div className="onb-two">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setImgUrl(null);
                setFile(null);
              }}
            >
              {t.cancel}
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void upload()}>
              {busy && <Spinner onAccent />} {t.onbUsePhoto}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- Step 3: gym (O-05) — nearby first, search, never blocks on permission --

function GymStep({
  rail,
  onPick,
}: {
  rail: React.ReactNode;
  onPick: (r: PlaceResult | null) => void;
}) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    getCurrentPositionOnce()
      .then((p) => alive && setCoords({ lat: p.lat, lng: p.lng }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const needle = q.trim();
  useEffect(() => {
    abortRef.current?.abort();
    if (needle.length < 2) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const deb = setTimeout(() => {
      void searchGyms(needle, coords, {}, [], ctrl.signal, {
        onResults: (m) => {
          if (!ctrl.signal.aborted) setResults([...m]);
        },
        onProvider: () => {},
      });
    }, 350);
    return () => {
      clearTimeout(deb);
      ctrl.abort();
    };
  }, [needle, coords]);

  const sorted = useMemo(() => {
    if (!coords) return results;
    return [...results].sort((a, b) => haversineM(coords, a) - haversineM(coords, b));
  }, [results, coords]);

  return (
    <div className="onb-card">
      <div className="kicker">{t.onbStepOf(3)}</div>
      {rail}
      <h1>{t.onbGymStep}</h1>
      <p className="lead">{t.onbGymLead}</p>
      <div className="searchbar">
        <Icon name="magnifying-glass" />
        <input
          value={q}
          placeholder={t.searchGymPlaceholder}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="onb-gym-list">
        {sorted.slice(0, 4).map((r) => {
          const d = coords ? haversineM(coords, r) : null;
          return (
            <button key={r.key} className="onb-gym-card" onClick={() => onPick(r)}>
              <span className="photo">
                <GymThumb name={r.name} lat={r.lat} lng={r.lng} size={120} />
              </span>
              <span className="body">
                <span className="n">{r.name}</span>
                <span className="s">
                  {r.address ?? ''}
                  {d !== null ? `${r.address ? ' · ' : ''}${fmtDistance(d)}` : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <button className="footer-link" onClick={() => onPick(null)}>
        {t.onbSkipGym}
      </button>
    </div>
  );
}
