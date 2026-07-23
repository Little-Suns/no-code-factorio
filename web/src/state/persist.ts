import { useStore } from './store';
import type { Entity } from '../core/types';

const PERSIST_KEY = 'ncf.world.v1';
const DEBOUNCE_MS = 500;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Инициализация персистентности:
 * 1. При старте загружает мир из localStorage
 * 2. Подписывается на изменения entities и сохраняет в localStorage (debounce 500мс)
 */
export function initPersist() {
  // На старте: загрузить из localStorage
  const stored = localStorage.getItem(PERSIST_KEY);
  if (stored) {
    try {
      const data = JSON.parse(stored);
      if (data && typeof data === 'object' && Array.isArray(data.entities)) {
        // Валидация базовой структуры
        const entities = data.entities as Entity[];
        useStore.setState({ entities: {} });
        useStore.getState().loadWorld(entities);
        console.log(`✓ Loaded ${entities.length} entities from localStorage`);
      }
    } catch (error) {
      console.warn('Failed to parse persisted world, ignoring:', error);
    }
  }

  // Подписка на изменения entities с debounce
  let prevEntities: Record<string, Entity> = {};
  useStore.subscribe((state) => {
    if (state.entities !== prevEntities) {
      prevEntities = state.entities;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const payload = {
          version: 1,
          entities: Object.values(state.entities),
        };
        localStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
        console.log('✓ Persisted', Object.keys(state.entities).length, 'entities');
      }, DEBOUNCE_MS);
    }
  });
}
