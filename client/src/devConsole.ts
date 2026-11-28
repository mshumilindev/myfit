/** Dev Console (SPO-639) entry point: only on a local dev server opened on localhost. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function devConsoleHref(dev: boolean, hostname: string): string | null {
  if (!dev || !LOCAL_HOSTS.has(hostname)) return null;
  // the console is a separate loopback-only dev server; port mirrors DEV_DASH_PORT
  const port = (import.meta.env.VITE_DEV_DASH_PORT as string | undefined) ?? '5174';
  return `http://127.0.0.1:${port}`;
}

export function currentDevConsoleHref(): string | null {
  return typeof window === 'undefined'
    ? null
    : devConsoleHref(import.meta.env.DEV, window.location.hostname);
}
