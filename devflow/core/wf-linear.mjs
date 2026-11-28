/**
 * SPO-639 (WF-B): publish the wf progress report to Linear as ONE pinned comment (edited in place).
 * The API key comes only from process.env.LINEAR_API_KEY; it is never logged or written anywhere.
 */
export const MARKER = '<!-- wf-progress -->';
const ENDPOINT = 'https://api.linear.app/graphql';

async function gql(key, query, variables, fetchImpl) {
  const res = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: key },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`linear http ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error('linear graphql error');
  return json.data;
}

/** Returns 'created' | 'updated' | 'skipped-no-key'. Throws only on transport/API errors (never leaks the key). */
export async function syncProgress({ task, report, env = process.env, fetchImpl = fetch }) {
  const key = env.LINEAR_API_KEY;
  if (!key) return 'skipped-no-key';
  const body = `${MARKER}\n${report}`;
  const found = await gql(
    key,
    'query($id:String!){issue(id:$id){id comments(first:100){nodes{id body}}}}',
    { id: task },
    fetchImpl,
  );
  const issue = found.issue;
  if (!issue) throw new Error('linear issue not found');
  const existing = issue.comments.nodes.find((c) => c.body.startsWith(MARKER));
  if (existing) {
    await gql(
      key,
      'mutation($id:String!,$body:String!){commentUpdate(id:$id,input:{body:$body}){success}}',
      { id: existing.id, body },
      fetchImpl,
    );
    return 'updated';
  }
  await gql(
    key,
    'mutation($issueId:String!,$body:String!){commentCreate(input:{issueId:$issueId,body:$body}){success}}',
    { issueId: issue.id, body },
    fetchImpl,
  );
  return 'created';
}
