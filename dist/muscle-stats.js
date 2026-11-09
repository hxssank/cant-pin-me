import { todayKey } from './model.js';
import { EXERCISES } from './exercises.js';
import { MOVEMENT_SCIENCE } from './movement-science.js';

export const MUSCLE_STATS_NOTE = 'Sets describe logged exercises that involve this muscle. Left and right sides share the same workout history. Exercise volume is logged weight × reps, not force or work performed by a muscle. It overlaps across muscles and must not be added across muscle cards.';

const groups = [
  ['chest', 'Chest', ['chest', 'pectorals', 'pecs'], [
    ['Pectoralis major'], ['Pectoralis minor'],
    ['Clavicular head of pectoralis major', 'pectoralis major clavicular head'],
    ['Sternocostal head of pectoralis major', 'pectoralis major sternocostal head'],
    ['Abdominal part of pectoralis major', 'pectoralis major abdominal part'],
  ]],
  ['anterior-delts', 'Front deltoids', ['front delts', 'anterior delts'], [['Anterior deltoid', 'anterior deltoids', 'clavicular part of deltoid', 'deltoid anterior part']]],
  ['lateral-delts', 'Side deltoids', ['side delts', 'lateral delts'], [['Middle deltoid', 'middle deltoids', 'lateral deltoid', 'acromial part of deltoid', 'deltoid acromial part']]],
  ['posterior-delts', 'Rear deltoids', ['rear delts', 'posterior delts'], [['Posterior deltoid', 'posterior deltoids', 'scapular spinal part of deltoid', 'spinal part of deltoid', 'deltoid posterior part']]],
  ['deltoids', 'Deltoids', ['shoulders', 'delts'], [['Deltoid', 'deltoids']]],
  ['biceps', 'Biceps and brachialis', ['biceps', 'elbow flexors'], [
    ['Biceps brachii'], ['Long head of biceps brachii', 'biceps brachii long head'],
    ['Short head of biceps brachii', 'biceps brachii short head'], ['Brachialis'], ['Coracobrachialis'],
  ]],
  ['triceps', 'Triceps', ['triceps'], [
    ['Triceps brachii'], ['Long head of triceps brachii', 'triceps brachii long head'],
    ['Lateral head of triceps brachii', 'triceps brachii lateral head'], ['Medial head of triceps brachii', 'triceps brachii medial head'], ['Anconeus'],
  ]],
  ['forearms', 'Forearms', ['forearms', 'forearm muscles'], [
    ['Brachioradialis'], ['Flexor digitorum superficialis'], ['Flexor digitorum profundus'], ['Flexor carpi radialis'], ['Flexor carpi ulnaris'],
    ['Extensor carpi radialis longus'], ['Extensor carpi radialis brevis'], ['Extensor carpi ulnaris'], ['Extensor digitorum'], ['Palmaris longus'], ['Pronator teres'], ['Pronator quadratus'], ['Supinator'],
    ['Abductor pollicis longus'], ['Extensor digiti minimi'], ['Extensor indicis'], ['Extensor pollicis brevis'], ['Extensor pollicis longus'], ['Flexor pollicis longus'],
    ['Deep head of pronator teres'], ['Superficial head of pronator teres'], ['Humeral head of extensor carpi ulnaris'], ['Ulnar head of extensor carpi ulnaris'],
    ['Humeral head of flexor carpi ulnaris'], ['Ulnar head of flexor carpi ulnaris'], ['Humero-ulnar head of flexor digitorum superficialis'], ['Radial head of flexor digitorum superficialis'],
  ]],
  ['lats', 'Lats', ['lats'], [['Latissimus dorsi']]],
  ['traps', 'Trapezius', ['traps'], [
    ['Trapezius'], ['Upper trapezius', 'descending part of trapezius'], ['Middle trapezius', 'transverse part of trapezius'], ['Lower trapezius', 'ascending part of trapezius'],
  ]],
  ['rhomboids', 'Rhomboids', ['rhomboids'], [['Rhomboid major'], ['Rhomboid minor']]],
  ['abs', 'Abdominals', ['abs', 'abdominals'], [['Rectus abdominis'], ['Transversus abdominis', 'transverse abdominal'], ['Pyramidalis']]],
  ['obliques', 'Obliques', ['obliques'], [['External oblique', 'external abdominal oblique'], ['Internal oblique', 'internal abdominal oblique']]],
  ['spinal-erectors', 'Spinal extensors', ['spinal erectors', 'spinal extensors', 'lower back'], [
    ['Erector spinae'], ['Iliocostalis lumborum'], ['Iliocostalis thoracis'], ['Iliocostalis colli', 'iliocostalis cervicis'],
    ['Longissimus thoracis'], ['Longissimus colli', 'longissimus cervicis'], ['Longissimus capitis'],
    ['Spinalis thoracis'], ['Spinalis cervicis', 'spinalis colli'], ['Spinalis capitis'], ['Multifidus'], ['Quadratus lumborum'],
    ['Multifidus colli'], ['Multifidus thoracis'], ['Multifidus lumborum'], ['Rotatores'], ['Semispinalis colli'], ['Semispinalis thoracis'],
    ['Interspinales colli'], ['Interspinales thoracis'], ['Interspinales lumborum'], ['Dorsal parts of lateral intertransversarii lumborum'], ['Ventral parts of lateral intertransversarii lumborum'],
  ]],
  ['glutes', 'Glutes', ['glutes', 'gluteals'], [['Gluteus maximus'], ['Gluteus medius'], ['Gluteus minimus']]],
  ['quads', 'Quadriceps', ['quads', 'quadriceps'], [['Quadriceps femoris'], ['Rectus femoris'], ['Vastus lateralis'], ['Vastus medialis'], ['Vastus intermedius']]],
  ['hamstrings', 'Hamstrings', ['hamstrings'], [
    ['Biceps femoris'], ['Long head of biceps femoris', 'biceps femoris long head'], ['Short head of biceps femoris', 'biceps femoris short head'], ['Semitendinosus'], ['Semimembranosus'],
  ]],
  ['adductors', 'Hip adductors', ['adductors', 'hip adductors'], [['Adductor magnus'], ['Adductor longus'], ['Adductor brevis'], ['Adductor minimus'], ['Gracilis'], ['Pectineus']]],
  ['abductors', 'Hip abductors', ['abductors', 'hip abductors'], [['Tensor fasciae latae', 'tensor fascia lata']]],
  ['hip-flexors', 'Hip flexors', ['hip flexors'], [['Iliopsoas'], ['Iliacus'], ['Psoas major'], ['Psoas minor'], ['Sartorius']]],
  ['calves', 'Calves', ['calves', 'triceps surae'], [['Gastrocnemius'], ['Medial head of gastrocnemius', 'gastrocnemius medial head'], ['Lateral head of gastrocnemius', 'gastrocnemius lateral head'], ['Soleus'], ['Plantaris']]],
  ['tibialis-anterior', 'Front of shin', ['tibialis anterior', 'front of shin'], [['Tibialis anterior']]],
  ['lower-leg', 'Lower leg', ['lower leg'], [['Tibialis posterior'], ['Fibularis longus', 'peroneus longus'], ['Fibularis brevis', 'peroneus brevis'], ['Fibularis tertius', 'peroneus tertius'], ['Extensor digitorum longus'], ['Extensor hallucis longus'], ['Flexor digitorum longus'], ['Flexor hallucis longus'], ['Popliteus']]],
  ['rotator-cuff', 'Rotator cuff', ['rotator cuff'], [['Supraspinatus'], ['Infraspinatus'], ['Teres minor'], ['Subscapularis']]],
  ['serratus', 'Serratus anterior', ['serratus'], [['Serratus anterior']]],
  ['upper-back', 'Upper back', ['upper back'], [['Teres major'], ['Levator scapulae'], ['Serratus posterior superior'], ['Serratus posterior inferior']]],
  ['neck', 'Neck', ['neck'], [
    ['Sternocleidomastoid'], ['Splenius capitis'], ['Splenius cervicis', 'splenius colli'], ['Scalenus anterior', 'anterior scalene'], ['Scalenus medius', 'middle scalene'], ['Scalenus posterior', 'posterior scalene'],
    ['Platysma'], ['Longus capitis'], ['Longus colli'], ['Obliquus inferior capitis'], ['Obliquus superior capitis'], ['Rectus anterior capitis'], ['Rectus lateralis capitis'], ['Rectus posterior major capitis'], ['Rectus posterior minor capitis'],
    ['Anterior belly of digastric'], ['Posterior belly of digastric'], ['Geniohyoid'], ['Mylohyoid'], ['Omohyoid'], ['Sternohyoid'], ['Stylohyoid'],
  ]],
  ['deep-hip', 'Deep hip muscles', ['deep hip muscles'], [['Piriformis'], ['Obturator externus'], ['Obturator internus'], ['Superior gemellus'], ['Inferior gemellus'], ['Quadratus femoris']]],
  ['thorax', 'Thorax', ['thorax'], [['External intercostal'], ['Internal intercostal'], ['Innermost intercostal'], ['Levatores breves costarum'], ['Levatores longi costarum'], ['Subclavius']]],
  ['pelvic-floor', 'Pelvic floor', ['pelvic floor'], [['Coccygeus'], ['Iliococcygeus'], ['Pubococcygeus']]],
  ['hand', 'Hand muscles', ['hand'], [
    ['Abductor digiti minimi of hand'], ['Abductor pollicis brevis'], ['Deep head of flexor pollicis brevis'], ['Superficial head of flexor pollicis brevis'],
    ['Dorsal interossei of hand'], ['Palmar interossei'], ['Flexor digiti minimi of hand'], ['Lumbrical of hand'], ['Oblique head of adductor pollicis'], ['Transverse head of adductor pollicis'], ['Opponens digiti minimi of hand'], ['Opponens pollicis'],
  ]],
  ['foot', 'Foot muscles', ['foot'], [
    ['Opponens digiti minimi of foot'], ['Abductor digiti minimi of foot'], ['Abductor hallucis'], ['Dorsal interossei of foot'], ['Plantar interossei'],
    ['Extensor digitorum brevis'], ['Extensor hallucis brevis'], ['Flexor digiti minimi of foot'], ['Flexor digitorum brevis'], ['Lateral head of flexor hallucis brevis'], ['Medial head of flexor hallucis brevis'],
    ['Lumbrical of foot'], ['Oblique head of adductor hallucis'], ['Transverse head of adductor hallucis'], ['Quadratus plantae'],
  ]],
  ['face', 'Face and jaw', ['face', 'jaw'], [
    ['Buccinator', 'bucinator'], ['Corrugator supercilii'], ['Deep part of masseter'], ['Superficial part of masseter'], ['Depressor anguli oris'], ['Depressor labii inferioris'], ['Depressor septi nasi'], ['Frontalis'],
    ['Inferior head of lateral pterygoid'], ['Superior head of lateral pterygoid'], ['Medial pterygoid'], ['Levator anguli oris'], ['Levator labii superioris'], ['Levator nasolabialis'], ['Mentalis'], ['Nasalis'], ['Occipitalis'], ['Orbicularis oris'],
    ['Orbital part of orbicularis oculi'], ['Palpebral part of orbicularis oculi'], ['Procerus'], ['Risorius'], ['Temporalis'], ['Temporoparietalis'], ['Zygomaticus major'], ['Zygomaticus minor'],
  ]],
  ['eyes', 'Eye muscles', ['eye muscles'], [['Inferior oblique'], ['Superior oblique'], ['Inferior rectus'], ['Superior rectus'], ['Medial rectus'], ['Lateral rectus'], ['Levator palpebrae superioris']]],
];

