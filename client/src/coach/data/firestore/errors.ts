/** Maps what the document store / callables throw to the port's error codes. No message text is ever copied across. */
import { PortError } from '../port';
import { classifyProblem } from '../problem';

export function toPortError(e: unknown): PortError {
  if (e instanceof PortError) return e;
  const x = e as { code?: unknown; status?: unknown; name?: unknown; message?: unknown } | null;
  const code = typeof x?.code === 'string' ? x.code.replace(/^functions\/|^firestore\//, '') : '';
  const status = typeof x?.status === 'number' ? x.status : 0;
  if (x?.name === 'VaultLockedError' || x?.message === 'vault-locked')
    return new PortError('vault-locked');
  if (status === 403 || code === 'permission-denied' || classifyProblem(e) === 'denied')
    return new PortError('forbidden');
  if (classifyProblem(e) === 'not-deployed') return new PortError('not-deployed');
  if (code === 'deadline-exceeded' || status === 408 || status === 504)
    return new PortError('timeout');
  if (code === 'unavailable' || status === 503) return new PortError('offline');
  // no HTTP status at all: a network-level failure only when the device says it is offline, else we do not know
  if (status === 0 && typeof navigator !== 'undefined' && navigator.onLine === false)
    return new PortError('offline');
  return new PortError('unavailable');
}
