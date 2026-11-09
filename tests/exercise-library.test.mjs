import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../dist/exercises.js';
import { filterExercises, exercisePoster } from '../dist/exercise-library.js';
import { ANIMATED_EXERCISE_IDS, FIRST_LOWERING_IDS } from '../dist/motion-catalog.js';

test('search matches words in any order and treats punctuation as spaces', () => {
  assert.ok(filterExercises(EXERCISES, { query: 'bench dumbbell' }).some(e => e.id === 'bench-press'));
  assert.ok(filterExercises(EXERCISES, { query: '  PUSH UP  ' }).some(e => e.id === 'push-up'));
  assert.equal(filterExercises(EXERCISES, { query: 'no matching movement' }).length, 0);
});

test('muscle, equipment, query and animation filters apply together', () => {
  const results = filterExercises(EXERCISES, { muscle: 'Chest', equipment: 'Dumbbell', guide: 'animated', query: 'press' });
  assert.deepEqual(results.map(e => e.id), ['bench-press']);
  assert.ok(filterExercises(EXERCISES, { equipment: 'Dumbbell' }).some(e => e.equipment === 'Dumbbells'));
  assert.equal(filterExercises(EXERCISES, { muscle: 'Calves', query: 'bench' }).length, 0);
});

test('only matching animations receive an animation filter result or poster', () => {
  const results = filterExercises(EXERCISES, { guide: 'animated' });
  assert.deepEqual(results.map(e => e.id).sort(), [...ANIMATED_EXERCISE_IDS].sort());
  for (const id of ANIMATED_EXERCISE_IDS) assert.match(exercisePoster(id), /\.webp$/);
  assert.equal(exercisePoster('leg-press'), null);
  assert.equal(exercisePoster('unknown-exercise'), null);
  assert.ok(FIRST_LOWERING_IDS.every(id => ANIMATED_EXERCISE_IDS.includes(id)));
});
