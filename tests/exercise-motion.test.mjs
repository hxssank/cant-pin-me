import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Bone, Group, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EXERCISE_IDS, createExerciseMotion, poseTargets, solveTwoBone } from '../dist/exercise-motion.js';

const rig = JSON.parse(fs.readFileSync(new URL('../dist/assets/anatomy/rig.json', import.meta.url), 'utf8'));
const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
const close = (actual, expected, tolerance = 1e-5) => assert.ok(distance(actual, expected) < tolerance, `${JSON.stringify(actual)} differs from ${JSON.stringify(expected)}`);

test('two-bone IK keeps both segment lengths and clamps unreachable targets', () => {
  const pose = solveTwoBone([0, 0, 0], [0, -.6, 0], [0, 0, 1], .4, .3);
  assert.ok(Math.abs(distance([0, 0, 0], pose.joint) - .4) < 1e-8);
  assert.ok(Math.abs(distance(pose.joint, pose.end) - .3) < 1e-8);
  close(pose.end, [0, -.6, 0]);
  const tooFar = solveTwoBone([0, 0, 0], [0, -2, 0], [0, 0, 1], .4, .3);
  assert.equal(tooFar.clamped, true);
  assert.ok(distance([0, 0, 0], tooFar.end) < .7);
  for (const values of [pose.joint, pose.end, tooFar.joint, tooFar.end]) assert.ok(values.every(Number.isFinite));
});

test('all eighteen exercise poses preserve every source bone length throughout the repetition', () => {
  assert.equal(EXERCISE_IDS.length, 18);
  for (const id of EXERCISE_IDS) {
    for (let frame = 0; frame <= 20; frame += 1) {
      const pose = poseTargets(id, frame / 20, rig);
      for (const bone of rig.bones) {
        const posed = pose.bones[bone.name];
        assert.ok(posed.head.every(Number.isFinite) && posed.tail.every(Number.isFinite));
        assert.ok(Math.abs(distance(posed.head, posed.tail) - distance(bone.head, bone.tail)) < 1e-6, `${id} stretches ${bone.name}`);
      }
    }
  }
});

test('ground supports stay planted through squats, hinges, bench press and the front lunge leg', () => {
  for (const id of ['goblet-squat', 'bodyweight-squat', 'romanian-deadlift', 'bench-press', 'chest-fly', 'reverse-lunge', 'dumbbell-reverse-lunge']) {
    const start = poseTargets(id, 0, rig);
    for (let frame = 1; frame <= 20; frame += 1) {
      const next = poseTargets(id, frame / 20, rig);
      close(next.landmarks.ankle_L, start.landmarks.ankle_L, .001);
      if (!['reverse-lunge', 'dumbbell-reverse-lunge'].includes(id)) close(next.landmarks.ankle_R, start.landmarks.ankle_R, .001);
    }
  }
});

test('push-up hands and feet remain fixed with nearly straight legs', () => {
  const start = poseTargets('push-up', 0, rig);
  for (let frame = 0; frame <= 20; frame += 1) {
    const pose = poseTargets('push-up', frame / 20, rig);
    for (const side of ['L', 'R']) {
      close(pose.landmarks[`ankle_${side}`], start.landmarks[`ankle_${side}`]);
      close(pose.landmarks[`wrist_${side}`], start.landmarks[`wrist_${side}`]);
      const hip = pose.landmarks[`hip_${side}`], knee = pose.landmarks[`knee_${side}`], ankle = pose.landmarks[`ankle_${side}`];
      assert.ok(distance(hip, knee) + distance(knee, ankle) - distance(hip, ankle) < .001);
      assert.ok(knee[1] > .05);
    }
  }
});

