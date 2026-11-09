import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getMuscleStats, getTrainedGroups, muscleGroupForName, MUSCLE_STATS_NOTE } from '../dist/muscle-stats.js';
import { MOVEMENT_SCIENCE } from '../dist/movement-science.js';

const now = new Date(2026, 9, 30, 0, 1);
const exercise = (exerciseId, sets = [{ reps: 10, weight: 20 }]) => ({ exerciseId, name: exerciseId, sets });
const session = (id, date, exercises) => ({ id, date, completedAt: `${date}T18:00:00.000Z`, exercises });

test('atlas names retain the identity of deltoid parts and normalize left and right', () => {
  assert.equal(muscleGroupForName('Clavicular part of deltoid muscle.l').id, 'anterior-delts');
  assert.equal(muscleGroupForName('Acromial part of deltoid muscle.r').id, 'lateral-delts');
  assert.equal(muscleGroupForName('Scapular spinal part of deltoid muscle.l').id, 'posterior-delts');
  assert.equal(muscleGroupForName('(Abdominal part of pectoralis major muscle).l').id, 'chest');
  assert.equal(muscleGroupForName('External abdominal oblique muscle.o2r').id, 'obliques');
  assert.equal(muscleGroupForName('Left Vastus medialis').id, 'quads');
  assert.equal(muscleGroupForName('Other muscles_forearm_L'), null);
  assert.equal(muscleGroupForName('Deltoid tuberosity.l'), null);
});

test('the atlas muscle names resolve without classifying connective structures as muscles', async () => {
  const rig = JSON.parse(await readFile(new URL('../dist/assets/anatomy/rig.json', import.meta.url), 'utf8'));
  const noncontractile = /^(?:Inferior tarsus|Superior tarsus|Trochlea of superior oblique muscle)\.[lr]$/;
  const muscles = rig.sourceParts.filter(part => part.tissue === 'muscle' && !noncontractile.test(part.name));
  assert.ok(muscles.length > 100);
  for (const part of muscles) assert.ok(muscleGroupForName(part.name), part.name);
});

test('unknown and known-but-unmapped muscles return unknown values rather than invented zeroes', () => {
  for (const name of ['Other muscles_forearm_L', 'Pectoralis minor.r']) {
    const stats = getMuscleStats({ sessions: [] }, name, now);
    assert.equal(stats.mapped, false);
    assert.equal(stats.totalSets, null);
    assert.equal(stats.exerciseVolume, null);
    assert.equal(stats.weekPrimarySets, null);
    assert.deepEqual(stats.exercises, []);
  }
  assert.equal(getMuscleStats({ sessions: [] }, 'Soleus.l', now).group.id, 'calves');
  const mapped = getMuscleStats({ sessions: [] }, 'Vastus medialis.r', now);
  assert.equal(mapped.mapped, true);
  assert.equal(mapped.totalSets, 0);
  assert.equal(mapped.lastTrained, null);
});

test('actual sets include repeated exercise entries without multiplying sessions or roles', () => {
  const state = { sessions: [session('one', '2026-10-30', [exercise('shoulder-press'), exercise('shoulder-press', [{ reps: 8, weight: 25 }]), exercise('lateral-raise', [{ reps: 12, weight: 5 }])])] };
  const stats = getMuscleStats(state, 'Deltoid muscle.l', now);
  assert.equal(stats.totalSets, 3);
  assert.equal(stats.weekPrimarySets, 3);
  assert.equal(stats.weekSecondarySets, 0);
  assert.equal(stats.sessionCount, 1);
  assert.equal(stats.exerciseVolume, 460);
  assert.equal(stats.exercises.find(entry => entry.id === 'shoulder-press').sets, 2);
  assert.equal(stats.lastTrained, '2026-10-30');
});