function normalize(name) {
  if (typeof name !== 'string') return '';
  return name.toLowerCase().replace(/\.(?:[oe]\d*)?[lr]$/g, '')
    .replace(/\b(left|right|muscle|muscles|musculus)\b/g, '')
    .replace(/[_.,()\-]+/g, ' ').replace(/\b[lr]\b/g, '').replace(/\s+/g, ' ').trim();
}

const names = new Map();
const groupRecords = new Map();
for (const [id, label, aliases, members] of groups) {
  const group = { id, label, aliases: [label, ...aliases] };
  const keys = members.map(([name]) => normalize(name));
  groupRecords.set(id, { group, keys });
  for (const alias of [id, label, ...aliases]) names.set(normalize(alias), { group, keys });
  for (const aliases of members) {
    for (const alias of aliases) names.set(normalize(alias), { group, keys: [normalize(aliases[0])] });
  }
}

const families = new Map([
  ['Pectoralis major', ['Clavicular head of pectoralis major', 'Sternocostal head of pectoralis major', 'Abdominal part of pectoralis major']],
  ['Deltoid', ['Anterior deltoid', 'Middle deltoid', 'Posterior deltoid']],
  ['Biceps brachii', ['Long head of biceps brachii', 'Short head of biceps brachii']],
  ['Triceps brachii', ['Long head of triceps brachii', 'Lateral head of triceps brachii', 'Medial head of triceps brachii']],
  ['Trapezius', ['Upper trapezius', 'Middle trapezius', 'Lower trapezius']],
  ['Quadriceps femoris', ['Rectus femoris', 'Vastus lateralis', 'Vastus medialis', 'Vastus intermedius']],
  ['Biceps femoris', ['Long head of biceps femoris', 'Short head of biceps femoris']],
  ['Erector spinae', ['Iliocostalis lumborum', 'Iliocostalis thoracis', 'Iliocostalis colli', 'Longissimus thoracis', 'Longissimus colli', 'Longissimus capitis', 'Spinalis thoracis', 'Spinalis cervicis', 'Spinalis capitis']],
  ['Gastrocnemius', ['Medial head of gastrocnemius', 'Lateral head of gastrocnemius']],
  ['Iliopsoas', ['Iliacus', 'Psoas major']],
  ['Flexor digitorum superficialis', ['Humero-ulnar head of flexor digitorum superficialis', 'Radial head of flexor digitorum superficialis']],
  ['Pronator teres', ['Deep head of pronator teres', 'Superficial head of pronator teres']],
  ['Flexor carpi ulnaris', ['Humeral head of flexor carpi ulnaris', 'Ulnar head of flexor carpi ulnaris']],
  ['Extensor carpi ulnaris', ['Humeral head of extensor carpi ulnaris', 'Ulnar head of extensor carpi ulnaris']],
  ['Multifidus', ['Multifidus colli', 'Multifidus thoracis', 'Multifidus lumborum']],
].map(([name, members]) => [normalize(name), members.map(normalize)]));

