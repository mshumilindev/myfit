import { Avatar } from '../components/Avatar';

/**
 * A client's face in the Coach UI: the app Avatar (the photo from Storage by user id, with the
 * IndexedDB cache; initials on the kit disc when there is none), the same component Trainer, Admin
 * and Profile use for the same people. Kit pieces take it through their `avatar` slot.
 */
export function ClientAvatar({
  id,
  name,
  size,
  hasPhoto,
}: {
  id?: string;
  name: string;
  size: number;
  hasPhoto?: boolean;
}) {
  return <Avatar userId={id} name={name} hasPhoto={hasPhoto} size={size} />;
}
