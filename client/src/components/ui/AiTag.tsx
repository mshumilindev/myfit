import { Icon } from '../../ui';
import { Tag } from './Tag';

/** The "AI" mark on a reply written by a provider model (EU AI Act Art. 50). The word comes from the caller. */
export function AiTag({ label }: { label: string }) {
  return (
    <Tag tone="atlas" icon={<Icon name="sparkle" />}>
      {label}
    </Tag>
  );
}
