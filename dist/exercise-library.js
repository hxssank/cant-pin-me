import { ANIMATED_EXERCISE_IDS } from './motion-catalog.js';

const animated = new Set(ANIMATED_EXERCISE_IDS);
const normalize = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const equipmentName = value => value === 'Dumbbells' ? 'Dumbbell' : value;

export function filterExercises(exercises, { query = '', muscle = 'All', equipment = 'All', guide = 'all' } = {}) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return exercises.filter(exercise => {
    const text = normalize([exercise.name, exercise.muscle, exercise.equipment, ...(exercise.aliases || [])].join(' '));
    return (muscle === 'All' || exercise.muscle.split(' · ').includes(muscle))
      && (equipment === 'All' || exercise.equipment.split(' · ').map(equipmentName).includes(equipment))
      && (guide !== 'animated' || animated.has(exercise.id))
      && terms.every(term => text.includes(term));
  });
}

export function exercisePoster(id) {
  return animated.has(id) ? `./assets/exercise-posters/${id}.webp` : null;
}
