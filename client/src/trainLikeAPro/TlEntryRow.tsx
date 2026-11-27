import { SkCard, SkIcon, SkRow } from '../store-kit';
import { TileOf } from '../addonStore/storeItems';
import { useAddonStoreT } from '../i18n/addonStore';
import { addonById } from '../addons/manifest';
import { useT } from '../i18n';
import { STRINGS } from './strings';

/**
 * The entry row on Programs after Train like a pro is installed: the same store-kit card row as the banner shown before
 * installing, with the still icon (no animation) and a chevron that opens the catalog.
 */
export function TlEntryRow({ onOpen }: { onOpen: () => void }) {
  const { locale } = useT();
  const { st } = useAddonStoreT();
  const s = STRINGS[locale];
  const m = addonById('train-like-a-pro');
  const root = typeof document === 'undefined' ? null : document.documentElement;
  const dark = root ? root.dataset.mode !== 'light' || root.dataset.sleep === 'night' : true;
  return (
    <section className={`sk-root ${dark ? 'sk-dark' : 'sk-light'}`}>
      <SkCard pad>
        <SkRow
          noBorder
          tile={m ? <TileOf st={st} m={m} size={64} /> : undefined}
          name={s.name}
          desc={s.entrySub}
          action={<SkIcon name="chev" />}
          onOpen={onOpen}
        />
      </SkCard>
    </section>
  );
}
