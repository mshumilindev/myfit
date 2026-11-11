import type { RingSound } from '../../sound/useLoopSound';
import ogg from './spotter_call.ogg?url';
import mp3 from './spotter_call.mp3?url';

/** The incoming-call ringtone. Imported on demand (only Gym / Coach people hear it), so it never rides along with the app shell. */
export const CALL_SOUND: RingSound = { ogg, mp3 };
