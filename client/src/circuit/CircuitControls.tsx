/**
 * The small controls around circuits in the session (Circuit chunk): the empty-session shortcut, the "adding to the circuit"
 * banner, the setting that turns circuit building on, and the "new circuit" button. Moved out of the session screen.
 */
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SwitchIndicator } from '../components/ui/Switch';
import { useT } from '../i18n';
import type { CircuitControlsHost } from '../circuitApi';
import { Icon } from '../ui';
import { STRINGS } from './strings';

function useWords() {
  const { locale } = useT();
  return STRINGS[locale];
}

function Shortcut(props: { onStart: () => void }) {
  const w = useWords();
  return (
    <div className="es-circuit">
      <span className="es-loop" aria-hidden>
        <Icon name="arrows-clockwise" />
      </span>
      <span className="es-circuit-text">
        <span className="es-circuit-title">{w.circuitLabel}</span>
        <span className="es-circuit-sub">{w.esCircuitSub}</span>
      </span>
      <Button
        variant="secondary"
        size="sm"
        icon="play"
        className="es-circuit-go"
        onClick={props.onStart}
      >
        {w.esCircuitStart}
      </Button>
    </div>
  );
}

function Banner(props: { letter: string; count: number; onDone: () => void }) {
  const w = useWords();
  return (
    <div className="circuit-banner">
      <span className="loop sm">
        <Icon name="arrows-clockwise" />
      </span>
      <div className="cb-text">
        <div className="cb-title">
          {w.circuitAdding} {props.letter}
        </div>
        <div className="cb-sub">{w.circuitSoFar(props.count)}</div>
      </div>
      <Button variant="secondary" className="cb-done" onClick={props.onDone}>
        {w.circuitFinishSet}
      </Button>
    </div>
  );
}

function Setting(props: { on: boolean; onToggle: () => void }) {
  const w = useWords();
  return (
    <Card
      as="button"
      tone="accent"
      emphasis="hero"
      className={`ss-circuit${props.on ? ' on' : ''}`}
      onClick={props.onToggle}
    >
      <span className="ss-top">
        <span className="ss-loop">
          <Icon name="arrows-clockwise" />
        </span>
        <span className="ss-circuit-text">
          <span className="ss-circuit-title">{w.circuitLabel}</span>
          <span className="ss-circuit-hint">{w.circuitHint}</span>
        </span>
        <SwitchIndicator on={props.on} size="sm" />
      </span>
      <span className="ss-desc">{w.circuitSettingDesc}</span>
    </Card>
  );
}

function NewButton(props: { letter: string; onNew: () => void }) {
  const w = useWords();
  return (
    <Button variant="secondary" className="circuit-new" onClick={props.onNew}>
      <Icon name="plus-circle" />
      {w.circuitNewCircuit(props.letter)}
    </Button>
  );
}

export const CIRCUIT_CONTROLS: CircuitControlsHost = { Shortcut, Banner, Setting, NewButton };
