import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const modelSource = await readFile(new URL('../dist/model.js', import.meta.url), 'utf8');
const modelUrl = `data:text/javascript;base64,${Buffer.from(modelSource).toString('base64')}`;
const persistenceSource = (await readFile(new URL('../dist/persistence.js', import.meta.url), 'utf8')).replace("'./model.js'", `'${modelUrl}'`);
const { createPersistence } = await import(`data:text/javascript;base64,${Buffer.from(persistenceSource).toString('base64')}`);
const { STORAGE_KEY, createInitialState } = await import(modelUrl);

function memoryStorage(raw = null) {
  const values = new Map(raw === null ? [] : [[STORAGE_KEY, raw]]);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('corrupted storage stays unchanged when an ordinary save is attempted', () => {
  const storage = memoryStorage('{damaged json');
  const persistence = createPersistence(storage);
  assert.equal(persistence.recoveryRequired, true);
  assert.match(persistence.error, /could not be loaded/);
  assert.throws(() => persistence.save(createInitialState()), /restore a backup/);
  assert.equal(storage.getItem(STORAGE_KEY), '{damaged json');
  assert.equal(persistence.exportRaw(), '{damaged json');
  assert.equal(persistence.recoveryRequired, true);
});

test('a stale tab cannot overwrite another tab and keeps its last saved snapshot', () => {
  const initial = createInitialState();
  const storage = memoryStorage(JSON.stringify(initial));
  const first = createPersistence(storage);
  const second = createPersistence(storage);
  const updated = first.state;
  updated.plans[0].name = 'Edited in first tab';
  first.save(updated);
  const stale = second.state;
  stale.plans[0].name = 'Edited in stale tab';
  assert.throws(() => second.save(stale), /changed in another tab/);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).plans[0].name, 'Edited in first tab');
  assert.equal(second.state.plans[0].name, 'Foundation');
  assert.equal(JSON.parse(second.exportRaw()).plans[0].name, 'Foundation');
});

test('explicit restore can replace damaged or newer data and clears recovery errors', () => {
  const storage = memoryStorage('invalid');
  const persistence = createPersistence(storage);
  const restored = createInitialState();
  restored.plans[0].name = 'Restored plan';
  persistence.save(restored, { replace: true });
  assert.deepEqual(persistence.state, restored);
  assert.equal(persistence.error, null);
  assert.equal(persistence.recoveryRequired, false);
  assert.deepEqual(JSON.parse(persistence.exportRaw()), restored);
  storage.setItem(STORAGE_KEY, 'changed elsewhere');
  persistence.save(restored, { replace: true });
  persistence.save(restored);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), restored);
});

test('successful saves update the snapshot without retaining mutable caller references', () => {
  const storage = memoryStorage();
  const persistence = createPersistence(storage);
  const next = persistence.state;
  next.plans[0].name = 'Saved name';
  persistence.save(next);
  next.plans[0].name = 'Unsaved name';
  assert.equal(persistence.state.plans[0].name, 'Saved name');
  const exposed = persistence.state;
  exposed.plans[0].name = 'Changed returned object';
  assert.equal(persistence.state.plans[0].name, 'Saved name');
  assert.equal(JSON.parse(persistence.exportRaw()).plans[0].name, 'Saved name');
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).plans[0].name, 'Saved name');
});

test('validation errors are preserved and neither failed validation nor quota errors update the snapshot', () => {
  const storage = memoryStorage();
  const persistence = createPersistence(storage);
  const original = persistence.state;
  assert.throws(() => persistence.save({}), /Check the plan and set entries/);
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.deepEqual(persistence.state, original);
  storage.setItem = () => { throw new Error('Quota'); };
  const next = persistence.state;
  next.plans[0].name = 'Not saved';
  assert.throws(() => persistence.save(next), /could not save this change/);
  assert.deepEqual(persistence.state, original);
  assert.deepEqual(JSON.parse(persistence.exportRaw()), original);
});

test('failed explicit restore does not clear the damaged original or its recovery guard', () => {
  const storage = memoryStorage('damaged');
  const persistence = createPersistence(storage);
  assert.throws(() => persistence.save({}, { replace: true }), /Check the plan and set entries/);
  assert.equal(persistence.recoveryRequired, true);
  assert.match(persistence.error, /could not be loaded/);
  assert.equal(persistence.exportRaw(), 'damaged');
  assert.equal(storage.getItem(STORAGE_KEY), 'damaged');
});

test('blocked localStorage access produces a recoverable result without throwing at construction', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
  try {
    const persistence = createPersistence();
    assert.equal(persistence.recoveryRequired, true);
    assert.match(persistence.error, /Storage blocked/);
    assert.equal(persistence.exportRaw(), null);
    assert.throws(() => persistence.save(createInitialState(), { replace: true }), /cannot read saved workouts/);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('storage removed in another tab also makes the current tab stale', () => {
  const initial = createInitialState();
  const storage = memoryStorage(JSON.stringify(initial));
  const persistence = createPersistence(storage);
  storage.getItem = () => null;
  assert.throws(() => persistence.save(initial), /changed in another tab/);
});


test('backup uses the valid saved snapshot when current edits cannot be restored', () => {
  const persistence = createPersistence(memoryStorage());
  const saved = persistence.state;
  saved.plans[0].name = 'Saved plan';
  persistence.save(saved);
  const invalid = persistence.state;
  invalid.plans[0].name = '';
  const backup = persistence.exportBackup(invalid);
  assert.equal(backup.kind, 'saved');
  assert.deepEqual(JSON.parse(backup.raw), saved);
  assert.equal(persistence.exportBackup(saved).kind, 'current');
});

test('backup preserves the original damaged data for recovery', () => {
  const persistence = createPersistence(memoryStorage('{broken'));
  assert.deepEqual(persistence.exportBackup(persistence.state), { raw: '{broken', kind: 'recovery' });
});