test('Romanian deadlift keeps a constant knee bend while the hips move backward', () => {
  const start = poseTargets('romanian-deadlift', 0, rig);
  const kneeAngle = pose => {
    const { hip_L: hip, knee_L: knee, ankle_L: ankle } = pose.landmarks;
    return new Vector3().fromArray(knee).sub(new Vector3().fromArray(hip))
      .angleTo(new Vector3().fromArray(ankle).sub(new Vector3().fromArray(knee)));
  };
  for (let frame = 0; frame <= 20; frame += 1) {
    const pose = poseTargets('romanian-deadlift', frame / 20, rig);
    assert.ok(Math.abs(kneeAngle(pose) - kneeAngle(start)) < 1e-5);
    assert.ok(pose.landmarks.wrist_L[1] < pose.landmarks.shoulder_L[1]);
  }
  assert.ok(poseTargets('romanian-deadlift', 1, rig).landmarks.hip_L[2] < start.landmarks.hip_L[2] - .25);
});

test('presses begin with the wrists above the elbows', () => {
  for (const id of ['bench-press', 'shoulder-press']) {
    const pose = poseTargets(id, 0, rig);
    const wrist = pose.landmarks.wrist_L, elbow = pose.landmarks.elbow_L;
    assert.ok(wrist[1] > elbow[1] + .20);
    assert.ok(Math.hypot(wrist[0] - elbow[0], wrist[2] - elbow[2]) < .06);
  }
});

test('press dumbbells have clearance at the top', () => {
  for (const id of ['bench-press', 'shoulder-press']) {
    const pose = poseTargets(id, 1, rig);
    assert.ok(distance(pose.dumbbells[0].position, pose.dumbbells[1].position) > .295);
  }
});

test('curl fixes the upper arms and lateral raise ends around shoulder height', () => {
  const curlStart = poseTargets('bicep-curl', 0, rig), curlEnd = poseTargets('bicep-curl', 1, rig);
  close(curlStart.landmarks.elbow_L, curlEnd.landmarks.elbow_L);
  close(curlStart.landmarks.elbow_R, curlEnd.landmarks.elbow_R);
  assert.ok(curlEnd.landmarks.wrist_L[1] > curlStart.landmarks.wrist_L[1]);
  const raise = poseTargets('lateral-raise', 1, rig);
  assert.ok(Math.abs(raise.landmarks.wrist_L[1] - raise.landmarks.shoulder_L[1]) < .04);
});

test('supported row keeps the support arm, knee and torso fixed while the free arm moves', () => {
  const start = poseTargets('dumbbell-row', 0, rig), end = poseTargets('dumbbell-row', 1, rig);
  close(start.landmarks.wrist_L, end.landmarks.wrist_L);
  close(start.landmarks.knee_L, end.landmarks.knee_L);
  close(start.bones.chest.head, end.bones.chest.head);
  assert.ok(distance(start.landmarks.wrist_R, end.landmarks.wrist_R) > .25);
  assert.equal(start.dumbbells.length, 1);
});

test('hammer curls keep the upper arm still and rotate the neutral grip with the forearm', () => {
  const start = poseTargets('hammer-curl', 0, rig), end = poseTargets('hammer-curl', 1, rig);
  const shaft = pose => new Vector3(1, 0, 0).applyQuaternion(new Quaternion().fromArray(pose.dumbbells[0].quaternion));
  for (const side of ['L', 'R']) {
    close(start.landmarks[`elbow_${side}`], end.landmarks[`elbow_${side}`]);
    assert.ok(end.landmarks[`wrist_${side}`][1] - start.landmarks[`wrist_${side}`][1] > .35);
  }
  assert.ok(Math.abs(shaft(start).x) < .001);
  assert.ok(Math.abs(shaft(start).y) < .001);
  assert.ok(Math.abs(shaft(end).y) > .8);
  assert.ok(shaft(start).distanceTo(shaft(end)) > 1);
  const regular = poseTargets('bicep-curl', 1, rig);
  assert.ok(Math.abs(shaft(regular).dot(shaft(end))) < .001);
  assert.notDeepEqual(end.bones.hand_L.basis, regular.bones.hand_L.basis);
  assert.notDeepEqual(end.bones.forearm_L.basis, regular.bones.forearm_L.basis);
});

