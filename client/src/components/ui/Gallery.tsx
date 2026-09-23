/**
 * UI Kit gallery (dev-only) — a single screen that renders every design token
 * and (as they land) every UI primitive in all its variants and states. Open at
 * #/uikit. This is the acceptance surface for the UI refactor: verify a change
 * here (light + dark, mobile + desktop) instead of hunting through features.
 *
 * Phase 0: token swatches + section scaffold. Primitives get added in Phase 2.
 */
import { useState, type ReactNode } from 'react';
import { useT } from '../../i18n';
import { Icon } from '../../ui';
import { Button, IconButton, type ButtonVariant } from './Button';
import { Card, type CardTone } from './Card';
import { Chip, ChipGroup, type ChipTone } from './Chip';
import { Banner, type BannerTone } from './Banner';

const ACCENT = ['100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const NEUTRAL = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
const SEMANTIC = ['ok', 'danger', 'kcal'] as const;
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
const BANNER_TONES: BannerTone[] = ['accent', 'rest', 'danger', 'ok'];
const BANNER_ICON: Record<BannerTone, string> = {
  accent: 'target',
  rest: 'moon-stars',
  danger: 'heartbeat',
  ok: 'check-circle',
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
        <button className="icon-btn" aria-label={t.backAction} onClick={onClose}>
          <Icon name="caret-left" />
        </button>
        <span className="uik-title">UI Kit</span>
      </div>
      <p className="uik-sub">
        Design tokens and primitives, all states. Verify refactor slices here (light/dark,
        mobile/desktop) — appearance must not change unless a slice is a deliberate design change.
      </p>

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
          ListRow, SectionLabel, Field, Segmented, Stepper, ProgressDots, StatTile,
          TrafficLightOption.
        </p>
      </Group>
    </div>
  );
}
