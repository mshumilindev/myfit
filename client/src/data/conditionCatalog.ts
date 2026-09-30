/**
 * Long-term condition catalogue. Every entry is a pre-written set of training
 * effects, so nobody has to describe rules; there is no "other" and no free text.
 * Entries are generated from a small table of effect templates (one per body area
 * or system) so the numbers live in one place and are easy to review.
 *
 * Not medical advice: effects are conservative training adjustments, never a
 * diagnosis or a prohibition. Names are English here; UI strings are localised
 * through i18n keys `cond.<key>`.
 */
import type { MuscleGroup } from './exercises';
import type { LocaleId } from '../i18n';
import { localizedCondition } from './conditionNames';

export type ConditionCategory =
  | 'spine'
  | 'joint'
  | 'cardio'
  | 'respiratory'
  | 'neuro'
  | 'postop'
  | 'pain'
  | 'metabolic'
  | 'pregnancy'
  | 'other';

export type ConditionRegion =
  | 'neck'
  | 'upper_back'
  | 'lower_back'
  | 'shoulder'
  | 'elbow'
  | 'wrist'
  | 'hip'
  | 'knee'
  | 'ankle'
  | 'foot'
  | 'heart'
  | 'lungs'
  | 'brain'
  | 'abdomen'
  | 'whole';

/** What a movement does to the body: the vocabulary effects and exercises share. */
export type RiskTag =
  | 'axial'
  | 'shear'
  | 'flexion'
  | 'extension'
  | 'rotation'
  | 'impact'
  | 'overhead'
  | 'valsalva'
  | 'deep_knee'
  | 'wrist_load'
  | 'hang'
  | 'inversion'
  | 'high_cardio';

export type CardioCap = 'light' | 'moderate' | 'vigorous';

export interface ConditionEffects {
  /** Muscles whose working load is scaled (0..1). */
  muscleCaps?: Partial<Record<MuscleGroup, number>>;
  /** Exercises carrying these tags are left out of auto-plans and flagged "avoid". */
  avoid?: RiskTag[];
  /** Exercises carrying these tags are flagged "careful" and ranked lower. */
  caution?: RiskTag[];
  rpeMax?: number;
  noFailure?: boolean;
  noMaxEffort?: boolean;
  noBreathHold?: boolean;
  /** 0..1 multiplier on planned sets. */
  volumeScale?: number;
  /** 0..1 multiplier on automatic load steps. */
  stepScale?: number;
  noAutoIncrease?: boolean;
  cardioMax?: CardioCap;
  /** >=1 multiplier on rest between sets (slower recovery). */
  restScale?: number;
}

export interface CatalogCondition {
  key: string;
  category: ConditionCategory;
  region: ConditionRegion;
  name: string;
  /** Extra search words (common names, synonyms). */
  aka: string[];
  icon: string;
  /** Effects at severity 2 (moderate). `effectsAt` derives 1 and 3. */
  effects: ConditionEffects;
}

// ---------------------------------------------------------------------------
// Effect templates (severity 2). Edit numbers here only.
// ---------------------------------------------------------------------------

