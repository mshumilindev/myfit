/**
 * UI Kit gallery (dev-only) — a single screen that renders every design token
 * and (as they land) every UI primitive in all its variants and states. Open at
 * #/uikit. This is the acceptance surface for the UI refactor: verify a change
 * here (light + dark, mobile + desktop) instead of hunting through features.
 *
 * Storybook (`npm run storybook`) is the primary catalog now — every primitive
 * has its stories next to it. This in-app screen stays as a quick on-device
 * check of the tokens and the core primitives inside the real app shell.
 */
import { BackButton } from './BackButton';
import { useState, type ReactNode } from 'react';
import { useT } from '../../i18n';
import { Button, IconButton, type ButtonVariant } from './Button';
import { Card, type CardTone } from './Card';
import { Chip, ChipGroup, type ChipTone } from './Chip';
import { Banner, type BannerTone } from './Banner';
import { Widget, WidgetBar, WidgetList, WidgetRing, WidgetSpark, WidgetDelta } from './Widget';
import { WidgetSection } from './WidgetGrid';
import { ShortcutTile } from './ShortcutTile';

const ACCENT = ['100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const NEUTRAL = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
const SEMANTIC = [
  'ok',
  'danger',
  'kcal',
  'accent',
  'rest',
  'active',
  'illness',
  'injury',
  'sleep',
  'sport',
  'home',
] as const;
const REST = ['200', '300', '400', '700', '800', '900'];
const CORE = [
  '--color-bg',
  '--color-bg-elevated',
  '--color-surface',
  '--color-surface-2',
  '--color-text',
  '--color-divider',
  '--color-accent',
];
const RADII = ['--radius-sm', '--radius-md', '--radius-lg', '--radius-sheet'];
const BTN_VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger', 'rest', 'fill'];
const CARD_TONES: CardTone[] = ['neutral', 'danger', 'ok', 'rest', 'accent'];
const CHIP_TONES: ChipTone[] = ['neutral', 'accent', 'danger', 'ok', 'rest'];
const BANNER_TONES: BannerTone[] = ['accent', 'rest', 'danger', 'ok', 'sport', 'conditioning'];
const BANNER_ICON: Record<BannerTone, string> = {
  accent: 'target',
  rest: 'moon-stars',
  danger: 'heartbeat',
  ok: 'check-circle',
  sport: 'soccer-ball',
  conditioning: 'heartbeat',
};

function Swatch({ token, label }: { token: string; label?: string }) {
  return (
    <div className="uik-sw">
      <span className="uik-sw-chip" style={{ background: `var(${token})` }} />
      <span className="uik-sw-name">{label ?? token.replace('--color-', '')}</span>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="uik-group">
      <h2 className="uik-h2">{title}</h2>
      {children}
    </section>
  );
}

export function Gallery({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const [picked, setPicked] = useState<string | null>('Chest');
  return (
    <div className="screen uik">
      <div className="uik-top">
        <BackButton label={t.backAction} onClick={onClose} />
        <span className="uik-title">UI Kit</span>
      </div>
      <p className="uik-sub">
        Design tokens and primitives, all states. Verify refactor slices here (light/dark,
        mobile/desktop) — appearance must not change unless a slice is a deliberate design change.
      </p>

      <Group title="Today widgets — S · M · L · XL (new)">
        <div style={{ maxWidth: 390, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <WidgetSection title="Shortcuts" layout="shortcuts">
            <ShortcutTile label="Chest 1" icon="play" primary />
            <ShortcutTile label="Dance" icon="disco-ball" tone="active" />
            <ShortcutTile
              label="Run"
              icon="person-simple-run"
              tone="active"
              state="live"
              meta="24:10"
            />
            <ShortcutTile label="Home set" icon="house" tone="accent" state="done" />
          </WidgetSection>
          <WidgetSection title="Body · pair" layout="pair">
            <Widget size="S" tone="ok" kicker="Readiness" value="82" unit="%" sub="Legs recovering">
              <WidgetBar value={0.82} />
            </Widget>
            <Widget
              size="S"
              tone="sleep"
              kicker="Last night"
              value="8"
              unit="h 30m"
              sub="02:00 → 10:30 · auto"
            />
          </WidgetSection>
          <WidgetSection title="Rows · M" layout="rows">
            <Widget
              size="M"
              tone="apex"
              icon="trophy"
              title="Consistency 30"
              sub="18 of 30 days"
              onClick={() => undefined}
            />
            <Widget
              size="M"
              tone="ok"
              icon="heartbeat"
              title="Readiness 82%"
              sub="Upper fresh · legs recovering"
              onClick={() => undefined}
            />
          </WidgetSection>
          <WidgetSection title="Wide · L" layout="wide">
            <Widget
              size="L"
              tone="ok"
              kicker="Bench e1RM"
              value="102"
              unit="kg"
              sub={<WidgetDelta>+2.5 · 4 wks</WidgetDelta>}
              bodyLast
            >
              <WidgetSpark
                points={[90, 91, 90.5, 93, 92.5, 95, 96, 98, 99, 100, 102]}
                height={44}
                area
              />
            </Widget>
          </WidgetSection>
          <WidgetSection title="Big · XL" layout="big">
            <Widget size="XL" tone="ok" kicker="Muscle readiness" badge="82%">
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <WidgetRing value={0.82} size={110}>
                  82
                </WidgetRing>
              </div>
              <WidgetList
                rows={[
                  { label: 'Chest', value: '100' },
                  { label: 'Back', value: '92' },
                  { label: 'Legs', value: '61' },
                ]}
              />
            </Widget>
          </WidgetSection>
        </div>
      </Group>

      <Group title="Accent ramp">
        <div className="uik-row">
          {ACCENT.map((n) => (
            <Swatch key={n} token={`--color-accent-${n}`} label={n} />
          ))}
        </div>
      </Group>

      <Group title="Neutral ramp">
        <div className="uik-row">
          {NEUTRAL.map((n) => (
            <Swatch key={n} token={`--color-neutral-${n}`} label={n} />
          ))}
        </div>
      </Group>

      <Group title="Semantic (tint · text · line · base)">
        {SEMANTIC.map((fam) => (
          <div key={fam} className="uik-fam">
            <span className="uik-fam-name">{fam}</span>
            <div className="uik-row">
              <Swatch token={`--color-${fam}`} label="base" />
              <Swatch token={`--color-${fam}-tint`} label="tint" />
              <Swatch token={`--color-${fam}-text`} label="text" />
              <Swatch token={`--color-${fam}-line`} label="line" />
            </div>
          </div>
        ))}
      </Group>

      <Group title="Rest ramp">
        <div className="uik-row">
          {REST.map((n) => (
            <Swatch key={n} token={`--color-rest-${n}`} label={n} />
          ))}
        </div>
      </Group>

      <Group title="Core surfaces">
        <div className="uik-row">
          {CORE.map((tok) => (
            <Swatch key={tok} token={tok} />
          ))}
        </div>
      </Group>

      <Group title="Radii">
        <div className="uik-row">
          {RADII.map((r) => (
            <div key={r} className="uik-sw">
              <span
                className="uik-sw-chip"
                style={{
                  background: 'var(--color-surface-2)',
                  borderRadius: `var(${r})`,
                  border: '1px solid var(--color-divider)',
                }}
              />
              <span className="uik-sw-name">{r.replace('--radius-', '')}</span>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Button — variants">
        <div className="uik-btnrow">
          {BTN_VARIANTS.map((v) => (
            <Button key={v} variant={v}>
              {v}
            </Button>
          ))}
        </div>
      </Group>

      <Group title="Button — sizes">
        <div className="uik-btnrow">
          <Button variant="primary" size="sm">
            sm
          </Button>
          <Button variant="primary" size="md">
            md
          </Button>
          <Button variant="primary" size="lg">
            lg
          </Button>
        </div>
      </Group>

      <Group title="Button — states">
        <div className="uik-btnrow">
          <Button variant="primary" icon="target">
            leading
          </Button>
          <Button variant="primary" iconTrailing="arrow-right">
            trailing
          </Button>
          <Button variant="fill" loading>
            loading
          </Button>
          <Button variant="primary" disabled>
            disabled
          </Button>
        </div>
        <div className="uik-btnrow" style={{ marginTop: 10 }}>
          <Button variant="fill" fullWidth icon="check">
            full width
          </Button>
        </div>
      </Group>

      <Group title="IconButton">
        <div className="uik-btnrow">
          <IconButton label="Close" icon="x" variant="ghost" />
          <IconButton label="Edit" icon="pencil-simple" variant="secondary" />
          <IconButton label="Add" icon="plus" variant="primary" />
          <IconButton label="Confirm" icon="check" variant="fill" />
        </div>
      </Group>

      <Group title="Card — tones">
        <div className="uik-cardgrid">
          {CARD_TONES.map((tone) => (
            <Card key={tone} tone={tone} header={tone}>
              <p className="uik-note" style={{ margin: 0 }}>
                Body text on the {tone} tone.
              </p>
            </Card>
          ))}
        </div>
      </Group>

      <Group title="Chip / Pill — tones">
        <ChipGroup>
          {CHIP_TONES.map((tone) => (
            <Chip key={tone} tone={tone}>
              {tone}
            </Chip>
          ))}
        </ChipGroup>
      </Group>

      <Group title="Chip — selectable & sizes">
        <ChipGroup>
          {['Chest', 'Back', 'Legs'].map((m) => (
            <Chip
              key={m}
              selected={picked === m}
              onClick={() => setPicked(picked === m ? null : m)}
            >
              {m}
            </Chip>
          ))}
          <Chip icon="target" selected>
            with icon
          </Chip>
          <Chip size="sm">small</Chip>
          <Chip tone="rest" size="sm" icon="clock">
            rest sm
          </Chip>
        </ChipGroup>
      </Group>

      <Group title="Banner — tones">
        <div className="uik-banners">
          {BANNER_TONES.map((tone) => (
            <Banner
              key={tone}
              tone={tone}
              icon={BANNER_ICON[tone]}
              kicker={`${tone} banner`}
              title={`This is a ${tone} banner`}
              body="A frosted-gem banner: one tone drives glass, rim, icon and text shades."
              primaryAction={{
                label: 'Primary',
                icon: 'arrow-right',
                onClick: () => setPicked(tone),
              }}
              skipAction={{ label: 'Skip', onClick: () => setPicked(null) }}
            />
          ))}
        </div>
      </Group>

      <Group title="Primitives (coming next)">
        <p className="uik-note">
          Storybook is the primary catalog now: npm run storybook — Calendar, GroupedList,
          Segmented, Switch, PresetChips, PinToggle, IconTile, CategoryRow, Snackbar,
          StickyActionBar, Timeline and every variant / state.
        </p>
      </Group>
    </div>
  );
}
