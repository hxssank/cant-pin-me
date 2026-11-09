export const STORAGE_KEY = 'form-workouts-v1';

const MAX_PLANS = 100;
const MAX_SESSIONS = 10000;
const MAX_DAYS = 14;
const MAX_EXERCISES = 30;
const MAX_SETS = 30;
const LEVEL_XP = 500;
const DAY_MS = 86400000;
const MAX_DURATION_SECONDS = 315360000;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value, max = 150, allowEmpty = false) {
  return typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0);
}

function isId(value) {
  return isText(value, 100) && /^[a-zA-Z0-9_-]+$/.test(value);
}

function isInteger(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function dateParts(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1900 || year > 2200 || month < 1 || month > 12) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= lastDay ? { year, month, day } : null;
}

function dateNumber(value) {
  const { year, month, day } = dateParts(value);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function numberToDate(value) {
  return new Date(value * DAY_MS).toISOString().slice(0, 10);
}

function weekStart(value) {
  const day = dateNumber(value);
  const weekday = new Date(day * DAY_MS).getUTCDay();
  return day - ((weekday + 6) % 7);
}

function uniqueIds(values) {
  return new Set(values.map(value => value.id)).size === values.length;
}

function isPlan(plan) {
  return isObject(plan)
    && isId(plan.id)
    && isText(plan.name)
    && dateParts(plan.startDate) !== null
    && dateParts(plan.endDate) !== null
    && plan.endDate > plan.startDate
    && Array.isArray(plan.days)
    && plan.days.length >= 1
    && plan.days.length <= MAX_DAYS
    && plan.days.every(day => isObject(day)
      && isId(day.id)
      && isText(day.name)
      && isText(day.focus, 200, true)
      && Array.isArray(day.exercises)
      && day.exercises.length >= 1
      && day.exercises.length <= MAX_EXERCISES
      && day.exercises.every(exercise => isObject(exercise)
        && isId(exercise.exerciseId)
        && isInteger(exercise.sets, 1, MAX_SETS)
        && isInteger(exercise.reps, 1, 1000)))
    && uniqueIds(plan.days);
}

function isDraftNumber(value, min, max, integer) {
  if (value === '') return true;
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  if (typeof value === 'string' && !/^\d+(?:\.\d*)?$/.test(value)) return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max && (!integer || Number.isInteger(number));
}

function isTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function isEpoch(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
}

function hasValidTiming(session) {
  return (session.loggingVersion === undefined || session.loggingVersion === 2)
    && (session.startedAt === undefined || isTimestamp(session.startedAt))
    && (session.pausedAt === undefined || session.pausedAt === null || isEpoch(session.pausedAt))
    && (session.pausedMs === undefined || isInteger(session.pausedMs, 0, MAX_DURATION_SECONDS * 1000))
    && (session.restEndsAt === undefined || session.restEndsAt === null || isEpoch(session.restEndsAt))
    && (session.durationSeconds === undefined || isInteger(session.durationSeconds, 0, MAX_DURATION_SECONDS))
    && (session.startedAt === undefined || session.pausedAt == null || session.pausedAt >= Date.parse(session.startedAt));
}

function isSession(session, draft = false) {
  return isObject(session)
    && isId(session.id)
    && isId(session.planId)
    && isId(session.dayId)
    && isText(session.dayName)
    && dateParts(session.date) !== null
    && (draft || isTimestamp(session.completedAt))
    && hasValidTiming(session)
    && isText(session.notes, 5000, true)
    && Array.isArray(session.exercises)
    && session.exercises.length >= (draft && session.loggingVersion === 2 ? 0 : 1)
    && session.exercises.length <= MAX_EXERCISES
    && session.exercises.every(exercise => isObject(exercise)
      && isId(exercise.exerciseId)
      && isText(exercise.name)
      && (exercise.restSeconds === undefined || isInteger(exercise.restSeconds, 0, 600))
      && (exercise.targetReps === undefined || isInteger(exercise.targetReps, 1, 1000))
      && Array.isArray(exercise.sets)
      && exercise.sets.length >= 1
      && exercise.sets.length <= MAX_SETS
      && exercise.sets.every(set => isObject(set)
        && (set.checked === undefined || typeof set.checked === 'boolean')
        && (set.type === undefined || ['normal', 'warmup', 'drop', 'failure'].includes(set.type))
        && (draft
          ? isDraftNumber(set.reps, 0, 1000, true) && isDraftNumber(set.weight, 0, 10000, false)
          : isInteger(set.reps, 1, 1000)
            && typeof set.weight === 'number'
            && Number.isFinite(set.weight)
            && set.weight >= 0
            && set.weight <= 10000)));
}

export function todayKey(date = new Date()) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error('Choose a valid date.');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addMonths(dateKey, months) {
  const parts = dateParts(dateKey);
  if (!parts || !Number.isInteger(months)) throw new Error('Choose a valid date and number of months.');
  const month = new Date(Date.UTC(parts.year, parts.month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  month.setUTCDate(Math.min(parts.day, lastDay));
  const result = month.toISOString().slice(0, 10);
  if (!dateParts(result)) throw new Error('The plan date must be between 1900 and 2200.');
  return result;
}

export function createInitialState(now = new Date()) {
  const startDate = todayKey(now);
  const exercise = exerciseId => ({ exerciseId, sets: 3, reps: 10 });
  return {
    version: 1,
    plans: [{
      id: 'plan-foundation',
      name: 'Foundation',
      startDate,
      endDate: addMonths(startDate, 3),
      days: [
        { id: 'upper-a', name: 'Upper A', focus: 'Chest, back & shoulders', exercises: ['bench-press', 'dumbbell-row', 'shoulder-press', 'bicep-curl'].map(exercise) },
        { id: 'lower-a', name: 'Lower A', focus: 'Legs & glutes', exercises: ['goblet-squat', 'romanian-deadlift', 'reverse-lunge'].map(exercise) },
        { id: 'upper-b', name: 'Upper B', focus: 'Back, arms & shoulders', exercises: ['push-up', 'dumbbell-row', 'lateral-raise', 'bicep-curl'].map(exercise) },
        { id: 'lower-b', name: 'Lower B', focus: 'Legs & posterior chain', exercises: ['romanian-deadlift', 'goblet-squat', 'reverse-lunge'].map(exercise) },
      ],
    }],
    activePlanId: 'plan-foundation',
    sessions: [],
    draft: null,
    unit: 'kg',
  };
}

export function validateState(input) {
  try {
    return isObject(input)
      && input.version === 1
      && (input.unit === 'kg' || input.unit === 'lb')
      && Array.isArray(input.plans)
      && input.plans.length >= 1
      && input.plans.length <= MAX_PLANS
      && input.plans.every(isPlan)
      && uniqueIds(input.plans)
      && input.plans.some(plan => plan.id === input.activePlanId)
      && Array.isArray(input.sessions)
      && input.sessions.length <= MAX_SESSIONS
      && input.sessions.every(session => isSession(session)
        && input.plans.some(plan => plan.id === session.planId))
      && uniqueIds(input.sessions)
      && (input.draft === null || (isSession(input.draft, true)
        && input.plans.some(plan => plan.id === input.draft.planId)
        && !input.sessions.some(session => session.id === input.draft.id)));
  } catch {
    return false;
  }
}

export function loadState(storage) {
  try {
    storage ??= globalThis.localStorage;
    if (!storage) throw new Error('Storage is unavailable.');
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { state: createInitialState(), error: null };
    if (raw.length > 10000000) throw new Error('Stored data is too large.');
    const state = JSON.parse(raw);
    if (!validateState(state)) throw new Error('Stored data has an unsupported format.');
    return { state, error: null };
  } catch (error) {
    return {
      state: createInitialState(),
      error: `Your saved workouts could not be loaded. The original data has not been changed. ${error.message}`,
    };
  }
}

export function saveState(state, storage) {
  if (!validateState(state)) throw new Error('This workout data could not be saved. Check the plan and set entries.');
  try {
    storage ??= globalThis.localStorage;
    if (!storage) throw new Error('Storage is unavailable.');
    const serialized = JSON.stringify(state);
    if (serialized.length > 10000000) throw new Error('The archive is too large.');
    storage.setItem(STORAGE_KEY, serialized);
  } catch {
    throw new Error('Your browser could not save this change. Free some storage or export a backup before closing the app.');
  }
}

export function completeWorkout(state, session) {
  if (!validateState(state)) throw new Error('Your workout data needs to be restored before saving.');
  if (!isSession(session)) throw new Error('Enter at least one rep and a valid weight for every logged set.');
  if (state.sessions.some(existing => existing.id === session.id)) throw new Error('This workout has already been logged.');
  if (!state.plans.some(plan => plan.id === session.planId)) throw new Error('The plan for this workout is missing.');
  if (state.sessions.length >= MAX_SESSIONS) throw new Error('This workout archive is full. Export a backup before starting a new archive.');
  return {
    ...state,
    sessions: [...state.sessions, structuredClone(session)],
    draft: null,
  };
}

export function calculateStats(state, now = new Date()) {
  const currentDate = todayKey(now);
  const currentWeek = weekStart(currentDate);
  const weeks = new Set();
  const dates = new Set();
  const bests = new Map();
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;
  let personalRecords = 0;
  const sessions = [...state.sessions].sort((a, b) => a.date.localeCompare(b.date) || a.completedAt.localeCompare(b.completedAt));
  for (const session of sessions) {
    weeks.add(weekStart(session.date));
    dates.add(session.date);
    for (const exercise of session.exercises) {
      let best = 0;
      for (const set of exercise.sets) {
        totalSets += 1;
        totalReps += set.reps;
        totalVolume += set.reps * set.weight;
        best = Math.max(best, set.weight > 0 ? set.weight * (1 + set.reps / 30) : set.reps);
      }
      const previous = bests.get(exercise.exerciseId);
      if (previous !== undefined && best > previous) personalRecords += 1;
      bests.set(exercise.exerciseId, Math.max(previous ?? 0, best));
    }
  }
  let streak = 0;
  let week = weeks.has(currentWeek) ? currentWeek : currentWeek - 7;
  while (weeks.has(week)) {
    streak += 1;
    week -= 7;
  }
  const xp = sessions.length * 100 + totalSets * 10;
  const levelProgress = xp % LEVEL_XP;
  return {
    sessions: sessions.length,
    totalSets,
    totalReps,
    totalVolume: Math.round(totalVolume * 100) / 100,
    xp,
    level: Math.floor(xp / LEVEL_XP) + 1,
    levelProgress,
    xpToNext: LEVEL_XP - levelProgress,
    weekCount: sessions.filter(session => weekStart(session.date) === currentWeek).length,
    streak,
    personalRecords,
    activeDays: dates.size,
    weeklyActivity: ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => {
      const date = numberToDate(currentWeek + index);
      return { date, label, count: sessions.filter(session => session.date === date).length };
    }),
  };
}