const T = {
  lumbar: {
    muscleCaps: { lower_back: 0.75, glutes: 0.85, hamstrings: 0.85 },
    avoid: ['shear'],
    caution: ['axial', 'flexion', 'rotation'],
    rpeMax: 8,
    noFailure: true,
    volumeScale: 0.85,
    stepScale: 0.5,
  },
  thoracic: {
    muscleCaps: { traps: 0.85, lats: 0.9 },
    caution: ['axial', 'rotation', 'overhead'],
    rpeMax: 8,
    noFailure: true,
    stepScale: 0.6,
  },
  cervical: {
    muscleCaps: { neck: 0.6, traps: 0.8 },
    avoid: ['inversion'],
    caution: ['axial', 'overhead', 'hang'],
    rpeMax: 8,
    noFailure: true,
    stepScale: 0.6,
  },
  disc: {
    muscleCaps: { lower_back: 0.65, glutes: 0.8, hamstrings: 0.8 },
    avoid: ['shear', 'flexion', 'axial'],
    caution: ['rotation'],
    rpeMax: 7,
    noFailure: true,
    noMaxEffort: true,
    volumeScale: 0.8,
    stepScale: 0.4,
  },
  scoliosis: {
    caution: ['axial', 'rotation'],
    rpeMax: 9,
    noFailure: true,
    stepScale: 0.7,
  },
  knee: {
    muscleCaps: { quads: 0.8, hamstrings: 0.9, calves: 0.9 },
    avoid: ['impact'],
    caution: ['deep_knee', 'rotation'],
    rpeMax: 8,
    noFailure: true,
    stepScale: 0.6,
  },
  shoulder: {
    muscleCaps: { shoulders: 0.75, chest: 0.85, triceps: 0.9 },
    avoid: ['overhead'],
    caution: ['hang'],
    rpeMax: 8,
    noFailure: true,
    stepScale: 0.6,
  },
  hip: {
    muscleCaps: { glutes: 0.8, adductors: 0.8, quads: 0.9 },
    avoid: ['impact'],
    caution: ['deep_knee', 'rotation'],
    rpeMax: 8,
    noFailure: true,
    stepScale: 0.6,
  },
  elbow: {
    muscleCaps: { biceps: 0.8, triceps: 0.8, forearms: 0.75 },
    caution: ['hang', 'wrist_load'],
    rpeMax: 8,
    noFailure: true,
    stepScale: 0.6,
  },
  wrist: {
    muscleCaps: { forearms: 0.7 },
    caution: ['wrist_load', 'hang'],
    rpeMax: 8,
    noFailure: true,
    stepScale: 0.6,
  },
  ankle: {
    muscleCaps: { calves: 0.8 },
    avoid: ['impact'],
    caution: ['deep_knee'],
    rpeMax: 8,
    noFailure: true,
    stepScale: 0.6,
  },
  pressure: {
    avoid: ['valsalva', 'inversion'],
    caution: ['overhead', 'high_cardio'],
    rpeMax: 8,
    noFailure: true,
    noMaxEffort: true,
    noBreathHold: true,
    stepScale: 0.6,
    cardioMax: 'moderate',

    restScale: 1.25,
  },
  rhythm: {
    avoid: ['valsalva', 'high_cardio', 'inversion'],
    caution: ['overhead'],
    rpeMax: 7,
    noFailure: true,
    noMaxEffort: true,
    noBreathHold: true,
    stepScale: 0.5,
    cardioMax: 'moderate',

    restScale: 1.25,
  },
  structural: {
    avoid: ['valsalva', 'high_cardio', 'impact', 'inversion'],
    caution: ['overhead'],
    rpeMax: 7,
    noFailure: true,
    noMaxEffort: true,
    noBreathHold: true,
    volumeScale: 0.85,
    stepScale: 0.4,
    cardioMax: 'light',

    restScale: 1.5,
  },
  implant: {
    avoid: ['valsalva', 'impact'],
    caution: ['overhead', 'rotation'],
    rpeMax: 7,
    noFailure: true,
    noMaxEffort: true,
    noBreathHold: true,
    stepScale: 0.5,
    cardioMax: 'moderate',
  },
  breathing: {
    avoid: ['valsalva'],
    caution: ['high_cardio'],
    rpeMax: 8,
    noFailure: true,
    noBreathHold: true,
    stepScale: 0.7,
    cardioMax: 'moderate',

    restScale: 1.25,
  },
  balance: {
    avoid: ['inversion'],
    caution: ['impact', 'rotation'],
    rpeMax: 8,
    noFailure: true,
    noMaxEffort: true,
    stepScale: 0.7,
  },
  neuropathy: {
    caution: ['impact', 'wrist_load'],
    rpeMax: 8,
    noFailure: true,
    stepScale: 0.7,
  },
  glucose: {
    caution: ['high_cardio'],
    rpeMax: 9,
    noFailure: true,
    stepScale: 0.8,
  },
  thyroid: {
    rpeMax: 8,
    noFailure: true,
    stepScale: 0.8,
    cardioMax: 'moderate',
  },
  pregnancy: {
    avoid: ['inversion', 'impact', 'valsalva'],
    caution: ['flexion', 'rotation', 'high_cardio'],
    rpeMax: 7,
    noFailure: true,
    noMaxEffort: true,
    noBreathHold: true,
    volumeScale: 0.85,
    stepScale: 0.5,
    cardioMax: 'moderate',

    restScale: 1.25,
  },
  postpartum: {
    avoid: ['impact', 'valsalva'],
    caution: ['flexion', 'axial', 'high_cardio'],
    rpeMax: 7,
    noFailure: true,
    noBreathHold: true,
    volumeScale: 0.85,
    stepScale: 0.5,
  },
  abdominal: {
    muscleCaps: { core: 0.6 },
    avoid: ['valsalva', 'flexion'],
    caution: ['axial', 'rotation'],
    rpeMax: 7,
    noFailure: true,
    noBreathHold: true,
    stepScale: 0.5,
  },
  postop_limb: {
    avoid: ['impact'],
    caution: ['axial', 'deep_knee', 'overhead'],
    rpeMax: 7,
    noFailure: true,
    noMaxEffort: true,
    volumeScale: 0.8,
    stepScale: 0.4,
  },
  fatigue: {
    rpeMax: 7,
    noFailure: true,
    noMaxEffort: true,
    volumeScale: 0.8,
    stepScale: 0.5,
    cardioMax: 'moderate',
  },
  pain_general: {
    rpeMax: 8,
    noFailure: true,
    stepScale: 0.6,
  },
  kidney: {
    avoid: ['valsalva'],
    rpeMax: 8,
    noFailure: true,
    noBreathHold: true,
    stepScale: 0.7,
    cardioMax: 'moderate',
  },
  digestive: {
    caution: ['flexion', 'inversion'],
    rpeMax: 9,
    stepScale: 0.8,
  },
} as const satisfies Record<string, ConditionEffects>;
export type EffectTemplate = keyof typeof T;

// [key, category, region, name, template, icon, aka, extra effects]
type Row = [
  string,
  ConditionCategory,
  ConditionRegion,
  string,
  EffectTemplate,
  string,
  string[]?,
  ConditionEffects?,
];

