import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { setLocale } from '../i18n';
import { LOCALES } from '../i18n';

const uploadBytes = vi.fn();
const updateDoc = vi.fn();
const currentUid = vi.fn();
const writeAvatarBlob = vi.fn();
const invalidateAvatarCache = vi.fn();
vi.mock('firebase/storage', () => ({
  ref: (_s: unknown, path: string) => ({ path }),
  uploadBytes: (...a: unknown[]) => uploadBytes(...a),
}));
vi.mock('firebase/firestore', () => ({
  doc: (_d: unknown, ...p: string[]) => ({ path: p.join('/') }),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
}));
vi.mock('../firebase', () => ({ db: {}, storage: {} }));
vi.mock('../api', () => ({
  currentUid: () => currentUid(),
  trackMutation: <T,>(p: Promise<T>) => p,
}));
vi.mock('../avatarStore', () => ({ writeAvatarBlob: (...a: unknown[]) => writeAvatarBlob(...a) }));
vi.mock('./Avatar', () => ({
  UserAvatar: (p: { userId: string; size: number }) => (
    <span data-testid="avatar" data-size={p.size} data-uid={p.userId} />
  ),
  invalidateAvatarCache: (...a: unknown[]) => invalidateAvatarCache(...a),
}));

import { AvatarUploader } from './AvatarUploader';

const en = () => LOCALES.en;
const file = (type = 'image/png', bytes = 10) =>
  new File([new Uint8Array(bytes)], 'a.png', { type });
const libraryInput = () =>
  document.querySelector('input[type=file]:not([capture])') as HTMLInputElement;
const cameraInput = () => document.querySelector('input[type=file][capture]') as HTMLInputElement;

function pickFile(f: File, input = libraryInput()) {
  fireEvent.change(input, { target: { files: [f] } });
}
/** Loads the picked image at the given natural size so the crop UI becomes usable. */
function loadImage(w: number, h: number) {
  const img = document.querySelector('.onb-crop img') as HTMLImageElement;
  Object.defineProperty(img, 'naturalWidth', { configurable: true, value: w });
  Object.defineProperty(img, 'naturalHeight', { configurable: true, value: h });
  fireEvent.load(img);
  return img;
}
function stubCanvas(blob: Blob | null = new Blob(['x'], { type: 'image/jpeg' })) {
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(((cb: BlobCallback) =>
    cb(blob)) as never);
  return drawImage;
}

