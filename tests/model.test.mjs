import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/model.js', import.meta.url), 'utf8');
const { STORAGE_KEY, todayKey, addMonths, createInitialState, validateState, loadState, saveState, completeWorkout, calculateStats } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function session(overrides = {}) {
  return {
    id: 'session-1',
    planId: 'plan-foundation',
    dayId: 'upper',
    dayName: 'Upper body',
    date: '2026-10-30',
    completedAt: '2026-10-30T19:00:00.000Z',
    notes: '',
    exercises: [{ exerciseId: 'bench-press', name: 'Bench press', sets: [{ reps: 10, weight: 20 }, { reps: 8, weight: 25 }] }],
    ...overrides,
  };
}

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('three-month plans clamp calendar end dates without a 90-day approximation', () => {
  assert.equal(addMonths('2026-10-30', 3), '2027-01-30');
  assert.equal(addMonths('2026-11-30', 3), '2027-02-28');
  assert.equal(addMonths('2023-11-30', 3), '2024-02-29');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-01-31', -1), '2025-12-31');
  assert.throws(() => addMonths('2026-02-30', 3));
});

test('todayKey follows the local calendar, including dates near midnight', () => {
  const date = new Date(2026, 9, 30, 0, 1);
  assert.equal(todayKey(date), '2026-10-30');
  assert.throws(() => todayKey(new Date('invalid')));
});

test('initial state contains a four-day plan and no invented workouts or rewards', () => {
  const state = createInitialState(new Date(2026, 9, 30));
  assert.equal(validateState(state), true);
  assert.equal(state.plans[0].endDate, '2027-01-30');
  assert.equal(state.plans[0].days.length, 4);
  const stats = calculateStats(state, new Date(2026, 9, 30));
  assert.equal(stats.sessions, 0);
  assert.equal(stats.xp, 0);
  assert.equal(stats.level, 1);
  assert.equal(stats.streak, 0);
});

test('completion preserves source state and snapshots submitted sets', () => {
  const state = createInitialState();
  const input = session();
  const updated = completeWorkout(state, input);
  assert.equal(state.sessions.length, 0);
  assert.equal(updated.sessions.length, 1);
  input.exercises[0].sets[0].reps = 100;
  assert.equal(updated.sessions[0].exercises[0].sets[0].reps, 10);
  assert.equal(validateState(updated), true);
});

test('each completed workout earns 100 XP plus 10 per set, with no duplicate awards', () => {
  const state = completeWorkout(createInitialState(), session());
  const stats = calculateStats(state, new Date(2026, 9, 30));
  assert.equal(stats.xp, 120);
  assert.equal(stats.totalSets, 2);
  assert.equal(stats.totalReps, 18);
  assert.equal(stats.totalVolume, 400);
  assert.equal(stats.levelProgress, 120);
  assert.equal(stats.xpToNext, 380);
  assert.throws(() => completeWorkout(state, session()), /already been logged/);
  assert.equal(calculateStats(state).xp, 120);
});

test('empty, fractional, negative, nonfinite and unreasonable set values cannot become workouts', () => {
  for (const badSet of [
    { reps: 0, weight: 0 }, { reps: -1, weight: 0 }, { reps: 1.5, weight: 0 },
    { reps: '', weight: 0 }, { reps: 10, weight: -1 }, { reps: 10, weight: Infinity },
    { reps: 10, weight: NaN }, { reps: 10, weight: '' }, { reps: 1001, weight: 0 },
    { reps: 1, weight: 10001 },
  ]) {
    const input = session({ exercises: [{ exerciseId: 'bench-press', name: 'Bench press', sets: [badSet] }] });
    assert.throws(() => completeWorkout(createInitialState(), input));
  }
  assert.throws(() => completeWorkout(createInitialState(), session({ exercises: [] })));
  assert.doesNotThrow(() => completeWorkout(createInitialState(), session({ exercises: [{ exerciseId: 'push-up', name: 'Push-up', sets: [{ reps: 12, weight: 0 }] }] })));
});

