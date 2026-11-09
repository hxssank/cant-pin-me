import { todayKey, addMonths } from './model.js';

const orderSessions = (a, b) => a.date.localeCompare(b.date) || a.completedAt.localeCompare(b.completedAt);

export function previousSets(state, exerciseId, beforeDate = todayKey()) {
  const session = [...state.sessions]
    .filter(item => item.date <= beforeDate && item.exercises.some(exercise => exercise.exerciseId === exerciseId))
    .sort(orderSessions).at(-1);
  return session ? structuredClone(session.exercises.filter(exercise => exercise.exerciseId === exerciseId).flatMap(exercise => exercise.sets)) : [];
}

export function workoutTotals(exercises, { completedOnly = false } = {}) {
  const result = { sets: 0, reps: 0, volume: 0 };
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      if (completedOnly && set.checked !== true) continue;
      const reps = Number(set.reps);
      const weight = Number(set.weight);
      if (!Number.isInteger(reps) || reps < 1 || !Number.isFinite(weight) || weight < 0) continue;
      result.sets += 1;
      result.reps += reps;
      result.volume += reps * weight;
    }
  }
  result.volume = Math.round(result.volume * 100) / 100;
  return result;
}

export function exerciseHistory(state, exerciseId) {
  return [...state.sessions].sort(orderSessions).flatMap(session => {
    const exercises = session.exercises.filter(exercise => exercise.exerciseId === exerciseId);
    if (!exercises.length) return [];
    const sets = structuredClone(exercises.flatMap(exercise => exercise.sets));
    const totals = workoutTotals(exercises);
    return [{
      id: session.id,
      date: session.date,
      dayName: session.dayName,
      sets,
      volume: totals.volume,
      bestWeight: Math.max(0, ...sets.map(set => set.weight)),
      totalReps: totals.reps,
    }];
  });
}

export function elapsedSeconds(draft, now = Date.now()) {
  const start = Date.parse(draft?.startedAt);
  if (!Number.isFinite(start) || !Number.isFinite(now)) return 0;
  const end = Number.isFinite(draft.pausedAt) ? Math.min(draft.pausedAt, now) : now;
  const paused = Number.isFinite(draft.pausedMs) ? Math.max(0, draft.pausedMs) : 0;
  return Math.max(0, Math.floor((end - start - paused) / 1000));
}

export function restRemaining(draft, now = Date.now()) {
  if (!Number.isFinite(draft?.restEndsAt) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.ceil((draft.restEndsAt - now) / 1000));
}

export function buildCompletedSession(draft, now = new Date()) {
  if (!draft || !Array.isArray(draft.exercises)) throw new Error('Start a workout before saving.');
  if (typeof draft.dayName !== 'string' || !draft.dayName.trim() || draft.dayName.length > 150) {
    throw new Error('Enter a workout name before saving.');
  }
  const date = todayKey(now);
  try {
    if (addMonths(draft.date, 0) !== draft.date || draft.date > date) throw new Error();
  } catch {
    throw new Error('Choose today or an earlier workout date.');
  }
  const checkedOnly = draft.loggingVersion === 2;
  const exercises = draft.exercises.map(exercise => ({
    ...exercise,
    sets: exercise.sets.filter(set => checkedOnly
      ? set.checked === true
      : String(set.reps ?? '').trim() || String(set.weight ?? '').trim()).map(set => {
      const repsText = String(set.reps ?? '').trim();
      const weightText = String(set.weight ?? '').trim();
      const reps = Number(repsText);
      const weight = weightText ? Number(weightText) : 0;
      if (!repsText || !Number.isInteger(reps) || reps < 1 || reps > 1000) {
        throw new Error(`Enter 1 to 1000 whole reps for each completed set of ${exercise.name}.`);
      }
      if (!Number.isFinite(weight) || weight < 0 || weight > 10000) {
        throw new Error(`Enter a weight between 0 and 10000 for ${exercise.name}.`);
      }
      return { reps, weight, ...(set.type ? { type: set.type } : {}) };
    }),
  })).filter(exercise => exercise.sets.length);
  if (!exercises.length) throw new Error(checkedOnly ? 'Complete at least one set before saving.' : 'Enter reps for at least one set before saving.');
  return {
    ...structuredClone(draft),
    exercises,
    completedAt: now.toISOString(),
    ...(draft.startedAt ? { durationSeconds: elapsedSeconds(draft, now.getTime()) } : {}),
  };
}
