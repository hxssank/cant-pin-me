import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../dist/exercises.js';
import { MOVEMENT_SCIENCE, COLOR_EXPLANATION } from '../dist/movement-science.js';

test('every exercise has sourced motion guidance and separate muscle roles', () => {
  assert.deepEqual(Object.keys(MOVEMENT_SCIENCE).sort(), EXERCISES.map(exercise => exercise.id).sort());
  for (const info of Object.values(MOVEMENT_SCIENCE)) {
    for (const role of ['primary', 'secondary', 'stabilizers']) {
      assert.ok(role === 'secondary' || info[role].length > 0);
      assert.ok(info[role].every(name => typeof name === 'string' && name.length > 0));
    }
    const muscles = [...info.primary, ...info.secondary, ...info.stabilizers];
    assert.equal(new Set(muscles).size, muscles.length);
    for (const field of ['setup', 'mechanics', 'concentric', 'eccentric']) {
      assert.ok(typeof info[field] === 'string' && info[field].length > 0);
    }
    assert.ok(info.cues.length > 0);
    assert.ok(info.cues.every(cue => typeof cue === 'string' && cue.length > 0));
    assert.ok(info.demonstration.title.length > 0);
    assert.ok(['www.muscleandstrength.com', 'cdn.muscleandstrength.com', 'gymvisual.com', 'www.acefitness.org'].includes(new URL(info.demonstration.url).hostname));
    if (info.demonstration.kind) assert.ok(['reference', 'video'].includes(info.demonstration.kind));
    if (info.demonstration.youtubeId) assert.match(info.demonstration.youtubeId, /^[A-Za-z0-9_-]{11}$/);
    if (info.demonstration.vimeoId) assert.match(info.demonstration.vimeoId, /^\d+$/);
    assert.ok(info.sources.length >= 2);
    for (const source of info.sources) {
      assert.ok(source.title.length > 0);
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:');
      assert.ok(['www.acefitness.org', 'www.nsca.com', 'www.mayoclinic.org', 'openstax.org', 'pmc.ncbi.nlm.nih.gov', 'www.muscleandstrength.com', 'cdn.muscleandstrength.com', 'gymvisual.com'].includes(url.hostname));
    }
  }
});

test('phase descriptions distinguish limb motion, support roles and illustration limits', () => {
  assert.match(COLOR_EXPLANATION, /do not measure activation, force, or tissue strain/);
  assert.match(COLOR_EXPLANATION, /cross two joints/);
  assert.match(MOVEMENT_SCIENCE['shoulder-press'].mechanics, /shoulder blades rotate upward/);
  assert.match(MOVEMENT_SCIENCE['romanian-deadlift'].mechanics, /little change in knee bend/);
  assert.match(MOVEMENT_SCIENCE['reverse-lunge'].mechanics, /front leg; the rear leg has a different support role/);
  assert.match(MOVEMENT_SCIENCE['dumbbell-row'].mechanics, /trunk resists rotation/);
  assert.ok(MOVEMENT_SCIENCE['romanian-deadlift'].primary.includes('Biceps femoris, long head'));
  assert.ok(!MOVEMENT_SCIENCE['romanian-deadlift'].primary.includes('Biceps femoris, short head'));
  assert.match(MOVEMENT_SCIENCE['romanian-deadlift'].demonstration.note, /barbell/);
  assert.match(MOVEMENT_SCIENCE['dumbbell-row'].demonstration.note, /unsupported standing/);
});
