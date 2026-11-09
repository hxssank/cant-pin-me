import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createExerciseMotion } from './exercise-motion.js';
import { FIRST_LOWERING_IDS } from './motion-catalog.js';

const DURATION = 6;
const COLORS = { muscle: '#8b969b', bone: '#d8d4c8', lifting: '#ff806b', lowering: '#65d7ef', hold: '#c7d3d2', selected: '#d6f76c' };
const TARGETS = {
  'bench-press': [/pectoralis.major/i, /triceps.brachii/i, /(clav|anterior).*deltoid|deltoid.*(clav|anterior)/i],
  'goblet-squat': [/vastus/i, /rectus.femoris/i, /gluteus.maximus/i],
  'dumbbell-row': [/latissimus/i, /biceps.brachii/i, /brachialis/i, /(spin|posterior).*deltoid|deltoid.*(spin|posterior)/i],
  'shoulder-press': [/deltoid/i, /triceps.brachii/i],
  'romanian-deadlift': [/biceps.femoris/i, /semitendinosus/i, /semimembranosus/i, /gluteus.maximus/i],
  'reverse-lunge': [/vastus/i, /rectus.femoris/i, /gluteus.maximus/i],
  'bicep-curl': [/biceps.brachii/i, /brachialis/i, /brachioradialis/i],
  'push-up': [/pectoralis.major/i, /triceps.brachii/i, /(clav|anterior).*deltoid|deltoid.*(clav|anterior)/i],
  'lateral-raise': [/(acrom|middle|lateral).*deltoid|deltoid.*(acrom|middle|lateral)/i, /supraspinatus/i],
  'hammer-curl': [/biceps.brachii/i, /brachialis/i, /brachioradialis/i],
  'chest-fly': [/pectoralis.major/i, /(clav|anterior).*deltoid|deltoid.*(clav|anterior)/i],
  'bodyweight-calf-raise': [/gastrocnemius/i, /soleus/i],
  'bodyweight-squat': [/vastus/i, /rectus.femoris/i, /gluteus.maximus/i],
  'dumbbell-front-raise': [/(clav|anterior).*deltoid|deltoid.*(clav|anterior)/i, /clavicular.*pectoralis.major/i],
  'dumbbell-shrug': [/(descending|upper).*trapezius|trapezius.*(descending|upper)/i, /levator.scapulae/i],
  'dumbbell-triceps-kickback': [/triceps.brachii/i],
  'dumbbell-reverse-fly': [/(spin|posterior).*deltoid|deltoid.*(spin|posterior)/i, /rhomboid/i, /(transverse|middle).*trapezius|trapezius.*(transverse|middle)/i],
  'dumbbell-reverse-lunge': [/vastus/i, /rectus.femoris/i, /gluteus.maximus/i],
};
const FIRST_LOWERING = new Set(FIRST_LOWERING_IDS);
const ASSET_TIMEOUT_MS = 30000;
let assetPromise;

export function repetitionAt(time) {
  const cycle = ((time % DURATION) + DURATION) % DURATION / DURATION;
  const smooth = t => t * t * (3 - 2 * t);
  if (cycle < .08) return { progress: 0, half: 0, hold: true };
  if (cycle < .46) return { progress: smooth((cycle - .08) / .38), half: 0, hold: false };
  if (cycle < .54) return { progress: 1, half: 0, hold: true };
  if (cycle < .92) return { progress: 1 - smooth((cycle - .54) / .38), half: 1, hold: false };
  return { progress: 0, half: 1, hold: true };
}

function assets() {
  if (!assetPromise) {
    const controller = new AbortController();
    const base = new URL('./assets/anatomy/', import.meta.url);
    const load = async (name, format) => {
      const response = await fetch(new URL(name, base), { signal: controller.signal });
      if (!response.ok) throw new Error(`Could not load ${name}.`);
      return response[format]();
    };
    let timeout;
    const deadline = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error('The anatomy model took too long to load.'));
      }, ASSET_TIMEOUT_MS);
    });
    const loading = Promise.all([load('anatomy.glb', 'arrayBuffer'), load('rig.json', 'json')])
      .then(async ([buffer, rig]) => [await new GLTFLoader().parseAsync(buffer, base.href), rig]);
    const attempt = Promise.race([loading, deadline]).catch(error => {
      controller.abort();
      if (assetPromise === attempt) assetPromise = null;
      throw error;
    }).finally(() => clearTimeout(timeout));
    assetPromise = attempt;
  }
  return assetPromise;
}

function makeDumbbell() {
  const group = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: '#343b40', metalness: .7, roughness: .33 });
  const steel = new THREE.MeshStandardMaterial({ color: '#c3cbd0', metalness: .8, roughness: .24 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .17, 12), steel);
  handle.rotation.z = Math.PI / 2;group.add(handle);
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .075, 10), iron);
    head.rotation.z = Math.PI / 2;head.position.x = side * .11;head.castShadow = true;group.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .078, 16), steel);
    cap.rotation.z = Math.PI / 2;cap.position.x = side * .11;group.add(cap);
  }
  return group;
}

