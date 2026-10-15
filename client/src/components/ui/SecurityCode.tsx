import { useState } from 'react';
import { Button } from './Button';
import { Tag } from './Tag';
import './SecurityCode.css';

export interface SecurityCodeLabels {
  /** "Security code: 0412 9981 ..." spoken name of the digits (the groups are read digit by digit). */
  groupsAria: (code: string) => string;
  copy: string;
  copied: string;
  verified: string;
  notVerified: string;
  /** The primary action while not verified. */
  verify: string;
  /** The quiet action once verified. */
  unverify: string;
}

export interface SecurityCodeProps {
  /** Six groups of four digits separated by spaces ("0412 9981 3307 5528 1046 7790"). */
  code: string;
  verified: boolean;
  labels: SecurityCodeLabels;
  /** Absent = the person cannot mark it (read-only). */
  onVerify?: () => void;
  onUnverify?: () => void;
  /** Stories / tests: the clipboard writer (default `navigator.clipboard.writeText`). */
  writeText?: (s: string) => Promise<void>;
}

/**
 * The 24-digit "Security code" of a trainer key (story group `Coach/Security code`): six groups of four digits in a
 * 3 x 2 grid (2 x 3 on a phone), Copy, and the verified state. Presentational: strings in, the person compares the code
 * out loud with the other side and marks it verified. Digits use tabular numerals so every group is the same width.
 */
export function SecurityCode({
  code,
  verified,
  labels,
  onVerify,
  onUnverify,
  writeText,
}: SecurityCodeProps) {
  const [copied, setCopied] = useState(false);
  const groups = code.split(/\s+/).filter(Boolean);
  const copy = async () => {
    try {
      await (writeText ?? ((s: string) => navigator.clipboard.writeText(s)))(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard refused: the digits are on screen, the person can read them out */
    }
  };
  return (
    <div className="uiseccode">
      <ol className="uiseccode-groups" aria-label={labels.groupsAria(groups.join(', '))}>
        {groups.map((g, i) => (
          <li key={i} className="uiseccode-g" aria-hidden="true">
            {g}
          </li>
        ))}
      </ol>
      <div className="uiseccode-row">
        <Tag tone={verified ? 'ok' : 'neutral'} icon={undefined}>
          {verified ? labels.verified : labels.notVerified}
        </Tag>
        <Button variant="ghost" size="sm" icon={copied ? 'check' : 'copy'} onClick={copy}>
          {copied ? labels.copied : labels.copy}
        </Button>
      </div>
      {!verified && onVerify && (
        <Button variant="primary" icon="shield-check" fullWidth onClick={onVerify}>
          {labels.verify}
        </Button>
      )}
      {verified && onUnverify && (
        <Button variant="ghost" size="sm" onClick={onUnverify}>
          {labels.unverify}
        </Button>
      )}
    </div>
  );
}
