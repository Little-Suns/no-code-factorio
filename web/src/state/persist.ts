import { useStore } from './store';
import type { Entity } from '../core/types';
import { NODE_DEFS } from '../core/nodes';

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
        // Валидация базовой структуры + отсев легаси-сущностей с удалённым kind (например
        // 'telegram', убран в PR #21) — иначе core/grid.ts падает на exhaustive-switch при
        // первом же пересчёте занятости, и ставить вообще ничего не получается.
        const rawEntities = data.entities as Entity[];
        const entities = rawEntities.filter((e) => e.kind in NODE_DEFS);
        if (entities.length !== rawEntities.length) {
          console.warn(`Отброшено ${rawEntities.length - entities.length} сущностей с неизвестным kind (устаревшее сохранение)`);
        }
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
