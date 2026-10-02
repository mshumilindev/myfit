/**
 * Shared UI primitives from the design system (S-49/S-50 kit + dialogs/sheets).
 * Every surface here mirrors the boards; keep visual changes in styles.css.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type CSSProperties,
} from 'react';
export {
  Dialog,
  ConfirmDialog,
  Sheet,
  UndoSnackbar,
  Toast,
  UpdatePlate,
  Portal,
  useFixedPanelPosition,
  type SnackState,
  type ToastState,
} from './components/ui/Overlays';
import { Portal, useFixedPanelPosition } from './components/ui/Overlays';
import { Button } from './components/ui/Button';
import { getMutationPending, subscribeMutation } from './api';
import { AndroidLogo } from '@phosphor-icons/react/AndroidLogo';
import { AppleLogo } from '@phosphor-icons/react/AppleLogo';
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise';
import { Moon } from '@phosphor-icons/react/Moon';
import { Confetti } from '@phosphor-icons/react/Confetti';
import { Pause } from '@phosphor-icons/react/Pause';
import { Stop } from '@phosphor-icons/react/Stop';
import { Bell } from '@phosphor-icons/react/Bell';
import { ArrowDown } from '@phosphor-icons/react/ArrowDown';
import { ArrowUp } from '@phosphor-icons/react/ArrowUp';
import { Microphone } from '@phosphor-icons/react/Microphone';
import { Lock } from '@phosphor-icons/react/Lock';
import { BellRinging } from '@phosphor-icons/react/BellRinging';
import { Clock } from '@phosphor-icons/react/Clock';
import { Info } from '@phosphor-icons/react/Info';
import { Plus } from '@phosphor-icons/react/Plus';
import { Check } from '@phosphor-icons/react/Check';
import { SkipForward } from '@phosphor-icons/react/SkipForward';
import { Vibrate } from '@phosphor-icons/react/Vibrate';
import { ShareNetwork } from '@phosphor-icons/react/ShareNetwork';
import { Target } from '@phosphor-icons/react/Target';
import { Heartbeat } from '@phosphor-icons/react/Heartbeat';
import { Minus } from '@phosphor-icons/react/Minus';
import { Medal } from '@phosphor-icons/react/Medal';
import { PushPin } from '@phosphor-icons/react/PushPin';
import { Bandaids } from '@phosphor-icons/react/Bandaids';
import { Path } from '@phosphor-icons/react/Path';
import { DotsThreeCircle } from '@phosphor-icons/react/DotsThreeCircle';
import { HandPalm } from '@phosphor-icons/react/HandPalm';
import { HandTap } from '@phosphor-icons/react/HandTap';
import { ThumbsUp } from '@phosphor-icons/react/ThumbsUp';
import { ThumbsDown } from '@phosphor-icons/react/ThumbsDown';
import { FirstAidKit } from '@phosphor-icons/react/FirstAidKit';
import { Virus } from '@phosphor-icons/react/Virus';
import { Brain } from '@phosphor-icons/react/Brain';
import { Drop } from '@phosphor-icons/react/Drop';
import { Question } from '@phosphor-icons/react/Question';
import { ArrowFatUp } from '@phosphor-icons/react/ArrowFatUp';
import { ArrowFatDown } from '@phosphor-icons/react/ArrowFatDown';
import { ArrowsDownUp } from '@phosphor-icons/react/ArrowsDownUp';
import { Warning } from '@phosphor-icons/react/Warning';
import { MoonStars } from '@phosphor-icons/react/MoonStars';
import { ArrowCounterClockwise } from '@phosphor-icons/react/ArrowCounterClockwise';
import { ArrowRight } from '@phosphor-icons/react/ArrowRight';
import { ArrowLeft } from '@phosphor-icons/react/ArrowLeft';
import { ArrowUpRight } from '@phosphor-icons/react/ArrowUpRight';
import { ArrowsClockwise } from '@phosphor-icons/react/ArrowsClockwise';
import { ArrowsLeftRight } from '@phosphor-icons/react/ArrowsLeftRight';
import { ArrowsOutLineHorizontal } from '@phosphor-icons/react/ArrowsOutLineHorizontal';
import { Archive } from '@phosphor-icons/react/Archive';
import { Barbell } from '@phosphor-icons/react/Barbell';
import { Export } from '@phosphor-icons/react/Export';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { CalendarCheck } from '@phosphor-icons/react/CalendarCheck';
import { ForkKnife } from '@phosphor-icons/react/ForkKnife';
import { Camera } from '@phosphor-icons/react/Camera';
import { Cards } from '@phosphor-icons/react/Cards';
import { CaretLeft } from '@phosphor-icons/react/CaretLeft';
import { CaretRight } from '@phosphor-icons/react/CaretRight';
import { Carrot } from '@phosphor-icons/react/Carrot';
import { ChartBar } from '@phosphor-icons/react/ChartBar';
import { ChartLine } from '@phosphor-icons/react/ChartLine';
import { ChartLineUp } from '@phosphor-icons/react/ChartLineUp';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { XCircle } from '@phosphor-icons/react/XCircle';
import { ClockCountdown } from '@phosphor-icons/react/ClockCountdown';
import { Pulse } from '@phosphor-icons/react/Pulse';
import { CloudSlash } from '@phosphor-icons/react/CloudSlash';
import { Copy } from '@phosphor-icons/react/Copy';
import { Crosshair } from '@phosphor-icons/react/Crosshair';
import { DotsSixVertical } from '@phosphor-icons/react/DotsSixVertical';
import { DotsThree } from '@phosphor-icons/react/DotsThree';
import { DotsThreeVertical } from '@phosphor-icons/react/DotsThreeVertical';
import { DownloadSimple } from '@phosphor-icons/react/DownloadSimple';
import { Eraser } from '@phosphor-icons/react/Eraser';
import { Envelope } from '@phosphor-icons/react/Envelope';
import { Eye } from '@phosphor-icons/react/Eye';
import { EyeSlash } from '@phosphor-icons/react/EyeSlash';
import { Feather } from '@phosphor-icons/react/Feather';
import { Flame } from '@phosphor-icons/react/Flame';
import { Gauge } from '@phosphor-icons/react/Gauge';
import { Globe } from '@phosphor-icons/react/Globe';
import { FloppyDisk } from '@phosphor-icons/react/FloppyDisk';
import { Gear } from '@phosphor-icons/react/Gear';
import { House } from '@phosphor-icons/react/House';
import { Lightning } from '@phosphor-icons/react/Lightning';
import { ImageSquare } from '@phosphor-icons/react/ImageSquare';
import { Key } from '@phosphor-icons/react/Key';
import { ListChecks } from '@phosphor-icons/react/ListChecks';
import { ListPlus } from '@phosphor-icons/react/ListPlus';
import { LockSimple } from '@phosphor-icons/react/LockSimple';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { MapPin } from '@phosphor-icons/react/MapPin';
import { MapPinLine } from '@phosphor-icons/react/MapPinLine';
import { PencilSimple } from '@phosphor-icons/react/PencilSimple';
import { Phone } from '@phosphor-icons/react/Phone';
import { Play } from '@phosphor-icons/react/Play';
import { PlayCircle } from '@phosphor-icons/react/PlayCircle';
import { YoutubeLogo } from '@phosphor-icons/react/YoutubeLogo';
import { SpeakerSimpleSlash } from '@phosphor-icons/react/SpeakerSimpleSlash';
import { QrCode } from '@phosphor-icons/react/QrCode';
import { CaretLineDown } from '@phosphor-icons/react/CaretLineDown';
import { CaretLineUp } from '@phosphor-icons/react/CaretLineUp';
import { Circle } from '@phosphor-icons/react/Circle';
import { Columns } from '@phosphor-icons/react/Columns';
import { Cylinder } from '@phosphor-icons/react/Cylinder';
import { Devices } from '@phosphor-icons/react/Devices';
import { Equals } from '@phosphor-icons/react/Equals';
import { Fire } from '@phosphor-icons/react/Fire';
import { FrameCorners } from '@phosphor-icons/react/FrameCorners';
import { FunnelSimple } from '@phosphor-icons/react/FunnelSimple';
import { PersonSimple } from '@phosphor-icons/react/PersonSimple';
import { Person } from '@phosphor-icons/react/Person';
import { SlidersHorizontal } from '@phosphor-icons/react/SlidersHorizontal';
import { List } from '@phosphor-icons/react/List';
import { MinusCircle } from '@phosphor-icons/react/MinusCircle';
import { PlusCircle } from '@phosphor-icons/react/PlusCircle';
import { Plugs } from '@phosphor-icons/react/Plugs';
import { Robot } from '@phosphor-icons/react/Robot';
import { Rows } from '@phosphor-icons/react/Rows';
import { Toolbox } from '@phosphor-icons/react/Toolbox';
import { WaveSine } from '@phosphor-icons/react/WaveSine';
import { Scales } from '@phosphor-icons/react/Scales';
import { Ruler } from '@phosphor-icons/react/Ruler';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';
import { Sparkle } from '@phosphor-icons/react/Sparkle';
import { SunHorizon } from '@phosphor-icons/react/SunHorizon';
import { SignOut } from '@phosphor-icons/react/SignOut';
import { SquaresFour } from '@phosphor-icons/react/SquaresFour';
import { GraduationCap } from '@phosphor-icons/react/GraduationCap';
import { BookmarkSimple } from '@phosphor-icons/react/BookmarkSimple';
import { BookOpen } from '@phosphor-icons/react/BookOpen';
import { RocketLaunch } from '@phosphor-icons/react/RocketLaunch';
import { PencilSimpleLine } from '@phosphor-icons/react/PencilSimpleLine';
import { Compass } from '@phosphor-icons/react/Compass';
import { DeviceMobile } from '@phosphor-icons/react/DeviceMobile';
import { Monitor } from '@phosphor-icons/react/Monitor';
import { DiscoBall } from '@phosphor-icons/react/DiscoBall';
import { HandGrabbing } from '@phosphor-icons/react/HandGrabbing';
import { PersonSimpleHike } from '@phosphor-icons/react/PersonSimpleHike';
import { Stairs } from '@phosphor-icons/react/Stairs';
import { Infinity as InfinityIcon } from '@phosphor-icons/react/Infinity';
import { PersonArmsSpread } from '@phosphor-icons/react/PersonArmsSpread';
import { SoccerBall } from '@phosphor-icons/react/SoccerBall';
import { Basketball } from '@phosphor-icons/react/Basketball';
import { Volleyball } from '@phosphor-icons/react/Volleyball';
import { TennisBall } from '@phosphor-icons/react/TennisBall';
import { Racquet } from '@phosphor-icons/react/Racquet';
import { PingPong } from '@phosphor-icons/react/PingPong';
import { BoxingGlove } from '@phosphor-icons/react/BoxingGlove';
import { HandFist } from '@phosphor-icons/react/HandFist';
import { Mountains } from '@phosphor-icons/react/Mountains';
import { Hockey } from '@phosphor-icons/react/Hockey';
import { PersonSimpleSki } from '@phosphor-icons/react/PersonSimpleSki';
import { PersonSimpleSnowboard } from '@phosphor-icons/react/PersonSimpleSnowboard';
import { Golf } from '@phosphor-icons/react/Golf';
import { Star } from '@phosphor-icons/react/Star';
import { Timer } from '@phosphor-icons/react/Timer';
import { FlagCheckered } from '@phosphor-icons/react/FlagCheckered';
import { Hourglass } from '@phosphor-icons/react/Hourglass';
import { Blueprint } from '@phosphor-icons/react/Blueprint';
import { Bed } from '@phosphor-icons/react/Bed';
import { Steps } from '@phosphor-icons/react/Steps';
import { TrendUp } from '@phosphor-icons/react/TrendUp';
import { UserSquare } from '@phosphor-icons/react/UserSquare';
import { ThermometerSimple } from '@phosphor-icons/react/ThermometerSimple';
import { ListNumbers } from '@phosphor-icons/react/ListNumbers';
import { SneakerMove } from '@phosphor-icons/react/SneakerMove';
import { CalendarPlus } from '@phosphor-icons/react/CalendarPlus';
import { ShieldChevron } from '@phosphor-icons/react/ShieldChevron';
import { Trash } from '@phosphor-icons/react/Trash';
import { Trophy } from '@phosphor-icons/react/Trophy';
import { UploadSimple } from '@phosphor-icons/react/UploadSimple';
import { User } from '@phosphor-icons/react/User';
import { UserFocus } from '@phosphor-icons/react/UserFocus';
import { WarningCircle } from '@phosphor-icons/react/WarningCircle';
import { PersonSimpleRun } from '@phosphor-icons/react/PersonSimpleRun';
import { Bicycle } from '@phosphor-icons/react/Bicycle';
import { PersonSimpleSwim } from '@phosphor-icons/react/PersonSimpleSwim';
import { PersonSimpleWalk } from '@phosphor-icons/react/PersonSimpleWalk';
import { PersonSimpleTaiChi } from '@phosphor-icons/react/PersonSimpleTaiChi';
import { HandHeart } from '@phosphor-icons/react/HandHeart';
import { Snowflake } from '@phosphor-icons/react/Snowflake';
import { ClockCounterClockwise } from '@phosphor-icons/react/ClockCounterClockwise';
import { FlowerLotus } from '@phosphor-icons/react/FlowerLotus';
import { AirplaneTilt } from '@phosphor-icons/react/AirplaneTilt';
import { CornersOut } from '@phosphor-icons/react/CornersOut';
import { Stack } from '@phosphor-icons/react/Stack';
import { FlagBanner } from '@phosphor-icons/react/FlagBanner';
import { X } from '@phosphor-icons/react/X';
import { CaretUp } from '@phosphor-icons/react/CaretUp';
import { CaretDown } from '@phosphor-icons/react/CaretDown';
import { Wind } from '@phosphor-icons/react/Wind';
import { BeerBottle } from '@phosphor-icons/react/BeerBottle';
import { BeerStein } from '@phosphor-icons/react/BeerStein';
import { Wine } from '@phosphor-icons/react/Wine';
import { Martini } from '@phosphor-icons/react/Martini';
import { DropHalf } from '@phosphor-icons/react/DropHalf';
import { Cheers } from '@phosphor-icons/react/Cheers';
import { CalendarDots } from '@phosphor-icons/react/CalendarDots';
import { Leaf } from '@phosphor-icons/react/Leaf';
import { Pill } from '@phosphor-icons/react/Pill';
import { Flask } from '@phosphor-icons/react/Flask';
import { TestTube } from '@phosphor-icons/react/TestTube';
import { Coffee } from '@phosphor-icons/react/Coffee';
import { Fish } from '@phosphor-icons/react/Fish';
import { Egg } from '@phosphor-icons/react/Egg';
import { Orange } from '@phosphor-icons/react/Orange';
import { Grains } from '@phosphor-icons/react/Grains';
import { HourglassMedium } from '@phosphor-icons/react/HourglassMedium';
import type { IconProps } from '@phosphor-icons/react/dist/lib/types';
import { FLAGS, LOCALE_IDS, LOCALES, setLocale, useT } from './i18n';
import { exerciseDisplay, localizedExerciseName } from './data/exerciseNames';

/**
 * Icons are bundled SVG components (@phosphor-icons/react) — the same Phosphor
 * glyphs the boards use, but with no icon font to load (nothing to 404, no
 * FOUC, works offline). The <i> wrapper keeps the existing `i { font-size }`
 * CSS contract: the SVG is sized 1em.
 */