function makeBench() {
  const group = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#232a31', roughness: .82 }));
  pad.name = 'pad';pad.castShadow = true;pad.receiveShadow = true;group.add(pad);
  const metal = new THREE.MeshStandardMaterial({ color: '#56616a', metalness: .65, roughness: .42 });
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.055, 1, .055), metal);
    leg.name = 'leg';leg.userData.side = side;leg.castShadow = true;group.add(leg);
    const base = new THREE.Mesh(new THREE.BoxGeometry(.48, .04, .085), metal);
    base.name = 'base';base.userData.side = side;group.add(base);
  }
  return group;
}

function displayName(mesh) {
  return (mesh.userData.anatomicalName || mesh.userData.label || mesh.name).replace(/_/g, ' ').replace(/\.\d{3}$/, '').replace(/\s+/g, ' ').trim();
}

export function mountAnatomyViewer(container, { exerciseId, initialMode = 'movement', overview = false, onUpdate = () => {}, onSelect = () => {}, onError = () => {} } = {}) {
  let disposed = false, model, motion, frame = null, lastFrame = performance.now(), lastPaint = 0, dirty = true;
  let time = .2, paused = overview || matchMedia('(prefers-reduced-motion: reduce)').matches, speed = 1, mode = initialMode, layer = 'muscles';
  let currentPose, selectedName, visible = true, previousColor = '';
  const meshes = [], ownedMaterials = [], equipment = new THREE.Group();
  const scene = new THREE.Scene();
  scene.background = overview ? null : new THREE.Color('#10151c');
  scene.fog = new THREE.Fog('#10151c', 6, 13);
  const camera = new THREE.PerspectiveCamera(36, 1, .02, 30);
  camera.position.set(2.8, 1.5, 3.2);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = overview ? 1.05 : 1.35;
  renderer.shadowMap.enabled = !overview;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.className = 'anatomy-canvas';
  renderer.domElement.setAttribute('aria-label', overview ? '3D anatomy. Drag to rotate, or use the left and right arrow keys.' : 'Interactive 3D anatomy. Drag to rotate; use the camera and zoom buttons for keyboard control.');
  if (overview) renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('role', 'img');
  container.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;controls.dampingFactor = .12;controls.enablePan = false;controls.enableZoom = false;
  controls.minDistance = .9;controls.maxDistance = 6;controls.maxPolarAngle = Math.PI * .88;
  controls.target.set(0, .9, 0);
  scene.add(new THREE.HemisphereLight(overview ? '#d7e2d2' : '#dbeaff', overview ? '#151a17' : '#28303a', overview ? 1.05 : 2.2));
  const key = new THREE.DirectionalLight(overview ? '#f2f7ed' : '#fff1df', overview ? 2.6 : 3.3);key.position.set(-2, 4, 3);
  key.castShadow = true;key.shadow.mapSize.set(1024, 1024);key.shadow.bias = -.0005;
  Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: .1, far: 10 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(overview ? '#c3ff5e' : '#9dc9ff', overview ? 2 : 2.3);rim.position.set(2, 2, -3);scene.add(rim);
  const fill = new THREE.DirectionalLight(overview ? '#a8b9a9' : '#fff6eb', overview ? .55 : .8);fill.position.set(1, 1, 4);scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#172029', roughness: 1 }));
  floor.visible = !overview;floor.rotation.x = -Math.PI / 2;floor.position.y = -.001;floor.receiveShadow = true;scene.add(floor);
  const grid = new THREE.GridHelper(5, 20, '#293744', '#22303c');grid.visible = !overview;grid.material.transparent = true;grid.material.opacity = .4;grid.position.y = 0;scene.add(grid);
  const weights = [makeDumbbell(), makeDumbbell()];weights.forEach(weight => equipment.add(weight));
  const bench = makeBench();equipment.add(bench);scene.add(equipment);
  const observer = new ResizeObserver(() => resize());observer.observe(container);
  const intersection = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? true;
    if (visible) { lastFrame = performance.now();invalidate(); }
    else cancelFrame();
  });intersection.observe(container);
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let downPoint;
  const onDown = event => { downPoint = [event.clientX, event.clientY]; };
  const onUp = event => {
    if (overview || !downPoint || Math.hypot(event.clientX - downPoint[0], event.clientY - downPoint[1]) > 6 || !model) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(meshes.filter(mesh => mesh.visible), false)[0];
    const part = hit?.object.userData.faceRanges?.find(range => hit.faceIndex >= range.start && hit.faceIndex < range.start + range.count);
    selectedName = part?.name || (hit ? displayName(hit.object) : null);
    previousColor = '';update();invalidate();
    onSelect(hit ? { name: selectedName, tissue: part?.tissue || hit.object.userData.tissue, involved: Boolean(hit.object.userData.involved) } : null);
  };
  const onKeyDown = event => {
    if (!overview || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), event.key === 'ArrowLeft' ? .25 : -.25).add(controls.target);
    controls.update();
  };
  const onContextLost = event => { event.preventDefault();if (!disposed) onError(new Error('3D rendering stopped. Close and reopen this guide to reload it.')); };
  const onVisibilityChange = () => {
    if (document.hidden) cancelFrame();
    else { lastFrame = performance.now();invalidate(); }
  };
  controls.addEventListener('change', invalidate);
  document.addEventListener('visibilitychange', onVisibilityChange);
  renderer.domElement.addEventListener('pointerdown', onDown);renderer.domElement.addEventListener('pointerup', onUp);renderer.domElement.addEventListener('keydown', onKeyDown);renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  function resize() {
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;camera.updateProjectionMatrix();renderer.setSize(width, height, false);
    invalidate();
  }
  function cancelFrame() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }
  function schedule() {
    if (!disposed && visible && !document.hidden && frame === null) frame = requestAnimationFrame(animate);
  }
  function invalidate() { dirty = true;schedule(); }
  function setEquipment(pose) {
    const dumbbells = pose.dumbbells || [];
    weights.forEach((weight, index) => {
      const value = dumbbells[index];weight.visible = Boolean(value) && mode === 'movement';
      if (!value) return;
      weight.position.fromArray(value.position || value);weight.quaternion.set(0, 0, 0, 1);
      if (value.quaternion) weight.quaternion.fromArray(value.quaternion);
    });
    bench.visible = Boolean(pose.bench) && mode === 'movement';
    if (pose.bench) {
      const { position, size } = pose.bench;bench.position.fromArray(position);
      const pad = bench.getObjectByName('pad');pad.scale.fromArray(size);
      for (const item of bench.children.filter(child => child.name !== 'pad')) {
        item.position.z = item.userData.side * size[2] * .33;
        if (item.name === 'leg') { item.scale.y = Math.max(.01, position[1] - size[1] / 2);item.position.y = -size[1] / 2 - item.scale.y / 2; }
        else item.position.y = -position[1] + .02;
      }
    }
  }
  function update() {
    if (!motion) return;
    const rep = repetitionAt(time);
    currentPose = motion.setPose(exerciseId, rep.progress, mode);
    setEquipment(currentPose);
    const lowering = FIRST_LOWERING.has(exerciseId) ? rep.half === 0 : rep.half === 1;
    const phase = rep.hold ? 'hold' : lowering ? 'lowering' : 'lifting';
    const colorKey = `${phase}-${mode}-${layer}`;
    if (colorKey !== previousColor) {
      previousColor = colorKey;
      for (const mesh of meshes) {
        const bone = mesh.userData.tissue === 'bone';
        mesh.visible = layer === 'bones' ? bone : true;
        const ranges = mesh.userData.faceRanges || [];
        const color = mesh.geometry.getAttribute('color');
        const index = mesh.geometry.index;
        for (const part of ranges) {
          const target = !bone && TARGETS[exerciseId]?.some(regex => regex.test(part.name)) && !(exerciseId === 'romanian-deadlift' && /short head of biceps femoris/i.test(part.name));
          const selected = selectedName === part.name;
          const tint = new THREE.Color(selected ? COLORS.selected : bone ? (overview ? '#a0ada4' : COLORS.bone) : overview ? part.weeklyTraining ? '#6eb9dd' : '#68776f' : target ? COLORS[mode === 'anatomy' ? 'lifting' : phase] : COLORS.muscle);
          for (let i = part.start * 3; i < (part.start + part.count) * 3; i++) {
            const vertex = index ? index.getX(i) : i;
            color.setXYZ(vertex, tint.r, tint.g, tint.b);
          }
        }
        if (color) color.needsUpdate = true;
        mesh.material.opacity = 1;mesh.material.transparent = false;
      }
    }
    onUpdate({ time, duration: DURATION, paused, speed, mode, layer, phase, progress: rep.progress });
  }
  function setCamera(angle = ['bench-press','dumbbell-row','push-up','bodyweight-calf-raise','dumbbell-front-raise','dumbbell-triceps-kickback'].includes(exerciseId) && mode === 'movement' ? 'side' : 'three-quarter') {
    const target = new THREE.Vector3().fromArray(currentPose?.target || [0, .9, 0]);
    const radius = overview ? .93 : currentPose?.radius || 1.1;
    const distance = Math.max(2.2, radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.aspect < 1 ? 1 / camera.aspect : 1) * .95);
    const direction = angle === 'front' ? [0, .1, 1] : angle === 'back' ? [0, .1, -1] : angle === 'side' ? [1, .1, .001] : [.8, .28, 1];
    camera.position.copy(target).add(new THREE.Vector3(...direction).normalize().multiplyScalar(distance));
    controls.target.copy(target);controls.minDistance = distance * .4;controls.maxDistance = distance * 1.7;
    controls.update();
  }
  function animate(now) {
    frame = null;
    if (disposed || document.hidden || !visible) return;
    const delta = Math.min(.1, (now - lastFrame) / 1000);lastFrame = now;
    const playing = !paused && mode === 'movement';
    if (playing && now - lastPaint < 32) { schedule();return; }
    if (playing) time = (time + (now - lastPaint < 150 ? (now - lastPaint) / 1000 : delta) * speed) % DURATION;
    if (playing || dirty) {
      dirty = false;lastPaint = now;update();controls.update();renderer.render(scene, camera);
    }
    if (playing) schedule();
  }
  const ready = assets().then(([gltf, rig]) => {
    if (disposed) return;
    model = clone(gltf.scene);scene.add(model);
    model.traverse(mesh => {
      if (!mesh.isMesh) return;
      const originalName = displayName(mesh);
      const bone = mesh.userData.tissue === 'bone' || /bone|skelet|skull|vertebr|sternum|costal|rib\b|clavic|scapul|humerus|radius|ulna|femur|patella|tibia|fibula|carpal|tarsal|phalan|mandib|pelvis/i.test(mesh.userData.tissue || '');
      mesh.userData.tissue = bone ? 'bone' : 'muscle';
      mesh.userData.anatomicalName = originalName;
      mesh.userData.involved = !bone && TARGETS[exerciseId]?.some(regex => regex.test(originalName));
      if (exerciseId === 'reverse-lunge' && /\b(right|R)\b|\.R|_R/.test(originalName)) mesh.userData.involved = false;
      mesh.geometry = mesh.geometry.clone();
      mesh.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(mesh.geometry.attributes.position.count * 3), 3));
      mesh.material = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: overview ? .46 : bone ? .58 : .72, metalness: overview ? .18 : .02, side: THREE.DoubleSide });
      ownedMaterials.push(mesh.material);mesh.castShadow = true;mesh.receiveShadow = false;mesh.frustumCulled = false;
      meshes.push(mesh);
    });
    motion = createExerciseMotion(model, rig);update();resize();setCamera(overview?'front':undefined);
    container.dataset.ready = 'true';container.dataset.meshCount = String(meshes.length);
    invalidate();
  }).catch(error => { if (!disposed) onError(error);throw error; });
  resize();
  return {
    ready,
    setTime(value) { time = Math.max(0, Math.min(DURATION - .001, Number(value) || 0));paused = true;update();invalidate(); },
    setPaused(value) { paused = Boolean(value);lastFrame = performance.now();lastPaint = lastFrame;update();invalidate(); },
    setSpeed(value) { speed = [.25, .5, 1].includes(Number(value)) ? Number(value) : 1;update();invalidate(); },
    setCamera,
    muscleNames() { return meshes.flatMap(mesh => (mesh.userData.faceRanges || []).filter(part => part.tissue === 'muscle').map(part => part.name)).sort(); },
    setExposure(lookup) { for (const mesh of meshes) for (const part of mesh.userData.faceRanges || []) part.weeklyTraining = part.tissue === 'muscle' && Boolean(lookup(part.name));previousColor='';update();invalidate(); },
    selectMuscle(name) { selectedName = name;previousColor='';update();invalidate(); },
    setMode(value) { mode = value === 'anatomy' ? 'anatomy' : 'movement';lastFrame = performance.now();lastPaint = lastFrame;update();setCamera();invalidate(); },
    setLayer(value) { layer = value === 'bones' ? 'bones' : 'muscles';update();invalidate(); },
    zoom(amount) { camera.position.sub(controls.target).multiplyScalar(amount).add(controls.target);controls.update(); },
    dispose() {
      disposed = true;cancelFrame();observer.disconnect();intersection.disconnect();controls.removeEventListener('change', invalidate);controls.dispose();document.removeEventListener('visibilitychange', onVisibilityChange);
      renderer.domElement.removeEventListener('pointerdown', onDown);renderer.domElement.removeEventListener('pointerup', onUp);renderer.domElement.removeEventListener('keydown', onKeyDown);renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      ownedMaterials.forEach(material => material.dispose());
      equipment.traverse(object => { object.geometry?.dispose();if (object.material) object.material.dispose(); });
      floor.geometry.dispose();floor.material.dispose();grid.geometry.dispose();grid.material.dispose();
      model?.traverse(object => { if (object.isSkinnedMesh) object.skeleton.dispose();if (object.isMesh) object.geometry.dispose(); });
      renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    },
  };
}
