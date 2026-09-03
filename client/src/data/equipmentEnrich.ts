/**
 * Equipment enrichment — curated notable model lines per catalog item, and
 * (later) license-clean images. Kept in a side map so the main catalog stays
 * clean and this can grow independently. There is no per-brand SKU database to
 * ingest, so `models` lists the well-known named lines, not every SKU. Images
 * are Wikimedia Commons / stock (commercial-safe) with attribution carried.
 */
import type { EquipmentModel, EquipmentImage } from './equipmentCatalog';

export const EQUIPMENT_ENRICH: Record<
  string,
  { models?: EquipmentModel[]; image?: EquipmentImage }
> = {
  // ── Barbells ──
  'barbell-olympic': {
    models: [
      { brand: 'Rogue', name: 'Ohio Bar' },
      { brand: 'Eleiko', name: 'Öppen Training Bar' },
      { brand: 'American Barbell', name: 'Elite Bar' },
    ],
  },
  'barbell-womens': {
    models: [
      { brand: 'Rogue', name: 'Bella Bar 2.0' },
      { brand: 'Eleiko', name: "Women's WL Bar" },
    ],
  },
  'barbell-power': {
    models: [
      { brand: 'Texas Power Bars', name: 'Texas Power Bar' },
      { brand: 'Rogue', name: 'Ohio Power Bar' },
      { brand: 'Eleiko', name: 'Powerlifting Bar' },
      { brand: 'Kabuki Strength', name: 'Power Bar' },
    ],
  },
  'barbell-deadlift': {
    models: [
      { brand: 'Texas Power Bars', name: 'Texas Deadlift Bar' },
      { brand: 'Rogue', name: 'Ohio Deadlift Bar' },
      { brand: 'Eleiko', name: 'Deadlift Bar' },
    ],
  },
  'barbell-oly-weightlifting': {
    models: [
      { brand: 'Eleiko', name: 'IWF Weightlifting Competition Bar' },
      { brand: 'Uesaka', name: 'Olympic WL Bar' },
      { brand: 'Rogue', name: 'Olympic WL Bar' },
      { brand: 'Werksan', name: 'Olympic Bar' },
    ],
  },
  'barbell-squat-specialist': {
    models: [
      { brand: 'Texas Power Bars', name: 'Texas Squat Bar' },
      { brand: 'Rogue', name: 'Ohio Squat Bar' },
      { brand: 'Kabuki Strength', name: 'Power Bar (squat)' },
    ],
  },
  'barbell-ez': {
    models: [
      { brand: 'Rogue', name: 'Curl Bar' },
      { brand: 'Ivanko', name: 'Super Curl Bar' },
    ],
  },
  'barbell-trap': {
    models: [
      { brand: 'Rogue', name: 'TB-1 Trap Bar' },
      { brand: 'Kabuki Strength', name: 'Trap Bar HD' },
      { brand: 'REP Fitness', name: 'Open Trap Bar' },
    ],
  },
  'barbell-ssb': {
    models: [
      { brand: 'EliteFTS', name: 'SS Yoke Bar' },
      { brand: 'Rogue', name: 'SB-1 Safety Squat Bar' },
      { brand: 'Kabuki Strength', name: 'Transformer Bar' },
    ],
  },
  'barbell-axle': {
    models: [
      { brand: 'Rogue', name: 'Axle Bar' },
      { brand: 'Cerberus', name: 'Axle Bar' },
    ],
  },
  'barbell-duffalo': { models: [{ brand: 'Kabuki Strength', name: 'Duffalo Bar' }] },
  'barbell-swiss': {
    models: [
      { brand: 'Rogue', name: 'MG-3 Multi-Grip Bar' },
      { brand: 'EliteFTS', name: 'Football Bar' },
    ],
  },
  'barbell-landmine': {
    models: [
      { brand: 'Rogue', name: 'Landmine' },
      { brand: 'Rogue', name: 'Monster Landmine' },
    ],
  },
  'barbell-earthquake': { models: [{ brand: 'Bandbell', name: 'Earthquake Bar' }] },

  // ── Dumbbells / kettlebells ──
  'dumbbell-adjustable': {
    models: [
      { brand: 'PowerBlock', name: 'Elite / Pro' },
      { brand: 'Nüobell', name: 'Adjustable 80' },
      { brand: 'Bowflex', name: 'SelectTech 552' },
      { brand: 'Ironmaster', name: 'Quick-Lock' },
    ],
  },
  'kettlebell-cast': {
    models: [
      { brand: 'Rogue', name: 'Kettlebell' },
      { brand: 'Kettlebell Kings', name: 'Powder-Coat' },
    ],
  },
  'kettlebell-competition': {
    models: [
      { brand: 'Eleiko', name: 'Competition Kettlebell' },
      { brand: 'Kettlebell Kings', name: 'Competition' },
    ],
  },
  'kettlebell-adjustable': {
    models: [
      { brand: 'Bowflex', name: 'SelectTech 840' },
      { brand: 'Kettlebell Kings', name: 'Adjustable' },
    ],
  },

  // ── Plates ──
  'plate-bumper': {
    models: [
      { brand: 'Rogue', name: 'Echo / HG 2.0 Bumper' },
      { brand: 'Eleiko', name: 'XF Bumper' },
    ],
  },
  'plate-competition': {
    models: [
      { brand: 'Eleiko', name: 'IWF/IPF Competition Discs' },
      { brand: 'Rogue', name: 'Competition Plates' },
      { brand: 'Uesaka', name: 'Competition Discs' },
    ],
  },
  'plate-iron': {
    models: [
      { brand: 'Ivanko', name: 'OM/OMEZ' },
      { brand: 'Rogue', name: 'Machined Olympic Plate' },
    ],
  },

  // ── Racks ──
  'rack-power': {
    models: [
      { brand: 'Rogue', name: 'RML-390F Monster Lite' },
      { brand: 'Rogue', name: 'R-6 Monster' },
      { brand: 'Sorinex', name: 'XL' },
    ],
  },
  'smith-machine': {
    models: [
      { brand: 'Life Fitness', name: 'Signature Smith' },
      { brand: 'Matrix', name: 'Magnum Smith' },
      { brand: 'Hammer Strength', name: 'Smith' },
    ],
  },
  'rack-monolift': {
    models: [
      { brand: 'EliteFTS', name: 'Mono' },
      { brand: 'Sorinex', name: 'Monolift' },
    ],
  },
  'rack-rig': {
    models: [
      { brand: 'Rogue', name: 'Monster / Infinity Rig' },
      { brand: 'Eleiko', name: 'XF Rig' },
    ],
  },

  // ── Benches ──
  'bench-ghd': {
    models: [
      { brand: 'Rogue', name: 'Abram GHD 2.0' },
      { brand: 'Sorinex', name: 'GHD' },
    ],
  },
  'bench-reverse-hyper': {
    models: [
      { brand: 'Rogue', name: 'Reverse Hyper' },
      { brand: 'EliteFTS', name: 'Reverse Hyper' },
    ],
  },

  // ── Machines ──
  'm-leg-press': {
    models: [
      { brand: 'Cybex', name: 'Leg Press' },
      { brand: 'Hammer Strength', name: 'Linear Leg Press' },
      { brand: 'Life Fitness', name: 'Signature Leg Press' },
    ],
  },
  'm-lat-pulldown': {
    models: [
      { brand: 'Life Fitness', name: 'Signature Lat Pulldown' },
      { brand: 'Hammer Strength', name: 'Select Lat Pulldown' },
    ],
  },
  'm-hack-squat': {
    models: [
      { brand: 'Hammer Strength', name: 'Linear Hack Squat' },
      { brand: 'Panatta', name: 'Hack Squat' },
    ],
  },
  'm-glute': {
    models: [
      { brand: 'PRIME Fitness', name: 'Glute Drive' },
      { brand: 'Booty Builder', name: 'Machine' },
    ],
  },
  'm-pneumatic': {
    models: [
      { brand: 'Keiser', name: 'Air300 series' },
      { brand: 'HUR', name: 'Pneumatic' },
    ],
  },
  'm-vibration-plate': {
    models: [
      { brand: 'Power Plate', name: 'MOVE / pro7' },
      { brand: 'hypervibe', name: 'G17' },
    ],
  },
  'm-digital-trainer': {
    models: [
      { brand: 'Tonal', name: 'Tonal' },
      { brand: 'Vitruvian', name: 'Trainer+' },
      { brand: 'Speediance', name: 'Gym Monster' },
    ],
  },
  'm-reformer': {
    models: [
      { brand: 'Balanced Body', name: 'Allegro 2' },
      { brand: 'Merrithew', name: 'STOTT Reformer' },
    ],
  },

  // ── Plate-loaded ──
  'hs-iso-chest': { models: [{ brand: 'Hammer Strength', name: 'Iso-Lateral Bench Press' }] },
  'hs-iso-row': { models: [{ brand: 'Hammer Strength', name: 'Iso-Lateral Row' }] },
  'hs-iso-pulldown': {
    models: [{ brand: 'Hammer Strength', name: 'Iso-Lateral Front Lat Pulldown' }],
  },
  'hs-pendulum-squat': {
    models: [
      { brand: 'Panatta', name: 'Pendulum Squat' },
      { brand: 'Arsenal Strength', name: 'Pendulum Squat' },
    ],
  },
  'hs-belt-squat': {
    models: [
      { brand: 'Rogue', name: 'Rhino Belt Squat' },
      { brand: 'EliteFTS', name: 'Belt Squat' },
    ],
  },

  // ── Cable ──
  'cable-functional-trainer': {
    models: [
      { brand: 'Freemotion', name: 'Dual Cable Cross' },
      { brand: 'Life Fitness', name: 'Dual Adjustable Pulley' },
      { brand: 'Keiser', name: 'Functional Trainer' },
    ],
  },
  'cable-crossover': {
    models: [
      { brand: 'Life Fitness', name: 'Signature Cable Crossover' },
      { brand: 'Technogym', name: 'Pure Dual Adjustable' },
    ],
  },

  // ── Cardio ──
  'cardio-rower': {
    models: [
      { brand: 'Concept2', name: 'RowErg (Model D/E)' },
      { brand: 'Hydrow', name: 'Rower' },
    ],
  },
  'cardio-ski-erg': { models: [{ brand: 'Concept2', name: 'SkiErg' }] },
  'cardio-bike-erg': {
    models: [
      { brand: 'Concept2', name: 'BikeErg' },
      { brand: 'Wattbike', name: 'AtomX' },
    ],
  },
  'cardio-air-bike': {
    models: [
      { brand: 'Assault', name: 'AirBike Classic/Elite' },
      { brand: 'Rogue', name: 'Echo Bike' },
      { brand: 'Schwinn', name: 'Airdyne' },
    ],
  },
  'cardio-treadmill': {
    models: [
      { brand: 'Woodway', name: '4Front' },
      { brand: 'Life Fitness', name: 'Integrity' },
      { brand: 'Technogym', name: 'Skillrun' },
    ],
  },
  'cardio-curved-treadmill': {
    models: [
      { brand: 'Woodway', name: 'Curve' },
      { brand: 'TrueForm', name: 'Runner' },
      { brand: 'Assault', name: 'AirRunner' },
    ],
  },
  'cardio-spin-bike': {
    models: [
      { brand: 'Keiser', name: 'M3i' },
      { brand: 'Peloton', name: 'Bike / Bike+' },
    ],
  },
  'cardio-stairclimber': {
    models: [
      { brand: 'StairMaster', name: 'Gauntlet / 8G' },
      { brand: 'Life Fitness', name: 'PowerMill' },
    ],
  },
  'cardio-elliptical': {
    models: [
      { brand: 'Precor', name: 'EFX' },
      { brand: 'Life Fitness', name: 'Elliptical Cross-Trainer' },
    ],
  },
  'cardio-recumbent-stepper': { models: [{ brand: 'NuStep', name: 'T6 / T5XR' }] },
  'cardio-vertical-climber': { models: [{ brand: 'VersaClimber', name: 'SM / TS' }] },

  // ── Suspension / conditioning ──
  'suspension-trx': { models: [{ brand: 'TRX', name: 'PRO4 / HOME2 / GO' }] },
  'cond-sled': { models: [{ brand: 'Rogue', name: 'Dog Sled 1.2 / Butcher' }] },
  'cond-battle-ropes': { models: [{ brand: 'Rogue', name: 'Conditioning Rope' }] },
  'cond-mace': {
    models: [
      { brand: 'Onnit', name: 'Steel Mace' },
      { brand: 'Adex', name: 'Adjustable Mace' },
    ],
  },

  // ── Accessories ──
  'belt-pl-lever': {
    models: [
      { brand: 'SBD', name: 'Lever Belt' },
      { brand: 'Inzer', name: 'Forever Lever' },
      { brand: 'Pioneer', name: 'Cut Lever' },
    ],
  },
  'belt-pl-prong': {
    models: [
      { brand: 'Inzer', name: 'Forever 10mm/13mm' },
      { brand: 'Pioneer', name: 'Prong Belt' },
    ],
  },
  'strap-lasso': {
    models: [
      { brand: 'SBD', name: 'Lifting Straps' },
      { brand: 'Rogue', name: 'Ohio Lifting Straps' },
    ],
  },
  'acc-lifting-shoes': {
    models: [
      { brand: 'Adidas', name: 'Adipower' },
      { brand: 'Nike', name: 'Romaleos' },
      { brand: 'TYR', name: 'L-1 Lifter' },
    ],
  },
  'grip-gripper': { models: [{ brand: 'IronMind', name: 'Captains of Crush' }] },

  // ── Recovery ──
  'rec-massage-gun': {
    models: [
      { brand: 'Therabody', name: 'Theragun PRO/Elite' },
      { brand: 'Hyperice', name: 'Hypervolt 2' },
    ],
  },
  'rec-compression-boots': { models: [{ brand: 'Therabody', name: 'RecoveryAir / Normatec' }] },
  'rec-ems-tens': {
    models: [
      { brand: 'Compex', name: 'Sport Elite' },
      { brand: 'PowerDot', name: '2.0' },
      { brand: 'Marc Pro', name: 'Plus' },
    ],
  },
  'rec-foam-roller': {
    models: [
      { brand: 'TriggerPoint', name: 'GRID' },
      { brand: 'RumbleRoller', name: 'Textured' },
    ],
  },
};
