import './SkHighlight.css';

export interface SkHighlightPart {
  text: string;
  hit: boolean;
}

/** Text split into matched / unmatched parts (the caller decides what matches). Matched parts get a soft mark. */
export function SkHighlight({ parts }: { parts: readonly SkHighlightPart[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="sk-hl">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
