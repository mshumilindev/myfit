/** Standards (Заліки) sub-tab: your lifts vs rank norms + strength levels. */
import { computeStandards, type DiscResult, type Sex } from '../standards';
import type { BodyMetrics, Workout } from '../types';
import { useT } from '../i18n';
import { Icon } from '../ui';

function latestWeight(body: BodyMetrics): number {
  if (!body?.weights?.length) return 0;
  return body.weights.slice().sort((a, b) => b.at - a.at)[0].weight;
}

export function StandardsView({ finished, body }: { finished: Workout[]; body: BodyMetrics }) {
  const { t } = useT();
  const bodyKg = latestWeight(body);
  const hasSex = body.sex === 'male' || body.sex === 'female';

  // Gate: standards are meaningless without sex + a bodyweight (both live in Profile).
  if (!hasSex || bodyKg === 0) {
    const missing: string[] = [];
    if (!hasSex) missing.push(t.sex.toLowerCase());
    if (bodyKg === 0) missing.push(t.stdBodyweight.toLowerCase());
    return (
      <div className="std-gate">
        <Icon name="user-focus" />
        <h4 className="std-gate-t">{t.stdNeedProfileTitle}</h4>
        <p className="std-gate-b">{t.stdNeedProfileBody(missing.join(t.stdAnd))}</p>
        <a className="btn btn-primary std-gate-cta" href="#/profile/me">
          {t.stdOpenProfile}
        </a>
      </div>
    );
  }

  const sex: Sex = body.sex === 'female' ? 'F' : 'M';
  const { results } = computeStandards(finished, bodyKg, sex);
  const trained = results.filter((r) => r.trained);
  const untrained = results.filter((r) => !r.trained);

  const tierLabel = (system: DiscResult['system'], id: string): string =>
    system === 'rank' ? t.rankShort[id] : t.lvlShort[id];

  const Card = ({ r }: { r: DiscResult }) => (
    <section className="std-card">
      <div className="std-card-head">
        <div className="std-titles">
          <span className="std-name">{r.name}</span>
          <span className="std-class">
            <span className={`std-tag ${r.system}`}>
              {r.system === 'rank' ? t.stdRankTag : t.stdLevelTag}
            </span>
            {r.system === 'rank' && r.classLabel ? ` · ${t.stdClassUpTo(r.classLabel)}` : ''}
          </span>
        </div>
        {r.trained ? (
          <div className="std-best">
            <span className="num">{Math.round(r.best)}</span>
            <span className="std-best-lab">kg · {t.stdEstMax}</span>
          </div>
        ) : (
          <span className="std-badge todo">{t.stdNotStarted}</span>
        )}
      </div>

      <div className={`std-ranks cols-${r.tierIds.length}`}>
        {r.tierIds.map((id, i) => {
          const achieved = r.trained && i <= r.achievedIdx;
          const target = r.trained && i === r.nextIdx;
          return (
            <div key={id} className={`std-rank${achieved ? ' on' : ''}${target ? ' target' : ''}`}>
              <span className="sr-name">{tierLabel(r.system, id)}</span>
              <span className="sr-kg num">{r.thresholds[i]}</span>
            </div>
          );
        })}
      </div>

      {r.trained && (
        <div className="std-foot">
          <div className="std-track">
            <div className="std-fill" style={{ width: `${Math.round(r.progress * 100)}%` }} />
          </div>
          <div className="std-foot-note">
            {r.achievedIdx >= 0 ? (
              <span className="std-cur">
                {t.stdNow} <b>{tierLabel(r.system, r.tierIds[r.achievedIdx])}</b>
              </span>
            ) : (
              <span className="std-cur muted">
                {t.stdBelowFirst(tierLabel(r.system, r.tierIds[0]))}
              </span>
            )}
            {r.nextIdx != null ? (
              <span className="std-next num">
                +{Math.round(r.toGo ?? 0)} kg → {tierLabel(r.system, r.tierIds[r.nextIdx])}
              </span>
            ) : (
              <span className="std-next ok">{t.stdMaxReached}</span>
            )}
          </div>
        </div>
      )}
    </section>
  );

  return (
    <div className="standards">
      <div className="std-top">
        <div className="std-body">
          <span className="std-body-lab">{t.stdBodyweight}</span>
          <span className="std-body-val num">{Math.round(bodyKg)} kg</span>
        </div>
        <div className="std-body">
          <span className="std-body-lab">{t.sex}</span>
          <span className="std-body-val">{body.sex === 'female' ? t.sexFemale : t.sexMale}</span>
        </div>
        <a className="std-editlink" href="#/profile/me">
          <Icon name="pencil-simple" />
          {t.stdEditProfile}
        </a>
      </div>

      {trained.length > 0 && (
        <>
          <div className="std-section-lab">{t.stdYouTrain}</div>
          {trained.map((r) => (
            <Card key={r.key} r={r} />
          ))}
        </>
      )}

      {untrained.length > 0 && (
        <>
          <div className="std-section-lab">{t.stdNotYet}</div>
          {untrained.map((r) => (
            <Card key={r.key} r={r} />
          ))}
        </>
      )}

      <p className="std-src">{t.stdSource}</p>
    </div>
  );
}
