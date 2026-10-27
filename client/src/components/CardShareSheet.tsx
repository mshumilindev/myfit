/**
 * Share bottom sheet shared by the Apex stat cards and the period recap: a live canvas preview, a story/square toggle
 * and native-share / save / copy. The caller supplies only what differs: the title, the file name, the share title and
 * how to draw the card (offline, data/shareCard). `draw` must be stable (useCallback) or the card redraws every render.
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/Button';
import { Segmented } from './ui/Segmented';
import { useT } from '../i18n';
import { Icon, Sheet, useIsDesktop } from '../ui';
import { cardBlob, type ShareFormat } from '../data/shareCard';

export function CardShareSheet({
  title,
  fileName,
  shareTitle,
  draw,
  onClose,
}: {
  title: string;
  fileName: string;
  /** Title passed to the native share dialog. */
  shareTitle: string;
  draw: (canvas: HTMLCanvasElement, format: ShareFormat) => void | Promise<void>;
  onClose: () => void;
}) {
  const { t } = useT();
  const isDesktop = useIsDesktop();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<ShareFormat>(isDesktop ? 'square' : 'story');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const cv = canvasRef.current;
    if (cv) void draw(cv, format);
  }, [draw, format]);

  async function withBlob(fn: (b: Blob) => void | Promise<void>): Promise<void> {
    const cv = canvasRef.current;
    if (!cv) return;
    setBusy(true);
    try {
      const b = await cardBlob(cv);
      if (b) await fn(b);
    } catch {
      /* cancelled or unsupported */
    } finally {
      setBusy(false);
    }
  }

  function download(b: Blob): void {
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function nativeShare(b: Blob): Promise<void> {
    const file = new File([b], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: shareTitle });
    } else {
      download(b);
    }
  }

  async function copy(b: Blob): Promise<void> {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } else {
      download(b);
    }
  }

  return (
    <Sheet className="share-sheet" onClose={onClose}>
      <div className="share-head">
        <h3>{title}</h3>
        <Segmented
          tabs
          className="share-format"
          value={format}
          onChange={setFormat}
          options={[
            { value: 'story', label: t.shareFormatStory },
            { value: 'square', label: t.shareFormatSquare },
          ]}
        />
      </div>
      <div className={`share-preview ${format}`}>
        <canvas ref={canvasRef} className="share-canvas" />
      </div>
      <div className="share-actions">
        {isDesktop ? (
          <Button
            variant="primary"
            className="grow"
            disabled={busy}
            onClick={() => withBlob(download)}
          >
            <Icon name="download-simple" />
            {t.shareDownload}
          </Button>
        ) : (
          <Button
            variant="primary"
            className="grow"
            disabled={busy}
            onClick={() => withBlob(nativeShare)}
          >
            <Icon name="export" />
            {t.shareToStories}
          </Button>
        )}
        {!isDesktop && (
          <Button
            variant="secondary"
            className="share-icon-btn"
            disabled={busy}
            onClick={() => withBlob(download)}
            aria-label={t.shareSaveImage}
            title={t.shareSaveImage}
          >
            <Icon name="download-simple" />
          </Button>
        )}
        <Button
          variant="secondary"
          className="share-icon-btn"
          disabled={busy}
          onClick={() => withBlob(copy)}
          aria-label={copied ? t.shareCopied : t.shareCopy}
          title={copied ? t.shareCopied : t.shareCopy}
        >
          <Icon name={copied ? 'check' : 'copy'} />
        </Button>
      </div>
    </Sheet>
  );
}
