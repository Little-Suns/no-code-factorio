import { useStore } from './store';
import type { Blueprint } from '../core/blueprint';

const PERSIST_KEY = 'ncf.blueprints.v1';
const DEBOUNCE_MS = 500;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Персистентность чертежей — зеркало initPersist() (persist.ts), отдельный ключ
 * (docs/01), т.к. чертежи не часть мира и не должны попадать в Export/Import фабрики.
 */
export function initBlueprintPersist() {
  const stored = localStorage.getItem(PERSIST_KEY);
  if (stored) {
    try {
      const data = JSON.parse(stored);
      if (Array.isArray(data)) {
        useStore.getState().loadBlueprints(data as Blueprint[]);
        console.log(`✓ Loaded ${data.length} blueprints from localStorage`);
      }
    } catch (error) {
      console.warn('Failed to parse persisted blueprints, ignoring:', error);
    }
  }

  let prevBlueprints: Blueprint[] = [];
  useStore.subscribe((state) => {
    if (state.blueprints !== prevBlueprints) {
      prevBlueprints = state.blueprints;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        localStorage.setItem(PERSIST_KEY, JSON.stringify(state.blueprints));
        console.log('✓ Persisted', state.blueprints.length, 'blueprints');
      }, DEBOUNCE_MS);
    }
  });
}
