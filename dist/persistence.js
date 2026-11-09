import { STORAGE_KEY, loadState, saveState, validateState } from './model.js';

export function createPersistence(storage) {
  let selectedStorage;
  let expectedRaw = null;
  let loaded;
  try {
    selectedStorage = storage ?? globalThis.localStorage;
    if (!selectedStorage) throw new Error('Storage is unavailable.');
    expectedRaw = selectedStorage.getItem(STORAGE_KEY);
    loaded = loadState({ getItem: () => expectedRaw });
  } catch (error) {
    loaded = loadState({ getItem() { throw error; } });
  }

  let savedState = structuredClone(loaded.state);
  let loadError = loaded.error;
  let recoveryRequired = Boolean(loadError);
  const damagedRaw = recoveryRequired ? expectedRaw : null;

  return {
    get state() { return structuredClone(savedState); },
    get error() { return loadError; },
    get recoveryRequired() { return recoveryRequired; },
    save(next, { replace = false } = {}) {
      if (recoveryRequired && !replace) {
        throw new Error('Your saved data could not be loaded. Export the original data or restore a backup before saving changes.');
      }

      let targetStorage;
      let currentRaw;
      try {
        targetStorage = selectedStorage ?? storage ?? globalThis.localStorage;
        if (!targetStorage) throw new Error('Storage is unavailable.');
        currentRaw = targetStorage.getItem(STORAGE_KEY);
      } catch {
        throw new Error('This browser cannot read saved workouts. Export a backup before closing the app.');
      }

      if (!replace && currentRaw !== expectedRaw) {
        throw new Error('Your workouts changed in another tab. Reload this tab before saving, or restore a backup to replace the saved data.');
      }

      const snapshot = structuredClone(next);
      saveState(snapshot, targetStorage);
      selectedStorage = targetStorage;
      savedState = snapshot;
      expectedRaw = JSON.stringify(snapshot);
      loadError = null;
      recoveryRequired = false;
    },
    exportBackup(current) {
      if (recoveryRequired) return { raw: damagedRaw, kind: 'recovery' };
      const valid = validateState(current);
      return { raw: JSON.stringify(valid ? current : savedState, null, 2), kind: valid ? 'current' : 'saved' };
    },
    exportRaw() {
      return recoveryRequired ? damagedRaw : JSON.stringify(savedState);
    },
  };
}
