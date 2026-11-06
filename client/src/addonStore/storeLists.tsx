/** Shared list pieces of the store screens: a titled section and a card of item rows. */
import { addonById, type AddonManifest } from '../addons/manifest';
import { SkList, SkSectionHeader } from '../store-kit';
import { ItemRow, type StoreCtx } from './storeItems';

export function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="sk-mt24">
      <SkSectionHeader title={title} aside={aside} />
      {children}
    </section>
  );
}

export function Rows({ ids, ctx, query }: { ids: string[]; ctx: StoreCtx; query?: string }) {
  const items = ids.map((id) => addonById(id)).filter((m): m is AddonManifest => !!m);
  if (!items.length) return null;
  return (
    <SkList>
      {items.map((m) => (
        <ItemRow key={m.id} m={m} ctx={ctx} query={query} />
      ))}
    </SkList>
  );
}