const ROWS: Row[] = [
  // --- Spine ---------------------------------------------------------------
  [
    'back_lumbar_chronic',
    'spine',
    'lower_back',
    'Chronic lower back pain',
    'lumbar',
    'person-simple',
    ['lumbago', 'low back'],
  ],
  [
    'back_lumbar_disc',
    'spine',
    'lower_back',
    'Lumbar disc herniation',
    'disc',
    'person-simple',
    ['slipped disc', 'sciatica', 'hernia'],
  ],
  [
    'back_lumbar_protrusion',
    'spine',
    'lower_back',
    'Lumbar disc protrusion',
    'disc',
    'person-simple',
    ['bulging disc'],
  ],
  [
    'back_lumbar_degenerative',
    'spine',
    'lower_back',
    'Degenerative disc disease',
    'lumbar',
    'person-simple',
    ['osteochondrosis'],
  ],
  [
    'back_spondylolisthesis',
    'spine',
    'lower_back',
    'Spondylolisthesis',
    'disc',
    'person-simple',
    ['vertebra slip'],
    { avoid: ['extension'] },
  ],
  [
    'back_spondylolysis',
    'spine',
    'lower_back',
    'Spondylolysis',
    'lumbar',
    'person-simple',
    ['pars fracture'],
    { avoid: ['extension'] },
  ],
  [
    'back_stenosis_lumbar',
    'spine',
    'lower_back',
    'Lumbar spinal stenosis',
    'lumbar',
    'person-simple',
    ['narrow canal'],
    { avoid: ['extension'] },
  ],
  [
    'back_si_joint',
    'spine',
    'lower_back',
    'Sacroiliac joint pain',
    'lumbar',
    'person-simple',
    ['SI joint', 'pelvic girdle'],
  ],
  [
    'back_sciatica',
    'spine',
    'lower_back',
    'Chronic sciatica',
    'lumbar',
    'person-simple',
    ['sciatic nerve'],
    { avoid: ['flexion'] },
  ],
  [
    'back_thoracic_chronic',
    'spine',
    'upper_back',
    'Chronic mid back pain',
    'thoracic',
    'person-simple',
    ['thoracic pain'],
  ],
  [
    'back_thoracic_disc',
    'spine',
    'upper_back',
    'Thoracic disc problem',
    'thoracic',
    'person-simple',
    [],
    { avoid: ['flexion'] },
  ],
  [
    'back_kyphosis',
    'spine',
    'upper_back',
    'Kyphosis',
    'scoliosis',
    'person-simple',
    ['hunchback', 'stoop'],
  ],
  ['back_scoliosis', 'spine', 'whole', 'Scoliosis', 'scoliosis', 'person-simple', ['curved spine']],
  [
    'back_cervical_chronic',
    'spine',
    'neck',
    'Chronic neck pain',
    'cervical',
    'person-simple',
    ['cervical pain'],
  ],
  [
    'back_cervical_disc',
    'spine',
    'neck',
    'Cervical disc herniation',
    'cervical',
    'person-simple',
    ['neck hernia', 'radiculopathy'],
    { avoid: ['overhead'] },
  ],
  [
    'back_cervical_stenosis',
    'spine',
    'neck',
    'Cervical spinal stenosis',
    'cervical',
    'person-simple',
    [],
    { avoid: ['overhead', 'axial'] },
  ],
  [
    'back_whiplash',
    'spine',
    'neck',
    'Whiplash, long-term',
    'cervical',
    'person-simple',
    ['neck injury'],
  ],
  [
    'back_ankylosing',
    'spine',
    'whole',
    'Ankylosing spondylitis',
    'lumbar',
    'person-simple',
    ['Bechterew'],
    { avoid: ['impact'] },
  ],
  [
    'back_osteoporosis',
    'spine',
    'whole',
    'Osteoporosis',
    'thoracic',
    'person-simple',
    ['bone density', 'osteopenia'],
    { avoid: ['flexion', 'impact'] },
  ],
  // --- Joints --------------------------------------------------------------
  ['knee_pain', 'joint', 'knee', 'Chronic knee pain', 'knee', 'sneaker-move', ['knee ache']],
  [
    'knee_patellofemoral',
    'joint',
    'knee',
    'Patellofemoral pain',
    'knee',
    'sneaker-move',
    ['runner knee', 'anterior knee'],
  ],
  [
    'knee_chondromalacia',
    'joint',
    'knee',
    'Chondromalacia patella',
    'knee',
    'sneaker-move',
    ['cartilage'],
  ],
  [
    'knee_arthritis',
    'joint',
    'knee',
    'Knee osteoarthritis',
    'knee',
    'sneaker-move',
    ['arthrosis', 'gonarthrosis'],
    { avoid: ['deep_knee'] },
  ],
  [
    'knee_meniscus',
    'joint',
    'knee',
    'Meniscus problem',
    'knee',
    'sneaker-move',
    ['meniscal tear'],
    { avoid: ['deep_knee', 'rotation'] },
  ],
  [
    'knee_acl',
    'joint',
    'knee',
    'ACL instability',
    'knee',
    'sneaker-move',
    ['cruciate'],
    { avoid: ['rotation'] },
  ],
  [
    'knee_tendinopathy',
    'joint',
    'knee',
    'Patellar tendinopathy',
    'knee',
    'sneaker-move',
    ['jumper knee'],
  ],
  ['knee_itb', 'joint', 'knee', 'IT band syndrome', 'knee', 'sneaker-move', ['iliotibial']],
  [
    'shoulder_impingement',
    'joint',
    'shoulder',
    'Shoulder impingement',
    'shoulder',
    'hand-grabbing',
    ['subacromial'],
  ],
  [
    'shoulder_rotator',
    'joint',
    'shoulder',
    'Rotator cuff problem',
    'shoulder',
    'hand-grabbing',
    ['rotator cuff tear'],
  ],
  [
    'shoulder_instability',
    'joint',
    'shoulder',
    'Shoulder instability',
    'shoulder',
    'hand-grabbing',
    ['dislocation', 'subluxation'],
    { avoid: ['hang'] },
  ],
  [
    'shoulder_arthritis',
    'joint',
    'shoulder',
    'Shoulder osteoarthritis',
    'shoulder',
    'hand-grabbing',
    ['arthrosis'],
  ],
  [
    'shoulder_ac',
    'joint',
    'shoulder',
    'AC joint pain',
    'shoulder',
    'hand-grabbing',
    ['acromioclavicular'],
  ],
  [
    'shoulder_frozen',
    'joint',
    'shoulder',
    'Frozen shoulder',
    'shoulder',
    'hand-grabbing',
    ['adhesive capsulitis'],
    { avoid: ['overhead', 'hang'] },
  ],
  ['hip_pain', 'joint', 'hip', 'Chronic hip pain', 'hip', 'person-simple-walk', ['groin']],
  [
    'hip_fai',
    'joint',
    'hip',
    'Femoroacetabular impingement',
    'hip',
    'person-simple-walk',
    ['FAI'],
    { avoid: ['deep_knee'] },
  ],
  [
    'hip_arthritis',
    'joint',
    'hip',
    'Hip osteoarthritis',
    'hip',
    'person-simple-walk',
    ['coxarthrosis'],
  ],
  [
    'hip_bursitis',
    'joint',
    'hip',
    'Trochanteric bursitis',
    'hip',
    'person-simple-walk',
    ['greater trochanter'],
  ],
  ['hip_dysplasia', 'joint', 'hip', 'Hip dysplasia', 'hip', 'person-simple-walk', []],
  [
    'elbow_tennis',
    'joint',
    'elbow',
    'Tennis elbow',
    'elbow',
    'hand-grabbing',
    ['lateral epicondylitis'],
  ],
  [
    'elbow_golfer',
    'joint',
    'elbow',
    'Golfer elbow',
    'elbow',
    'hand-grabbing',
    ['medial epicondylitis'],
  ],
  ['elbow_arthritis', 'joint', 'elbow', 'Elbow osteoarthritis', 'elbow', 'hand-grabbing', []],
  [
    'wrist_carpal',
    'joint',
    'wrist',
    'Carpal tunnel syndrome',
    'wrist',
    'hand-grabbing',
    ['median nerve'],
  ],
  [
    'wrist_tendinitis',
    'joint',
    'wrist',
    'Wrist tendinitis',
    'wrist',
    'hand-grabbing',
    ['de Quervain'],
  ],
  ['wrist_instability', 'joint', 'wrist', 'Wrist instability', 'wrist', 'hand-grabbing', []],
  [
    'ankle_instability',
    'joint',
    'ankle',
    'Chronic ankle instability',
    'ankle',
    'sneaker-move',
    ['sprain'],
  ],
  [
    'ankle_achilles',
    'joint',
    'ankle',
    'Achilles tendinopathy',
    'ankle',
    'sneaker-move',
    ['heel cord'],
    { avoid: ['impact'] },
  ],
  ['foot_plantar', 'joint', 'foot', 'Plantar fasciitis', 'ankle', 'sneaker-move', ['heel pain']],
  ['foot_flat', 'joint', 'foot', 'Flat feet, pain', 'ankle', 'sneaker-move', ['pes planus']],
  [
    'joint_hypermobility',
    'joint',
    'whole',
    'Joint hypermobility',
    'pain_general',
    'person-simple',
    ['Ehlers-Danlos', 'hypermobile'],
    { avoid: ['hang'], caution: ['deep_knee', 'overhead'] },
  ],
  [
    'joint_rheumatoid',
    'joint',
    'whole',
    'Rheumatoid arthritis',
    'pain_general',
    'person-simple',
    ['RA'],
    { avoid: ['impact'], volumeScale: 0.85 },
  ],
  [
    'joint_gout',
    'joint',
    'whole',
    'Gout',
    'pain_general',
    'person-simple',
    [],
    { avoid: ['impact'] },
  ],
  [
    'joint_fibromyalgia',
    'joint',
    'whole',
    'Fibromyalgia',
    'fatigue',
    'person-simple',
    ['widespread pain'],
  ],
  // --- Heart & circulation -------------------------------------------------
  [
    'heart_hypertension',
    'cardio',
    'heart',
    'High blood pressure',
    'pressure',
    'heartbeat',
    ['hypertension'],
  ],
  [
    'heart_hypotension',
    'cardio',
    'heart',
    'Low blood pressure',
    'balance',
    'heartbeat',
    ['hypotension', 'dizzy'],
  ],
  [
    'heart_arrhythmia',
    'cardio',
    'heart',
    'Arrhythmia',
    'rhythm',
    'heartbeat',
    ['irregular heartbeat'],
  ],
  ['heart_afib', 'cardio', 'heart', 'Atrial fibrillation', 'rhythm', 'heartbeat', ['AFib']],
  [
    'heart_tachycardia',
    'cardio',
    'heart',
    'Tachycardia',
    'rhythm',
    'heartbeat',
    ['fast heart rate'],
  ],
  [
    'heart_postmi',
    'cardio',
    'heart',
    'After a heart attack',
    'structural',
    'heartbeat',
    ['myocardial infarction', 'MI'],
  ],
  [
    'heart_failure',
    'cardio',
    'heart',
    'Heart failure',
    'structural',
    'heartbeat',
    ['cardiomyopathy'],
  ],
  [
    'heart_valve',
    'cardio',
    'heart',
    'Heart valve condition',
    'structural',
    'heartbeat',
    ['murmur', 'stenosis'],
  ],
  [
    'heart_congenital',
    'cardio',
    'heart',
    'Congenital heart condition',
    'structural',
    'heartbeat',
    [],
  ],
  [
    'heart_pacemaker',
    'cardio',
    'heart',
    'Pacemaker or ICD',
    'implant',
    'heartbeat',
    ['defibrillator'],
  ],
  [
    'heart_stent',
    'cardio',
    'heart',
    'After stent or bypass',
    'structural',
    'heartbeat',
    ['CABG', 'angioplasty'],
  ],
  [
    'heart_angina',
    'cardio',
    'heart',
    'Angina',
    'structural',
    'heartbeat',
    ['chest pain', 'coronary'],
  ],
  [
    'heart_pots',
    'cardio',
    'heart',
    'POTS',
    'balance',
    'heartbeat',
    ['orthostatic', 'postural tachycardia'],
    { cardioMax: 'moderate' },
  ],
  [
    'heart_varicose',
    'cardio',
    'whole',
    'Varicose veins',
    'pressure',
    'heartbeat',
    ['venous insufficiency'],
    { avoid: ['valsalva'] },
  ],
  ['heart_raynaud', 'cardio', 'whole', 'Raynaud phenomenon', 'glucose', 'heartbeat', []],
  ['heart_aneurysm', 'cardio', 'heart', 'Aneurysm', 'structural', 'heartbeat', ['aortic']],
  // --- Breathing -----------------------------------------------------------
  ['lung_asthma', 'respiratory', 'lungs', 'Asthma', 'breathing', 'wind', ['wheeze']],
  [
    'lung_exercise_asthma',
    'respiratory',
    'lungs',
    'Exercise-induced asthma',
    'breathing',
    'wind',
    ['EIB'],
  ],
  [
    'lung_copd',
    'respiratory',
    'lungs',
    'COPD',
    'breathing',
    'wind',
    ['emphysema', 'chronic bronchitis'],
    { cardioMax: 'light' },
  ],
  ['lung_bronchiectasis', 'respiratory', 'lungs', 'Bronchiectasis', 'breathing', 'wind', []],
  [
    'lung_fibrosis',
    'respiratory',
    'lungs',
    'Pulmonary fibrosis',
    'breathing',
    'wind',
    [],
    { cardioMax: 'light' },
  ],
  ['lung_cf', 'respiratory', 'lungs', 'Cystic fibrosis', 'breathing', 'wind', []],
  ['lung_sleep_apnea', 'respiratory', 'lungs', 'Sleep apnea', 'glucose', 'wind', []],
  ['lung_long_covid', 'respiratory', 'lungs', 'Long COVID', 'fatigue', 'wind', ['post-covid']],
  [
    'lung_collapsed',
    'respiratory',
    'lungs',
    'After a collapsed lung',
    'breathing',
    'wind',
    ['pneumothorax'],
    { avoid: ['valsalva', 'high_cardio'] },
  ],
  ['lung_chronic_cough', 'respiratory', 'lungs', 'Chronic cough', 'breathing', 'wind', []],
  // --- Nerves & balance ----------------------------------------------------
  [
    'neuro_neuropathy',
    'neuro',
    'whole',
    'Peripheral neuropathy',
    'neuropathy',
    'brain',
    ['numbness', 'tingling'],
  ],
  ['neuro_vertigo', 'neuro', 'brain', 'Vertigo', 'balance', 'brain', ['dizziness', 'BPPV']],
  ['neuro_vestibular', 'neuro', 'brain', 'Vestibular disorder', 'balance', 'brain', ['Meniere']],
  [
    'neuro_migraine',
    'neuro',
    'brain',
    'Chronic migraine',
    'pressure',
    'brain',
    ['headache'],
    { cardioMax: 'moderate' },
  ],
  [
    'neuro_epilepsy',
    'neuro',
    'brain',
    'Epilepsy',
    'balance',
    'brain',
    ['seizures'],
    { avoid: ['inversion', 'hang'] },
  ],
  ['neuro_ms', 'neuro', 'whole', 'Multiple sclerosis', 'fatigue', 'brain', ['MS']],
  ['neuro_parkinson', 'neuro', 'whole', 'Parkinson disease', 'balance', 'brain', []],
  [
    'neuro_concussion',
    'neuro',
    'brain',
    'Post-concussion syndrome',
    'balance',
    'brain',
    ['head injury'],
    { avoid: ['impact', 'valsalva'] },
  ],
  ['neuro_cp', 'neuro', 'whole', 'Cerebral palsy', 'balance', 'brain', []],
  ['neuro_stroke', 'neuro', 'brain', 'After a stroke', 'structural', 'brain', ['TIA']],
  ['neuro_spinal_cord', 'neuro', 'whole', 'Spinal cord injury', 'balance', 'brain', ['paraplegia']],
  [
    'neuro_chronic_fatigue',
    'neuro',
    'whole',
    'Chronic fatigue syndrome',
    'fatigue',
    'brain',
    ['ME/CFS'],
  ],
  // --- After surgery -------------------------------------------------------
  [
    'postop_spine_lumbar',
    'postop',
    'lower_back',
    'After lumbar spine surgery',
    'disc',
    'bandaids',
    ['fusion', 'discectomy'],
  ],
  [
    'postop_spine_cervical',
    'postop',
    'neck',
    'After cervical spine surgery',
    'cervical',
    'bandaids',
    ['ACDF'],
    { avoid: ['overhead', 'axial'] },
  ],
  [
    'postop_spine_thoracic',
    'postop',
    'upper_back',
    'After thoracic spine surgery',
    'thoracic',
    'bandaids',
    [],
  ],
  [
    'postop_knee',
    'postop',
    'knee',
    'After knee surgery',
    'postop_limb',
    'bandaids',
    ['ACL reconstruction', 'meniscectomy'],
  ],
  [
    'postop_knee_replacement',
    'postop',
    'knee',
    'After knee replacement',
    'postop_limb',
    'bandaids',
    ['TKR'],
    { avoid: ['deep_knee', 'impact'] },
  ],
  [
    'postop_hip',
    'postop',
    'hip',
    'After hip surgery',
    'postop_limb',
    'bandaids',
    ['labral repair'],
  ],
  [
    'postop_hip_replacement',
    'postop',
    'hip',
    'After hip replacement',
    'postop_limb',
    'bandaids',
    ['THR'],
    { avoid: ['deep_knee', 'impact', 'rotation'] },
  ],
  [
    'postop_shoulder',
    'postop',
    'shoulder',
    'After shoulder surgery',
    'postop_limb',
    'bandaids',
    ['rotator cuff repair'],
  ],
  [
    'postop_elbow_wrist',
    'postop',
    'elbow',
    'After elbow or wrist surgery',
    'postop_limb',
    'bandaids',
    [],
    { caution: ['wrist_load', 'hang'] },
  ],
  [
    'postop_ankle_foot',
    'postop',
    'ankle',
    'After ankle or foot surgery',
    'postop_limb',
    'bandaids',
    ['Achilles repair'],
  ],
  [
    'postop_abdomen',
    'postop',
    'abdomen',
    'After abdominal surgery',
    'abdominal',
    'bandaids',
    ['hernia repair', 'appendix'],
  ],
  [
    'postop_heart',
    'postop',
    'heart',
    'After heart surgery',
    'structural',
    'bandaids',
    ['open heart'],
  ],
  [
    'postop_chest',
    'postop',
    'lungs',
    'After chest surgery',
    'breathing',
    'bandaids',
    ['thoracotomy'],
  ],
  [
    'postop_breast',
    'postop',
    'whole',
    'After breast surgery',
    'shoulder',
    'bandaids',
    ['mastectomy'],
    { avoid: ['overhead'] },
  ],
  [
    'postop_csection',
    'postop',
    'abdomen',
    'After a C-section',
    'abdominal',
    'bandaids',
    ['cesarean'],
  ],
  [
    'postop_bariatric',
    'postop',
    'abdomen',
    'After bariatric surgery',
    'abdominal',
    'bandaids',
    ['gastric bypass'],
  ],
  [
    'postop_transplant',
    'postop',
    'whole',
    'After an organ transplant',
    'structural',
    'bandaids',
    [],
  ],
  // --- Chronic pain without a diagnosis (by area) ---------------------------
  [
    'pain_neck',
    'pain',
    'neck',
    'Neck pain, no diagnosis',
    'cervical',
    'warning-circle',
    ['unexplained'],
  ],
  [
    'pain_upper_back',
    'pain',
    'upper_back',
    'Mid back pain, no diagnosis',
    'thoracic',
    'warning-circle',
    [],
  ],
  [
    'pain_lower_back',
    'pain',
    'lower_back',
    'Lower back pain, no diagnosis',
    'lumbar',
    'warning-circle',
    [],
  ],
  [
    'pain_shoulder',
    'pain',
    'shoulder',
    'Shoulder pain, no diagnosis',
    'shoulder',
    'warning-circle',
    [],
  ],
  ['pain_elbow', 'pain', 'elbow', 'Elbow pain, no diagnosis', 'elbow', 'warning-circle', []],
  [
    'pain_wrist',
    'pain',
    'wrist',
    'Wrist or hand pain, no diagnosis',
    'wrist',
    'warning-circle',
    [],
  ],
  ['pain_hip', 'pain', 'hip', 'Hip pain, no diagnosis', 'hip', 'warning-circle', []],
  ['pain_knee', 'pain', 'knee', 'Knee pain, no diagnosis', 'knee', 'warning-circle', []],
  [
    'pain_ankle',
    'pain',
    'ankle',
    'Ankle or foot pain, no diagnosis',
    'ankle',
    'warning-circle',
    [],
  ],
  [
    'pain_chest',
    'pain',
    'lungs',
    'Chest pain, checked and benign',
    'breathing',
    'warning-circle',
    [],
    { noBreathHold: true },
  ],
  [
    'pain_abdomen',
    'pain',
    'abdomen',
    'Abdominal pain, no diagnosis',
    'digestive',
    'warning-circle',
    [],
  ],
  ['pain_headache', 'pain', 'brain', 'Headaches, no diagnosis', 'pressure', 'warning-circle', []],
  [
    'pain_whole',
    'pain',
    'whole',
    'Widespread pain, no diagnosis',
    'pain_general',
    'warning-circle',
    [],
  ],
  // --- Metabolic & endocrine -----------------------------------------------
  ['meta_diabetes1', 'metabolic', 'whole', 'Type 1 diabetes', 'glucose', 'drop', ['insulin']],
  ['meta_diabetes2', 'metabolic', 'whole', 'Type 2 diabetes', 'glucose', 'drop', []],
  [
    'meta_prediabetes',
    'metabolic',
    'whole',
    'Prediabetes',
    'glucose',
    'drop',
    ['insulin resistance'],
  ],
  ['meta_hypothyroid', 'metabolic', 'whole', 'Hypothyroidism', 'thyroid', 'drop', ['Hashimoto']],
  ['meta_hyperthyroid', 'metabolic', 'whole', 'Hyperthyroidism', 'rhythm', 'drop', ['Graves']],
  ['meta_pcos', 'metabolic', 'whole', 'PCOS', 'thyroid', 'drop', []],
  ['meta_adrenal', 'metabolic', 'whole', 'Adrenal insufficiency', 'fatigue', 'drop', ['Addison']],
  ['meta_cholesterol', 'metabolic', 'whole', 'High cholesterol', 'thyroid', 'drop', []],
  [
    'meta_obesity',
    'metabolic',
    'whole',
    'Obesity, joint-friendly training',
    'knee',
    'drop',
    ['overweight'],
    { avoid: ['impact', 'inversion'], stepScale: 0.8 },
  ],
  ['meta_anemia', 'metabolic', 'whole', 'Chronic anemia', 'fatigue', 'drop', ['low iron']],
  // --- Pregnancy & postpartum ----------------------------------------------
  [
    'preg_first',
    'pregnancy',
    'abdomen',
    'Pregnancy, first trimester',
    'pregnancy',
    'hand-heart',
    [],
  ],
  [
    'preg_second',
    'pregnancy',
    'abdomen',
    'Pregnancy, second trimester',
    'pregnancy',
    'hand-heart',
    [],
    { avoid: ['flexion'] },
  ],
  [
    'preg_third',
    'pregnancy',
    'abdomen',
    'Pregnancy, third trimester',
    'pregnancy',
    'hand-heart',
    [],
    { avoid: ['flexion', 'axial'], volumeScale: 0.75 },
  ],
  [
    'preg_postpartum',
    'pregnancy',
    'abdomen',
    'Postpartum recovery',
    'postpartum',
    'hand-heart',
    ['after birth'],
  ],
  [
    'preg_diastasis',
    'pregnancy',
    'abdomen',
    'Diastasis recti',
    'abdominal',
    'hand-heart',
    ['abdominal separation'],
  ],
  [
    'preg_pelvic_floor',
    'pregnancy',
    'abdomen',
    'Pelvic floor dysfunction',
    'postpartum',
    'hand-heart',
    ['incontinence', 'prolapse'],
  ],
  // --- Other systems --------------------------------------------------------
  [
    'other_ibd',
    'other',
    'abdomen',
    'Crohn disease or colitis',
    'digestive',
    'first-aid-kit',
    ['IBD', 'ulcerative colitis'],
  ],
  [
    'other_ibs',
    'other',
    'abdomen',
    'Irritable bowel syndrome',
    'digestive',
    'first-aid-kit',
    ['IBS'],
  ],
  [
    'other_reflux',
    'other',
    'abdomen',
    'Chronic reflux',
    'digestive',
    'first-aid-kit',
    ['GERD'],
    { avoid: ['inversion'] },
  ],
  [
    'other_hernia',
    'other',
    'abdomen',
    'Hernia',
    'abdominal',
    'first-aid-kit',
    ['inguinal', 'hiatal'],
  ],
  [
    'other_kidney',
    'other',
    'abdomen',
    'Chronic kidney disease',
    'kidney',
    'first-aid-kit',
    ['CKD'],
  ],
  [
    'other_liver',
    'other',
    'abdomen',
    'Chronic liver disease',
    'kidney',
    'first-aid-kit',
    ['hepatitis', 'fatty liver'],
  ],
  ['other_lupus', 'other', 'whole', 'Lupus', 'fatigue', 'first-aid-kit', ['SLE']],
  [
    'other_psoriatic',
    'other',
    'whole',
    'Psoriatic arthritis',
    'pain_general',
    'first-aid-kit',
    [],
    { avoid: ['impact'] },
  ],
  ['other_autoimmune', 'other', 'whole', 'Autoimmune condition', 'fatigue', 'first-aid-kit', []],
  [
    'other_cancer_recovery',
    'other',
    'whole',
    'After cancer treatment',
    'fatigue',
    'first-aid-kit',
    ['chemotherapy', 'remission'],
    { avoid: ['impact'] },
  ],
  [
    'other_lymphedema',
    'other',
    'whole',
    'Lymphedema',
    'pressure',
    'first-aid-kit',
    [],
    { avoid: ['hang'] },
  ],
  [
    'other_bone_fragility',
    'other',
    'whole',
    'Bone fragility',
    'thoracic',
    'first-aid-kit',
    ['brittle bones'],
    { avoid: ['impact', 'flexion'] },
  ],
  [
    'other_hiatal_hernia',
    'other',
    'abdomen',
    'Hiatal hernia',
    'digestive',
    'first-aid-kit',
    [],
    { avoid: ['valsalva', 'inversion'] },
  ],
  [
    'other_eye_pressure',
    'other',
    'brain',
    'Glaucoma or eye pressure',
    'pressure',
    'first-aid-kit',
    ['retina'],
    { avoid: ['inversion', 'valsalva'] },
  ],
  [
    'other_inner_ear',
    'other',
    'brain',
    'Inner ear condition',
    'balance',
    'first-aid-kit',
    ['tinnitus'],
  ],
];

