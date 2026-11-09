import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, getExercise } from '../dist/exercises.js';
import { CATALOG_EXERCISES } from '../dist/catalog-exercises.js';
import { MOVEMENT_SCIENCE } from '../dist/movement-science.js';
import { createInitialState, validateState, completeWorkout } from '../dist/model.js';
import { createPersistence } from '../dist/persistence.js';
import { buildCompletedSession, exerciseHistory, previousSets } from '../dist/workout.js';
import { getMuscleStats, muscleGroupForName } from '../dist/muscle-stats.js';

const now = new Date('2026-10-30T18:00:00.000Z');

test('the expanded catalog has 60 unique exercises with usable rep defaults', () => {
  assert.equal(EXERCISES.length, 60);
  assert.equal(CATALOG_EXERCISES.length, 30);
  assert.equal(new Set(EXERCISES.map(item => item.id)).size, EXERCISES.length);
  assert.equal(new Set(EXERCISES.map(item => item.name.toLowerCase())).size, EXERCISES.length);
  for (const item of CATALOG_EXERCISES) {
    assert.equal(getExercise(item.id).name, item.name);
    assert.match(item.id, /^[a-z0-9-]+$/);
    assert.ok(Number.isInteger(item.defaultReps) && item.defaultReps > 0);
    assert.ok(Number.isInteger(item.defaultSets) && item.defaultSets > 0);
    assert.ok(item.description && item.cues.length >= 2);
    assert.equal(MOVEMENT_SCIENCE[item.id], item.science);
    for (const muscle of [...item.science.primary, ...item.science.secondary, ...item.science.stabilizers]) {
      assert.ok(muscleGroupForName(muscle), `${item.id}: unmapped muscle ${muscle}`);
    }
  }
});

test('catalog pages remain external references without an implied playable media file', () => {
  for (const item of CATALOG_EXERCISES) {
    const demo = item.science.demonstration;
    assert.equal(demo.kind, 'reference');
    assert.equal(new URL(demo.url).protocol, 'https:');
    assert.ok(['gymvisual.com', 'www.acefitness.org'].includes(new URL(demo.url).hostname));
    assert.equal(demo.youtubeId, undefined);
    assert.equal(demo.vimeoId, undefined);
    assert.equal(demo.src, undefined);
  }
});

test('every added exercise survives a completed workout, backup restore, history and muscle stats', () => {
  for (const item of CATALOG_EXERCISES) {
    const state = createInitialState(now);
    state.plans[0].days[0].exercises.push({ exerciseId: item.id, sets: item.defaultSets, reps: item.defaultReps });
    const draft = {
      id: `catalog-${item.id}`, loggingVersion: 2,
      planId: state.plans[0].id, dayId: state.plans[0].days[0].id, dayName: 'Catalog check',
      date: '2026-10-30', startedAt: '2026-10-30T17:50:00.000Z',
      pausedAt: null, pausedMs: 0, restEndsAt: null, notes: '',
      exercises: [{ exerciseId: item.id, name: item.name, targetReps: item.defaultReps,
        sets: [{ reps: String(item.defaultReps), weight: '0', checked: true, type: 'normal' }] }],
    };
    assert.equal(validateState({ ...state, draft }), true, item.id);
    const session = buildCompletedSession(draft, now);
    const saved = completeWorkout(state, session);
    assert.equal(validateState(saved), true, item.id);
    const values = new Map();
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const persistence = createPersistence(storage);
    persistence.save(JSON.parse(JSON.stringify(saved)), { replace: true });
    const restored = createPersistence(storage).state;
    assert.equal(restored.sessions[0].exercises[0].exerciseId, item.id);
    assert.equal(exerciseHistory(restored, item.id)[0].totalReps, item.defaultReps);
    assert.equal(previousSets(restored, item.id, '2026-10-30')[0].reps, item.defaultReps);
    assert.equal(getMuscleStats(restored, item.science.primary[0], now).weekPrimarySets, 1, item.id);
  }
});
