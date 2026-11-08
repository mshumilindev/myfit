import type { ComponentType } from 'react';
import type { IconProps } from '@phosphor-icons/react/dist/lib/types';
import { VideoCamera } from '@phosphor-icons/react/VideoCamera';
import { VideoCameraSlash } from '@phosphor-icons/react/VideoCameraSlash';
import { MicrophoneSlash } from '@phosphor-icons/react/MicrophoneSlash';
import { PhoneDisconnect } from '@phosphor-icons/react/PhoneDisconnect';
import { PhoneCall } from '@phosphor-icons/react/PhoneCall';
import { PhoneIncoming } from '@phosphor-icons/react/PhoneIncoming';
import { PhoneX } from '@phosphor-icons/react/PhoneX';
import { CameraRotate } from '@phosphor-icons/react/CameraRotate';
import { SpeakerHigh } from '@phosphor-icons/react/SpeakerHigh';
import { WifiSlash } from '@phosphor-icons/react/WifiSlash';
import { CellSignalLow } from '@phosphor-icons/react/CellSignalLow';
import { ArrowsInSimple } from '@phosphor-icons/react/ArrowsInSimple';
import { ArrowsOutSimple } from '@phosphor-icons/react/ArrowsOutSimple';
import { Phone } from '@phosphor-icons/react/Phone';
import { AddonsGlyph } from './addonsGlyph';

/** Icons of the call kit (SPO-432) and the store's Add-ons glyph, kept out of ui.tsx so that file stays under the size ratchet. */
export const CALL_ICONS: Record<string, ComponentType<IconProps>> = {
  addons: AddonsGlyph,
  'video-camera': VideoCamera,
  'video-camera-slash': VideoCameraSlash,
  'microphone-slash': MicrophoneSlash,
  'phone-disconnect': PhoneDisconnect,
  'phone-call': PhoneCall,
  'phone-incoming': PhoneIncoming,
  'phone-x': PhoneX,
  'camera-rotate': CameraRotate,
  'speaker-high': SpeakerHigh,
  'wifi-slash': WifiSlash,
  'cell-signal-low': CellSignalLow,
  'arrows-in-simple': ArrowsInSimple,
  'arrows-out-simple': ArrowsOutSimple,
  phone: Phone,
};
