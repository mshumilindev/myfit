import type { ReactNode } from 'react';
import { Switch } from './Switch';
import { Select } from './Select';
import './Call.css';

export interface CallPreflightProps {
  /** The self-view (a `<video>`) or a placeholder node. */
  preview: ReactNode;
  /** Mic level 0..1 for the meter. */
  level: number;
  cameraLabel: string;
  cameraOn: boolean;
  onCamera: (on: boolean) => void;
  micLabel: string;
  micDevice: string;
  micDevices: { id: string; label: string }[];
  onMicDevice: (id: string) => void;
  camLabel: string;
  camDevice: string;
  camDevices: { id: string; label: string }[];
  onCamDevice: (id: string) => void;
  levelLabel: string;
}

/**
 * The "check before you call" body (kit group `Call`; put it in a kit `Sheet` on a phone or a `Dialog` on desktop): your
 * own picture, a live mic level, the device pickers and the camera-on switch. Shown before the first call on a device and
 * when the person changes a device in the call settings.
 */
export function CallPreflight(p: CallPreflightProps) {
  return (
    <div className="uicall-pre">
      <div className="uicall-pre-view">{p.preview}</div>
      <div
        className="uicall-pre-meter"
        role="meter"
        aria-label={p.levelLabel}
        aria-valuenow={Math.round(p.level * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="uicall-pre-lvl" data-level={Math.round(p.level * 10)} />
      </div>
      <label className="uicall-pre-row">
        <span>{p.cameraLabel}</span>
        <Switch checked={p.cameraOn} onChange={p.onCamera} aria-label={p.cameraLabel} />
      </label>
      <Select
        label={p.micLabel}
        value={p.micDevice}
        onChange={(e) => p.onMicDevice(e.target.value)}
      >
        {p.micDevices.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </Select>
      <Select
        label={p.camLabel}
        value={p.camDevice}
        onChange={(e) => p.onCamDevice(e.target.value)}
      >
        {p.camDevices.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
