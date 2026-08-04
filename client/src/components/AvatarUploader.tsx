/**
 * Reusable avatar add/edit pattern from onboarding: source choice, circular
 * crop with zoom, then authenticated upload. Profile details reuse the same
 * surface instead of inventing separate photo controls.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { currentUid, trackMutation } from '../api';
import { db, storage } from '../firebase';
import { useT } from '../i18n';
import { Icon } from '../ui';
import { Avatar, invalidateAvatarCache } from './Avatar';

export function AvatarUploader({
  userId,
  name,
  hasPhoto = false,
  refreshKey = 0,
  compact = false,
  idleFooter,
  onUploaded,
  onRemoved,
}: {
  userId?: string;
  name: string;
  hasPhoto?: boolean;
  refreshKey?: number;
  compact?: boolean;
  idleFooter?: ReactNode;
  onUploaded: (previewUrl?: string) => void;
  onRemoved?: () => Promise<void> | void;
}) {
  const { t } = useT();
  const [file, setFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [cropSize, setCropSize] = useState(260);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const cropRef = useRef<HTMLDivElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffset: { x: number; y: number };
  } | null>(null);
  const id = useId();
  const cameraInputId = `${id}-camera`;
  const libraryInputId = `${id}-library`;

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  useEffect(() => {
    if (!imgUrl || !cropRef.current) return;
    const el = cropRef.current;
    const update = () => setCropSize(el.getBoundingClientRect().width || 260);
    update();
    const Observer = window.ResizeObserver;
    if (!Observer) return;
    const ro = new Observer(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [imgUrl]);

  function cropSide(): number {
    return cropSize;
  }

  function clampOffset(
    next: { x: number; y: number },
    nextZoom = zoom,
    size = imageSize,
  ): { x: number; y: number } {
    if (!size) return next;
    const side = cropSide();
    const scale = Math.max(side / size.width, side / size.height) * nextZoom;
    const drawnW = size.width * scale;
    const drawnH = size.height * scale;
    const maxX = Math.max(0, (drawnW - side) / 2);
    const maxY = Math.max(0, (drawnH - side) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }

  function clearPicked(): void {
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    setImgUrl(null);
    setFile(null);
    setImageSize(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function pick(f: File | undefined): void {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError(t.onbAvatarTooBig(`${Math.round(f.size / 1024 / 1024)} MB`));
      return;
    }
    if (!/^image\/(jpeg|png|webp|heic|heif)/.test(f.type)) {
      setError(t.onbAvatarType);
      return;
    }
    clearPicked();
    setError(null);
    setFile(f);
    setImgUrl(URL.createObjectURL(f));
    setImageSize(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  async function openCamera(): Promise<void> {
    if (busy || cameraBusy) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }
    setCameraBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      setCameraStream(stream);
      setCameraOpen(true);
    } catch {
      setError(t.onbCameraUnavailable);
    } finally {
      setCameraBusy(false);
    }
  }

  function closeCamera(): void {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraOpen(false);
  }

  async function captureCamera(): Promise<void> {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError(t.error);
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(t.error))), 'image/jpeg', 0.9);
    });
    closeCamera();
    pick(new File([blob], 'avatar-camera.jpg', { type: 'image/jpeg' }));
  }

  function openLibrary(): void {
    if (!busy) libraryInputRef.current?.click();
  }

  async function upload(): Promise<void> {
    const img = imgRef.current;
    if (!img || !file || !imageSize) return;
    setBusy(true);
    setError(null);
    try {
      const size = 512;
      const side = cropSide();
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(t.error);
      const scale = Math.max(side / imageSize.width, side / imageSize.height) * zoom;
      const drawnW = imageSize.width * scale;
      const drawnH = imageSize.height * scale;
      const ratio = size / side;
      const dx = (side / 2 - drawnW / 2 + offset.x) * ratio;
      const dy = (side / 2 - drawnH / 2 + offset.y) * ratio;
      ctx.drawImage(img, dx, dy, drawnW * ratio, drawnH * ratio);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(t.error))), 'image/jpeg', 0.86);
      });
      const uid = currentUid();
      if (!uid) throw new Error(t.error);
      // Upload to Storage (access-gated by storage.rules), then flag the photo
      // on the user's own doc so `hasPhoto` persists across devices.
      await trackMutation(
        (async () => {
          await uploadBytes(ref(storage, `avatars/${uid}/photo`), blob, {
            contentType: 'image/jpeg',
            cacheControl: 'no-store',
          });
          await updateDoc(doc(db, 'users', uid), { avatarExt: 'jpg', updatedAt: Date.now() });
        })(),
      );
      const preview = URL.createObjectURL(blob);
      invalidateAvatarCache(uid);
      clearPicked();
      onUploaded(preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    if (!onRemoved) return;
    setBusy(true);
    setError(null);
    try {
      await onRemoved();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`avatar-uploader${compact ? ' compact' : ''}`}>
      {cameraOpen ? (
        <>
          <div className="kicker">{t.onbCamera}</div>
          <div className="onb-camera">
            <video ref={videoRef} autoPlay muted playsInline />
          </div>
          {error && (
            <div className="field-error">
              <Icon name="warning-circle" />
              {error}
            </div>
          )}
          <div className="onb-two avatar-uploader-actions">
            <button className="btn btn-secondary" type="button" onClick={closeCamera}>
              {t.cancel}
            </button>
            <button className="btn btn-primary" type="button" onClick={() => void captureCamera()}>
              <Icon name="camera" /> {t.onbTakePhoto}
            </button>
          </div>
        </>
      ) : !imgUrl ? (
        <>
          <button
            type="button"
            className="onb-avatar-ring avatar-uploader-ring"
            aria-label={t.profileChangeAvatar}
            onClick={openLibrary}
            disabled={busy}
          >
            {userId && hasPhoto ? (
              <Avatar
                userId={userId}
                name={name}
                hasPhoto={hasPhoto}
                refreshKey={refreshKey}
                size={compact ? 112 : 150}
              />
            ) : (
              <Icon name="plus" className="avatar-uploader-plus" />
            )}
            <span className="cam-badge">
              <Icon name="camera" />
            </span>
          </button>
          <div className="onb-two avatar-uploader-actions">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => void openCamera()}
              disabled={busy || cameraBusy}
            >
              <Icon name="camera" /> {t.onbCamera}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={openLibrary}
              disabled={busy}
            >
              <Icon name="image-square" /> {t.onbLibrary}
            </button>
            {hasPhoto && onRemoved && (
              <button
                className="btn btn-secondary danger-outline"
                type="button"
                onClick={remove}
                disabled={busy}
              >
                <Icon name="trash" /> {t.profileRemoveAvatar}
              </button>
            )}
          </div>
          <input
            ref={cameraInputRef}
            id={cameraInputId}
            className="visually-hidden"
            type="file"
            accept="image/*"
            capture="user"
            tabIndex={-1}
            onChange={(e) => {
              pick(e.currentTarget.files?.[0]);
              e.currentTarget.value = '';
            }}
          />
          <input
            ref={libraryInputRef}
            id={libraryInputId}
            className="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            tabIndex={-1}
            onChange={(e) => {
              pick(e.currentTarget.files?.[0]);
              e.currentTarget.value = '';
            }}
          />
          {error && (
            <div className="field-error">
              <Icon name="warning-circle" />
              {error}
            </div>
          )}
          {idleFooter}
        </>
      ) : (
        <>
          <div className="kicker">{t.onbPosition}</div>
          <div
            ref={cropRef}
            className="onb-crop"
            onPointerDown={(e) => {
              if (!imageSize) return;
              dragRef.current = {
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                startOffset: offset,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const drag = dragRef.current;
              if (!drag || drag.pointerId !== e.pointerId) return;
              setOffset(
                clampOffset({
                  x: drag.startOffset.x + e.clientX - drag.startX,
                  y: drag.startOffset.y + e.clientY - drag.startY,
                }),
              );
            }}
            onPointerUp={(e) => {
              if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
          >
            <img
              ref={imgRef}
              src={imgUrl}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const nextSize = {
                  width: e.currentTarget.naturalWidth,
                  height: e.currentTarget.naturalHeight,
                };
                setImageSize(nextSize);
                setOffset((o) => clampOffset(o, zoom, nextSize));
              }}
              style={
                imageSize
                  ? {
                      width: `${imageSize.width * Math.max(cropSize / imageSize.width, cropSize / imageSize.height) * zoom}px`,
                      height: `${imageSize.height * Math.max(cropSize / imageSize.width, cropSize / imageSize.height) * zoom}px`,
                      transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                    }
                  : undefined
              }
            />
            <div className="mask" />
          </div>
          <div className="detail-muted">{t.onbCropHelp}</div>
          <label className="avatar-zoom">
            <span>{t.onbZoom}</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => {
                const nextZoom = Number(e.target.value);
                setZoom(nextZoom);
                setOffset((o) => clampOffset(o, nextZoom));
              }}
            />
          </label>
          {error && (
            <div className="field-error">
              <Icon name="warning-circle" />
              {error}
            </div>
          )}
          <div className="onb-two avatar-uploader-actions">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={clearPicked}
              disabled={busy}
            >
              {t.cancel}
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy || !imageSize}
              onClick={() => void upload()}
            >
              {t.onbUsePhoto}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
