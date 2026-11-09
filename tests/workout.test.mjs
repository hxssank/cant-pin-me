import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialState, validateState, completeWorkout, saveState, loadState } from '../dist/model.js';
import { previousSets, exerciseHistory, workoutTotals, elapsedSeconds, restRemaining, buildCompletedSession } from '../dist/workout.js';

const now = new Date('2026-10-30T18:30:00.000Z');

function draft(overrides = {}) {
  return {
    id: 'workout-1', planId: 'plan-foundation', dayId: 'upper-a', dayName: 'Upper A',
    date: '2026-10-30', notes: '', loggingVersion: 2,
    startedAt: '2026-10-30T18:00:00.000Z', pausedAt: null, pausedMs: 0, restEndsAt: null,
    exercises: [{ exerciseId: 'bench-press', name: 'Bench press', restSeconds: 90, sets: [
      { weight: '20', reps: '10', checked: true, type: 'normal' },
      { weight: '25', reps: '8', checked: false, type: 'normal' },
      { weight: '', reps: '', checked: false, type: 'normal' },
    ] }],
    ...overrides,
  };
}

function saved(id, date, time, weight) {
  return { ...draft(), id, date, completedAt: `${date}T${time}.000Z`, exercises: [
    { exerciseId: 'bench-press', name: 'Bench press', sets: [{ reps: 10, weight }] },
  ] };
}

test('previous sets use workout date and completion order and return an independent copy', () => {
  const state = { sessions: [
    saved('future', '2026-10-31', '19:00:00', 100),
    saved('later', '2026-10-30', '20:00:00', 30),
    saved('earlier', '2026-10-30', '19:00:00', 25),
    saved('old', '2026-10-29', '22:00:00', 20),
  ] };
  assert.deepEqual(previousSets(state, 'bench-press', '2026-10-30'), [{ reps: 10, weight: 30 }]);
  assert.deepEqual(previousSets(state, 'bench-press', '2026-10-29'), [{ reps: 10, weight: 20 }]);
  assert.deepEqual(previousSets(state, 'push-up', '2026-10-30'), []);
  const copy = previousSets(state, 'bench-press', '2026-10-30');
  copy[0].weight = 999;
  assert.equal(state.sessions[1].exercises[0].sets[0].weight, 30);
  assert.equal(state.sessions[0].id, 'future');
});

test('exercise history orders sessions and calculates totals including repeated exercise entries', () => {
  const newer = saved('new', '2026-10-30', '19:00:00', 25);
  newer.exercises.push({ exerciseId: 'bench-press', name: 'Bench press', sets: [{ weight: 30, reps: 8 }] });
  newer.exercises.push({ exerciseId: 'push-up', name: 'Push-up', sets: [{ weight: 0, reps: 20 }] });
  const entries = exerciseHistory({ sessions: [newer, saved('old', '2026-10-29', '19:00:00', 20)] }, 'bench-press');
  assert.deepEqual(entries.map(entry => entry.id), ['old', 'new']);
  assert.equal(entries[1].volume, 490);
  assert.equal(entries[1].bestWeight, 30);
  assert.equal(entries[1].totalReps, 18);
  entries[1].sets[0].reps = 999;
  assert.equal(newer.exercises[0].sets[0].reps, 10);
});

test('live workout totals exclude unchecked sets when requested and never count blank sets', () => {
  const exercises = draft().exercises;
  assert.deepEqual(workoutTotals(exercises), { sets: 2, reps: 18, volume: 400 });
  assert.deepEqual(workoutTotals(exercises, { completedOnly: true }), { sets: 1, reps: 10, volume: 200 });
  exercises[0].sets.push({ weight: '', reps: '12', checked: true });
  assert.deepEqual(workoutTotals(exercises, { completedOnly: true }), { sets: 2, reps: 22, volume: 200 });
});

test('completion saves only checked sets, keeps set type, and leaves the original draft untouched', () => {
  const input = draft();
  input.exercises[0].sets[0].type = 'warmup';
  const result = buildCompletedSession(input, now);
  assert.deepEqual(result.exercises[0].sets, [{ weight: 20, reps: 10, type: 'warmup' }]);
  assert.equal(result.durationSeconds, 1800);
  assert.equal(input.exercises[0].sets.length, 3);
  assert.equal(result.completedAt, now.toISOString());
  const state = { ...createInitialState(now), draft: input };
  assert.equal(validateState(state), true);
  assert.equal(validateState(completeWorkout(state, result)), true);
});

