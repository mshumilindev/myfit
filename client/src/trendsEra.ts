/** Recent era vs the prior one: >= +10% is "up", <= -18% is "down". Integer cross-multiplication, because `prior * 1.1`
 * is 110.00000000000001 for 100 and an exact +10% would not count. */
export function eraTrend(recent: number, prior: number | undefined) {
  if (!prior || prior <= 0) return { up: false, down: false };
  return { up: recent * 10 >= prior * 11, down: recent * 100 <= prior * 82 };
}
