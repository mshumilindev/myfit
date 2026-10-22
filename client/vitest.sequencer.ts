import { BaseSequencer, type TestSpecification } from 'vitest/node';
import { planShards } from './shardPlan';

/** Shards by measured weight instead of file count; the algorithm and its rationale live in shardPlan.ts. */
export default class WeightedShardSequencer extends BaseSequencer {
  async shard(specs: TestSpecification[]): Promise<TestSpecification[]> {
    const { index, count } = this.ctx.config.shard ?? { index: 1, count: 1 };
    const root = this.ctx.config.root.replace(/\\/g, '/');
    const rel = (s: TestSpecification) => s.moduleId.replace(/\\/g, '/').slice(root.length + 1);
    const byRel = new Map(specs.map((s) => [rel(s), s]));
    const mine = new Set(planShards([...byRel.keys()], count)[index - 1]);
    return specs.filter((s) => mine.has(rel(s)));
  }
}