test('chest fly opens an arc with a constant elbow bend and a supported torso', () => {
  const start = poseTargets('chest-fly', 0, rig), end = poseTargets('chest-fly', 1, rig);
  const angle = pose => {
    const { shoulder_L: shoulder, elbow_L: elbow, wrist_L: wrist } = pose.landmarks;
    return new Vector3().fromArray(elbow).sub(new Vector3().fromArray(shoulder))
      .angleTo(new Vector3().fromArray(wrist).sub(new Vector3().fromArray(elbow)));
  };
  for (let frame = 0; frame <= 20; frame += 1) {
    const pose = poseTargets('chest-fly', frame / 20, rig);
    close(pose.bones.chest.head, start.bones.chest.head);
    assert.ok(Math.abs(angle(pose) - angle(start)) < 1e-6);
    assert.ok(pose.landmarks.elbow_L[1] > pose.landmarks.shoulder_L[1]);
    assert.ok(distance(pose.dumbbells[0].position, pose.dumbbells[1].position) > .25);
  }
  assert.ok(end.landmarks.wrist_L[0] > start.landmarks.wrist_L[0] + .45);
  assert.ok(end.landmarks.wrist_L[1] < start.landmarks.wrist_L[1] - .25);
  assert.ok(start.bench);
});

test('calf raise pivots on fixed forefeet while the heels and body rise together', () => {
  const start = poseTargets('bodyweight-calf-raise', 0, rig);
  for (let frame = 0; frame <= 20; frame += 1) {
    const pose = poseTargets('bodyweight-calf-raise', frame / 20, rig);
    for (const side of ['L', 'R']) {
      close(pose.bones[`foot_${side}`].tail, start.bones[`foot_${side}`].tail);
      const hipRise = pose.landmarks[`hip_${side}`][1] - start.landmarks[`hip_${side}`][1];
      const ankleRise = pose.landmarks[`ankle_${side}`][1] - start.landmarks[`ankle_${side}`][1];
      assert.ok(Math.abs(hipRise - ankleRise) < 1e-6);
    }
    assert.deepEqual(pose.dumbbells, []);
  }
  assert.ok(poseTargets('bodyweight-calf-raise', 1, rig).landmarks.ankle_L[1] - start.landmarks.ankle_L[1] > .05);
});

test('front raise moves the arms forward while shrug elevates the shoulders without a curl', () => {
  const frontStart = poseTargets('dumbbell-front-raise', 0, rig), frontEnd = poseTargets('dumbbell-front-raise', 1, rig);
  close(frontStart.bones.hips.head, frontEnd.bones.hips.head);
  assert.ok(frontEnd.landmarks.wrist_L[2] - frontStart.landmarks.wrist_L[2] > .4);
  assert.ok(Math.abs(frontEnd.landmarks.wrist_L[1] - frontEnd.landmarks.shoulder_L[1]) < .05);
  const start = poseTargets('dumbbell-shrug', 0, rig), end = poseTargets('dumbbell-shrug', 1, rig);
  const rise = end.landmarks.shoulder_L[1] - start.landmarks.shoulder_L[1];
  assert.ok(rise > .04 && rise < .07);
  assert.ok(Math.abs(end.landmarks.wrist_L[1] - start.landmarks.wrist_L[1] - rise) < 1e-6);
  close(start.bones.chest.head, end.bones.chest.head);
});