const ICONS: Record<string, ComponentType<IconProps>> = {
  'moon-stars': MoonStars,
  'android-logo': AndroidLogo,
  'apple-logo': AppleLogo,
  'arrow-clockwise': ArrowClockwise,
  'arrow-counter-clockwise': ArrowCounterClockwise,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'arrow-up-right': ArrowUpRight,
  'arrows-clockwise': ArrowsClockwise,
  swap: ArrowsLeftRight,
  'arrows-out-line-horizontal': ArrowsOutLineHorizontal,
  archive: Archive,
  barbell: Barbell,
  bell: Bell,
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  microphone: Microphone,
  lock: Lock,
  'bell-ringing': BellRinging,
  export: Export,
  'calendar-blank': CalendarBlank,
  'calendar-check': CalendarCheck,
  'fork-knife': ForkKnife,
  camera: Camera,
  'caret-left': CaretLeft,
  'caret-right': CaretRight,
  carrot: Carrot,
  'chart-line': ChartLine,
  'chart-bar': ChartBar,
  'chart-line-up': ChartLineUp,
  'check-circle': CheckCircle,
  clock: Clock,
  'clock-countdown': ClockCountdown,
  pulse: Pulse,
  'cloud-slash': CloudSlash,
  copy: Copy,
  crosshair: Crosshair,
  'dots-six': DotsSixVertical,
  'dots-three': DotsThree,
  'dots-three-vertical': DotsThreeVertical,
  eraser: Eraser,
  envelope: Envelope,
  eye: Eye,
  'eye-slash': EyeSlash,
  feather: Feather,
  flame: Flame,
  'skip-forward': SkipForward,
  vibrate: Vibrate,
  'share-network': ShareNetwork,
  gauge: Gauge,
  globe: Globe,
  gear: Gear,
  house: House,
  'image-square': ImageSquare,
  info: Info,
  key: Key,
  cards: Cards,
  'list-checks': ListChecks,
  'list-plus': ListPlus,
  'lock-simple': LockSimple,
  'magnifying-glass': MagnifyingGlass,
  'map-pin': MapPin,
  'map-pin-slash': MapPinLine,
  'pencil-simple': PencilSimple,
  phone: Phone,
  play: Play,
  stop: Stop,
  'play-circle': PlayCircle,
  'youtube-logo': YoutubeLogo,
  'speaker-simple-slash': SpeakerSimpleSlash,
  plus: Plus,
  'qr-code': QrCode,
  'caret-line-down': CaretLineDown,
  'caret-line-up': CaretLineUp,
  check: Check,
  circle: Circle,
  columns: Columns,
  cylinder: Cylinder,
  devices: Devices,
  equals: Equals,
  fire: Fire,
  'frame-corners': FrameCorners,
  'funnel-simple': FunnelSimple,
  'person-simple': PersonSimple,
  person: Person,
  'sliders-horizontal': SlidersHorizontal,
  target: Target,
  list: List,
  'minus-circle': MinusCircle,
  'plus-circle': PlusCircle,
  plugs: Plugs,
  robot: Robot,
  rows: Rows,
  toolbox: Toolbox,
  'wave-sine': WaveSine,
  scales: Scales,
  ruler: Ruler,
  'shield-check': ShieldCheck,
  confetti: Confetti,
  pause: Pause,
  bandaids: Bandaids,
  path: Path,
  'dots-three-circle': DotsThreeCircle,
  'hand-palm': HandPalm,
  'hand-tap': HandTap,
  'thumbs-up': ThumbsUp,
  'thumbs-down': ThumbsDown,
  'first-aid-kit': FirstAidKit,
  virus: Virus,
  brain: Brain,
  drop: Drop,
  question: Question,
  'arrow-fat-up': ArrowFatUp,
  'arrow-fat-down': ArrowFatDown,
  'arrows-down-up': ArrowsDownUp,
  warning: Warning,
  moon: Moon,
  sparkle: Sparkle,
  'sun-horizon': SunHorizon,
  lightning: Lightning,
  'floppy-disk': FloppyDisk,
  'sign-out': SignOut,
  star: Star,
  'squares-four': SquaresFour,
  'graduation-cap': GraduationCap,
  'bookmark-simple': BookmarkSimple,
  'book-open': BookOpen,
  'rocket-launch': RocketLaunch,
  'pencil-simple-line': PencilSimpleLine,
  compass: Compass,
  'device-mobile': DeviceMobile,
  monitor: Monitor,
  'disco-ball': DiscoBall,
  'hand-grabbing': HandGrabbing,
  'person-simple-hike': PersonSimpleHike,
  stairs: Stairs,
  infinity: InfinityIcon,
  'person-arms-spread': PersonArmsSpread,
  'soccer-ball': SoccerBall,
  basketball: Basketball,
  volleyball: Volleyball,
  'tennis-ball': TennisBall,
  racquet: Racquet,
  'ping-pong': PingPong,
  'boxing-glove': BoxingGlove,
  'hand-fist': HandFist,
  mountains: Mountains,
  hockey: Hockey,
  'person-simple-ski': PersonSimpleSki,
  'person-simple-snowboard': PersonSimpleSnowboard,
  golf: Golf,
  timer: Timer,
  'flag-checkered': FlagCheckered,
  hourglass: Hourglass,
  blueprint: Blueprint,
  bed: Bed,
  steps: Steps,
  'trend-up': TrendUp,
  'user-square': UserSquare,
  'thermometer-simple': ThermometerSimple,
  'list-numbers': ListNumbers,
  'sneaker-move': SneakerMove,
  'calendar-plus': CalendarPlus,
  'shield-chevron': ShieldChevron,
  trash: Trash,
  trophy: Trophy,
  user: User,
  'user-focus': UserFocus,
  'download-simple': DownloadSimple,
  'upload-simple': UploadSimple,
  'warning-circle': WarningCircle,
  heartbeat: Heartbeat,
  'person-simple-run': PersonSimpleRun,
  bicycle: Bicycle,
  'person-simple-swim': PersonSimpleSwim,
  'person-simple-walk': PersonSimpleWalk,
  'person-simple-tai-chi': PersonSimpleTaiChi,
  'hand-heart': HandHeart,
  snowflake: Snowflake,
  'clock-counter-clockwise': ClockCounterClockwise,
  yoga: FlowerLotus,
  'flower-lotus': FlowerLotus,
  'airplane-tilt': AirplaneTilt,
  'corners-out': CornersOut,
  minus: Minus,
  stack: Stack,
  medal: Medal,
  'push-pin': PushPin,
  'flag-banner': FlagBanner,
  x: X,
  'x-circle': XCircle,
  'caret-up': CaretUp,
  'caret-down': CaretDown,
  wind: Wind,
  'beer-bottle': BeerBottle,
  'beer-stein': BeerStein,
  wine: Wine,
  martini: Martini,
  'drop-half': DropHalf,
  cheers: Cheers,
  'calendar-dots': CalendarDots,
  leaf: Leaf,
  pill: Pill,
  flask: Flask,
  'test-tube': TestTube,
  coffee: Coffee,
  fish: Fish,
  egg: Egg,
  orange: Orange,
  grains: Grains,
  'hourglass-medium': HourglassMedium,
};

