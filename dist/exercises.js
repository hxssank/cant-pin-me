import { EXTRA_EXERCISES } from './extra-exercises.js';
import { renderDemo, renderAnatomy } from './anatomy.js';
export { DEMO_DURATION, getDemoPhase, muscleInfo } from './anatomy.js';

export const EXERCISES = [
  { id: 'bench-press', name: 'Dumbbell bench press', muscle: 'Chest', equipment: 'Dumbbells · Bench', description: 'Press from a supported position, then lower the weights with control.', cues: ['Keep your feet planted and your upper back on the bench.', 'Lower the dumbbells beside your chest.', 'Press up without bouncing the weights at the bottom.'], defaultSets: 3, defaultReps: 10 },
  { id: 'goblet-squat', name: 'Goblet squat', muscle: 'Quads · Glutes', equipment: 'Dumbbell', description: 'Hold one dumbbell at your chest as you sit down between your hips.', cues: ['Hold the weight close to your chest.', 'Keep your heels down and knees in line with your toes.', 'Stand by pushing through your whole foot.'], defaultSets: 3, defaultReps: 10 },
  { id: 'dumbbell-row', name: 'Dumbbell row', muscle: 'Back', equipment: 'Dumbbell · Bench', description: 'Support one hand on a bench and pull the weight toward your hip.', cues: ['Brace your free hand on a stable bench.', 'Pull your elbow back without twisting your torso.', 'Lower with control, then repeat on the other side.'], defaultSets: 3, defaultReps: 10 },
  { id: 'shoulder-press', name: 'Shoulder press', muscle: 'Shoulders', equipment: 'Dumbbells', description: 'Start at shoulder height and press the dumbbells overhead.', cues: ['Start with the dumbbells beside your shoulders.', 'Keep your ribs over your hips as you press.', 'Lower to shoulder height with control.'], defaultSets: 3, defaultReps: 10 },
  { id: 'romanian-deadlift', name: 'Romanian deadlift', muscle: 'Hamstrings · Glutes', equipment: 'Dumbbells', description: 'Move your hips back while keeping the weights close to your legs.', cues: ['Start with a small bend in your knees.', 'Push your hips back and keep the weights close.', 'Stand tall by bringing your hips forward.'], defaultSets: 3, defaultReps: 10 },
  { id: 'reverse-lunge', name: 'Reverse lunge', muscle: 'Quads · Glutes', equipment: 'Bodyweight', description: 'Step one foot back, lower into a lunge, and return to standing.', cues: ['Take a controlled step back.', 'Lower your back knee toward the floor.', 'Push through your front foot to stand. Log reps per side.'], defaultSets: 3, defaultReps: 10 },
  { id: 'bicep-curl', name: 'Dumbbell curl', muscle: 'Biceps', equipment: 'Dumbbells', description: 'Bend at the elbows to lift the weights toward your shoulders.', cues: ['Keep your upper arms close to your sides.', 'Curl without swinging your torso.', 'Lower until your arms are almost straight.'], defaultSets: 3, defaultReps: 10 },
  { id: 'push-up', name: 'Push-up', muscle: 'Chest · Triceps', equipment: 'Bodyweight', description: 'Lower your body as one unit, then press the floor away.', cues: ['Place your hands just wider than your shoulders.', 'Keep your hips in line with your shoulders.', 'Lower with control and press back up.'], defaultSets: 3, defaultReps: 10 },
  { id: 'lateral-raise', name: 'Lateral raise', muscle: 'Shoulders', equipment: 'Dumbbells', description: 'Lift the dumbbells out to your sides with a slight bend in your elbows.', cues: ['Keep a slight bend in your elbows.', 'Raise to about shoulder height.', 'Lower slowly without swinging the weights.'], defaultSets: 3, defaultReps: 10 },
];

EXERCISES.push(...EXTRA_EXERCISES.map(({ science, ...exercise }) => exercise));

export function getExercise(id) {
  return EXERCISES.find((exercise) => exercise.id === id);
}

export function demoSvg(id, options = {}) {
  const exercise = getExercise(id);
  return exercise ? renderDemo(exercise, options) : '';
}

export function anatomySvg(id, options = {}) {
  const exercise = getExercise(id);
  return exercise ? renderAnatomy(exercise, options) : '';
}
