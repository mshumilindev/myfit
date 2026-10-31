/**
 * "Open the forgot-password form next" for the sign-in screen that is about to mount (a dead reset link sends the person
 * there). A module flag, not the URL hash: leaving the join route rewrites the hash first. Read with `peek`, cleared by
 * the screen once it is up (the lazy state initialiser may run twice).
 */
let wanted = false;
export const wantForgotForm = (): void => {
  wanted = true;
};
export const peekForgotForm = (): boolean => wanted;
export const clearForgotForm = (): void => {
  wanted = false;
};