export function Icon({
  name,
  className,
  weight = 'bold',
  style,
}: {
  name: string;
  className?: string;
  weight?: IconProps['weight'];
  style?: CSSProperties;
}) {
  const Glyph = ICONS[name];
  const classes = ['ui-icon', className].filter(Boolean).join(' ');
  return (
    <i className={classes} aria-hidden style={style}>
      {Glyph ? <Glyph size="1em" weight={weight} /> : null}
    </i>
  );
}

/** Media hook: true at the desktop breakpoint (≥720 px). */
export function useIsDesktop(): boolean {
  const [is, setIs] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 720px)').matches,
  );
  useEffect(() => {
    const q = window.matchMedia('(min-width: 720px)');
    const on = () => setIs(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return is;
}

/** S-10 · Today · skeleton — never a spinner. */
/**
 * Compact language selector — flag chip on every screen (documented addition
 * on top of the boards; see docs/DESIGN.md). Opens a popover with all locales.
 */
export function LanguageSelector({ compact }: { compact?: boolean } = {}) {
  const { locale } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const popStyle = useFixedPanelPosition('popover', ref);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={`lang${compact ? ' compact' : ''}`} ref={ref}>
      <Button
        className="lang-chip"
        variant="ghost"
        size="sm"
        aria-label={LOCALES[locale].language}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((x) => !x)}
      >
        <span aria-hidden>{FLAGS[locale]}</span>
        {!compact && <span className="lang-chip-label">{LOCALES[locale].locale}</span>}
        {!compact && <Icon name="caret-line-down" className="lang-chip-caret" />}
      </Button>
      {open && (
        <Portal>
          {/* Invisible underlay: a tap outside only closes the popover, never hits the page. */}
          <div className="lang-scrim" onClick={() => setOpen(false)} aria-hidden />
          <div className="lang-pop" role="menu" ref={popRef} style={popStyle}>
            {LOCALE_IDS.map((id) => (
              <Button
                key={id}
                role="menuitemradio"
                aria-checked={id === locale}
                className={`lang-item${id === locale ? ' active' : ''}`}
                variant={id === locale ? 'secondary' : 'ghost'}
                size="sm"
                fullWidth
                onClick={() => {
                  setLocale(id);
                  setOpen(false);
                }}
              >
                <span aria-hidden>{FLAGS[id]}</span>
                <span>{LOCALES[id].locale}</span>
              </Button>
            ))}
          </div>
        </Portal>
      )}
    </div>
  );
}

