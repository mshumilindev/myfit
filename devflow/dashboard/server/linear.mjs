/**
 * SPO-639 (W30): read-only Linear status for the Dev Console. The key comes from the environment or from the
 * gitignored `.claude/settings.local.json` `env` block; it is never logged, returned or put into a snapshot.
 * Every failure (no key, network, API) gives an empty result: the tab then explains instead of breaking.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ENDPOINT = 'https://api.linear.app/graphql';
const MARKER = '<!-- wf-progress -->';

/** @param {string} root @param {Record<string, string | undefined>} [env] @returns {string | null} */
export function loadKey(root, env = process.env) {
  if (env.LINEAR_API_KEY) return env.LINEAR_API_KEY;
  try {
    const s = JSON.parse(readFileSync(join(root, '.claude/settings.local.json'), 'utf8'));
    const k = s?.env?.LINEAR_API_KEY;
    return typeof k === 'string' && k ? k : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ key: string | null, ids: string[], fetchImpl?: typeof fetch, now?: number }} o
 * @returns {Promise<Record<string, { state: string, syncedSecAgo: number | null }>>}
 */
export async function linearOf({ key, ids, fetchImpl = fetch, now = Date.now() }) {
  /** @type {Record<string, { state: string, syncedSecAgo: number | null }>} */
  const out = {};
  if (!key) return out;
  for (const id of ids.slice(0, 12)) {
    try {
      const res = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: key },
        body: JSON.stringify({
          query:
            'query($id:String!){issue(id:$id){state{name} comments(first:100){nodes{body updatedAt}}}}',
          variables: { id },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const issue = json?.data?.issue;
      if (!issue) continue;
      const mine = (issue.comments?.nodes ?? []).find((/** @type {any} */ c) =>
        String(c.body).startsWith(MARKER),
      );
      const at = mine ? Date.parse(mine.updatedAt) : NaN;
      out[id] = {
        state: String(issue.state?.name ?? 'unknown').slice(0, 30),
        syncedSecAgo: Number.isFinite(at) ? Math.max(0, Math.round((now - at) / 1000)) : null,
      };
    } catch {
      /* one task failing never hides the others */
    }
  }
  return out;
}