const CARDIO_ORDER: CardioCap[] = ['light', 'moderate', 'vigorous'];

/** Stricter cardio ceiling of two. */
export function minCardio(a?: CardioCap, b?: CardioCap): CardioCap | undefined {
  if (!a) return b;
  if (!b) return a;
  return CARDIO_ORDER[Math.min(CARDIO_ORDER.indexOf(a), CARDIO_ORDER.indexOf(b))];
}

function uniq<X>(a: readonly X[] | undefined, b: readonly X[] | undefined): X[] | undefined {
  const all = [...(a ?? []), ...(b ?? [])];
  return all.length ? [...new Set(all)] : undefined;
}

const maxDef = (x?: number, y?: number) => (x == null ? y : y == null ? x : Math.max(x, y));

const minDef = (x?: number, y?: number) => (x == null ? y : y == null ? x : Math.min(x, y));

/** Union of tag lists; the stricter number wins. Used for templates and for stacking conditions. */
export function mergeEffects(a: ConditionEffects, b?: ConditionEffects): ConditionEffects {
  const caps: Partial<Record<MuscleGroup, number>> = { ...a.muscleCaps };
  for (const [m, v] of Object.entries(b?.muscleCaps ?? {}) as [MuscleGroup, number][])
    caps[m] = Math.min(caps[m] ?? 1, v);
  const avoid = uniq(a.avoid, b?.avoid);
  const caution = uniq(a.caution, b?.caution)?.filter((t) => !avoid?.includes(t));
  return {
    muscleCaps: Object.keys(caps).length ? caps : undefined,
    avoid,
    caution: caution && caution.length ? caution : undefined,
    rpeMax: minDef(a.rpeMax, b?.rpeMax),
    noFailure: a.noFailure || b?.noFailure || undefined,
    noMaxEffort: a.noMaxEffort || b?.noMaxEffort || undefined,
    noBreathHold: a.noBreathHold || b?.noBreathHold || undefined,
    volumeScale: minDef(a.volumeScale, b?.volumeScale),
    stepScale: minDef(a.stepScale, b?.stepScale),
    noAutoIncrease: a.noAutoIncrease || b?.noAutoIncrease || undefined,
    cardioMax: minCardio(a.cardioMax, b?.cardioMax),
    restScale: maxDef(a.restScale, b?.restScale),
  };
}

