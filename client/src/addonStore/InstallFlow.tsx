/** The install run screens (boards 10, 11): Installing with a row per item, then All set. */
import type { RunState } from '../addons/installRun';
import { addonById } from '../addons/manifest';
import { SkBtn, SkIcon, SkList, SkStatusHeader, SkSteps, type SkStep } from '../store-kit';
import './screens.css';
import { ItemRow, itemName, TileOf, type StoreCtx } from './storeItems';

export function Installing({
  ctx,
  run,
  onRetry,
}: {
  ctx: StoreCtx;
  run: RunState;
  onRetry: () => void;
}) {
  const { st } = ctx;
  const partial = run.status === 'partial';
  const doneCount = run.ids.filter((id) => run.result[id] === 'done').length;
  const steps: SkStep[] = run.ids.map((id, i) => {
    const m = addonById(id);
    const state = run.result[id] ?? 'pending';
    return {
      id,
      tile: m && <TileOf st={st} m={m} size={40} />,
      name: itemName(st, id),
      state,
      progress: state === 'active' ? run.progress : undefined,
      detail:
        state === 'done'
          ? st.stepDone
          : state === 'failed'
            ? st.installFailed
            : state === 'pending'
              ? st.startsAfter(itemName(st, run.ids[i - 1] ?? id))
              : undefined,
      status: state === 'pending' ? st.waiting : undefined,
      action:
        state === 'failed' ? (
          <SkBtn kind="pri" size="s" onClick={onRetry} disabled={!ctx.online}>
            {st.tryAgain}
          </SkBtn>
        ) : undefined,
    };
  });
  return (
    <>
      <div className="sk-col sk-g8">
        <SkStatusHeader
          status={partial ? 'bad' : 'progress'}
          icon={<SkIcon name={partial ? 'alert' : 'sync'} />}
          title={partial ? st.almostDone : st.installingTitle}
        />
        <div className="sk-t-s">
          {partial ? st.installedOf(doneCount, run.ids.length) : st.installingSub}
        </div>
      </div>
      <div>
        <SkSteps
          items={steps}
          label={st.installingTitle}
          stateLabels={{
            pending: st.waiting,
            active: st.installingTitle,
            done: st.stepDone,
            failed: st.installFailed,
          }}
        />
      </div>
    </>
  );
}

export function InstallDone({ ctx, ids }: { ctx: StoreCtx; ids: readonly string[] }) {
  const { st } = ctx;
  return (
    <>
      <div className="sk-col sk-g8">
        <SkStatusHeader status="ok" icon={<SkIcon name="check" />} title={st.doneTitle} />
        <div className="sk-t-s">{st.doneSub}</div>
      </div>
      <div>
        <SkList>
          {ids.map((id) => {
            const m = addonById(id);
            return m && <ItemRow key={id} m={m} ctx={ctx} action={null} />;
          })}
        </SkList>
      </div>
    </>
  );
}
