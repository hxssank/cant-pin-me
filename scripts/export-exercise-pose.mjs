import fs from 'node:fs';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createExerciseMotion, EXERCISE_IDS } from '../dist/exercise-motion.js';

const [id, destination, progress = '.72'] = process.argv.slice(2);
if (!EXERCISE_IDS.includes(id) || !destination) throw new Error('Pass a supported exercise ID and output JSON path.');
const source = fs.readFileSync(new URL('../dist/assets/anatomy/anatomy.glb', import.meta.url));
const rig = JSON.parse(fs.readFileSync(new URL('../dist/assets/anatomy/rig.json', import.meta.url), 'utf8'));
const gltf = await new GLTFLoader().parseAsync(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), '');
const pose = createExerciseMotion(gltf.scene, rig).setPose(id, Number(progress));
gltf.scene.updateMatrixWorld(true);
const meshes = [];
const point = new Vector3();
gltf.scene.traverse(mesh => {
  if (!mesh.isMesh) return;
  if (mesh.skeleton) mesh.skeleton.update();
  const attribute = mesh.geometry.attributes.position;
  const vertices = [];
  for (let index = 0; index < attribute.count; index++) {
    point.fromBufferAttribute(attribute, index);
    if (mesh.isSkinnedMesh) mesh.applyBoneTransform(index, point);
    point.applyMatrix4(mesh.matrixWorld);
    vertices.push([point.x, -point.z, point.y].map(value => Number(value.toFixed(6))));
  }
  const indices = mesh.geometry.index ? Array.from(mesh.geometry.index.array) : Array.from({ length: attribute.count }, (_, i) => i);
  meshes.push({ name: mesh.name, tissue: mesh.userData.tissue, ranges: mesh.userData.faceRanges || [], vertices, indices });
});
fs.writeFileSync(destination, JSON.stringify({ id, progress: Number(progress), pose, meshes }));