test('kickback extends the elbow behind a fixed upper arm; reverse fly spreads both arms', () => {
  const start = poseTargets('dumbbell-triceps-kickback', 0, rig), end = poseTargets('dumbbell-triceps-kickback', 1, rig);
  for (const side of ['L', 'R']) {
    close(start.landmarks[`elbow_${side}`], end.landmarks[`elbow_${side}`]);
    close(start.landmarks[`shoulder_${side}`], end.landmarks[`shoulder_${side}`]);
    close(start.landmarks[`ankle_${side}`], end.landmarks[`ankle_${side}`]);
    assert.ok(end.landmarks[`wrist_${side}`][2] < start.landmarks[`wrist_${side}`][2] - .20);
  }
  const flyStart = poseTargets('dumbbell-reverse-fly', 0, rig), flyEnd = poseTargets('dumbbell-reverse-fly', 1, rig);
  close(flyStart.bones.chest.head, flyEnd.bones.chest.head);
  close(flyStart.bones.hips.head, flyEnd.bones.hips.head);
  assert.ok(distance(flyEnd.landmarks.wrist_L, flyEnd.landmarks.wrist_R) > 1.2);
  assert.ok(Math.abs(flyEnd.landmarks.wrist_L[1] - flyEnd.landmarks.shoulder_L[1]) < .12);
});

test('bodyweight squat carries no weight and loaded reverse lunge holds two weights outside the legs', () => {
  for (let frame = 0; frame <= 20; frame += 1) {
    const progress = frame / 20;
    const squat = poseTargets('bodyweight-squat', progress, rig);
    assert.deepEqual(squat.dumbbells, []);
    assert.ok(squat.landmarks.wrist_L[2] > squat.landmarks.shoulder_L[2] + .35);
    const lunge = poseTargets('dumbbell-reverse-lunge', progress, rig);
    assert.equal(lunge.dumbbells.length, 2);
    assert.ok(lunge.dumbbells[0].position[0] - lunge.landmarks.hip_L[0] > .14);
    assert.ok(lunge.dumbbells[0].position[1] > .2);
    assert.ok(lunge.dumbbells[1].position[1] > .2);
  }
});

test('neutral anatomy mode works without an exercise and contains no equipment', () => {
  const pose = poseTargets(null, .5, rig, 'anatomy');
  assert.equal(pose.mode, 'anatomy');
  assert.equal(pose.bench, null);
  assert.deepEqual(pose.dumbbells, []);
  for (const bone of rig.bones) close(pose.bones[bone.name].head, bone.head);
});

test('scene rig application resets deterministically and matches computed joint positions', () => {
  const scene = new Group(), nodes = new Map();
  for (const spec of rig.bones) {
    const bone = new Bone(); bone.name = spec.name;
    const parent = spec.parent ? nodes.get(spec.parent) : scene;
    const parentHead = spec.parent ? rig.bones.find(item => item.name === spec.parent).head : [0, 0, 0];
    bone.position.fromArray(spec.head.map((value, i) => value - parentHead[i]));
    parent.add(bone); nodes.set(spec.name, bone);
  }
  const motion = createExerciseMotion(scene, rig);
  for (const id of EXERCISE_IDS) {
    const result = motion.setPose(id, .65);
    for (const spec of rig.bones) close(nodes.get(spec.name).getWorldPosition(new Vector3()).toArray(), result.bones[spec.name].head);
  }
  motion.setPose(null, 0, 'anatomy');
  for (const spec of rig.bones) close(nodes.get(spec.name).getWorldPosition(new Vector3()).toArray(), spec.head);
});

test('exported anatomy skeleton accepts all poses and returns to its source stance', async () => {
  const buffer = fs.readFileSync(new URL('../dist/assets/anatomy/anatomy.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
  const motion = createExerciseMotion(gltf.scene, rig);
  const nodes = new Map();
  gltf.scene.traverse(node => { if (node.isBone) nodes.set(node.name, node); });
  for (const id of EXERCISE_IDS) {
    for (const progress of [0, .5, 1]) {
      const pose = motion.setPose(id, progress);
      for (const spec of rig.bones) close(nodes.get(spec.name).getWorldPosition(new Vector3()).toArray(), pose.bones[spec.name].head);
    }
  }
  motion.setPose(null, 0, 'anatomy');
  for (const spec of rig.bones) close(nodes.get(spec.name).getWorldPosition(new Vector3()).toArray(), spec.head);
});
