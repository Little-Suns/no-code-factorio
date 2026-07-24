import { create } from 'zustand';
import type { Entity, NodeStatus, MachineKind } from '../core/types';
import { canPlace } from '../core/grid';
import { NODE_DEFS } from '../core/nodes';
import type { Blueprint } from '../core/blueprint';
import { canPlaceBlueprint } from '../core/blueprint';

export interface Store {
  entities: Record<string, Entity>;
  running: boolean;
  selectedTool: MachineKind | null;
  selectedEntityId: string | null;
  nodeStatus: Record<string, { status: NodeStatus; error?: string; lastIn?: unknown; lastOut?: unknown }>;
  results: Record<string, { at: number; data: unknown }[]>;
  toasts: { id: string; text: string; at: number }[];
  energy: { charge: number; capacity: number } | null; // E1: null — энергослой выключен (нет аккумулятора)
  // E4: чертежи. pendingSelection — эфемерно (не персистится), ждёт имени в UI;
  // stampBlueprintId — какой чертёж «на кисти» для постановки, взаимоисключающе с selectedTool.
  blueprints: Blueprint[];
  pendingSelection: Entity[] | null;
  stampBlueprintId: string | null;
  blueprintPanelOpen: boolean; // видимость списка чертежей — переключается клавишей B
  resultPanelOpen: boolean; // видимость дока результатов — переключается кнопкой в TopBar
  logsPanelOpen: boolean; // видимость панели логов — переключается кнопкой в TopBar
  logsUnread: boolean; // новый лог пришёл, пока панель закрыта — «загорается» кнопка в TopBar
  // actions
  place: (entity: Entity) => boolean;
  remove: (entityId: string) => void;
  removeMany: (entityIds: string[]) => void;
  rotate: (entityId: string) => void;
  setConfig: (entityId: string, config: Record<string, unknown>) => void;
  select: (entityId: string | null) => void;
  setTool: (tool: MachineKind | null) => void;
  setRunning: (running: boolean) => void;
  setStatus: (nodeId: string, status: NodeStatus, error?: string) => void;
  setIO: (nodeId: string, lastIn?: unknown, lastOut?: unknown) => void;
  pushResult: (nodeId: string, data: unknown) => void;
  toast: (text: string) => void;
  dismissToast: (id: string) => void;
  loadWorld: (entities: Entity[]) => void;
  setEnergy: (charge: number, capacity: number) => void;
  placeMany: (entities: Entity[]) => boolean;
  addBlueprint: (blueprint: Blueprint) => void;
  removeBlueprint: (id: string) => void;
  setStampBlueprint: (id: string | null) => void;
  setPendingSelection: (entities: Entity[] | null) => void;
  setBlueprintPanelOpen: (open: boolean) => void;
  setResultPanelOpen: (open: boolean) => void;
  setLogsPanelOpen: (open: boolean) => void;
  clearLogs: () => void;
  loadBlueprints: (blueprints: Blueprint[]) => void;
}

export const useStore = create<Store>((set, get) => ({
  entities: {},
  running: false,
  selectedTool: null,
  selectedEntityId: null,
  nodeStatus: {},
  results: {},
  toasts: [],
  energy: null,
  blueprints: [],
  pendingSelection: null,
  stampBlueprintId: null,
  blueprintPanelOpen: false,
  resultPanelOpen: false,
  logsPanelOpen: false,
  logsUnread: false,

  place: (entity: Entity) => {
    const state = get();
    if (state.running) {
      get().toast('Останови фабрику');
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
      get().toast('Останови фабрику');
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

  // E4: массовое удаление станков, захваченных рамкой выделения (Del) — одна проверка running
  // и один set на всю группу, а не N тостов от remove() при работающей фабрике.
  removeMany: (entityIds: string[]) => {
    const state = get();
    if (state.running) {
      get().toast('Останови фабрику');
      return;
    }
    const idSet = new Set(entityIds);
    set((s) => {
      const newEntities = { ...s.entities };
      for (const id of idSet) delete newEntities[id];
      return {
        entities: newEntities,
        selectedEntityId: s.selectedEntityId && idSet.has(s.selectedEntityId) ? null : s.selectedEntityId,
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
      stampBlueprintId: null, // выбор обычного инструмента отменяет постановку чертежа
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
      toasts: [...s.toasts, { id: crypto.randomUUID().slice(0, 8), text, at: Date.now() }].slice(-200),
      logsUnread: !s.logsPanelOpen, // «загорается» кнопка в TopBar, пока панель закрыта
    }));
  },

  dismissToast: (id: string) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  loadWorld: (entities: Entity[]) => {
    const entitiesMap: Record<string, Entity> = {};
    for (const entity of entities) {
      entitiesMap[entity.id] = entity;
    }
    set({ entities: entitiesMap });
  },

  setEnergy: (charge: number, capacity: number) => {
    set({ energy: { charge, capacity } });
  },

  /**
   * Атомарная постановка группы (E4: постановка чертежа) — либо вся группа целиком,
   * либо ничего; canPlaceBlueprint уже проверяет коллизии и внутри группы, и с миром.
   * В отличие от place() конфиги не дозаполняются дефолтами — сущности чертежа
   * уже полностью сконфигурированы (скопированы из момента сохранения).
   */
  placeMany: (entities: Entity[]) => {
    const state = get();
    if (state.running) {
      get().toast('Останови фабрику');
      return false;
    }
    if (!canPlaceBlueprint(state.entities, entities)) {
      return false;
    }
    set((s) => {
      const newEntities = { ...s.entities };
      for (const entity of entities) newEntities[entity.id] = entity;
      return { entities: newEntities };
    });
    return true;
  },

  addBlueprint: (blueprint: Blueprint) => {
    set((s) => ({ blueprints: [...s.blueprints, blueprint] }));
  },

  removeBlueprint: (id: string) => {
    set((s) => ({
      blueprints: s.blueprints.filter((b) => b.id !== id),
      stampBlueprintId: s.stampBlueprintId === id ? null : s.stampBlueprintId,
    }));
  },

  setStampBlueprint: (id: string | null) => {
    set({ stampBlueprintId: id, selectedTool: null, selectedEntityId: null });
  },

  setPendingSelection: (entities: Entity[] | null) => {
    // Рамкой захватили станки — открываем панель заодно, иначе форму сохранения не видно
    set((s) => ({ pendingSelection: entities, blueprintPanelOpen: entities ? true : s.blueprintPanelOpen }));
  },

  setBlueprintPanelOpen: (open: boolean) => {
    set({ blueprintPanelOpen: open });
  },

  setResultPanelOpen: (open: boolean) => {
    set({ resultPanelOpen: open });
  },

  setLogsPanelOpen: (open: boolean) => {
    // Открыли — считаем всё прочитанным, гасим индикатор
    set({ logsPanelOpen: open, logsUnread: open ? false : get().logsUnread });
  },

  clearLogs: () => {
    set({ toasts: [] });
  },

  loadBlueprints: (blueprints: Blueprint[]) => {
    set({ blueprints });
  },
}));
