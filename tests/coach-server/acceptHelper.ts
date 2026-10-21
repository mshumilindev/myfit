import type { Kv } from '../../functions/src/coach/kv';
import type { Actor, Ctx } from '../../functions/src/coach/service';
import { teamAccept } from '../../functions/src/coach/team';

/** Accept as the person the invite was written for (the real handler passes the VERIFIED sign-in e-mail). */
export async function acceptWithMail(
  ctx: Ctx & { kv: Kv },
  actor: Actor,
  body: { inviteId: string },
) {
  const inv = await ctx.kv.get(`teamInvites/${body.inviteId}`);
  const email = typeof inv?.emailLower === 'string' ? inv.emailLower : undefined;
  return teamAccept(ctx, email ? { ...actor, email } : actor, body);
}
