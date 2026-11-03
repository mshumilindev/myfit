/**
 * SPO-35 P21 — what Atlas will not do: swap roles, read out its instructions, or play doctor.
 * Explicit patterns (not KB examples), checked early; the reply never carries advice.
 */
import type { Tr } from './intentKit';

const RULES_RE =
  /(?<!\p{L})(forget|ignore|disregard|drop|override)\b[\w\s]{0,20}(rules|instructions|prompt|guidelines|restrictions)(?!\p{L})/iu;
const REPEAT_RE =
  /(?<!\p{L})(repeat|show|print|reveal|read out|tell me|give me)( me)? (back )?(your|the)( initial| original| system| hidden)? (instructions|prompt|rules|guidelines)(?!\p{L})/iu;
const DOCTOR_RE =
  /(?<!\p{L})(act|pretend|behave|play|be) (as|like)( if you were)? (my |a |an |the )?(doctor|physician|nurse|therapist|lawyer|pharmacist)(?!\p{L})|(?<!\p{L})(prescribe|prescription for) (me|something)|(?<!\p{L})(виписа\p{L}*|признач\p{L}*) (мені )?(ліки|рецепт|препарат\p{L}*)|(?<!\p{L})будь (моїм )?лікарем(?!\p{L})/iu;

export function p21Guard(question: string, L: Tr): { intent: string; text: string } | null {
  if (RULES_RE.test(question) || REPEAT_RE.test(question))
    return {
      intent: 'jailbreak_probe',
      text: L(
        "I'm Atlas, your gym buddy, and I can't swap roles or share my instructions.",
        'Я Atlas, твій напарник із залу, і міняти роль чи ділитися своїми інструкціями я не можу.',
      ),
    };
  if (DOCTOR_RE.test(question))
    return {
      intent: 'not_a_doctor',
      text: L(
        "I'm not a doctor and I can't prescribe or diagnose anything. For medicine or symptoms, see a doctor or a pharmacist. For training, I'm here.",
        'Я не лікар і нічого не призначаю та не діагностую. З ліками чи симптомами — до лікаря або фармацевта. З тренуваннями я тут.',
      ),
    };
  return null;
}
