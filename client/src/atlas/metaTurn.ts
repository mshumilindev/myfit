/**
 * SPO-35 P3: questions about the chat itself — "what did I just ask", "repeat that", "what did we talk about".
 * Answered from the short log of the conversation (convo.said, newest first), never from a topic template.
 */
import type { Tr } from './intentKit';

export interface Said {
  q: string;
  a: string;
}
interface MConvo {
  said?: Said[];
}

const REPEAT_RE =
  /^\s*(please\s+)?(repeat( that| it| the last answer)?|say (that|it) again|can you (repeat|say) (that|it|the last answer)( again)?|what did you (just )?say|come again)\W*$|^\s*(повтори|скажи ще раз|ще раз|що ти (щойно )?сказав|powtórz|powiedz jeszcze raz|co (właśnie )?powiedziałeś)\W*$/iu;
const LAST_Q_RE =
  /what (did|was) (i|my)( just| last)? (ask|question|say)|my (last|previous) question|що я (щойно |останнім )?(питав|запитував)|моє (останнє|попереднє) питання|o co (ostatnio |przed chwilą )?pytałem/iu;
const FIRST_Q_RE =
  /(my )?(first|1st) question|перше (моє )?питання|що я питав першим|moje pierwsze pytanie/iu;
const RECAP_RE =
  /what did we (talk|discuss|cover)|summari[sz]e (our|the|this) (chat|conversation)|про що (ми )?(говорили|розмовляли)|підсумуй (розмову|чат)|o czym (rozmawialiśmy|mówiliśmy)/iu;

const quote = (s: string) => `“${s.length > 90 ? `${s.slice(0, 87)}…` : s}”`;

/** A meta turn answered, or null when the message is not about the chat. */
export function metaTurn<C extends MConvo>(
  question: string,
  convo: C,
  turn: number,
  L: Tr,
): {
  route: 'ack';
  intent: 'meta';
  text: string;
  chips: string[];
  convo: C & { turn: number; q: string };
} | null {
  const said = convo.said ?? [];
  const mk = (text: string) => ({
    route: 'ack' as const,
    intent: 'meta' as const,
    text,
    chips: [],
    convo: { ...convo, turn, q: question },
  });
  if (REPEAT_RE.test(question))
    return mk(said[0] ? said[0].a : L('Nothing to repeat yet.', 'Поки нема що повторювати.'));
  if (LAST_Q_RE.test(question))
    return mk(
      said[0]
        ? L(`You asked: ${quote(said[0].q)}`, `Ти питав: ${quote(said[0].q)}`)
        : L('You haven’t asked anything yet.', 'Ти ще нічого не питав.'),
    );
  if (FIRST_Q_RE.test(question)) {
    const first = said[said.length - 1];
    return mk(
      first
        ? L(`Your first question: ${quote(first.q)}`, `Твоє перше питання: ${quote(first.q)}`)
        : L('You haven’t asked anything yet.', 'Ти ще нічого не питав.'),
    );
  }
  if (RECAP_RE.test(question)) {
    if (!said.length) return mk(L('We haven’t talked yet.', 'Ми ще не говорили.'));
    const list = said
      .slice(0, 5)
      .reverse()
      .map((s, i) => `${i + 1}. ${quote(s.q)}`)
      .join('\n');
    return mk(L(`So far you asked:\n${list}`, `Поки що ти питав:\n${list}`));
  }
  return null;
}

/** Remember one exchange (newest first, capped), except the meta turns themselves. */
export function remember(said: Said[] | undefined, q: string, a: string): Said[] {
  return [{ q, a }, ...(said ?? [])].slice(0, 8);
}