export const CONDITION_CATALOG: readonly CatalogCondition[] = ROWS.map(
  ([key, category, region, name, tpl, icon, aka = [], extra]) => ({
    key,
    category,
    region,
    name,
    aka,
    icon,
    effects: mergeEffects(T[tpl], extra),
  }),
);

const BY_KEY = new Map(CONDITION_CATALOG.map((c) => [c.key, c]));

export function catalogCondition(key: string): CatalogCondition | null {
  return BY_KEY.get(key) ?? null;
}

/**
 * Effects at a given severity. 2 = the catalogue value. 1 (mild) loosens it: caps move
 * halfway toward 1, avoided tags become cautions, RPE ceiling +1. 3 (severe) tightens it:
 * caps shrink, cautions become avoid, RPE ceiling −1, no failure and no max effort.
 */
export function effectsAt(e: ConditionEffects, severity: 1 | 2 | 3): ConditionEffects {
  if (severity === 2) return e;
  const mild = severity === 1;
  const caps: Partial<Record<MuscleGroup, number>> = {};
  for (const [m, v] of Object.entries(e.muscleCaps ?? {}) as [MuscleGroup, number][])
    caps[m] = mild ? v + (1 - v) * 0.5 : Math.max(0.3, v - (1 - v) * 0.5);
  const both = uniq(e.avoid, e.caution);
  const scale = (x: number | undefined) =>
    x == null ? x : Math.min(1, Math.max(0.2, mild ? x + (1 - x) * 0.5 : x - (1 - x) * 0.5));
  const step = (c: CardioCap | undefined) =>
    c == null
      ? c
      : CARDIO_ORDER[Math.min(2, Math.max(0, CARDIO_ORDER.indexOf(c) + (mild ? 1 : -1)))];
  return {
    muscleCaps: Object.keys(caps).length ? caps : undefined,
    avoid: mild ? undefined : both,
    caution: mild ? both : undefined,
    rpeMax: e.rpeMax == null ? e.rpeMax : Math.min(10, Math.max(5, e.rpeMax + (mild ? 1 : -1))),
    noFailure: mild ? e.noFailure : true,
    noMaxEffort: mild ? undefined : true,
    noBreathHold: e.noBreathHold,
    volumeScale: scale(e.volumeScale),
    stepScale: scale(e.stepScale),
    noAutoIncrease: mild ? undefined : e.noAutoIncrease,
    cardioMax: step(e.cardioMax),
    restScale:
      e.restScale == null
        ? e.restScale
        : Math.min(2, Math.max(1, e.restScale + (e.restScale - 1) * (mild ? -0.5 : 0.5))),
  };
}