beforeEach(() => {
  setLocale('en');
  [uploadBytes, updateDoc, currentUid, writeAvatarBlob, invalidateAvatarCache].forEach((m) =>
    m.mockReset(),
  );
  uploadBytes.mockResolvedValue(undefined);
  updateDoc.mockResolvedValue(undefined);
  currentUid.mockReturnValue('u1');
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:mock-${++n}`);
  URL.revokeObjectURL = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AvatarUploader · idle state', () => {
  it('shows the plus placeholder and the source buttons, no remove without a photo', () => {
    render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    expect(screen.getByRole('button', { name: en().profileChangeAvatar })).toBeTruthy();
    expect(screen.getByRole('button', { name: new RegExp(en().onbCamera) })).toBeTruthy();
    expect(screen.getByRole('button', { name: new RegExp(en().onbLibrary) })).toBeTruthy();
    expect(screen.queryByTestId('avatar')).toBeNull();
    expect(screen.queryByRole('button', { name: new RegExp(en().profileRemoveAvatar) })).toBeNull();
  });

  it('shows the current photo at the size that fits (compact is smaller) and renders the footer', () => {
    const { rerender, container } = render(
      <AvatarUploader
        userId="u1"
        name="Ann"
        hasPhoto
        idleFooter={<p>footer-note</p>}
        onUploaded={() => undefined}
      />,
    );
    expect(screen.getByTestId('avatar').getAttribute('data-size')).toBe('150');
    expect(screen.getByText('footer-note')).toBeTruthy();
    rerender(
      <AvatarUploader userId="u1" name="Ann" hasPhoto compact onUploaded={() => undefined} />,
    );
    expect(screen.getByTestId('avatar').getAttribute('data-size')).toBe('112');
    expect(container.querySelector('.avatar-uploader.compact')).toBeTruthy();
  });

  it('falls back to the placeholder when there is a photo flag but no user id', () => {
    render(<AvatarUploader name="Ann" hasPhoto onUploaded={() => undefined} />);
    expect(screen.queryByTestId('avatar')).toBeNull();
  });

  it('the ring and Library button open the file chooser', () => {
    render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    const click = vi.spyOn(libraryInput(), 'click').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: en().profileChangeAvatar }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en().onbLibrary) }));
    expect(click).toHaveBeenCalledTimes(2);
  });

  it('removing calls onRemoved; failures surface as an error and re-enable the buttons', async () => {
    const onRemoved = vi
      .fn()
      .mockRejectedValueOnce(new Error('nope'))
      .mockResolvedValueOnce(undefined);
    render(
      <AvatarUploader
        userId="u1"
        name="Ann"
        hasPhoto
        onRemoved={onRemoved}
        onUploaded={() => undefined}
      />,
    );
    const btn = () =>
      screen.getByRole('button', {
        name: new RegExp(en().profileRemoveAvatar),
      }) as HTMLButtonElement;
    fireEvent.click(btn());
    expect(await screen.findByText('nope')).toBeTruthy();
    expect(btn().disabled).toBe(false);
    fireEvent.click(btn());
    await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('nope')).toBeNull());
  });

  it('a non-Error rejection falls back to the generic error text', async () => {
    const onRemoved = vi.fn().mockRejectedValue('boom');
    render(
      <AvatarUploader
        userId="u1"
        name="Ann"
        hasPhoto
        onRemoved={onRemoved}
        onUploaded={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en().profileRemoveAvatar) }));
    expect(await screen.findByText(en().error)).toBeTruthy();
  });
});

describe('AvatarUploader · picking a file', () => {
  it('rejects files over 10 MB with their size in the message', () => {
    render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    pickFile(file('image/png', 12 * 1024 * 1024 + 1));
    expect(screen.getByText(en().onbAvatarTooBig('12 MB'))).toBeTruthy();
    expect(document.querySelector('.onb-crop')).toBeNull();
  });

  it('accepts exactly 10 MB', () => {
    render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    pickFile(file('image/png', 10 * 1024 * 1024));
    expect(document.querySelector('.onb-crop')).toBeTruthy();
  });

  it.each(['image/gif', 'application/pdf', ''])('rejects the type %j', (type) => {
    render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    pickFile(file(type));
    expect(screen.getByText(en().onbAvatarType)).toBeTruthy();
  });

  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])(
    'accepts %s',
    (type) => {
      render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
      pickFile(file(type));
      expect(document.querySelector('.onb-crop')).toBeTruthy();
    },
  );

  it('ignores an empty selection, and the camera input feeds the same pipeline', () => {
    render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    fireEvent.change(libraryInput(), { target: { files: [] } });
    expect(document.querySelector('.onb-crop')).toBeNull();
    pickFile(file('image/jpeg'), cameraInput());
    expect(document.querySelector('.onb-crop')).toBeTruthy();
  });

  it('a good pick clears an earlier error', () => {
    render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    pickFile(file('image/gif'));
    expect(screen.getByText(en().onbAvatarType)).toBeTruthy();
    pickFile(file('image/png'));
    expect(screen.queryByText(en().onbAvatarType)).toBeNull();
  });
});

describe('AvatarUploader · crop', () => {
  it('"Use photo" stays disabled until the image has loaded; Cancel discards and revokes the URL', () => {
    render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    pickFile(file());
    const use = () => screen.getByRole('button', { name: en().onbUsePhoto }) as HTMLButtonElement;
    expect(use().disabled).toBe(true);
    loadImage(800, 400);
    expect(use().disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: en().cancel }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
    expect(document.querySelector('.onb-crop')).toBeNull();
    expect(screen.getByRole('button', { name: en().profileChangeAvatar })).toBeTruthy();
  });

  it('sizes the image to cover the square and clamps dragging to the overflow', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 200,
    } as DOMRect);
    render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    pickFile(file());
    const img = loadImage(800, 400); // scale = 200/400 = 0.5 -> 400x200, overflow x = 100
    expect(img.style.width).toBe('400px');
    expect(img.style.height).toBe('200px');
    const crop = document.querySelector('.onb-crop') as HTMLElement;
    crop.setPointerCapture = vi.fn();
    const ev = (type: string, init: Record<string, number>) =>
      fireEvent(
        crop,
        Object.assign(new MouseEvent(type, { bubbles: true, clientX: init.x, clientY: init.y }), {
          pointerId: init.id ?? 1,
        }),
      );
    ev('pointerdown', { x: 0, y: 0 });
    ev('pointermove', { x: 60, y: 500 });
    expect(img.style.transform).toBe('translate(calc(-50% + 60px), calc(-50% + 0px))');
    ev('pointermove', { x: -900, y: 0 });
    expect(img.style.transform).toBe('translate(calc(-50% + -100px), calc(-50% + 0px))');
    ev('pointermove', { x: 10, y: 0, id: 2 }); // other pointer is ignored
    expect(img.style.transform).toContain('-100px');
    ev('pointerup', { x: 0, y: 0 });
    ev('pointermove', { x: 20, y: 0 }); // drag ended
    expect(img.style.transform).toContain('-100px');
  });

  it('ignores drags before the image is measured and after cancel', () => {
    render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    pickFile(file());
    const crop = document.querySelector('.onb-crop') as HTMLElement;
    crop.setPointerCapture = vi.fn();
    const pe = (type: string) =>
      Object.assign(new MouseEvent(type, { bubbles: true, clientX: 5 }), { pointerId: 1 });
    fireEvent(crop, pe('pointerdown'));
    expect(crop.setPointerCapture).not.toHaveBeenCalled();
    loadImage(100, 100);
    fireEvent(crop, pe('pointerdown'));
    expect(crop.setPointerCapture).toHaveBeenCalledWith(1);
    fireEvent(crop, pe('pointercancel'));
    fireEvent(crop, pe('pointermove'));
    expect((document.querySelector('.onb-crop img') as HTMLElement).style.transform).toContain(
      '+ 0px',
    );
  });

  it('zooming enlarges the image and re-clamps an existing offset', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 200,
    } as DOMRect);
    render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    pickFile(file());
    const img = loadImage(400, 400);
    const slider = screen.getByRole('slider') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '2' } });
    expect(img.style.width).toBe('400px');
    const crop = document.querySelector('.onb-crop') as HTMLElement;
    crop.setPointerCapture = vi.fn();
    const ev = (type: string, x: number) =>
      fireEvent(
        crop,
        Object.assign(new MouseEvent(type, { bubbles: true, clientX: x }), { pointerId: 1 }),
      );
    ev('pointerdown', 0);
    ev('pointermove', 500);
    expect(img.style.transform).toContain('+ 100px');
    fireEvent.change(slider, { target: { value: '1' } });
    expect(img.style.transform).toContain('+ 0px');
  });

  it('follows the container width through ResizeObserver and disconnects on unmount', () => {
    let width = 200;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ width }) as DOMRect,
    );
    const disconnect = vi.fn();
    let cb: () => void = () => undefined;
    window.ResizeObserver = class {
      constructor(f: () => void) {
        cb = f;
      }
      observe() {}
      unobserve() {}
      disconnect = disconnect;
    } as never;
    const { unmount } = render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    pickFile(file());
    const img = loadImage(100, 100);
    expect(img.style.width).toBe('200px');
    width = 300;
    act(() => cb());
    expect(img.style.width).toBe('300px');
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('falls back to 260 when the container has no width and no ResizeObserver exists', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 0,
    } as DOMRect);
    window.ResizeObserver = undefined as never;
    render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    pickFile(file());
    expect(loadImage(260, 260).style.width).toBe('260px');
  });
});

describe('AvatarUploader · upload', () => {
  async function toUpload() {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 256,
    } as DOMRect);
    const onUploaded = vi.fn();
    render(<AvatarUploader name="Ann" onUploaded={onUploaded} />);
    pickFile(file());
    loadImage(512, 256);
    return onUploaded;
  }

  it('crops to 512px JPEG, uploads to the owner path, flags the profile and reports the preview', async () => {
    const drawImage = stubCanvas();
    const onUploaded = await toUpload();
    fireEvent.click(screen.getByRole('button', { name: en().onbUsePhoto }));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    // image 512x256 in a 256 square: scale 1, drawn 512x256, ratio 2 -> dx=(128-256)*2, dy=0
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), -256, 0, 1024, 512);
    expect(uploadBytes).toHaveBeenCalledWith({ path: 'avatars/u1/photo' }, expect.any(Blob), {
      contentType: 'image/jpeg',
      cacheControl: 'no-store',
    });
    const [docRef, patch] = updateDoc.mock.calls[0];
    expect(docRef).toEqual({ path: 'users/u1' });
    expect(patch).toMatchObject({ avatarExt: 'jpg' });
    expect(invalidateAvatarCache).toHaveBeenCalledWith('u1');
    expect(writeAvatarBlob).toHaveBeenCalledWith('u1', patch.updatedAt, expect.any(Blob));
    expect(onUploaded.mock.calls[0][0]).toMatch(/^blob:mock-/);
    expect(document.querySelector('.onb-crop')).toBeNull(); // back to idle
  });

  it.each([
    [
      'no canvas context',
      () => vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null),
      () => en().error,
    ],
    ['an encoder failure', () => stubCanvas(null), () => en().error],
  ])('shows an error and stays in the editor on %s', async (_n, arrange, msg) => {
    stubCanvas();
    arrange();
    await toUpload();
    fireEvent.click(screen.getByRole('button', { name: en().onbUsePhoto }));
    expect(await screen.findByText(msg())).toBeTruthy();
    expect(uploadBytes).not.toHaveBeenCalled();
    expect(
      (screen.getByRole('button', { name: en().onbUsePhoto }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('refuses to upload when signed out', async () => {
    stubCanvas();
    currentUid.mockReturnValue(null);
    await toUpload();
    fireEvent.click(screen.getByRole('button', { name: en().onbUsePhoto }));
    expect(await screen.findByText(en().error)).toBeTruthy();
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it('a storage failure shows its message, keeps the crop, and does not report success', async () => {
    stubCanvas();
    uploadBytes.mockRejectedValue(new Error('quota'));
    const onUploaded = await toUpload();
    fireEvent.click(screen.getByRole('button', { name: en().onbUsePhoto }));
    expect(await screen.findByText('quota')).toBeTruthy();
    expect(onUploaded).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
    expect(writeAvatarBlob).not.toHaveBeenCalled();
  });
});

describe('AvatarUploader · camera', () => {
  const track = () => ({ stop: vi.fn() });
  function withCamera(stream: unknown) {
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    return getUserMedia;
  }

  it('without getUserMedia the Camera button falls back to the native camera input', () => {
    render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    const click = vi.spyOn(cameraInput(), 'click').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en().onbCamera) }));
    expect(click).toHaveBeenCalled();
  });

  it('a denied camera shows the unavailable message', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en().onbCamera) }));
    expect(await screen.findByText(en().onbCameraUnavailable)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: new RegExp(en().onbCamera) }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('opens the live view with a front-facing stream; Cancel stops every track', async () => {
    const t1 = track();
    const getUserMedia = withCamera({ getTracks: () => [t1] });
    render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en().onbCamera) }));
    expect(await screen.findByRole('button', { name: new RegExp(en().onbTakePhoto) })).toBeTruthy();
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'user' }, audio: false });
    fireEvent.click(screen.getByRole('button', { name: en().cancel }));
    expect(t1.stop).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: en().profileChangeAvatar })).toBeTruthy();
  });

  it('unmounting while the camera is on releases the stream', async () => {
    const t1 = track();
    withCamera({ getTracks: () => [t1] });
    const { unmount } = render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en().onbCamera) }));
    await screen.findByRole('button', { name: new RegExp(en().onbTakePhoto) });
    unmount();
    expect(t1.stop).toHaveBeenCalled();
  });

  it('capturing before the video has dimensions does nothing', async () => {
    withCamera({ getTracks: () => [track()] });
    render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en().onbCamera) }));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(en().onbTakePhoto) }));
    expect(screen.getByRole('button', { name: new RegExp(en().onbTakePhoto) })).toBeTruthy();
  });

  it('capturing a frame closes the camera and goes to the crop step', async () => {
    const t1 = track();
    withCamera({ getTracks: () => [t1] });
    const drawImage = stubCanvas();
    render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en().onbCamera) }));
    const take = await screen.findByRole('button', { name: new RegExp(en().onbTakePhoto) });
    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'videoWidth', { configurable: true, value: 640 });
    Object.defineProperty(video, 'videoHeight', { configurable: true, value: 480 });
    fireEvent.click(take);
    await waitFor(() => expect(document.querySelector('.onb-crop')).toBeTruthy());
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 640, 480);
    expect(t1.stop).toHaveBeenCalled();
  });

  it('a missing canvas context while capturing shows the generic error, camera stays open', async () => {
    withCamera({ getTracks: () => [track()] });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    render(<AvatarUploader name="Ann" onUploaded={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en().onbCamera) }));
    const take = await screen.findByRole('button', { name: new RegExp(en().onbTakePhoto) });
    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'videoWidth', { configurable: true, value: 10 });
    Object.defineProperty(video, 'videoHeight', { configurable: true, value: 10 });
    fireEvent.click(take);
    expect(await screen.findByText(en().error)).toBeTruthy();
    expect(document.querySelector('video')).toBeTruthy();
  });
});