/** Full-page scrim + spinner while a mutation (callable / tracked write) is in flight. */
export function ServerBusyOverlay() {
  const { t } = useT();
  const busy = useSyncExternalStore(
    subscribeMutation,
    () => getMutationPending() > 0,
    () => false,
  );
  if (!busy) return null;
  return (
    <Portal>
      <div className="server-busy-scrim" role="alert" aria-busy="true" aria-live="assertive">
        <div className="sp" aria-label={t.saving} />
      </div>
    </Portal>
  );
}

/**
 * Renders an exercise name for the active locale: the localized name as the
 * prominent primary, with the English name as a smaller, subdued line beneath
 * when a non-English locale is active and a localized name exists. Falls back
 * to the plain name (English or a custom entry) otherwise.
 */
export function ExerciseName({
  name,
  className,
  secondary = true,
}: {
  name: string;
  className?: string;
  secondary?: boolean;
}) {
  const { locale } = useT();
  const d = exerciseDisplay(name, locale);
  const sec = secondary ? d.secondary : null;
  return (
    <span className="exn">
      <span className={className ? `exn-primary ${className}` : 'exn-primary'}>{d.primary}</span>
      {sec && <span className="exn-secondary">{sec}</span>}
    </span>
  );
}

/** Primary-only localized name, for plain-string contexts (aria-label, title). */
export function useExerciseName(): (name: string) => string {
  const { locale } = useT();
  return useCallback((name: string) => localizedExerciseName(name, locale) ?? name, [locale]);
}