export const CONDITION_CATEGORIES: { id: ConditionCategory; icon: string }[] = [
  { id: 'spine', icon: 'person-simple' },
  { id: 'joint', icon: 'sneaker-move' },
  { id: 'cardio', icon: 'heartbeat' },
  { id: 'respiratory', icon: 'wind' },
  { id: 'neuro', icon: 'brain' },
  { id: 'postop', icon: 'bandaids' },
  { id: 'pain', icon: 'warning-circle' },
  { id: 'metabolic', icon: 'drop' },
  { id: 'pregnancy', icon: 'hand-heart' },
  { id: 'other', icon: 'first-aid-kit' },
];

/** Display name for a catalogue key in a locale; English when missing or not loaded yet. */
export function conditionName(key: string, locale: LocaleId = 'en'): string {
  return localizedCondition(key, locale)?.name ?? BY_KEY.get(key)?.name ?? key;
}

/**
 * Text search over name, synonyms and key (case-insensitive, every word must match).
 * With a non-English locale the localised name and synonyms are searched too.
 */
export function searchConditions(q: string, locale: LocaleId = 'en'): CatalogCondition[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...CONDITION_CATALOG];
  return CONDITION_CATALOG.filter((c) => {
    const loc = localizedCondition(c.key, locale);
    const hay =
      `${c.name} ${c.aka.join(' ')} ${c.key.replace(/_/g, ' ')} ${loc?.name ?? ''} ${(loc?.aka ?? []).join(' ')}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
