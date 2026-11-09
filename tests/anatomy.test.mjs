import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, demoSvg, anatomySvg, muscleInfo, DEMO_DURATION, getDemoPhase } from '../dist/exercises.js';

const animatedExercises = EXERCISES.slice(0, 9);

test('every animated exercise has muscles, both movement directions, and an anatomical demo', () => {
  for (const exercise of animatedExercises) {
    const info = muscleInfo(exercise.id);
    assert.ok(info.primary.length > 0);
    assert.ok(info.secondary.length > 0);
    assert.ok(['front', 'back'].includes(info.preferredView));
    assert.ok(info.concentric.length > 0);
    assert.ok(info.eccentric.length > 0);
    const svg = demoSvg(exercise.id);
    assert.match(svg, /anatomical movement demonstration/);
    assert.match(svg, /<animate attributeName="d"/);
    assert.match(svg, /attributeName="stop-color"/);
    assert.match(svg, /#ff7a64/);
    assert.match(svg, /#62cce6/);
    assert.ok(!svg.includes('NaN'));
    assert.ok(!svg.includes('undefined'));
  }
});

test('text phases follow each exercise direction and the shared animation timeline', () => {
  assert.equal(DEMO_DURATION, 6);
  const descents = new Set(['goblet-squat', 'romanian-deadlift', 'reverse-lunge', 'push-up']);
  for (const exercise of animatedExercises) {
    assert.equal(getDemoPhase(exercise.id, 0).key, 'hold');
    assert.equal(getDemoPhase(exercise.id, .04 * DEMO_DURATION).key, 'hold');
    assert.equal(getDemoPhase(exercise.id, .27 * DEMO_DURATION).key, descents.has(exercise.id) ? 'lengthening' : 'shortening');
    assert.equal(getDemoPhase(exercise.id, .5 * DEMO_DURATION).key, 'hold');
    assert.equal(getDemoPhase(exercise.id, .73 * DEMO_DURATION).key, descents.has(exercise.id) ? 'shortening' : 'lengthening');
    assert.equal(getDemoPhase(exercise.id, .97 * DEMO_DURATION).key, 'hold');
    assert.deepEqual(getDemoPhase(exercise.id, 1.5), getDemoPhase(exercise.id, 7.5));
    const svg = demoSvg(exercise.id);
    for (const tag of svg.matchAll(/<(?:animate|animateTransform)\b[^>]*>/g)) {
      assert.match(tag[0], /dur="6s"/);
      assert.match(tag[0], /keyTimes="0;0.08;0.46;0.54;0.92;1"/);
    }
  }
});

test('static and reduced-motion diagrams contain no animation', () => {
  for (const exercise of animatedExercises) {
    assert.doesNotMatch(demoSvg(exercise.id, { paused: true }), /<animate/);
    assert.doesNotMatch(anatomySvg(exercise.id, { view: 'front' }), /<animate/);
    assert.doesNotMatch(anatomySvg(exercise.id, { view: 'back' }), /<animate/);
  }
  const previousWindow = globalThis.window;
  try {
    globalThis.window = { matchMedia: () => ({ matches: true }) };
    assert.doesNotMatch(demoSvg('bicep-curl'), /<animate/);
    assert.match(demoSvg('bicep-curl', { respectReducedMotion: false }), /<animate/);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('each SVG uses independent paint IDs and muscle metadata cannot be mutated by a caller', () => {
  const first = demoSvg('bicep-curl');
  const second = demoSvg('bicep-curl');
  const ids = svg => [...svg.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids(first).filter(id => ids(second).includes(id)).length, 0);
  const info = muscleInfo('bicep-curl');
  info.primary.length = 0;
  info.targets.push('chest');
  assert.ok(muscleInfo('bicep-curl').primary.length > 0);
  assert.ok(!muscleInfo('bicep-curl').targets.includes('chest'));
});

test('unknown exercises produce no diagram or fabricated muscle information', () => {
  assert.equal(demoSvg('not-an-exercise'), '');
  assert.equal(anatomySvg('not-an-exercise'), '');
  assert.equal(muscleInfo('not-an-exercise'), null);
  assert.equal(getDemoPhase('not-an-exercise', 2), null);
});
