import { PageHead } from '../../components/ui/PageHead';
import { IconButton } from '../../components/ui/Button';
import type { Strings } from '../../i18n/en';

/** Header of the scrolling recap: back, title, and the story / share actions. */
export function RecapHead({
  t,
  onClose,
  onStory,
  onShare,
}: {
  t: Strings;
  onClose: () => void;
  onStory: () => void;
  onShare: () => void;
}) {
  return (
    <PageHead
      back={{ label: t.backAction, onClick: onClose }}
      title={t.rcRecap}
      actions={
        <>
          <IconButton icon="cards" label={t.rcPlayStory} onClick={onStory} />
          <IconButton icon="export" label={t.rcShare} onClick={onShare} />
        </>
      }
    />
  );
}
