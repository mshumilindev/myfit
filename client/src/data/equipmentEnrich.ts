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

  // ── Barbells (more) ──
  'barbell-cambered': {
    models: [
      { brand: 'EliteFTS', name: 'Cambered Bar' },
      { brand: 'Rogue', name: 'Cambered Squat Bar' },
    ],
  },
  'barbell-buffalo': {
    models: [
      { brand: 'EliteFTS', name: 'Bow Bar' },
      { brand: 'Rogue', name: 'Cambered Swiss Bar' },
    ],
  },
  'barbell-technique': {
    models: [
      { brand: 'Rogue', name: 'Technique Bar' },
      { brand: 'Eleiko', name: 'Weightlifting Technique Bar' },
    ],
  },
  'barbell-junior': {
    models: [
      { brand: 'Rogue', name: 'Junior Bar' },
      { brand: 'Eleiko', name: 'Youth Bar' },
    ],
  },
  'barbell-multi-grip': {
    models: [
      { brand: 'Rogue', name: 'MG-3 Multi-Grip Bar' },
      { brand: 'Kabuki Strength', name: 'Kadillac Bar' },
    ],
  },
  'barbell-spider': { models: [{ brand: 'Rogue', name: 'Spider Bar' }] },
  'barbell-open-trap': {
    models: [
      { brand: 'Rogue', name: 'TB-2 Trap Bar' },
      { brand: 'Kabuki Strength', name: 'Trap Bar HD' },
    ],
  },
  'barbell-viking-press': {
    models: [
      { brand: 'Rogue', name: 'Viking Press' },
      { brand: 'EliteFTS', name: 'Viking Press' },
    ],
  },
  'barbell-tsunami': {
    models: [
      { brand: 'Tsunami Bar', name: 'Tsunami Bar' },
      { brand: 'Bandbell', name: 'Bamboo Bar' },
    ],
  },
  'barbell-fixed': {
    models: [
      { brand: 'Ivanko', name: 'Pro-Style Fixed Barbell' },
      { brand: 'Troy', name: 'Fixed Barbell' },
    ],
  },

  // ── Dumbbells / weights ──
  'dumbbell-fixed': {
    models: [
      { brand: 'Rogue', name: 'Rubber Hex Dumbbells' },
      { brand: 'Ivanko', name: 'Pro-Style' },
      { brand: 'Iron Grip', name: 'Urethane DB' },
    ],
  },
  'dumbbell-loadable': {
    models: [
      { brand: 'Ironmaster', name: 'Quick-Lock Handles' },
      { brand: 'Rogue', name: 'Loadable Dumbbell' },
    ],
  },
  'dumbbell-urethane': {
    models: [
      { brand: 'Life Fitness', name: 'Urethane Dumbbells' },
      { brand: 'Escape Fitness', name: 'Urethane DB' },
    ],
  },
  'weight-fixed-bar': {
    models: [
      { brand: 'Body-Solid', name: 'Fixed Weight Bar' },
      { brand: 'Troy', name: 'Studio Bar' },
    ],
  },

  // ── Kettlebells ──
  'kettlebell-urethane': {
    models: [
      { brand: 'Life Fitness', name: 'Urethane Kettlebell' },
      { brand: 'First Place', name: 'Rubber KB' },
    ],
  },
  'kb-loadable': {
    models: [
      { brand: 'Kettlebell Kings', name: 'Adjustable' },
      { brand: 'Stamina', name: 'Adjustable Kettle Versa-Bell' },
    ],
  },

  // ── Plates ──
  'plate-fractional': {
    models: [
      { brand: 'Rogue', name: 'Fractional Plates' },
      { brand: 'Eleiko', name: 'Fractional Discs' },
    ],
  },
  'plate-tri-grip': {
    models: [
      { brand: 'Rogue', name: 'Tri-Grip Plate' },
      { brand: 'Troy', name: 'Grip Plate' },
    ],
  },
  'plate-urethane': {
    models: [
      { brand: 'Eleiko', name: 'Vulcano Urethane' },
      { brand: 'Life Fitness', name: 'Urethane Plate' },
    ],
  },
  'plate-micro': {
    models: [
      { brand: 'PlateMate', name: 'Magnetic Add-On' },
      { brand: 'MicroGainz', name: 'Fractional' },
    ],
  },

  // ── Racks ──
  'rack-half': {
    models: [
      { brand: 'Rogue', name: 'HR-2 Half Rack' },
      { brand: 'REP Fitness', name: 'PR-4000 Half' },
    ],
  },
  'rack-squat-stand': {
    models: [
      { brand: 'Rogue', name: 'SML-2 Squat Stand' },
      { brand: 'REP Fitness', name: 'SR-4000' },
    ],
  },
  'rack-wall-mounted': {
    models: [
      { brand: 'Rogue', name: 'RML-3W Fold Back' },
      { brand: 'PRx Performance', name: 'Profile Rack' },
    ],
  },
  'rack-combo': {
    models: [
      { brand: 'Rogue', name: 'Combo Rack' },
      { brand: 'Eleiko', name: 'Powerlifting Combo Rack' },
    ],
  },
  'rack-lifting-platform': {
    models: [
      { brand: 'Rogue', name: 'Oly Platform' },
      { brand: 'Eleiko', name: 'Weightlifting Platform' },
    ],
  },

  // ── Benches ──
  'bench-flat': {
    models: [
      { brand: 'Rogue', name: 'Flat Utility Bench 2.0' },
      { brand: 'REP Fitness', name: 'FB-5000' },
    ],
  },
  'bench-adjustable': {
    models: [
      { brand: 'Rogue', name: 'AB-3 Adjustable' },
      { brand: 'REP Fitness', name: 'AB-5200' },
      { brand: 'Ironmaster', name: 'Super Bench' },
    ],
  },
  'bench-olympic': {
    models: [
      { brand: 'Rogue', name: 'Monster Olympic Bench' },
      { brand: 'EliteFTS', name: '0-90 Bench' },
    ],
  },
  'bench-seal-row': {
    models: [
      { brand: 'Rogue', name: 'Seal Row Bench' },
      { brand: 'PRIME Fitness', name: 'Seal Row' },
    ],
  },
  'bench-nordic': { models: [{ brand: 'Kabuki Strength', name: 'Nordic Bench' }] },

  // ── Machines (selectorized) ──
  'm-chest-press': {
    models: [
      { brand: 'Life Fitness', name: 'Signature Chest Press' },
      { brand: 'Hammer Strength', name: 'Select Chest Press' },
      { brand: 'Technogym', name: 'Selection Chest Press' },
    ],
  },
  'm-pec-deck': {
    models: [
      { brand: 'Nautilus', name: 'Pec Fly' },
      { brand: 'Life Fitness', name: 'Pec Fly / Rear Delt' },
    ],
  },
  'm-shoulder-press': {
    models: [
      { brand: 'Hammer Strength', name: 'Select Shoulder Press' },
      { brand: 'Life Fitness', name: 'Signature Shoulder Press' },
    ],
  },
  'm-lateral-raise': {
    models: [
      { brand: 'Hammer Strength', name: 'Select Lateral Raise' },
      { brand: 'Nautilus', name: 'Lateral Raise' },
    ],
  },
  'm-rear-delt': {
    models: [
      { brand: 'Life Fitness', name: 'Pec Fly / Rear Delt' },
      { brand: 'Hammer Strength', name: 'Select Rear Delt' },
    ],
  },
  'm-seated-row': {
    models: [
      { brand: 'Hammer Strength', name: 'Select Seated Row' },
      { brand: 'Life Fitness', name: 'Signature Row' },
    ],
  },
  'm-pullover': { models: [{ brand: 'Nautilus', name: 'Pullover' }] },
  'm-biceps-curl': {
    models: [
      { brand: 'Life Fitness', name: 'Signature Biceps Curl' },
      { brand: 'Hammer Strength', name: 'Select Biceps' },
    ],
  },
  'm-triceps-ext': {
    models: [
      { brand: 'Life Fitness', name: 'Signature Triceps' },
      { brand: 'Hammer Strength', name: 'Select Triceps' },
    ],
  },
  'm-leg-extension': {
    models: [
      { brand: 'Cybex', name: 'Leg Extension' },
      { brand: 'Hammer Strength', name: 'Select Leg Extension' },
      { brand: 'Life Fitness', name: 'Signature Leg Extension' },
    ],
  },
  'm-leg-curl-seated': {
    models: [
      { brand: 'Cybex', name: 'Seated Leg Curl' },
      { brand: 'Life Fitness', name: 'Signature Seated Leg Curl' },
    ],
  },
  'm-leg-curl-lying': {
    models: [
      { brand: 'Hammer Strength', name: 'Select Lying Leg Curl' },
      { brand: 'Cybex', name: 'Prone Leg Curl' },
    ],
  },
  'm-hip-adductor': {
    models: [
      { brand: 'Life Fitness', name: 'Signature Hip Adduction' },
      { brand: 'Technogym', name: 'Adductor' },
    ],
  },
  'm-hip-abductor': {
    models: [
      { brand: 'Life Fitness', name: 'Signature Hip Abduction' },
      { brand: 'Technogym', name: 'Abductor' },
    ],
  },
  'm-calf-seated': {
    models: [
      { brand: 'Hammer Strength', name: 'Seated Calf' },
      { brand: 'Cybex', name: 'Seated Calf' },
    ],
  },
  'm-calf-standing': {
    models: [
      { brand: 'Hammer Strength', name: 'Standing Calf' },
      { brand: 'Nautilus', name: 'Standing Calf' },
    ],
  },
  'm-ab-crunch': {
    models: [
      { brand: 'Technogym', name: 'Selection Abdominal Crunch' },
      { brand: 'Life Fitness', name: 'Signature Abdominal' },
    ],
  },
  'm-back-extension': {
    models: [
      { brand: 'Technogym', name: 'Lower Back' },
      { brand: 'Life Fitness', name: 'Signature Back Extension' },
    ],
  },
  'm-assisted-pullup': {
    models: [
      { brand: 'Life Fitness', name: 'Signature Assisted Pull-Up' },
      { brand: 'Cybex', name: 'Assisted Chin/Dip' },
      { brand: 'Hammer Strength', name: 'Select Assist' },
    ],
  },
  'm-multi-gym': {
    models: [
      { brand: 'Body-Solid', name: 'EXM Series' },
      { brand: 'Life Fitness', name: 'G7 Home Gym' },
      { brand: 'Marcy', name: 'Home Gym' },
    ],
  },
  'm-total-gym': { models: [{ brand: 'Total Gym', name: 'GTS / Elevate' }] },
  'm-pilates-chair': {
    models: [
      { brand: 'Balanced Body', name: 'EXO Chair' },
      { brand: 'Merrithew', name: 'STOTT Stability Chair' },
    ],
  },
  'm-isokinetic': {
    models: [
      { brand: 'Biodex', name: 'System 4' },
      { brand: 'CSMi', name: 'HUMAC NORM' },
    ],
  },

  // ── Plate-loaded (more) ──
  'hs-iso-incline': { models: [{ brand: 'Hammer Strength', name: 'Iso-Lateral Incline Press' }] },
  'hs-iso-highrow': { models: [{ brand: 'Hammer Strength', name: 'Iso-Lateral High Row' }] },
  'hs-iso-shoulder': { models: [{ brand: 'Hammer Strength', name: 'Iso-Lateral Shoulder Press' }] },
  'hs-iso-decline': { models: [{ brand: 'Hammer Strength', name: 'Iso-Lateral Decline Press' }] },
  'hs-iso-lowrow': { models: [{ brand: 'Hammer Strength', name: 'Iso-Lateral Low Row' }] },
  'hs-iso-frontlat': {
    models: [{ brand: 'Hammer Strength', name: 'Iso-Lateral Front Lat Pulldown' }],
  },
  'hs-tbar-row': {
    models: [
      { brand: 'Rogue', name: 'T-Bar Row Machine' },
      { brand: 'Legend Fitness', name: 'T-Bar Row' },
    ],
  },
  'hs-vertical-leg-press': {
    models: [
      { brand: 'Hammer Strength', name: 'V-Squat' },
      { brand: 'Nautilus', name: 'Vertical Leg Press' },
    ],
  },
  'hs-plate-row': {
    models: [
      { brand: 'Hammer Strength', name: 'Plate-Loaded Row' },
      { brand: 'Panatta', name: 'Seated Row' },
    ],
  },
  'hs-deadlift-machine': {
    models: [
      { brand: 'Hammer Strength', name: 'Deadlift Machine' },
      { brand: 'Panatta', name: 'Dead Squat' },
    ],
  },
  'hs-ground-base': { models: [{ brand: 'Hammer Strength', name: 'Ground Base Jammer' }] },
  'hs-plate-pullover': {
    models: [
      { brand: 'Nautilus', name: 'Plate-Loaded Pullover' },
      { brand: 'Panatta', name: 'Pullover' },
    ],
  },
  'hs-plate-calf': {
    models: [
      { brand: 'Hammer Strength', name: 'Plate-Loaded Calf' },
      { brand: 'Panatta', name: 'Calf' },
    ],
  },
  'hs-linear-leg-press': { models: [{ brand: 'Hammer Strength', name: 'Linear Leg Press' }] },
  'hs-seated-leg-press': { models: [{ brand: 'Cybex', name: 'Eagle NX Leg Press' }] },
  'hs-plate-shrug': {
    models: [
      { brand: 'Hammer Strength', name: 'Deadlift Shrug' },
      { brand: 'Panatta', name: 'Shrug' },
    ],
  },
  'hs-plate-leg-ext': {
    models: [
      { brand: 'Hammer Strength', name: 'Plate-Loaded Leg Extension' },
      { brand: 'Panatta', name: 'Leg Extension' },
      { brand: 'Watson', name: 'Leg Extension' },
    ],
  },
  'hs-plate-leg-curl': {
    models: [
      { brand: 'Hammer Strength', name: 'Plate-Loaded Leg Curl' },
      { brand: 'Panatta', name: 'Leg Curl' },
      { brand: 'Watson', name: 'Leg Curl' },
    ],
  },
  'hs-plate-hip-thrust': {
    models: [
      { brand: 'Booty Builder', name: 'Pro Hip Thrust' },
      { brand: 'Panatta', name: 'Hip Thrust' },
      { brand: 'Rogue', name: 'Hip Thrust' },
    ],
  },
  'hs-viking-machine': {
    models: [
      { brand: 'Panatta', name: 'Viking Press' },
      { brand: 'Rogue', name: 'Viking Press' },
    ],
  },
  'hs-plate-preacher': {
    models: [
      { brand: 'Hammer Strength', name: 'Plate-Loaded Preacher Curl' },
      { brand: 'Panatta', name: 'Arm Curl' },
    ],
  },

  // ── Cable (more) ──
  'cable-single-column': {
    models: [
      { brand: 'Freemotion', name: 'Cable Column' },
      { brand: 'Life Fitness', name: 'Signature Cable Column' },
    ],
  },
  'cable-lat-tower': {
    models: [
      { brand: 'Body-Solid', name: 'Pro Lat Machine' },
      { brand: 'Rogue', name: 'Lat Pulldown / Low Row' },
    ],
  },

  // ── Cardio (more) ──
  'cardio-upright-bike': {
    models: [
      { brand: 'Life Fitness', name: 'Integrity Upright' },
      { brand: 'Precor', name: 'UBK 800' },
    ],
  },
  'cardio-recumbent-bike': {
    models: [
      { brand: 'Life Fitness', name: 'Integrity Recumbent' },
      { brand: 'Precor', name: 'RBK 800' },
    ],
  },
  'cardio-water-rower': {
    models: [
      { brand: 'WaterRower', name: 'Classic / A1' },
      { brand: 'First Degree Fitness', name: 'Fluid Rower' },
    ],
  },
  'cardio-magnetic-rower': {
    models: [
      { brand: 'Aviron', name: 'Impact' },
      { brand: 'Ergatta', name: 'Rower' },
    ],
  },
  'cardio-ube': {
    models: [
      { brand: 'SciFit', name: 'PRO2' },
      { brand: 'Matrix', name: 'Krankcycle' },
    ],
  },
  'cardio-arc-trainer': { models: [{ brand: 'Cybex', name: 'Arc Trainer' }] },
  'cardio-skillmill': { models: [{ brand: 'Technogym', name: 'Skillmill' }] },
  'cardio-lateral-trainer': {
    models: [
      { brand: 'Helix', name: 'Lateral Trainer' },
      { brand: 'Octane Fitness', name: 'LateralX' },
    ],
  },
  'cardio-assault-runner': {
    models: [
      { brand: 'Assault', name: 'AirRunner' },
      { brand: 'TrueForm', name: 'Runner' },
    ],
  },
  'cardio-walking-pad': {
    models: [
      { brand: 'WalkingPad', name: 'A1 / P1' },
      { brand: 'Egofit', name: 'Walker Pro' },
    ],
  },
  'cardio-rebounder': {
    models: [
      { brand: 'JumpSport', name: 'Fitness Trampoline' },
      { brand: 'bellicon', name: 'Rebounder' },
    ],
  },

  // ── Suspension / bodyweight ──
  'gym-rings': {
    models: [
      { brand: 'Rogue', name: 'Wood Gymnastic Rings' },
      { brand: 'Vulcan', name: 'Gymnastic Rings' },
    ],
  },
  'pullup-bar': {
    models: [
      { brand: 'Rogue', name: 'P-4 Pull-Up System' },
      { brand: 'Iron Gym', name: 'Total Upper Body' },
    ],
  },
  'dip-station': {
    models: [
      { brand: 'Rogue', name: 'Matador' },
      { brand: 'Body-Solid', name: 'Dip Station' },
    ],
  },
  parallettes: {
    models: [
      { brand: 'Rogue', name: 'Parallettes' },
      { brand: 'Gornation', name: 'Parallettes' },
    ],
  },
  'gym-climbing-rope': { models: [{ brand: 'Rogue', name: 'Manila Climbing Rope' }] },
  'sus-power-tower': {
    models: [
      { brand: 'Body Champ', name: 'Power Tower' },
      { brand: 'Sportsroyals', name: 'Power Tower' },
    ],
  },
  'sus-doorway-bar': {
    models: [
      { brand: 'Iron Gym', name: 'Pull-Up Bar' },
      { brand: 'Perfect Fitness', name: 'Multi-Gym' },
    ],
  },

  // ── Conditioning / strongman / functional ──
  'cond-plyo-box': {
    models: [
      { brand: 'Rogue', name: 'Games Box / Foam Box' },
      { brand: 'REP Fitness', name: '3-in-1 Box' },
    ],
  },
  'cond-slam-ball': {
    models: [
      { brand: 'Rogue', name: 'Slam Ball' },
      { brand: 'Dynamax', name: 'Slam Ball' },
    ],
  },
  'cond-wall-ball': {
    models: [
      { brand: 'Dynamax', name: 'Medicine Ball' },
      { brand: 'Rogue', name: 'Wall Ball' },
    ],
  },
  'cond-jump-rope': {
    models: [
      { brand: 'RPM Fitness', name: 'Session4' },
      { brand: 'Rogue', name: 'SR-1 / SR-2' },
      { brand: 'Crossrope', name: 'Get Lean' },
    ],
  },
  'cond-sandbag': {
    models: [
      { brand: 'Rogue', name: 'Strongman Sandbag' },
      { brand: 'GORUCK', name: 'Sandbag' },
    ],
  },
  'cond-power-bag': {
    models: [
      { brand: 'Suples', name: 'Bulgarian Bag' },
      { brand: 'Brute Force', name: 'Sandbag' },
    ],
  },
  'cond-yoke': {
    models: [
      { brand: 'Rogue', name: 'SY-1 Yoke' },
      { brand: 'Cerberus', name: 'Yoke' },
    ],
  },
  'cond-log-bar': {
    models: [
      { brand: 'Rogue', name: 'Strongman Log' },
      { brand: 'Cerberus', name: 'Training Log' },
    ],
  },
  'cond-vipr': { models: [{ brand: 'ViPR', name: 'PRO' }] },
  'cond-clubbell': {
    models: [
      { brand: 'Onnit', name: 'Steel Club' },
      { brand: 'Adex', name: 'Club' },
    ],
  },
  'cond-deadball': {
    models: [
      { brand: 'Rogue', name: 'Strongman Dead Ball' },
      { brand: 'Brute Force', name: 'Dead Ball' },
    ],
  },
  'cond-aerobic-step': {
    models: [
      { brand: 'Reebok', name: 'Step' },
      { brand: 'The Step', name: 'Original' },
    ],
  },
  'cond-agility-ladder': { models: [{ brand: 'SKLZ', name: 'Quick Ladder' }] },
  'ball-medicine-bounce': {
    models: [
      { brand: 'Dynamax', name: 'Medicine Ball' },
      { brand: 'Rogue', name: 'Medicine Ball' },
    ],
  },

  // ── Combat / boxing ──
  'box-heavy-bag': {
    models: [
      { brand: 'Everlast', name: 'Heavy Bag' },
      { brand: 'Fairtex', name: 'Heavy Bag' },
      { brand: 'Title Boxing', name: 'Heavy Bag' },
    ],
  },
  'box-freestanding-bag': {
    models: [
      { brand: 'Century', name: 'Wavemaster' },
      { brand: 'Everlast', name: 'Freestanding Bag' },
    ],
  },
  'box-speed-bag': {
    models: [
      { brand: 'Everlast', name: 'Speed Bag' },
      { brand: 'Title Boxing', name: 'Speed Bag' },
    ],
  },
  'box-gloves': {
    models: [
      { brand: 'Winning', name: 'Training Gloves' },
      { brand: 'Fairtex', name: 'BGV1' },
      { brand: 'Everlast', name: 'Pro Style' },
    ],
  },
  'box-focus-mitts': {
    models: [
      { brand: 'Fairtex', name: 'Focus Mitts' },
      { brand: 'Cleto Reyes', name: 'Punch Mitts' },
    ],
  },
  'box-thai-pads': {
    models: [
      { brand: 'Fairtex', name: 'Thai Pads' },
      { brand: 'Twins Special', name: 'Kick Pads' },
    ],
  },

  // ── Recovery / mobility (more) ──
  'rec-lacrosse-ball': {
    models: [
      { brand: 'TriggerPoint', name: 'MobiPoint' },
      { brand: 'RAD', name: 'Roller' },
    ],
  },
  'rec-mobility-bands': {
    models: [
      { brand: 'RockTape', name: 'RockBand Flex' },
      { brand: 'EliteFTS', name: 'Pro Bands' },
    ],
  },
  'rec-mobility-stick': {
    models: [
      { brand: 'TheStick', name: 'Original' },
      { brand: 'TriggerPoint', name: 'STK' },
    ],
  },
  'rec-inversion-table': { models: [{ brand: 'Teeter', name: 'FitSpine' }] },
  'rec-cold-plunge': {
    models: [
      { brand: 'Plunge', name: 'The Plunge' },
      { brand: 'Ice Barrel', name: '400' },
    ],
  },
  'rec-sauna': {
    models: [
      { brand: 'Sunlighten', name: 'Infrared Sauna' },
      { brand: 'HigherDOSE', name: 'Sauna Blanket' },
    ],
  },
  'rec-bosu': { models: [{ brand: 'BOSU', name: 'Balance Trainer' }] },
  'rec-stability-ball': {
    models: [
      { brand: 'TheraBand', name: 'Exercise Ball' },
      { brand: 'Physio-Ball', name: 'Stability Ball' },
    ],
  },
  'rec-balance-board': {
    models: [
      { brand: 'Indo Board', name: 'Original' },
      { brand: 'Fitterfirst', name: 'Wobble Board' },
    ],
  },
  'yoga-block': {
    models: [
      { brand: 'Manduka', name: 'Cork Block' },
      { brand: 'Gaiam', name: 'Yoga Block' },
    ],
  },
  'yoga-wheel': { models: [{ brand: 'UpCircleSeven', name: 'Yoga Wheel' }] },

  // ── Accessories / gear (notable) ──
  'acc-ab-wheel': {
    models: [
      { brand: 'Perfect Fitness', name: 'Ab Carver Pro' },
      { brand: 'Rogue', name: 'Ab Wheel' },
    ],
  },
  'acc-dip-belt': {
    models: [
      { brand: 'Rogue', name: 'Dip Belt' },
      { brand: 'Spud Inc', name: 'Dip Belt' },
    ],
  },
  'acc-weight-vest': {
    models: [
      { brand: 'Rogue', name: 'Plate Carrier' },
      { brand: '5.11', name: 'TacTec' },
      { brand: 'Hyperwear', name: 'Hyper Vest' },
    ],
  },
  'acc-lifting-belt': {
    models: [
      { brand: 'Rogue', name: 'Ohio Lifting Belt' },
      { brand: '2POOD', name: 'Weightlifting Belt' },
    ],
  },
  'acc-straps': {
    models: [
      { brand: 'SBD', name: 'Lifting Straps' },
      { brand: 'Rogue', name: 'Ohio Lifting Straps' },
    ],
  },
  'aid-slingshot': { models: [{ brand: 'Sling Shot', name: 'Original / Maddog' }] },
  'aid-knee-sleeves': {
    models: [
      { brand: 'SBD', name: 'Knee Sleeves' },
      { brand: 'Rehband', name: 'RX Knee Sleeve' },
    ],
  },
  'aid-knee-wraps': {
    models: [
      { brand: 'Inzer', name: 'Iron Z Wraps' },
      { brand: 'SBD', name: 'Knee Wraps' },
    ],
  },
  'aid-wrist-wraps': {
    models: [
      { brand: 'SBD', name: 'Wrist Wraps' },
      { brand: 'Inzer', name: 'Gripper Wraps' },
    ],
  },
  'aid-elbow-sleeves': {
    models: [
      { brand: 'SBD', name: 'Elbow Sleeves' },
      { brand: 'Rehband', name: 'RX Elbow Sleeve' },
    ],
  },
  'belt-oly': {
    models: [
      { brand: 'Eleiko', name: 'Weightlifting Belt' },
      { brand: 'SBD', name: 'Weightlifting Belt' },
    ],
  },
  'belt-nylon': {
    models: [
      { brand: 'Harbinger', name: 'Nylon Belt' },
      { brand: 'Rogue', name: 'Nylon Lifting Belt' },
    ],
  },
  'strap-figure8': {
    models: [
      { brand: 'SBD', name: 'Figure 8 Straps' },
      { brand: 'Cerberus', name: 'Figure 8 Straps' },
    ],
  },
  'strap-hook': {
    models: [
      { brand: 'Versa Gripps', name: 'PRO' },
      { brand: 'Harbinger', name: 'Lifting Hooks' },
    ],
  },
  'strap-grips': { models: [{ brand: 'Versa Gripps', name: 'PRO' }] },
  'grip-wrist-roller': { models: [{ brand: 'Rogue', name: 'Wrist Roller' }] },
  'grip-rolling-thunder': { models: [{ brand: 'IronMind', name: 'Rolling Thunder' }] },
  'grip-pinch-block': { models: [{ brand: 'IronMind', name: 'Pinch Block' }] },
  'store-db-rack': {
    models: [
      { brand: 'Rogue', name: 'Dumbbell Storage' },
      { brand: 'Body-Solid', name: 'DB Rack' },
    ],
  },
  'store-plate-tree': {
    models: [
      { brand: 'Rogue', name: 'Plate Tree' },
      { brand: 'REP Fitness', name: 'Plate Tree' },
    ],
  },

  // ── Barbells (remaining) ──
  'barbell-curl-cambered': {
    models: [
      { brand: 'Rogue', name: 'Cambered Curl Bar' },
      { brand: 'Ivanko', name: 'Super Curl Bar' },
    ],
  },
  'barbell-curl-fixed': {
    models: [
      { brand: 'Troy', name: 'Fixed Curl Bars' },
      { brand: 'Ivanko', name: 'Fixed EZ Curl' },
    ],
  },
  'barbell-bench-specialist': {
    models: [
      { brand: 'Rogue', name: 'Ohio Power Bar' },
      { brand: 'Texas Power Bars', name: 'Texas Bench Bar' },
    ],
  },

  // ── Dumbbells ──
  'dumbbell-studio': {
    models: [
      { brand: 'SPRI', name: 'Vinyl Dumbbells' },
      { brand: 'Body-Solid', name: 'Vinyl Dumbbells' },
    ],
  },
  'dumbbell-spinlock': {
    models: [
      { brand: 'Marcy', name: 'Spinlock Handles' },
      { brand: 'CAP Barbell', name: 'Spinlock Set' },
    ],
  },
  'grip-globe-db': {
    models: [
      { brand: 'Rogue', name: 'Globe Dumbbells' },
      { brand: 'IronMind', name: 'Globe Dumbbell' },
    ],
  },

  // ── Kettlebells ──
  'kb-powder-coat': {
    models: [
      { brand: 'Rogue', name: 'Kettlebell' },
      { brand: 'Kettlebell Kings', name: 'Powder Coat' },
    ],
  },

  // ── Plates ──
  'plate-technique': {
    models: [
      { brand: 'Eleiko', name: 'XF Training Plate' },
      { brand: 'Rogue', name: 'Technique Plate' },
    ],
  },

  // ── Racks ──
  'rack-jerk-blocks': {
    models: [
      { brand: 'Rogue', name: 'Jerk Blocks' },
      { brand: 'Eleiko', name: 'Jerk Blocks' },
    ],
  },
  'rack-pulling-blocks': {
    models: [
      { brand: 'Rogue', name: 'Pull Blocks' },
      { brand: 'EliteFTS', name: 'Pulling Blocks' },
    ],
  },

  // ── Benches ──
  'bench-decline': {
    models: [
      { brand: 'Rogue', name: 'Decline Bench' },
      { brand: 'Body-Solid', name: 'Decline Bench' },
    ],
  },
  'bench-preacher': {
    models: [
      { brand: 'Body-Solid', name: 'Preacher Curl Bench' },
      { brand: 'Legend Fitness', name: 'Preacher Curl' },
    ],
  },
  'bench-hyper-45': {
    models: [
      { brand: 'Rogue', name: '45° Hyper' },
      { brand: 'Titan Fitness', name: '45 Degree Hyper' },
    ],
  },
  'bench-ab': {
    models: [
      { brand: 'Rogue', name: 'Ab Bench' },
      { brand: 'Body-Solid', name: 'Ab Board' },
    ],
  },
  'bench-seated-shoulder': {
    models: [
      { brand: 'Body-Solid', name: 'Shoulder Press Bench' },
      { brand: 'Rogue', name: 'Vertical Bench' },
    ],
  },
  'bench-roman-chair': {
    models: [
      { brand: 'Rogue', name: 'Roman Chair' },
      { brand: 'Titan Fitness', name: 'Roman Chair' },
    ],
  },

  // ── Machines (remaining) ──
  'm-rotary-torso': {
    models: [
      { brand: 'Life Fitness', name: 'Signature Rotary Torso' },
      { brand: 'Technogym', name: 'Rotary Torso' },
    ],
  },
  'm-neck': {
    models: [
      { brand: 'Hammer Strength', name: 'Four-Way Neck' },
      { brand: 'Nautilus', name: '4-Way Neck' },
    ],
  },
  'm-incline-press': {
    models: [
      { brand: 'Hammer Strength', name: 'Select Incline Press' },
      { brand: 'Life Fitness', name: 'Signature Incline Press' },
    ],
  },
  'm-decline-press': {
    models: [
      { brand: 'Hammer Strength', name: 'Select Decline Press' },
      { brand: 'Panatta', name: 'Decline Press' },
    ],
  },
  'm-converging-press': {
    models: [
      { brand: 'Life Fitness', name: 'Insignia Converging Chest' },
      { brand: 'Precor', name: 'Converging Chest Press' },
    ],
  },
  'm-seated-dip': {
    models: [
      { brand: 'Hammer Strength', name: 'Seated Dip' },
      { brand: 'Cybex', name: 'Dip' },
    ],
  },
  'm-front-raise': { models: [{ brand: 'Panatta', name: 'Front Raise' }] },
  'm-shrug': {
    models: [
      { brand: 'Hammer Strength', name: 'Shrug' },
      { brand: 'Nautilus', name: 'Shrug' },
    ],
  },
  'm-cable-crunch-station': {
    models: [
      { brand: 'Life Fitness', name: 'Signature Abdominal' },
      { brand: 'Technogym', name: 'Abdominal Crunch' },
    ],
  },
  'm-oblique': {
    models: [
      { brand: 'Nautilus', name: 'Oblique' },
      { brand: 'Technogym', name: 'Rotary Torso' },
    ],
  },
  'm-multi-hip': {
    models: [
      { brand: 'Cybex', name: 'Multi-Hip' },
      { brand: 'Life Fitness', name: 'Multi-Hip' },
    ],
  },
  'm-standing-leg-curl': {
    models: [
      { brand: 'Precor', name: 'Standing Leg Curl' },
      { brand: 'Cybex', name: 'Standing Leg Curl' },
    ],
  },
  'm-single-leg-press': {
    models: [
      { brand: 'Cybex', name: 'Single Leg Press' },
      { brand: 'Hammer Strength', name: 'Iso Single Leg Press' },
    ],
  },
  'm-tibialis': {
    models: [
      { brand: 'Panatta', name: 'Tibia' },
      { brand: 'ATG', name: 'Tib Bar' },
    ],
  },
  'm-wrist-forearm': {
    models: [
      { brand: 'Panatta', name: 'Forearm' },
      { brand: 'IronMind', name: 'Forearm Machine' },
    ],
  },
  'm-hip-thrust': {
    models: [
      { brand: 'Technogym', name: 'Pure Glute' },
      { brand: 'Booty Builder', name: 'Machine' },
      { brand: 'Life Fitness', name: 'Glute' },
    ],
  },
  'm-adj-cable-crunch': {
    models: [
      { brand: 'Technogym', name: 'Kinesis' },
      { brand: 'Freemotion', name: 'Functional Trainer' },
    ],
  },
  'm-sissy-squat': {
    models: [
      { brand: 'Panatta', name: 'Sissy Squat' },
      { brand: 'Body-Solid', name: 'Sissy Squat' },
    ],
  },
  'm-ab-coaster': { models: [{ brand: 'Ab Coaster', name: 'CS3000 / Max' }] },

  // ── Plate-loaded (remaining) ──
  'hs-iso-biceps': {
    models: [
      { brand: 'Hammer Strength', name: 'Plate-Loaded Biceps' },
      { brand: 'Panatta', name: 'Arm Curl' },
    ],
  },
  'hs-iso-triceps': {
    models: [
      { brand: 'Hammer Strength', name: 'Plate-Loaded Triceps' },
      { brand: 'Panatta', name: 'Triceps' },
    ],
  },
  'hs-super-row': {
    models: [
      { brand: 'Hammer Strength', name: 'Plate-Loaded Row' },
      { brand: 'Panatta', name: 'Super Row' },
    ],
  },

  // ── Cable (remaining) ──
  'cable-crossover-cage': {
    models: [
      { brand: 'REP Fitness', name: 'Ares 2.0' },
      { brand: 'Rogue', name: 'Cable Attachment' },
    ],
  },
  'cable-wall-pulley': {
    models: [
      { brand: 'Freemotion', name: 'Cable Column' },
      { brand: 'Rogue', name: 'Wall Pulley' },
    ],
  },
  'cable-crossover-half': {
    models: [
      { brand: 'REP Fitness', name: 'Ares' },
      { brand: 'Force USA', name: 'MyRack' },
    ],
  },

  // ── Cardio (remaining) ──
  'cardio-rope-trainer': {
    models: [
      { brand: 'Ropeflex', name: 'RX2500' },
      { brand: 'Marpo', name: 'VLT / Rope Trainer' },
    ],
  },
  'cardio-mini-stepper': {
    models: [
      { brand: 'Sunny Health', name: 'Mini Stepper' },
      { brand: 'Xiser', name: 'Commercial' },
    ],
  },
  'cardio-aqua-bike': {
    models: [
      { brand: 'Hydrorider', name: 'Aquabike' },
      { brand: 'SciFit', name: 'Inclusive Fitness' },
    ],
  },

  // ── Bands ──
  'band-loop-power': {
    models: [
      { brand: 'Rogue', name: 'Monster Bands' },
      { brand: 'EliteFTS', name: 'Pro Bands' },
      { brand: 'WODFitters', name: 'Resistance Bands' },
    ],
  },
  'band-mini': {
    models: [
      { brand: 'Rogue', name: 'Monster Mini Bands' },
      { brand: 'Perform Better', name: 'Mini Band' },
    ],
  },
  'band-tube-handles': {
    models: [
      { brand: 'Bodylastics', name: 'Resistance Tubes' },
      { brand: 'SPRI', name: 'Xertube' },
    ],
  },
  'band-therapy': {
    models: [
      { brand: 'TheraBand', name: 'Resistance Band' },
      { brand: 'Perform Better', name: 'Exercise Band' },
    ],
  },
  'band-hip-circle': {
    models: [
      { brand: 'Sling Shot', name: 'Hip Circle' },
      { brand: 'Rogue', name: 'Mighty Band' },
    ],
  },
  'band-deadlift': {
    models: [
      { brand: 'EliteFTS', name: 'Pro Resistance Bands' },
      { brand: 'Rogue', name: 'Monster Bands' },
    ],
  },
  'band-clip-set': {
    models: [
      { brand: 'Bodylastics', name: 'Clip Tube Set' },
      { brand: 'Undersun', name: 'Fitness Bands' },
    ],
  },
  'band-pull-apart': {
    models: [
      { brand: 'TheraBand', name: 'Loop' },
      { brand: 'Rogue', name: 'Mobility Band' },
    ],
  },

  // ── Suspension / gymnastics (remaining) ──
  'gym-peg-board': { models: [{ brand: 'Rogue', name: 'Peg Board' }] },
  'gym-monkey-bars': { models: [{ brand: 'Rogue', name: 'Monster Monkey Bars' }] },
  'gym-salmon-ladder': { models: [{ brand: 'Rogue', name: 'Salmon Ladder' }] },
  'gym-nordic-anchor': {
    models: [
      { brand: 'Rogue', name: 'Nordic / GHR Strap' },
      { brand: 'Kabuki Strength', name: 'Nordic' },
    ],
  },
  'sus-stall-bars': {
    models: [
      { brand: 'NOHrD', name: 'WallBars' },
      { brand: 'Artimex', name: 'Stall Bars' },
    ],
  },
  'sus-aerial-straps': {
    models: [
      { brand: 'Uplift Active', name: 'Aerial Yoga Hammock' },
      { brand: 'Aerial Essentials', name: 'Silks' },
    ],
  },
  'sus-parallel-bars': {
    models: [
      { brand: 'Gymnova', name: 'Parallel Bars' },
      { brand: 'Rogue', name: 'Parallel Bars' },
    ],
  },

  // ── Conditioning / strongman / speed (remaining) ──
  'cond-sledgehammer-tire': { models: [{ brand: 'Rogue', name: 'Strength Sledgehammer' }] },
  'cond-atlas-stones': {
    models: [
      { brand: 'Slater Hardware', name: 'Stone Molds' },
      { brand: 'Rogue', name: 'Atlas Stone Molds' },
    ],
  },
  'cond-keg': {
    models: [
      { brand: 'Rogue', name: 'Strongman Keg' },
      { brand: 'Cerberus', name: 'Training Keg' },
    ],
  },
  'cond-circus-db': {
    models: [
      { brand: 'Rogue', name: 'Circus Dumbbell' },
      { brand: 'Cerberus', name: 'Circus Dumbbell' },
    ],
  },
  'cond-husafell': {
    models: [
      { brand: 'Rogue', name: 'Husafell Stone' },
      { brand: 'Cerberus', name: 'Husafell Bag' },
    ],
  },
  'cond-hurdles': {
    models: [
      { brand: 'SKLZ', name: 'Speed Hurdles' },
      { brand: 'Rogue', name: 'Plyo Hurdles' },
    ],
  },
  'ball-toning': {
    models: [
      { brand: 'SPRI', name: 'Toning Ball' },
      { brand: 'TheraBand', name: 'Soft Weight' },
    ],
  },
  'ball-sandbell': { models: [{ brand: 'Hyperwear', name: 'SandBell' }] },
  'ball-reaction': { models: [{ brand: 'SKLZ', name: 'Reaction Ball' }] },
  'ball-power-plyo': {
    models: [
      { brand: 'Dynamax', name: 'Medicine Ball' },
      { brand: 'Rogue', name: 'Med Ball' },
    ],
  },
  'box-double-end': {
    models: [
      { brand: 'Everlast', name: 'Double-End Bag' },
      { brand: 'Title Boxing', name: 'Double-End' },
    ],
  },
  'box-grappling-dummy': {
    models: [
      { brand: 'Combat Sports', name: 'Grappling Dummy' },
      { brand: 'Century', name: 'Grappling Dummy' },
    ],
  },
  'spd-parachute': {
    models: [
      { brand: 'SKLZ', name: 'Speed Chute' },
      { brand: 'Rogue', name: 'Speed Chute' },
    ],
  },
  'spd-sled-harness': {
    models: [
      { brand: 'Rogue', name: 'Sled Harness' },
      { brand: 'SKLZ', name: 'Sled Harness' },
    ],
  },
  'spd-reaction-lights': {
    models: [
      { brand: 'BlazePod', name: 'Flash Reflex' },
      { brand: 'FITLIGHT', name: 'Trainer' },
    ],
  },
  'spd-cones-dots': {
    models: [
      { brand: 'SKLZ', name: 'Agility Cones' },
      { brand: 'Rogue', name: 'Agility Cones' },
    ],
  },
  'spd-resistance-belt': {
    models: [
      { brand: 'SKLZ', name: 'Acceleration Trainer' },
      { brand: 'Rogue', name: 'Resistance Belt' },
    ],
  },
  'cond-aqua-bag': {
    models: [
      { brand: 'Kamagon', name: 'Ball' },
      { brand: 'Aqua Training Bag', name: 'Aqua Bag' },
    ],
  },
  'cond-starting-blocks': {
    models: [
      { brand: 'Gill Athletics', name: 'Starting Blocks' },
      { brand: 'SKLZ', name: 'Starting Blocks' },
    ],
  },
  'cond-weighted-hoop': {
    models: [
      { brand: 'Sports Hoop', name: 'Weighted Hoop' },
      { brand: 'Dynamis', name: 'Smart Hoop' },
    ],
  },
  'cond-power-wheel': { models: [{ brand: 'Lifeline', name: 'Power Wheel' }] },

  // ── Accessories: cable attachments & handles ──
  'acc-lat-bar': {
    models: [
      { brand: 'Rogue', name: 'Lat Bar' },
      { brand: 'Body-Solid', name: 'Lat Bar' },
    ],
  },
  'acc-row-handle': {
    models: [
      { brand: 'Rogue', name: 'V-Handle' },
      { brand: 'Spud Inc', name: 'Pulley Row Handle' },
    ],
  },
  'acc-rope': {
    models: [
      { brand: 'Rogue', name: 'Triceps Rope' },
      { brand: 'Spud Inc', name: 'Tricep Rope' },
    ],
  },
  'acc-ez-cable-bar': {
    models: [
      { brand: 'Rogue', name: 'EZ Curl Cable Bar' },
      { brand: 'Body-Solid', name: 'Curl Bar' },
    ],
  },
  'acc-ankle-strap': {
    models: [
      { brand: 'Spud Inc', name: 'Ankle Strap' },
      { brand: 'Rogue', name: 'Ankle Strap' },
    ],
  },
  'acc-fat-grips': {
    models: [
      { brand: 'Fat Gripz', name: 'Original / Extreme' },
      { brand: 'Rogue', name: 'Fat Grips' },
    ],
  },
  'acc-glute-band-pad': {
    models: [
      { brand: 'Hampton', name: 'Barbell Pad' },
      { brand: 'Rogue', name: 'Barbell Pad' },
    ],
  },
  'acc-landmine-attach': {
    models: [
      { brand: 'Rogue', name: 'Landmine Attachments' },
      { brand: 'PRIME Fitness', name: 'Landmine Handle' },
    ],
  },
  'rack-deadlift-jack': {
    models: [
      { brand: 'Rogue', name: 'Deadlift Bar Jack' },
      { brand: 'Cerberus', name: 'Deadlift Jack' },
    ],
  },
  'acc-mag-grip': {
    models: [
      { brand: 'MAG Grip', name: 'Cable Attachments' },
      { brand: 'PRIME Fitness', name: 'Handles' },
    ],
  },
  'acc-d-handle': {
    models: [
      { brand: 'Rogue', name: 'Single D Handle' },
      { brand: 'Spud Inc', name: 'D Handle' },
    ],
  },
  'acc-straight-bar': {
    models: [
      { brand: 'Rogue', name: 'Straight Bar' },
      { brand: 'Body-Solid', name: 'Straight Bar' },
    ],
  },
  'acc-triangle': {
    models: [
      { brand: 'Rogue', name: 'Close Grip Handle' },
      { brand: 'Body-Solid', name: 'Triangle Handle' },
    ],
  },
  'acc-multi-grip-row': {
    models: [
      { brand: 'PRIME Fitness', name: 'Handles' },
      { brand: 'Rogue', name: 'MSA Handle' },
    ],
  },
  'acc-stirrup': {
    models: [
      { brand: 'Rogue', name: 'Stirrup Handle' },
      { brand: 'Body-Solid', name: 'Nylon Handle' },
    ],
  },
  'band-pegs': {
    models: [
      { brand: 'Rogue', name: 'Band Pegs' },
      { brand: 'Titan Fitness', name: 'Band Pegs' },
    ],
  },
  'grip-thick-handle': {
    models: [
      { brand: 'Rogue', name: 'Fat Bar Handle' },
      { brand: 'IronMind', name: 'Loadable Thick Handle' },
    ],
  },
  'grip-hub': { models: [{ brand: 'IronMind', name: 'Hub' }] },
  'acc-lat-bar-wide': {
    models: [
      { brand: 'Rogue', name: 'Curl Lat Bar' },
      { brand: 'Body-Solid', name: 'Wide Lat Bar' },
    ],
  },
  'acc-lat-bar-short': {
    models: [
      { brand: 'Rogue', name: 'Neutral Grip Lat Bar' },
      { brand: 'PRIME Fitness', name: 'Extreme Row Handle' },
    ],
  },
  'acc-pushdown-bar': {
    models: [
      { brand: 'Rogue', name: 'Pushdown Bar' },
      { brand: 'Body-Solid', name: 'Pro-Grip Bar' },
    ],
  },
  'acc-revolving-curl-bar': {
    models: [
      { brand: 'Rogue', name: 'Revolving Curl Bar' },
      { brand: 'Body-Solid', name: 'Revolving Curl Bar' },
    ],
  },
  'acc-double-d': {
    models: [
      { brand: 'Rogue', name: 'Double D Handle' },
      { brand: 'Spud Inc', name: 'Low Row Handle' },
    ],
  },
  'acc-rotating-handle': {
    models: [
      { brand: 'PRIME Fitness', name: 'Rotating Handle' },
      { brand: 'Rogue', name: 'Rotating Handle' },
    ],
  },
  'acc-globe-handle': {
    models: [
      { brand: 'Rogue', name: 'Globe Handles' },
      { brand: 'IronMind', name: 'Globe Handle' },
    ],
  },
  'acc-pro-handle': { models: [{ brand: 'PRIME Fitness', name: 'Pro Handle' }] },
  'acc-tricep-v': {
    models: [
      { brand: 'Rogue', name: 'V-Bar' },
      { brand: 'Body-Solid', name: 'V-Bar' },
    ],
  },
  'acc-row-footplate': { models: [{ brand: 'Rogue', name: 'Row Footplate' }] },
  'acc-loading-pin': {
    models: [
      { brand: 'Rogue', name: 'Loading Pin' },
      { brand: 'Spud Inc', name: 'Loading Pin' },
    ],
  },
  'acc-carabiner': {
    models: [
      { brand: 'Rogue', name: 'Carabiner' },
      { brand: 'Spud Inc', name: 'Carabiner' },
    ],
  },
  'acc-hip-belt-cable': {
    models: [
      { brand: 'Spud Inc', name: 'Econo Hip Belt' },
      { brand: 'Rogue', name: 'Dip / Belt Squat Belt' },
    ],
  },
  'sus-ab-straps': {
    models: [
      { brand: 'Rogue', name: 'Ab Straps' },
      { brand: 'Spud Inc', name: 'Ab Straps' },
    ],
  },
  'store-kb-rack': {
    models: [
      { brand: 'Rogue', name: 'Ball / KB Storage' },
      { brand: 'Body-Solid', name: 'KB Rack' },
    ],
  },
  'acc-band-peg-storage': {
    models: [
      { brand: 'Rogue', name: 'Bar / Accessory Storage' },
      { brand: 'Titan Fitness', name: 'Storage Rack' },
    ],
  },

  // ── Accessories: grip / strongman feats ──
  'grip-blob': { models: [{ brand: 'IronMind', name: 'Blob' }] },

  // ── Accessories: powerlifting supports / boards ──
  'pl-board-press': {
    models: [
      { brand: 'EliteFTS', name: 'Bench Boards' },
      { brand: 'Rogue', name: 'Bench Board' },
    ],
  },
  'pl-bench-blocks': {
    models: [
      { brand: 'EliteFTS', name: 'Bench Blocks' },
      { brand: 'Rogue', name: 'Bar Blocks' },
    ],
  },
  'pl-deadlift-platform': {
    models: [
      { brand: 'Rogue', name: 'Deadlift Platform' },
      { brand: 'EliteFTS', name: 'Drop Pads' },
    ],
  },
  'strap-oly': {
    models: [
      { brand: 'SBD', name: 'Weightlifting Straps' },
      { brand: 'Cerberus', name: 'Snatch Straps' },
    ],
  },
  'acc-neck-harness': {
    models: [
      { brand: 'Rogue', name: 'Neck Harness' },
      { brand: 'IronMind', name: 'Head Strap' },
    ],
  },
  'acc-arm-blaster': {
    models: [
      { brand: 'Hyperlethal', name: 'Arm Blaster' },
      { brand: 'Rogue', name: 'Arm Blaster' },
    ],
  },
  'acc-gym-grips': {
    models: [
      { brand: 'Bear KompleX', name: 'Hand Grips' },
      { brand: 'Victory Grips', name: 'Grips' },
      { brand: 'WODies', name: 'Grips' },
    ],
  },
  'acc-heel-wedge': {
    models: [
      { brand: 'StrongTek', name: 'Squat Wedge' },
      { brand: 'Rogue', name: 'Squat Wedge' },
    ],
  },
  'acc-ab-mat': {
    models: [
      { brand: 'Rogue', name: 'Ab Mat' },
      { brand: 'GoFit', name: 'Ab Mat' },
    ],
  },
  'acc-pushup-bars': {
    models: [
      { brand: 'Perfect Fitness', name: 'Pushup Elite' },
      { brand: 'Rogue', name: 'Push-Up Bars' },
    ],
  },
  'acc-weight-releasers': {
    models: [
      { brand: 'EliteFTS', name: 'Weight Releasers' },
      { brand: 'Rogue', name: 'Weight Releasers' },
    ],
  },
  'acc-lifting-chains': {
    models: [
      { brand: 'Rogue', name: 'Lifting Chains' },
      { brand: 'EliteFTS', name: 'Chain Package' },
    ],
  },
  'acc-gym-timer': {
    models: [
      { brand: 'GymNext', name: 'Flex Timer' },
      { brand: 'Rogue', name: 'Echo Gym Timer' },
    ],
  },
  'acc-deadlift-socks': {
    models: [
      { brand: 'SBD', name: 'Deadlift Socks' },
      { brand: 'Rogue', name: 'Shin Sleeves' },
    ],
  },
  'acc-ankle-weights': {
    models: [
      { brand: 'Bala', name: 'Bangles' },
      { brand: 'Nordic Lifting', name: 'Ankle Weights' },
    ],
  },
  'acc-band-door-anchor': {
    models: [
      { brand: 'Bodylastics', name: 'Door Anchor' },
      { brand: 'Undersun', name: 'Door Anchor' },
    ],
  },
  'acc-ceiling-anchor': {
    models: [
      { brand: 'TRX', name: 'Xmount' },
      { brand: 'Rogue', name: 'Ceiling Anchor' },
    ],
  },
  'acc-hand-grips-pads': {
    models: [
      { brand: 'Harbinger', name: 'Grip Pads' },
      { brand: 'Cobra Grips', name: 'Pro' },
    ],
  },

  // ── Accessories: consumables ──
  'acc-chalk': {
    models: [
      { brand: 'Rogue', name: 'Gym Chalk' },
      { brand: 'Friction Labs', name: 'Unicorn Dust' },
    ],
  },
  'acc-liquid-chalk': {
    models: [
      { brand: 'Friction Labs', name: 'Secret Stuff' },
      { brand: 'Rogue', name: 'Liquid Chalk' },
    ],
  },

  // ── Recovery / mobility (remaining) ──
  'rec-stretch-mat': {
    models: [
      { brand: 'Manduka', name: 'PRO Mat' },
      { brand: 'Gaiam', name: 'Yoga Mat' },
    ],
  },
  'rec-stretch-strap': {
    models: [
      { brand: 'OPTP', name: 'Stretch Out Strap' },
      { brand: 'Gaiam', name: 'Stretch Strap' },
    ],
  },
  'ball-mini-stability': {
    models: [
      { brand: 'TheraBand', name: 'Mini Ball' },
      { brand: 'Gaiam', name: 'Mini Ball' },
    ],
  },
  'mob-slant-board': {
    models: [
      { brand: 'StrongTek', name: 'Slant Board' },
      { brand: 'Vive', name: 'Slant Board' },
    ],
  },
  'mob-balance-pad': {
    models: [
      { brand: 'Airex', name: 'Balance Pad' },
      { brand: 'TheraBand', name: 'Stability Trainer' },
    ],
  },
  'mob-foot-roller': {
    models: [
      { brand: 'TriggerPoint', name: 'Nano Foot Roller' },
      { brand: 'RAD', name: 'Roller' },
    ],
  },
  'rec-vibrating-roller': {
    models: [
      { brand: 'Hyperice', name: 'Vyper 3' },
      { brand: 'TriggerPoint', name: 'Carbon Vibe' },
    ],
  },
  'rec-yoga-bolster': {
    models: [
      { brand: 'Manduka', name: 'Enlight Bolster' },
      { brand: 'Hugger Mugger', name: 'Bolster' },
    ],
  },
  'rec-massage-table': {
    models: [
      { brand: 'Earthlite', name: 'Massage Table' },
      { brand: 'NRG', name: 'Massage Table' },
    ],
  },
  'rec-red-light': {
    models: [
      { brand: 'Joovv', name: 'Solo / Elite' },
      { brand: 'Mito Red Light', name: 'Panel' },
    ],
  },
  'rec-hanging-boots': { models: [{ brand: 'Teeter', name: 'Gravity Boots' }] },
  'rec-cupping': {
    models: [
      { brand: 'RockTape', name: 'RockPods' },
      { brand: 'Graston', name: 'IASTM Tools' },
    ],
  },
  'rec-therapy-putty': {
    models: [
      { brand: 'TheraPutty', name: 'Hand Putty' },
      { brand: 'TheraBand', name: 'Hand Xtrainer' },
    ],
  },
  'rec-shoulder-pulley': {
    models: [
      { brand: 'RANGEMASTER', name: 'Shoulder Pulley' },
      { brand: 'Vive', name: 'Shoulder Pulley' },
    ],
  },
  'rec-stretch-table': {
    models: [
      { brand: 'StretchLab', name: 'Stretch Table' },
      { brand: 'Nimble', name: 'Stretch Cage' },
    ],
  },
  'rec-cold-compression': {
    models: [
      { brand: 'Game Ready', name: 'GRPro 2.1' },
      { brand: 'Breg', name: 'Polar Care' },
    ],
  },
  'rec-peanut-ball': {
    models: [
      { brand: 'TriggerPoint', name: 'MB2 Roller' },
      { brand: 'RAD', name: 'Helix' },
    ],
  },
  // ── Accessories: collars ──
  'acc-collars-spring': {
    models: [
      { brand: 'Rogue', name: 'Spring Collars' },
      { brand: 'Ivanko', name: 'Spring Collars' },
    ],
  },
  'acc-collars-comp': {
    models: [
      { brand: 'Rogue', name: 'USAW / Comp Collars' },
      { brand: 'OSO Barbell', name: 'Bexco Collars' },
      { brand: 'Lock-Jaw', name: 'Pro' },
    ],
  },

  // ── Rack attachments / climbing / balance (tranche 6) ──
  'rack-jhooks': {
    models: [
      { brand: 'Rogue', name: 'J-Cups' },
      { brand: 'REP Fitness', name: 'J-Cups' },
    ],
  },
  'rack-spotter-arms': {
    models: [
      { brand: 'Rogue', name: 'Safety Spotter Arms' },
      { brand: 'REP Fitness', name: 'Spotter Arms' },
    ],
  },
  'rack-safety-straps': {
    models: [
      { brand: 'Rogue', name: 'Strap Safety System' },
      { brand: 'EliteFTS', name: 'Strap Safeties' },
    ],
  },
  'rack-pullup-attach': {
    models: [
      { brand: 'Rogue', name: 'Pull-Up Bar Attachment' },
      { brand: 'REP Fitness', name: 'Pull-Up Bar' },
    ],
  },
  'rack-dip-attach': {
    models: [
      { brand: 'Rogue', name: 'Matador Dip' },
      { brand: 'Titan Fitness', name: 'Dip Attachment' },
    ],
  },
  'rack-plate-horns': {
    models: [
      { brand: 'Rogue', name: 'Plate Horns' },
      { brand: 'REP Fitness', name: 'Plate Storage Posts' },
    ],
  },
  'grip-hangboard': {
    models: [
      { brand: 'Beastmaker', name: '1000 / 2000 Series' },
      { brand: 'Metolius', name: 'Wood Grips / Simulator' },
      { brand: 'Tension', name: 'Grindstone' },
    ],
  },
  'grip-campus-board': {
    models: [
      { brand: 'Metolius', name: 'Wood Rungs' },
      { brand: 'Tension', name: 'Campus Rungs' },
    ],
  },
  'rec-slackline': {
    models: [
      { brand: 'Gibbon', name: 'Classic Line' },
      { brand: 'Slackline Industries', name: 'Play Line' },
    ],
  },

  // ── Aquatic / extra cardio / studio (tranche 7) ──
  'aqua-dumbbells': {
    models: [
      { brand: 'Hydro-Fit', name: 'Hand Buoys' },
      { brand: 'Speedo', name: 'Aqua Dumbbells' },
    ],
  },
  'aqua-barbell': {
    models: [
      { brand: 'Hydro-Fit', name: 'Buoyancy Bar' },
      { brand: 'AquaJogger', name: 'Buoyancy Cuffs Bar' },
    ],
  },
  'aqua-jogger-belt': {
    models: [
      { brand: 'AquaJogger', name: 'Classic / Pro' },
      { brand: 'Speedo', name: 'Aqua Fitness Belt' },
    ],
  },
  'aqua-kickboard': {
    models: [
      { brand: 'Speedo', name: 'Kickboard' },
      { brand: 'TYR', name: 'Kickboard' },
    ],
  },
  'aqua-pull-buoy': {
    models: [
      { brand: 'FINIS', name: 'Pull Buoy' },
      { brand: 'TYR', name: 'Pull Float' },
    ],
  },
  'aqua-hand-paddles': {
    models: [
      { brand: 'FINIS', name: 'Freestyler' },
      { brand: 'Speedo', name: 'Power Paddle' },
    ],
  },
  'aqua-fins': {
    models: [
      { brand: 'FINIS', name: 'Zoomers' },
      { brand: 'DMC', name: 'Elite Fins' },
    ],
  },
  'aqua-resistance-gloves': {
    models: [
      { brand: 'Speedo', name: 'Aqua Fitness Gloves' },
      { brand: 'Hydro-Fit', name: 'Wave Web Gloves' },
    ],
  },
  'aqua-snorkel': {
    models: [
      { brand: 'FINIS', name: "Swimmer's Snorkel" },
      { brand: 'Arena', name: 'Swim Snorkel' },
    ],
  },
  'aqua-step': {
    models: [
      { brand: 'Hydro-Fit', name: 'Aqua Step' },
      { brand: 'SPRI', name: 'Aquatic Step' },
    ],
  },
  'cardio-jacobs-ladder': {
    models: [
      { brand: 'Jacobs Ladder', name: 'Original / JL2' },
      { brand: 'Matrix', name: 'Climbmill' },
    ],
  },
  'cardio-treadclimber': { models: [{ brand: 'Bowflex', name: 'TreadClimber TC200' }] },
  'rec-pilates-ring': {
    models: [
      { brand: 'Balanced Body', name: 'Pilates Ring' },
      { brand: 'Merrithew', name: 'Fitness Circle' },
    ],
  },
  'rec-balance-disc': {
    models: [
      { brand: 'TheraBand', name: 'Stability Disc' },
      { brand: 'URBNFit', name: 'Balance Cushion' },
    ],
  },
  'grip-finger-bands': {
    models: [
      { brand: 'IronMind', name: 'Expand-Your-Hand Bands' },
      { brand: 'TheraBand', name: 'Hand Xtrainer' },
    ],
  },

  // ── Combat gear / rehab / studio (tranche 8) ──
  'box-reflex-bag': {
    models: [
      { brand: 'Everlast', name: 'Reflex Bag' },
      { brand: 'Century', name: 'Reflex Bag' },
    ],
  },
  'box-uppercut-bag': {
    models: [
      { brand: 'Title Boxing', name: 'Uppercut Bag' },
      { brand: 'Everlast', name: 'Angle Bag' },
    ],
  },
  'box-hand-wraps': {
    models: [
      { brand: 'Everlast', name: 'Hand Wraps' },
      { brand: 'Fairtex', name: 'Hand Wraps' },
    ],
  },
  'box-shin-guards': {
    models: [
      { brand: 'Fairtex', name: 'SP5 Shin Guards' },
      { brand: 'Venum', name: 'Elite Shin Guards' },
    ],
  },
  'box-headgear': {
    models: [
      { brand: 'Winning', name: 'Headgear' },
      { brand: 'Cleto Reyes', name: 'Headgear' },
    ],
  },
  'box-groin-guard': {
    models: [
      { brand: 'Fairtex', name: 'Groin Guard' },
      { brand: 'Twins Special', name: 'Steel Cup' },
    ],
  },
  'm-donkey-calf': {
    models: [
      { brand: 'Nautilus', name: 'Donkey Calf' },
      { brand: 'Panatta', name: 'Donkey Calf' },
    ],
  },
  'rec-acupressure-mat': {
    models: [
      { brand: 'Shakti', name: 'Mat' },
      { brand: 'ProsourceFit', name: 'Acupressure Mat' },
    ],
  },
  'rec-neck-traction': {
    models: [
      { brand: 'ComforTrac', name: 'Cervical Traction' },
      { brand: 'Vive', name: 'Cervical Traction' },
    ],
  },
  'rec-ballet-barre': {
    models: [
      { brand: 'Vita Vibe', name: 'Ballet Barre' },
      { brand: 'Nimble Sports', name: 'Portable Barre' },
    ],
  },
  'gym-mushroom': {
    models: [
      { brand: 'AAI', name: 'Pommel Trainer' },
      { brand: "Norbert's Athletic", name: 'Mushroom' },
    ],
  },
  'cardio-air-walker': {
    models: [
      { brand: 'Sunny Health', name: 'Air Walk Trainer' },
      { brand: 'Body Rider', name: 'Air Walker' },
    ],
  },

  // ── Assessment / specialty training (tranche 9) ──
  'test-force-plate': {
    models: [
      { brand: 'Hawkin Dynamics', name: 'Force Plates' },
      { brand: 'VALD', name: 'ForceDecks' },
    ],
  },
  'test-hand-dynamometer': {
    models: [
      { brand: 'Jamar', name: 'Hydraulic Dynamometer' },
      { brand: 'Camry', name: 'Digital Dynamometer' },
    ],
  },
  'test-body-comp': {
    models: [
      { brand: 'InBody', name: '270 / 570 / 770' },
      { brand: 'Tanita', name: 'MC-780' },
    ],
  },
  'test-skinfold': {
    models: [
      { brand: 'Harpenden', name: 'Skinfold Caliper' },
      { brand: 'Accu-Measure', name: 'Fitness 3000' },
    ],
  },
  'test-jump-mat': {
    models: [
      { brand: 'Just Jump', name: 'Just Jump System' },
      { brand: 'Chronojump', name: 'Contact Platform' },
    ],
  },
  'cond-vertimax': { models: [{ brand: 'VertiMax', name: 'Raptor / V8' }] },
  'm-flywheel': {
    models: [
      { brand: 'Exxentric', name: 'kBox4' },
      { brand: 'Desmotec', name: 'D-Evo' },
    ],
  },
  'rec-leg-stretcher': {
    models: [
      { brand: 'Century', name: 'Leg Stretcher' },
      { brand: 'Valor Fitness', name: 'CA-37' },
    ],
  },
  'acc-ruck-plate': {
    models: [
      { brand: 'GORUCK', name: 'Ruck Plate' },
      { brand: '5.11', name: 'TacTec Plate' },
    ],
  },

  // ── Hydrotherapy / testing / gymnastics (tranche 10) ──
  'aqua-underwater-treadmill': {
    models: [
      { brand: 'HydroWorx', name: '300 / 500' },
      { brand: 'SwimEx', name: 'Aquatic Treadmill' },
    ],
  },
  'test-metabolic-cart': {
    models: [
      { brand: 'COSMED', name: 'K5 / Quark' },
      { brand: 'PNOE', name: 'Metabolic Analyzer' },
    ],
  },
  'test-goniometer': {
    models: [
      { brand: 'Baseline', name: 'Goniometer' },
      { brand: 'Jamar', name: 'Goniometer' },
    ],
  },
  'gym-balance-beam': {
    models: [
      { brand: 'AAI', name: 'Competition Beam' },
      { brand: "Norbert's Athletic", name: 'Training Beam' },
    ],
  },
  'box-slip-bag': {
    models: [
      { brand: 'Ringside', name: 'Maize Bag' },
      { brand: 'Cleto Reyes', name: 'Slip Bag' },
    ],
  },
  'cond-tornado-ball': {
    models: [
      { brand: 'Power Systems', name: 'Tornado Ball' },
      { brand: 'Rogue', name: 'Rope Med Ball' },
    ],
  },
};
