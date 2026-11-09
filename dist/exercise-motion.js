import { Vector3, Quaternion, Matrix4 } from 'three';
import { ANIMATED_EXERCISE_IDS } from './motion-catalog.js';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const vec = value => new Vector3().fromArray(value);
const clamp = value => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const normalizeName = value => value.toLowerCase().replace(/[^a-z]/g, '');
const lerp = (a, b, t) => a + (b - a) * t;

export const EXERCISE_IDS = ANIMATED_EXERCISE_IDS;

export function solveTwoBone(start, end, pole, upperLength, lowerLength) {
  const a = vec(start), requested = vec(end), toward = requested.clone().sub(a);
  const distance = Math.min(upperLength + lowerLength - 1e-6, Math.max(Math.abs(upperLength - lowerLength) + 1e-6, toward.length()));
  if (toward.lengthSq() < 1e-12) toward.set(0, -1, 0);
  toward.normalize();
  const along = (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  const bend = vec(pole).sub(a);
  bend.addScaledVector(toward, -bend.dot(toward));
  if (bend.lengthSq() < 1e-12) {
    bend.copy(Math.abs(toward.x) < .8 ? X : Z);
    bend.addScaledVector(toward, -bend.dot(toward));
  }
  bend.normalize();
  return {
    joint: a.clone().addScaledVector(toward, along).addScaledVector(bend, height).toArray(),
    end: a.clone().addScaledVector(toward, distance).toArray(),
    clamped: requested.distanceTo(a) > upperLength + lowerLength - 1e-6,
  };
}

function boneMap(rig) {
  const bones = Object.fromEntries(rig.bones.map(b => [b.name, b]));
  const get = name => {
    const result = bones[name] || rig.bones.find(b => normalizeName(b.name) === normalizeName(name));
    if (!result) throw new Error(`The anatomy rig is missing ${name}.`);
    return result;
  };
  return { get, length: name => vec(get(name).head).distanceTo(vec(get(name).tail)) };
}

export function poseTargets(exerciseId, progress, rig, mode = 'movement') {
  const t = clamp(progress), { get, length } = boneMap(rig);
  const restHips = vec(get('hips').head);
  const bones = {};
  const bodyRotation = new Quaternion();
  let hips = restHips.clone(), bench = null;
  let target = [0, .89, 0], radius = 1.08;
  const equipment = [];
  const supine = ['bench-press', 'chest-fly'].includes(exerciseId);
  const squat = ['goblet-squat', 'bodyweight-squat'].includes(exerciseId);
  const lunge = ['reverse-lunge', 'dumbbell-reverse-lunge'].includes(exerciseId);
  const bentOver = ['dumbbell-triceps-kickback', 'dumbbell-reverse-fly'].includes(exerciseId);
  const supported = EXERCISE_IDS.includes(exerciseId) && mode !== 'anatomy';
  if (!supported) {
    for (const b of rig.bones) bones[b.name] = { head: [...b.head], tail: [...b.tail], basis: [0, 0, 0, 1] };
    return { bones, dumbbells: [], bench, target, radius, groundY: 0, mode: 'anatomy', exerciseId: null, landmarks: {} };
  }

  let lean = 0;
  if (supine) {
    hips.set(0, .615, .25); lean = -Math.PI / 2;
    bench = { position: [0, .435, -.12], size: [.34, .16, 1.24] };
    target = [0, .66, -.03]; radius = 1.17;
  } else if (squat) {
    hips.set(0, lerp(.87, .50, t), lerp(-.027, -.20, t)); lean = .27 * t;
    target = [0, .88, .02]; radius = 1.08;
  } else if (exerciseId === 'romanian-deadlift') {
    hips.set(0, .87, lerp(-.027, -.307, t)); lean = 1.08 * t;
    const offset = vec(get('thigh_L').head).sub(restHips).applyAxisAngle(X, lean);
    const ankle = vec(get('foot_L').head);
    const a = length('thigh_L'), b = length('shin_L');
    const reachSquared = a * a + b * b + 2 * a * b * Math.cos(20 * Math.PI / 180);
    hips.y = ankle.y + Math.sqrt(reachSquared - (offset.x - ankle.x) ** 2 - (hips.z + offset.z - ankle.z) ** 2) - offset.y;
    target = [0, .88, .03]; radius = 1.08;
  } else if (lunge) {
    hips.set(0, lerp(.862, .49, t), lerp(.015, -.20, t)); lean = .11 * t;
    target = [0, .83, -.15]; radius = 1.14;
  } else if (exerciseId === 'dumbbell-row') {
    hips.set(0, .86, -.10); lean = 1.27;
    bench = { position: [.10, .38, .04], size: [.34, .15, 1.08] };
    target = [0, .65, .03]; radius = 1.05;
  } else if (exerciseId === 'push-up') {
    const legLength = length('thigh_L') + length('shin_L') - .0002;
    lean = lerp(1.19, 1.465, t);
    const rotation = new Quaternion().setFromAxisAngle(X, lean);
    const hipOffset = vec(get('thigh_L').head).sub(restHips).applyQuaternion(rotation);
    hips.set(0, .078 + legLength * Math.cos(lean) - hipOffset.y, -.90 + legLength * Math.sin(lean) - hipOffset.z);
    target = [0, .32, -.23]; radius = 1.13;
  } else if (exerciseId === 'shoulder-press') {
    target = [0, 1.02, .01]; radius = 1.2;
  } else if (bentOver) {
    hips.set(0, .81, -.15); lean = 1.10;
    target = [0, .76, .12]; radius = 1.08;
  } else if (exerciseId === 'bodyweight-calf-raise') {
    const foot = get('foot_L');
    const direction = vec(foot.tail).sub(vec(foot.head));
    const raisedAnkle = vec(foot.tail).sub(direction.clone().applyAxisAngle(X, .58 * t));
    hips.add(raisedAnkle.sub(vec(foot.head)));
  }
  bodyRotation.setFromAxisAngle(X, lean);
  const bodyPoint = point => vec(point).sub(restHips).applyQuaternion(bodyRotation).add(hips);
  const bodyBasis = bodyRotation.toArray();
  for (const b of rig.bones) bones[b.name] = { head: bodyPoint(b.head).toArray(), tail: bodyPoint(b.tail).toArray(), basis: bodyBasis };
  const h = name => vec(bones[get(name).name].head);
  const put = (name, a, b, basis = bodyRotation) => { bones[get(name).name] = { head: a.toArray(), tail: b.toArray(), basis: basis.toArray() }; };
  const handPoints = {};
  const landmarks = {};

  for (const [side, sign] of [['L', 1], ['R', -1]]) {
    const clavicle = `clavicle_${side}`, upper = `upper_arm_${side}`, forearm = `forearm_${side}`, hand = `hand_${side}`;
    const thigh = `thigh_${side}`, shin = `shin_${side}`, foot = `foot_${side}`;
    let shoulder = h(upper);
    if (['shoulder-press', 'lateral-raise', 'dumbbell-front-raise', 'dumbbell-shrug'].includes(exerciseId)) {
      const amount = (exerciseId === 'shoulder-press' ? .22 : exerciseId === 'dumbbell-shrug' ? .32 : .11) * t;
      const clavicleHead = h(clavicle);
      const direction = shoulder.clone().sub(clavicleHead).applyAxisAngle(Z, sign * amount);
      shoulder = clavicleHead.clone().add(direction);
      put(clavicle, clavicleHead, shoulder);
    }
    const hip = h(thigh);
    let ankle = vec(get(foot).head), kneePole = hip.clone().add(new Vector3(0, -.2, .65));
    let footDirection = vec(get(foot).tail).sub(vec(get(foot).head));
    if (supine) {
      ankle.set(sign * .18, .0766, .72);
      kneePole.set(sign * .20, .50, 1);
    } else if (squat) {
      ankle.set(sign * .135, .0766, .04);
      kneePole.set(sign * .17, .48, .72);
    } else if (lunge) {
      if (side === 'L') ankle.set(.10, .0766, .12);
      else {
        ankle.set(-.10, .0766 + .055 * Math.sin(Math.PI * t) + .07 * t, lerp(.0233, -.65, t));
        footDirection.applyAxisAngle(X, .80 * t);
      }
      kneePole.set(sign * .12, .42, .60);
    } else if (exerciseId === 'dumbbell-row') {
      if (side === 'L') {
        ankle.set(.083, .50, -.27);
        kneePole.set(.083, .50, .20);
        footDirection.set(0, -.03, -.13).setLength(length(foot));
      } else {
        ankle.set(-.22, .0766, -.18);
        kneePole.set(-.23, .47, .34);
      }
    } else if (exerciseId === 'push-up') {
      ankle.set(sign * .083, .078, -.90);
      kneePole.set(sign * .083, .05, -.55);
      footDirection.set(0, -.058, -.122).setLength(length(foot));
    } else if (exerciseId === 'bodyweight-calf-raise') {
      footDirection.applyAxisAngle(X, .58 * t);
      ankle = vec(get(foot).tail).sub(footDirection);
    }
    const leg = solveTwoBone(hip.toArray(), ankle.toArray(), kneePole.toArray(), length(thigh), length(shin));
    const knee = vec(leg.joint), actualAnkle = vec(leg.end);
    put(thigh, hip, knee); put(shin, knee, actualAnkle);
    put(foot, actualAnkle, actualAnkle.clone().add(footDirection), new Quaternion());
    landmarks[`hip_${side}`] = hip.toArray(); landmarks[`knee_${side}`] = knee.toArray(); landmarks[`ankle_${side}`] = actualAnkle.toArray();

    let wrist, elbow, pole = shoulder.clone().add(new Vector3(sign * .5, -.25, .3));
    if (exerciseId === 'bench-press') {
      wrist = new Vector3(sign * lerp(.35, .18, t), lerp(.79, 1.145, t), lerp(-.06, -.23, t));
      pole.set(sign * .44, .46, .12);
    } else if (exerciseId === 'chest-fly') {
      const angle = lerp(.10, 1.28, t);
      const upperDirection = new Vector3(sign * Math.sin(angle), Math.cos(angle), 0);
      const forearmDirection = new Vector3(sign * Math.sin(angle - .28), Math.cos(angle - .28), 0);
      elbow = shoulder.clone().addScaledVector(upperDirection, length(upper));
      wrist = elbow.clone().addScaledVector(forearmDirection, length(forearm));
    } else if (exerciseId === 'goblet-squat') {
      wrist = bodyPoint([sign * .068, 1.21, .135]);
      pole = bodyPoint([sign * .22, 1.02, .19]);
    } else if (exerciseId === 'bodyweight-squat') {
      const direction = new Vector3(sign * .09, -.12, 1).normalize().applyQuaternion(bodyRotation);
      elbow = shoulder.clone().addScaledVector(direction, length(upper));
      wrist = elbow.clone().addScaledVector(direction.clone().applyAxisAngle(X, -.12), length(forearm));
    } else if (exerciseId === 'shoulder-press') {
      wrist = new Vector3(sign * lerp(.39, .18, t), lerp(1.47, 1.94, t), lerp(.09, .025, t));
      pole.set(sign * .48, 1.20, .08);
    } else if (exerciseId === 'romanian-deadlift') {
      wrist = shoulder.clone().add(new Vector3(sign * .018, -(length(upper) + length(forearm) - .002), .012));
      pole = shoulder.clone().add(new Vector3(sign * .25, -.35, .12));
    } else if (lunge) {
      const weighted = exerciseId === 'dumbbell-reverse-lunge';
      wrist = shoulder.clone().add(new Vector3(sign * (weighted ? .09 : .04), -(length(upper) + length(forearm) - (weighted ? .014 : .003)), .025));
      pole = shoulder.clone().add(new Vector3(sign * .20, -.35, .12));
    } else if (exerciseId === 'dumbbell-row') {
      if (side === 'L') {
        wrist = new Vector3(.18, .49, .46);
        pole.set(.28, .74, .55);
      } else {
        wrist = new Vector3(lerp(-.18, -.23, t), lerp(.475, .82, t), lerp(.40, .14, t));
        pole.set(-.32, 1.06, -.12);
      }
    } else if (exerciseId === 'push-up') {
      wrist = new Vector3(sign * .25, .065, .40);
      pole = shoulder.clone().add(new Vector3(sign * .46, -.18, -.35));
    } else if (exerciseId === 'bicep-curl' || exerciseId === 'hammer-curl') {
      elbow = bodyPoint(get(forearm).head);
      const forearmDirection = vec(get(forearm).tail).sub(vec(get(forearm).head)).applyAxisAngle(X, -2.10 * t);
      wrist = elbow.clone().add(forearmDirection);
    } else if (exerciseId === 'lateral-raise') {
      const angle = lerp(.09, Math.PI / 2, t);
      const upperDirection = new Vector3(sign * Math.sin(angle), -Math.cos(angle), .13 * Math.sin(angle)).normalize();
      elbow = shoulder.clone().addScaledVector(upperDirection, length(upper));
      const forearmDirection = upperDirection.clone().add(new Vector3(0, -.025, .17)).normalize();
      wrist = elbow.clone().addScaledVector(forearmDirection, length(forearm));
    } else if (exerciseId === 'dumbbell-front-raise') {
      const angle = lerp(.05, 1.46, t);
      const upperDirection = new Vector3(sign * .10, -Math.cos(angle), Math.sin(angle)).normalize();
      const forearmDirection = new Vector3(sign * .10, -Math.cos(angle + .13), Math.sin(angle + .13)).normalize();
      elbow = shoulder.clone().addScaledVector(upperDirection, length(upper));
      wrist = elbow.clone().addScaledVector(forearmDirection, length(forearm));
    } else if (exerciseId === 'dumbbell-shrug' || exerciseId === 'bodyweight-calf-raise') {
      const direction = new Vector3(sign * .16, -1, .025).normalize();
      elbow = shoulder.clone().addScaledVector(direction, length(upper));
      wrist = elbow.clone().addScaledVector(direction, length(forearm));
    } else if (exerciseId === 'dumbbell-triceps-kickback') {
      const upperDirection = new Vector3(sign * .08, .10, -1).normalize();
      const forearmDirection = new Vector3(sign * .08, -Math.cos(1.64 * t), -Math.sin(1.64 * t)).normalize();
      elbow = shoulder.clone().addScaledVector(upperDirection, length(upper));
      wrist = elbow.clone().addScaledVector(forearmDirection, length(forearm));
    } else if (exerciseId === 'dumbbell-reverse-fly') {
      const angle = lerp(.08, 1.48, t);
      const upperDirection = new Vector3(sign * Math.sin(angle), -Math.cos(angle), .04).normalize();
      const forearmDirection = new Vector3(sign * Math.sin(angle - .16), -Math.cos(angle - .16), .04).normalize();
      elbow = shoulder.clone().addScaledVector(upperDirection, length(upper));
      wrist = elbow.clone().addScaledVector(forearmDirection, length(forearm));
    }
    if (!elbow) {
      const arm = solveTwoBone(shoulder.toArray(), wrist.toArray(), pole.toArray(), length(upper), length(forearm));
      elbow = vec(arm.joint); wrist = vec(arm.end);
    }
    const neutralGrip = ['hammer-curl', 'chest-fly', 'dumbbell-shrug', 'dumbbell-triceps-kickback', 'dumbbell-reverse-fly', 'dumbbell-reverse-lunge'].includes(exerciseId);
    const gripBasis = name => neutralGrip ? bodyRotation.clone().multiply(new Quaternion().setFromAxisAngle(vec(get(name).tail).sub(vec(get(name).head)).normalize(), sign * Math.PI / 2)) : bodyRotation;
    put(upper, shoulder, elbow); put(forearm, elbow, wrist, gripBasis(forearm));
    let handDirection = wrist.clone().sub(elbow).normalize();
    if (exerciseId === 'push-up' || (exerciseId === 'dumbbell-row' && side === 'L')) handDirection.set(0, -.1, 1).normalize();
    put(hand, wrist, wrist.clone().addScaledVector(handDirection, length(hand)), gripBasis(hand));
    const grip = wrist.clone().addScaledVector(handDirection, .045);
    handPoints[side] = grip;
    landmarks[`shoulder_${side}`] = shoulder.toArray(); landmarks[`elbow_${side}`] = elbow.toArray(); landmarks[`wrist_${side}`] = wrist.toArray();
  }
  if (exerciseId === 'goblet-squat') {
    const grip = handPoints.L.clone().add(handPoints.R).multiplyScalar(.5);
    equipment.push({ position: grip.toArray(), quaternion: new Quaternion().setFromAxisAngle(Z, Math.PI / 2).toArray(), kind: 'goblet' });
  } else if (exerciseId === 'dumbbell-row') {
    equipment.push({ position: handPoints.R.toArray(), quaternion: new Quaternion().setFromAxisAngle(Y, Math.PI / 2).toArray() });
  } else if (!['reverse-lunge', 'push-up', 'bodyweight-squat', 'bodyweight-calf-raise'].includes(exerciseId)) {
    const neutralWeights = ['lateral-raise', 'hammer-curl', 'chest-fly', 'dumbbell-shrug', 'dumbbell-triceps-kickback', 'dumbbell-reverse-fly', 'dumbbell-reverse-lunge'].includes(exerciseId);
    const orientation = new Quaternion();
    if (exerciseId === 'hammer-curl') orientation.setFromAxisAngle(X, -2.10 * t);
    if (exerciseId === 'dumbbell-triceps-kickback') orientation.setFromAxisAngle(X, 1.64 * t);
    if (neutralWeights) orientation.multiply(new Quaternion().setFromAxisAngle(Y, Math.PI / 2));
    for (const side of ['L', 'R']) equipment.push({ position: handPoints[side].toArray(), quaternion: orientation.toArray() });
  }
  return { bones, dumbbells: equipment, bench, target, radius, groundY: 0, mode: 'movement', exerciseId, landmarks };
}

export function createExerciseMotion(scene, rigMetadata) {
  scene.updateMatrixWorld(true);
  const nodes = new Map();
  scene.traverse(node => { if (node.isBone) nodes.set(normalizeName(node.name), node); });
  const records = rigMetadata.bones.map(spec => {
    const bone = nodes.get(normalizeName(spec.name));
    if (!bone) throw new Error(`The anatomy model is missing its ${spec.name} joint.`);
    return {
      spec, bone,
      restQuaternion: bone.getWorldQuaternion(new Quaternion()),
      restDirection: vec(spec.tail).sub(vec(spec.head)).normalize(),
      localPosition: bone.position.clone(), localQuaternion: bone.quaternion.clone(), localScale: bone.scale.clone(),
    };
  });
  const inverse = new Matrix4(), desiredWorldQuaternion = new Quaternion(), parentQuaternion = new Quaternion();
  let last = null;
  function setPose(id, progress = 0, mode = 'movement') {
    const pose = poseTargets(id, progress, rigMetadata, mode);
    for (const record of records) {
      record.bone.position.copy(record.localPosition); record.bone.quaternion.copy(record.localQuaternion); record.bone.scale.copy(record.localScale);
    }
    scene.updateMatrixWorld(true);
    if (pose.mode === 'anatomy') { last = pose; return pose; }
    for (const { spec, bone, restQuaternion, restDirection } of records) {
      const desired = pose.bones[spec.name], basis = new Quaternion().fromArray(desired.basis);
      const direction = vec(desired.tail).sub(vec(desired.head)).normalize();
      const rotatedRest = restDirection.clone().applyQuaternion(basis);
      desiredWorldQuaternion.setFromUnitVectors(rotatedRest, direction).multiply(basis).multiply(restQuaternion);
      if (bone.parent) {
        inverse.copy(bone.parent.matrixWorld).invert();
        bone.position.copy(vec(desired.head).applyMatrix4(inverse));
        bone.parent.getWorldQuaternion(parentQuaternion).invert();
        bone.quaternion.copy(parentQuaternion.multiply(desiredWorldQuaternion));
      } else {
        bone.position.fromArray(desired.head); bone.quaternion.copy(desiredWorldQuaternion);
      }
      bone.updateMatrix(); bone.updateMatrixWorld(true);
    }
    scene.updateMatrixWorld(true);
    last = pose;
    return pose;
  }
  return {
    setPose,
    equipmentInfo: id => poseTargets(id, 0, rigMetadata),
    getLandmarks: () => last ? structuredClone(last.landmarks) : {},
  };
}