test('anatomical members do not inherit the stronger role of another member in their group', () => {
  const state = { sessions: [session('one', '2026-10-30', [exercise('goblet-squat'), exercise('romanian-deadlift')])] };
  const maximus = getMuscleStats(state, 'Gluteus maximus.l', now);
  const medius = getMuscleStats(state, 'Gluteus medius.r', now);
  assert.equal(maximus.weekPrimarySets, 2);
  assert.equal(medius.weekPrimarySets, 0);
  assert.equal(medius.weekStabilizerSets, 1);
  assert.equal(getMuscleStats(state, 'Long head of biceps femoris.l', now).totalSets, 1);
  assert.equal(getMuscleStats(state, 'Short head of biceps femoris.l', now).totalSets, 0);
  const minimus = getMuscleStats(state, 'Gluteus minimus.l', now);
  assert.equal(minimus.mapped, true);
  assert.equal(minimus.totalSets, 0);
  assert.equal(minimus.weekPrimarySets, 0);
  const group = getMuscleStats(state, 'glutes', now);
  assert.equal(group.weekPrimarySets, 2);
  assert.equal(group.weekStabilizerSets, 0);
});

test('weeks begin on local Monday, future workouts and drafts never contribute', () => {
  const state = { sessions: [
    session('old', '2026-10-25', [exercise('bench-press')]),
    session('monday', '2026-10-26', [exercise('bench-press')]),
    session('future', '2026-10-31', [exercise('bench-press', [{ reps: 99, weight: 99 }])]),
    { id: 'unfinished', date: '2026-10-30', exercises: [exercise('bench-press')] },
    session('invalid', '2026-02-30', [exercise('bench-press')]),
  ], draft: session('draft', '2026-10-30', [exercise('bench-press')]) };
  const stats = getMuscleStats(state, 'Pectoralis major.r', now);
  assert.equal(stats.totalSets, 2);
  assert.equal(stats.weekPrimarySets, 1);
  assert.equal(stats.sessionCount, 2);
  assert.equal(stats.lastTrained, '2026-10-26');
  assert.equal(getMuscleStats(state, 'Pectoralis major.r', new Date(2026, 10, 2)).weekPrimarySets, 0);
});

test('bodyweight sets count, zero external load stays zero, and side histories are shared', () => {
  const state = { sessions: [session('one', '2026-10-30', [exercise('push-up', [{ reps: 15, weight: 0 }])])] };
  const before = structuredClone(state);
  const left = getMuscleStats(state, 'Pectoralis major.l', now);
  const right = getMuscleStats(state, 'Pectoralis major.r', now);
  assert.equal(left.totalSets, 1);
  assert.equal(left.exerciseVolume, 0);
  assert.equal(left.totalSets, right.totalSets);
  assert.match(MUSCLE_STATS_NOTE, /must not be added across muscle cards/);
  left.exercises[0].sets = 999;
  left.group.aliases.push('changed');
  assert.equal(getMuscleStats(state, 'Pectoralis major.l', now).totalSets, 1);
  assert.deepEqual(state, before);
  const groups = getTrainedGroups(state, now);
  assert.ok(groups.some(group => group.id === 'chest' && group.primarySets === 1));
  assert.ok(groups.some(group => group.id === 'abs' && group.stabilizerSets === 1));
  assert.ok(!groups.some(group => group.id === 'calves'));
});


test('new exercise roles contribute only their logged sets to the relevant muscles', () => {
  const state = { sessions: [session('one', '2026-10-30', [exercise('calf-raise'), exercise('leg-curl'), exercise('pull-up', [{ reps: 6, weight: 0 }])])] };
  const calves = getMuscleStats(state, 'Soleus muscle.l', now);
  assert.equal(calves.mapped, true);
  assert.equal(calves.weekPrimarySets, 1);
  assert.equal(calves.totalSets, 1);
  const hamstring = getMuscleStats(state, 'Short head of biceps femoris.l', now);
  assert.equal(hamstring.weekPrimarySets, 1);
  const lats = getMuscleStats(state, 'Latissimus dorsi muscle.r', now);
  assert.equal(lats.weekPrimarySets, 1);
  assert.equal(lats.exerciseVolume, 0);
  assert.equal(lats.lastTrained, '2026-10-30');
});


test('every named exercise muscle resolves for training history', () => {
  for (const [id, guide] of Object.entries(MOVEMENT_SCIENCE)) {
    for (const muscle of [...guide.primary, ...guide.secondary, ...guide.stabilizers]) {
      assert.ok(muscleGroupForName(muscle), `${id}: ${muscle}`);
      assert.ok(getMuscleStats({ sessions: [] }, muscle, now).exercises.some(exercise => exercise.id === id), `${id}: ${muscle}`);
    }
  }
});
