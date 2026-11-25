import { useState } from 'react';
import { ConfirmDialog } from '../components/ui/Overlays';
import { currentUid } from '../api';
import { useT } from '../i18n';
import { refreshProgramMine, useProgramMine } from '../data/programMine';
import { setHash } from '../route';
import { storeHash } from '../addonStore/storeRoute';
import { CatalogPage } from './CatalogPage';
import type { CatalogEntry } from './catalog/types';
import { programIdFor } from './entryToProgram';
import { startCatalogProgram } from './startProgram';
import { STRINGS } from './strings';

/**
 * The catalog with its Start flow. One active program at a time: a trainer's program is never replaced (Start is off, the
 * server refuses too); the member's own other active program is replaced after a confirmation (it is archived, the history
 * stays). Started → back to Programs, where the program is now the active one.
 */
export function CatalogRoute({ onClose }: { onClose: () => void }) {
  const { locale } = useT();
  const s = STRINGS[locale];
  const { assignment } = useProgramMine();
  const uid = currentUid();
  const current = assignment?.program;
  const trainerHolds = !!current && !!uid && current.authorId !== uid;
  const [pending, setPending] = useState<CatalogEntry | null>(null);
  const [starting, setStarting] = useState(false);
  const [note, setNote] = useState<string | undefined>();

  async function run(e: CatalogEntry) {
    setPending(null);
    setNote(undefined);
    setStarting(true);
    const r = await startCatalogProgram(e);
    setStarting(false);
    refreshProgramMine();
    if (r.kind === 'started') onClose();
    else if (r.kind === 'queued') setNote(s.queued);
    else if (r.kind === 'held') setNote(s.heldHint);
    else setNote(s.failed);
  }

  function start(e: CatalogEntry) {
    const sameAlready = !!uid && current?.id === programIdFor(uid, e.id);
    if (current && !trainerHolds && !sameAlready) setPending(e);
    else void run(e);
  }

  return (
    <>
      <CatalogPage
        onClose={onClose}
        onStart={start}
        onGetAddon={(id) => {
          setHash(storeHash('item', id));
        }}
        heldHint={trainerHolds ? s.heldHint : undefined}
        starting={starting}
        note={note}
      />
      {pending && current && (
        <ConfirmDialog
          title={s.replaceTitle}
          body={s.replaceBody(current.name)}
          confirmLabel={s.replaceBtn}
          cancelLabel={s.cancel}
          onConfirm={() => void run(pending)}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  );
}