function resolve(name) {
  const entry = names.get(normalize(name));
  if (!entry) return null;
  const keys = new Set(entry.keys.flatMap(key => [key, ...(families.get(key) || [])]));
  return { group: entry.group, keys };
}

export function muscleGroupForName(anatomicalName) {
  const found = resolve(anatomicalName);
  return found ? { ...found.group, aliases: [...found.group.aliases] } : null;
}

function matchingExercises(name) {
  const query = resolve(name);
  if (!query) return [];
  return Object.entries(MOVEMENT_SCIENCE).flatMap(([id, info]) => {
    const role = ['primary', 'secondary', 'stabilizer'].find(role => {
      const muscles = info[role === 'stabilizer' ? 'stabilizers' : role];
      return muscles.some(muscle => {
        const found = resolve(muscle);
        return found && [...found.keys].some(key => query.keys.has(key));
      });
    });
    return role ? [{ id, name: EXERCISES.find(exercise => exercise.id === id)?.name || id, role, sets: 0, volume: 0, lastDate: null }] : [];
  });
}

function dateNumber(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const number = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isFinite(number) && new Date(number).toISOString().slice(0, 10) === date ? number / 86400000 : null;
}

export function getMuscleStats(state, name, now = new Date()) {
  const today = todayKey(now);
  const currentDay = dateNumber(today);
  const monday = currentDay - ((new Date(currentDay * 86400000).getUTCDay() + 6) % 7);
  const group = muscleGroupForName(name);
  const exercises = matchingExercises(name);
  const mapped = exercises.length > 0;
  const stats = {
    name, group, mapped,
    weekPrimarySets: mapped ? 0 : null,
    weekSecondarySets: mapped ? 0 : null,
    weekStabilizerSets: mapped ? 0 : null,
    totalSets: mapped ? 0 : null,
    sessionCount: mapped ? 0 : null,
    lastTrained: null,
    exerciseVolume: mapped ? 0 : null,
    exercises,
  };
  if (!mapped) return stats;
  const byId = new Map(exercises.map(exercise => [exercise.id, exercise]));
  const weekKeys = { primary: 'weekPrimarySets', secondary: 'weekSecondarySets', stabilizer: 'weekStabilizerSets' };
  for (const session of state.sessions || []) {
    const day = dateNumber(session.date);
    if (day === null || day > currentDay || !Number.isFinite(Date.parse(session.completedAt))) continue;
    let involved = false;
    for (const entry of session.exercises || []) {
      const exercise = byId.get(entry.exerciseId);
      if (!exercise) continue;
      const sets = (entry.sets || []).filter(set => Number.isInteger(set.reps) && set.reps > 0 && typeof set.weight === 'number' && Number.isFinite(set.weight) && set.weight >= 0);
      if (!sets.length) continue;
      const volume = sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
      exercise.sets += sets.length;
      exercise.volume += volume;
      exercise.lastDate = exercise.lastDate === null || session.date > exercise.lastDate ? session.date : exercise.lastDate;
      stats.totalSets += sets.length;
      stats.exerciseVolume += volume;
      if (day >= monday) stats[weekKeys[exercise.role]] += sets.length;
      stats.lastTrained = stats.lastTrained === null || session.date > stats.lastTrained ? session.date : stats.lastTrained;
      involved = true;
    }
    if (involved) stats.sessionCount += 1;
  }
  return stats;
}

export function getTrainedGroups(state, now = new Date()) {
  return [...groupRecords.values()].flatMap(({ group }) => {
    const stats = getMuscleStats(state, group.id, now);
    const sets = (stats.weekPrimarySets || 0) + (stats.weekSecondarySets || 0) + (stats.weekStabilizerSets || 0);
    return sets ? [{ ...group, aliases: [...group.aliases], primarySets: stats.weekPrimarySets, secondarySets: stats.weekSecondarySets, stabilizerSets: stats.weekStabilizerSets }] : [];
  });
}