test('empty modern drafts save but cannot become completed workouts', () => {
  const empty = draft({ exercises: [] });
  const state = { ...createInitialState(now), draft: empty };
  assert.equal(validateState(state), true);
  assert.throws(() => buildCompletedSession(empty, now), /Complete at least one set/);
  assert.throws(() => completeWorkout(state, { ...empty, completedAt: now.toISOString() }));
  const unchecked = draft();
  unchecked.exercises[0].sets.forEach(set => set.checked = false);
  assert.throws(() => buildCompletedSession(unchecked, now), /Complete at least one set/);
  delete empty.loggingVersion;
  assert.equal(validateState({ ...state, draft: empty }), false);
});

test('legacy drafts retain all nonblank sets and invalid completed entries fail clearly', () => {
  const input = draft();
  delete input.loggingVersion;
  delete input.startedAt;
  const result = buildCompletedSession(input, now);
  assert.equal(result.exercises[0].sets.length, 2);
  assert.equal(result.durationSeconds, undefined);
  input.exercises[0].sets[0].reps = '';
  assert.throws(() => buildCompletedSession(input, now), /whole reps/);
  for (const date of ['2026-10-31', '2026-02-30', '', undefined]) {
    assert.throws(() => buildCompletedSession(draft({ date }), now), /workout date/);
  }
  assert.throws(() => buildCompletedSession(draft({ dayName: '  ' }), now), /workout name/);
  const invalid = draft();
  invalid.exercises[0].sets[0].weight = '-2';
  assert.throws(() => buildCompletedSession(invalid, now), /weight between/);
});

test('elapsed time and rest deadlines survive storage reload and background time', () => {
  const input = draft({ pausedMs: 120000, restEndsAt: now.getTime() + 90500 });
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  saveState({ ...createInitialState(now), draft: input }, storage);
  const restored = loadState(storage).state.draft;
  assert.equal(elapsedSeconds(restored, now.getTime()), 1680);
  assert.equal(restRemaining(restored, now.getTime()), 91);
  assert.equal(restRemaining(restored, now.getTime() + 120000), 0);
  restored.pausedAt = now.getTime();
  assert.equal(elapsedSeconds(restored, now.getTime() + 600000), 1680);
  assert.equal(elapsedSeconds({}, now.getTime()), 0);
  assert.equal(restRemaining({}, now.getTime()), 0);
  assert.equal(elapsedSeconds(restored, Date.parse(restored.startedAt) - 1000), 0);
});

test('malformed timing, flags, rest settings and set types fail backup validation', () => {
  const state = createInitialState(now);
  for (const patch of [
    { loggingVersion: 3 }, { startedAt: '2026-02-30T18:00:00.000Z' },
    { pausedAt: 'now' }, { pausedAt: -1 }, { pausedAt: Date.parse('2026-10-29T18:00:00.000Z') },
    { pausedMs: -1 }, { pausedMs: Infinity }, { restEndsAt: 'soon' },
    { durationSeconds: -1 }, { durationSeconds: 1.5 },
  ]) assert.equal(validateState({ ...state, draft: draft(patch) }), false, JSON.stringify(patch));
  for (const value of [-1, 601, 1.5, '90']) {
    const input = draft();
    input.exercises[0].restSeconds = value;
    assert.equal(validateState({ ...state, draft: input }), false);
  }
  for (const value of [0, 1001, 1.5, '\"><img src=x onerror=alert(1)>']) {
    const input = draft();
    input.exercises[0].targetReps = value;
    assert.equal(validateState({ ...state, draft: input }), false);
  }
  for (const patch of [{ checked: 'yes' }, { checked: 1 }, { type: 'garbage' }]) {
    const input = draft();
    Object.assign(input.exercises[0].sets[0], patch);
    assert.equal(validateState({ ...state, draft: input }), false);
  }
});
