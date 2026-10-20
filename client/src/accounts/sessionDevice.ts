/** The device key shared with push (one id per browser install). Kept apart from sessions.ts so api.ts can use it without an import cycle. */
const DEVICE_KEY = 'spotter.pushDevice';

export function sessionDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}
