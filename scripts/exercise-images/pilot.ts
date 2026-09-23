/**
 * Pilot set: 22 real catalog exercises chosen to hit the hard cases before any
 * bulk run — every equipment family, every body position, unilateral work,
 * cable heights, machine geometry, split stance, hanging and dynamic moves.
 */
export const PILOT: { id: string; why: string }[] = [
  { id: 'Barbell_Bench_Press_-_Medium_Grip', why: 'barbell compound, lying on flat bench' },
  { id: 'Incline_Dumbbell_Press', why: 'dumbbell compound, incline bench angle must survive' },
  { id: 'Barbell_Full_Squat', why: 'barbell lower body, standing, full plates in frame' },
  { id: 'Romanian_Deadlift', why: 'hinge, standing, bar path close to legs' },
  { id: 'Wide-Grip_Lat_Pulldown', why: 'cable bilateral, seated, high pulley + thigh pad' },
  { id: 'Seated_Cable_Rows', why: 'cable bilateral, low pulley, V-handle' },
  { id: 'Single-Arm_Cable_Crossover', why: 'cable unilateral, pulley height and side' },
  { id: 'Face_Pull', why: 'cable high pulley, rope attachment, standing' },
  { id: 'Machine_Bench_Press', why: 'selectorized machine geometry' },
  { id: 'Leverage_Iso_Row', why: 'plate-loaded machine, chest pad' },
  { id: 'Leg_Press', why: 'plate-loaded sled, reclined seated' },
  { id: 'Smith_Machine_Bench_Press', why: 'Smith machine must stay Smith' },
  { id: 'Pullups', why: 'bodyweight hanging, overhead structure, pronated grip' },
  { id: 'Dips_-_Triceps_Version', why: 'bodyweight dip station, supported' },
  { id: 'Preacher_Curl', why: 'preacher pad support must survive' },
  { id: 'Lying_Leg_Curls', why: 'prone machine isolation' },
  { id: 'Side_Lateral_Raise', why: 'dumbbell isolation, standing' },
  { id: 'One-Arm_Dumbbell_Row', why: 'unilateral, bench-supported' },
  { id: 'Dumbbell_Lunges', why: 'split stance must stay split' },
  { id: 'Hanging_Leg_Raise', why: 'core, hanging' },
  { id: 'One-Arm_Kettlebell_Swings', why: 'dynamic, kettlebell, unusual' },
  { id: 'Standing_Calf_Raises', why: 'calf machine, lower leg' },
];