test('malformed and incompatible imports fail validation', () => {
  const initial = createInitialState();
  for (const value of [null, [], {}, { ...initial, version: 2 }, { ...initial, unit: 'stone' }, { ...initial, activePlanId: 'missing' }, { ...initial, plans: [] }, { ...initial, draft: {} }]) {
    assert.equal(validateState(value), false);
  }
  assert.equal(validateState({ ...initial, plans: [initial.plans[0], initial.plans[0]] }), false);
  assert.equal(validateState({ ...initial, sessions: [session(), session()] }), false);
  assert.equal(validateState({ ...initial, sessions: [session({ date: '2026-02-30' })] }), false);
  assert.equal(validateState({ ...initial, sessions: [session({ completedAt: '2026-02-30T19:00:00.000Z' })] }), false);
  assert.equal(validateState({ ...initial, sessions: [session({ planId: 'missing' })] }), false);
});

test('unfinished draft string inputs survive reload but do not earn XP', () => {
  const initial = createInitialState();
  const draft = session({ exercises: [{ exerciseId: 'bench-press', name: 'Bench press', sets: [{ reps: '', weight: '' }, { reps: '8', weight: '22.5' }] }] });
  delete draft.completedAt;
  const state = { ...initial, draft };
  const storage = memoryStorage();
  assert.equal(validateState(state), true);
  saveState(state, storage);
  assert.deepEqual(loadState(storage).state.draft, draft);
  assert.equal(calculateStats(state).xp, 0);
  assert.equal(validateState({ ...state, draft: { ...draft, exercises: [{ ...draft.exercises[0], sets: [{ reps: 'garbage', weight: '' }] }] } }), false);
});

test('storage round trip keeps completed sets and errors do not overwrite saved data', () => {
  const storage = memoryStorage();
  const state = completeWorkout(createInitialState(), session());
  saveState(state, storage);
  assert.deepEqual(loadState(storage), { state, error: null });
  storage.setItem(STORAGE_KEY, '{bad json');
  const loaded = loadState(storage);
  assert.match(loaded.error, /original data has not been changed/);
  assert.equal(storage.getItem(STORAGE_KEY), '{bad json');
  const unavailable = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Quota'); } };
  assert.match(loadState(unavailable).error, /Denied/);
  assert.throws(() => saveState(state, unavailable), /could not save/);
  assert.throws(() => saveState({}, storage));
});

test('a browser that blocks access to localStorage returns a recoverable error', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Browser storage blocked'); } });
  try {
    assert.match(loadState().error, /Browser storage blocked/);
    assert.throws(() => saveState(createInitialState()), /could not save/);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('week counts start on Monday and a streak survives an empty current week', () => {
  let state = createInitialState(new Date(2026, 9, 1));
  for (const [index, date] of ['2026-10-12', '2026-10-25'].entries()) {
    state = completeWorkout(state, session({ id: `session-${index}`, date }));
  }
  const monday = calculateStats(state, new Date(2026, 9, 26, 0, 1));
  assert.equal(monday.weekCount, 0);
  assert.equal(monday.streak, 2);
  assert.equal(monday.weeklyActivity[0].date, '2026-10-26');
  assert.equal(monday.weeklyActivity[6].date, '2026-11-01');
  assert.equal(calculateStats(state, new Date(2026, 10, 2)).streak, 0);
  state = completeWorkout(state, session({ id: 'session-current', date: '2026-10-26' }));
  assert.equal(calculateStats(state, new Date(2026, 9, 26)).streak, 3);
  assert.equal(calculateStats(state, new Date(2026, 9, 26)).weekCount, 1);
});

test('multiple workouts on one date count as one active day and do not multiply the weekly streak', () => {
  let state = completeWorkout(createInitialState(), session());
  state = completeWorkout(state, session({ id: 'session-2' }));
  const stats = calculateStats(state, new Date(2026, 9, 30));
  assert.equal(stats.activeDays, 1);
  assert.equal(stats.streak, 1);
  assert.equal(stats.weekCount, 2);
  assert.equal(stats.weeklyActivity[4].count, 2);
});

test('personal records compare later workouts with their actual baseline', () => {
  let state = completeWorkout(createInitialState(), session());
  assert.equal(calculateStats(state).personalRecords, 0);
  state = completeWorkout(state, session({ id: 'session-2', date: '2026-10-31', exercises: [{ exerciseId: 'bench-press', name: 'Bench press', sets: [{ reps: 10, weight: 25 }] }] }));
  assert.equal(calculateStats(state).personalRecords, 1);
  state = completeWorkout(state, session({ id: 'session-3', date: '2026-11-01' }));
  assert.equal(calculateStats(state).personalRecords, 1);
});
