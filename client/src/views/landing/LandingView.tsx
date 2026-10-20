/** Landing before sign-in (SPO-169): the approved v36 design with the real AuthView as its sign-in form. */
import { LandingDesign, type LandingInvite } from './LandingDesign';
import './landing.css';

export function LandingView({
  onLoggedIn,
  invite,
}: {
  onLoggedIn: () => void;
  invite?: LandingInvite;
}) {
  return <LandingDesign onLoggedIn={onLoggedIn} invite={invite} />;
}
