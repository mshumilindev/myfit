/** The install run screens (boards 10, 11): Installing with a row per item, then All set. */
import type { RunState } from '../addons/installRun';
import { addonById } from '../addons/manifest';
import { SkIcon, SkList, SkStatusHeader, SkSteps, type SkStep } from '../store-kit';
import './screens.css';
import { ItemRow, itemName, TileOf, type StoreCtx } from './storeItems';

export function Installing({ ctx, run }: { ctx: StoreCtx; run: RunState }) {
  const { st } = ctx;
  const steps: SkStep[] = run.ids.map((id, i) => {
    const m = addonById(id);
    const state = i < run.current ? 'done' : i === run.current ? 'active' : 'pending';
    return {
      id,
      tile: m && <TileOf st={st} m={m} size={40} />,
      name: itemName(st, id),
      state,
      progress: state === 'active' ? run.progress : undefined,
      detail:
        state === 'done'
          ? st.stepDone
          : state === 'pending'
            ? st.startsAfter(itemName(st, run.ids[i - 1] ?? id))
            : undefined,
      status: state === 'pending' ? st.waiting : undefined,
    };
  });
  return (
    <>
      <SkStatusHeader status="progress" icon={<SkIcon name="sync" />} title={st.installingTitle} />
      <div className="sk-t-s sk-mt8">{st.installingSub}</div>
      <div className="sk-mt16">
        <SkSteps
          items={steps}
          label={st.installingTitle}
          stateLabels={{ pending: st.waiting, active: st.installingTitle, done: st.stepDone }}
        />
      </div>
    </>
  );
}

export function InstallDone({ ctx, ids }: { ctx: StoreCtx; ids: readonly string[] }) {
  const { st } = ctx;
  return (
    <>
      <SkStatusHeader status="ok" icon={<SkIcon name="check" />} title={st.doneTitle} />
      <div className="sk-t-s sk-mt8">{st.doneSub}</div>
      <div className="sk-mt16">
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
