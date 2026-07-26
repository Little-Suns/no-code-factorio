import { useStore } from './store';
import type { Store } from './store';

const PERSIST_KEY = 'ncf.levels.progress.v1';
const DEBOUNCE_MS = 500;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Персистентность прогресса уровней — зеркало initBlueprintPersist() (blueprintPersist.ts),
 * отдельный ключ (docs/01), т.к. прогресс не часть мира и не должен попадать в Export/Import.
 */
export function initLevelPersist() {
  const stored = localStorage.getItem(PERSIST_KEY);
  if (stored) {
    try {
      const data = JSON.parse(stored);
      if (data && typeof data === 'object') {
        useStore.getState().loadLevelProgress(data as Store['levelProgress']);
        console.log('✓ Loaded level progress from localStorage');
      }
    } catch (error) {
      console.warn('Failed to parse persisted level progress, ignoring:', error);
    }
  }

  let prevProgress = useStore.getState().levelProgress;
  useStore.subscribe((state) => {
    if (state.levelProgress !== prevProgress) {
      prevProgress = state.levelProgress;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        localStorage.setItem(PERSIST_KEY, JSON.stringify(state.levelProgress));
        console.log('✓ Persisted level progress');
      }, DEBOUNCE_MS);
    }
  });
}
