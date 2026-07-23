import { create } from 'zustand';
import type { Entity, NodeStatus, MachineKind } from '../core/types';
import { canPlace } from '../core/grid';
import { NODE_DEFS } from '../core/nodes';

export interface Store {
  entities: Record<string, Entity>;
  running: boolean;
  selectedTool: MachineKind | null;
  selectedEntityId: string | null;
  nodeStatus: Record<string, { status: NodeStatus; error?: string; lastIn?: unknown; lastOut?: unknown }>;
  results: Record<string, { at: number; data: unknown }[]>;
  toasts: { id: string; text: string }[];
  // actions
  place: (entity: Entity) => boolean;
  remove: (entityId: string) => void;
  rotate: (entityId: string) => void;
  setConfig: (entityId: string, config: Record<string, unknown>) => void;
  select: (entityId: string | null) => void;
  setTool: (tool: MachineKind | null) => void;
  setRunning: (running: boolean) => void;
  setStatus: (nodeId: string, status: NodeStatus, error?: string) => void;
  setIO: (nodeId: string, lastIn?: unknown, lastOut?: unknown) => void;
  pushResult: (nodeId: string, data: unknown) => void;
  toast: (text: string) => void;
  loadWorld: (entities: Entity[]) => void;
}

export const useStore = create<Store>((set, get) => ({
  entities: {},
  running: false,
  selectedTool: null,
  selectedEntityId: null,
  nodeStatus: {},
  results: {},
  toasts: [],

  place: (entity: Entity) => {
    const state = get();
    if (state.running) {
      set((s) => ({
        toasts: [...s.toasts, { id: crypto.randomUUID().slice(0, 8), text: 'Останови фабрику' }],
      }));
      return false;
    }
    if (!canPlace(state.entities, entity)) {
      return false;
    }

    // Заполняем config дефолтами из NODE_DEFS если их нет
    let config = entity.config;
    if (Object.keys(config).length === 0) {
      const def = NODE_DEFS[entity.kind];
      if (def) {
        config = {};
        for (const field of def.schema) {
          if (field.default !== undefined) {
            config[field.key] = field.default;
          }
        }
      }
    }

    set((s) => ({
      entities: { ...s.entities, [entity.id]: { ...entity, config } },
    }));
    return true;
  },

  remove: (entityId: string) => {
    const state = get();
    if (state.running) {
      set((s) => ({
        toasts: [...s.toasts, { id: crypto.randomUUID().slice(0, 8), text: 'Останови фабрику' }],
      }));
      return;
    }
    set((s) => {
      const newEntities = { ...s.entities };
      delete newEntities[entityId];
      return {
        entities: newEntities,
        selectedEntityId: s.selectedEntityId === entityId ? null : s.selectedEntityId,
      };
    });
  },

  rotate: (entityId: string) => {
    const state = get();
    const entity = state.entities[entityId];
    if (!entity) return;
    const newEntity = { ...entity, dir: ((entity.dir + 1) % 4) as 0 | 1 | 2 | 3 };
    // Сам станок исключаем из занятости — иначе поворот всегда «занято»
    const others = { ...state.entities };
    delete others[entityId];
    if (!canPlace(others, newEntity)) {
      return;
    }
    set((s) => ({
      entities: { ...s.entities, [entityId]: newEntity },
    }));
  },

  setConfig: (entityId: string, config: Record<string, unknown>) => {
    const state = get();
    const entity = state.entities[entityId];
    if (!entity) return;
    set((s) => ({
      entities: { ...s.entities, [entityId]: { ...entity, config } },
    }));
  },

  select: (entityId: string | null) => {
    set({ selectedEntityId: entityId });
  },

  setTool: (tool: MachineKind | null) => {
    set((s) => ({
      selectedTool: s.selectedTool === tool ? null : tool,
      selectedEntityId: null,
    }));
  },

  setRunning: (running: boolean) => {
    set({ running });
  },

  setStatus: (nodeId: string, status: NodeStatus, error?: string) => {
    set((s) => ({
      nodeStatus: {
        ...s.nodeStatus,
        [nodeId]: { ...(s.nodeStatus[nodeId] ?? {}), status, error },
      },
    }));
  },

  setIO: (nodeId: string, lastIn?: unknown, lastOut?: unknown) => {
    set((s) => ({
      nodeStatus: {
        ...s.nodeStatus,
        [nodeId]: { ...(s.nodeStatus[nodeId] ?? {}), lastIn, lastOut },
      },
    }));
  },

  pushResult: (nodeId: string, data: unknown) => {
    set((s) => {
      const results = s.results[nodeId] ?? [];
      const newResults = [{ at: Date.now(), data }, ...results].slice(0, 50);
      return {
        results: { ...s.results, [nodeId]: newResults },
      };
    });
  },

  toast: (text: string) => {
    set((s) => ({
      toasts: [...s.toasts, { id: crypto.randomUUID().slice(0, 8), text }],
    }));
  },

  loadWorld: (entities: Entity[]) => {
    const entitiesMap: Record<string, Entity> = {};
    for (const entity of entities) {
      entitiesMap[entity.id] = entity;
    }
    set({ entities: entitiesMap });
  },
}));
