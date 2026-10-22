/** Landing before sign-in (SPO-169): the approved v36 design with the real AuthView as its sign-in form. */
import type { ReactNode } from 'react';
import { LandingDesign, type LandingInvite } from './LandingDesign';
import './landing.css';

export function LandingView({
  onLoggedIn,
  invite,
  signInNotice,
}: {
  onLoggedIn: () => void;
  invite?: LandingInvite;
  signInNotice?: ReactNode;
}) {
  return <LandingDesign onLoggedIn={onLoggedIn} invite={invite} signInNotice={signInNotice} />;
}
