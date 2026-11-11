import { useState } from 'react';
import type { AddonStoreStrings } from '../i18n/addonStore';
import { itemAbout, itemDesc, itemHighlights, itemTagline } from './storeItems';

/** About copy: the first paragraph and highlights always, the rest behind Show more (an item without long copy shows its card line). */
export function AboutText({ st, id }: { st: AddonStoreStrings; id: string }) {
  const [open, setOpen] = useState(false);
  const paras = itemAbout(st, id);
  const tagline = itemTagline(st, id);
  const highlights = itemHighlights(st, id);
  if (paras.length === 0) return <p className="sk-t-b sk-mute">{itemDesc(st, id)}</p>;
  const shown = open ? paras : paras.slice(0, 1);
  return (
    <div className="as-about">
      {tagline && <div className="sk-t-s sk-b">{tagline}</div>}
      {shown.map((p, i) => (
        <p key={i} className="sk-t-b sk-mute sk-mt8">
          {p}
        </p>
      ))}
      {open && highlights.length > 0 && (
        <ul className="sk-t-b sk-mute sk-mt8 as-about-hl">
          {highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}
      {(paras.length > 1 || highlights.length > 0) && (
        <button
          type="button"
          className="sk-t-s sk-mt8 as-about-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? st.showLess : st.showMore}
        </button>
      )}
    </div>
  );
}
