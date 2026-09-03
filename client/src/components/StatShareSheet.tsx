/**
 * Share bottom sheet for the Apex stat cards (awards · standards). Mirrors the
 * workout/recap share sheet: a live canvas preview, a story/square toggle, and
 * native-share / save / copy. Drawing is offline (data/shareCard).
 */
import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Icon, Sheet, useIsDesktop } from '../ui';
import {
  drawStatCard,
  cardBlob,
  type StatShareModel,
  type StatShareFormat,
} from '../data/shareCard';

export function StatShareSheet({
  model,
  fileBase,
  onClose,
}: {
  model: StatShareModel;
  fileBase: string;
  onClose: () => void;
}) {
  const { t } = useT();
  const isDesktop = useIsDesktop();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<StatShareFormat>(isDesktop ? 'square' : 'story');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileName = `${fileBase}.png`;

  useEffect(() => {
    const cv = canvasRef.current;
    if (cv) void drawStatCard(cv, model, format);
  }, [model, format]);

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
      await navigator.share({ files: [file], title: model.headline });
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
        <h3>{model.kicker}</h3>
        <div className="share-format" role="tablist">
          <button className={format === 'story' ? 'on' : ''} onClick={() => setFormat('story')}>
            {t.shareFormatStory}
          </button>
          <button className={format === 'square' ? 'on' : ''} onClick={() => setFormat('square')}>
            {t.shareFormatSquare}
          </button>
        </div>
      </div>
      <div className={`share-preview ${format}`}>
        <canvas ref={canvasRef} className="share-canvas" />
      </div>
      <div className="share-actions">
        {isDesktop ? (
          <button
            className="btn btn-primary grow"
            disabled={busy}
            onClick={() => withBlob(download)}
          >
            <Icon name="download-simple" />
            {t.shareDownload}
          </button>
        ) : (
          <button
            className="btn btn-primary grow"
            disabled={busy}
            onClick={() => withBlob(nativeShare)}
          >
            <Icon name="export" />
            {t.shareToStories}
          </button>
        )}
        {!isDesktop && (
          <button
            className="btn btn-secondary share-icon-btn"
            disabled={busy}
            onClick={() => withBlob(download)}
            aria-label={t.shareSaveImage}
            title={t.shareSaveImage}
          >
            <Icon name="download-simple" />
          </button>
        )}
        <button
          className="btn btn-secondary share-icon-btn"
          disabled={busy}
          onClick={() => withBlob(copy)}
          aria-label={copied ? t.shareCopied : t.shareCopy}
          title={copied ? t.shareCopied : t.shareCopy}
        >
          <Icon name={copied ? 'check' : 'copy'} />
        </button>
      </div>
    </Sheet>
  );
}
