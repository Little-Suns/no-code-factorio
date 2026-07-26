import { create } from 'zustand';
import type { Entity, NodeStatus, MachineKind, Vec } from '../core/types';
import { canPlace, rotateGroupRigid } from '../core/grid';
import { NODE_DEFS } from '../core/nodes';
import type { Blueprint } from '../core/blueprint';
import { canPlaceBlueprint } from '../core/blueprint';
import { t } from '../i18n/dictionaries';
import type { Locale } from '../i18n/dictionaries';

// BCP-47 для <html lang>: важно для доступности и для того, чтобы браузер подбирал
// CJK-шрифт для китайского текста (zh без региона браузеры тоже понимают, но -Hans
// однозначно указывает на упрощённые иероглифы, которые мы и используем в словаре).
const HTML_LANG: Record<Locale, string> = { ru: 'ru', en: 'en', zh: 'zh-Hans' };

export interface Store {
  entities: Record<string, Entity>;
  running: boolean;
  debugMode: boolean; // пошаговая отладка (кнопки Пауза/Шаг в TopBar) — зеркалит Engine.setDebugMode
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
  searchOpen: boolean; // видимость поиска по узлам (Ctrl+F / кнопка в TopBar)
  logsUnread: boolean; // новый лог пришёл, пока панель закрыта — «загорается» кнопка в TopBar
  locale: Locale; // язык UI-оболочки (i18n/) — персистится отдельно, state/localePersist.ts
  tutorialActive: boolean; // обучалка открыта — блокирует хоткеи и клики по канвасу (ui/Tutorial.tsx)
  tutorialStep: number; // индекс текущего шага; список шагов и их количество — в Tutorial.tsx
  // Уровни/челленджи (core/levels/): levelActive — id текущего уровня или null = обычная
  // песочница; levelProgress персистится отдельно (state/levelPersist.ts, зеркало
  // blueprintPersist.ts); levelCompleteInfo — транзиент для модалки успеха.
  levelActive: string | null;
  // stars: 0 — уровень ещё не пройден (но подсказки могли уже раскрываться), 1-3 — пройден.
  // Разлочка следующего уровня/бонуса проверяет stars > 0, а не просто наличие ключа —
  // иначе одно раскрытие подсказки без прохождения ошибочно засчитывалось бы как прогресс.
  levelProgress: Record<string, { stars: 0 | 1 | 2 | 3; hintsRevealed: number }>;
  levelPanelOpen: boolean;
  levelCompleteInfo: { id: string; stars: 1 | 2 | 3 } | null;
  // Разовая всплывашка-подсказка «попробуй уровни» сразу после первого закрытия
  // обучалки (см. state/tutorialPersist.ts) — транзиент, не персистится отдельно
  // (факт показа отслеживается тем же ncf.tutorial.seen.v1: показываем только на
  // переходе tutorialActive true→false, когда флага ещё не было в localStorage).
  levelsNudgeVisible: boolean;
  // actions
  place: (entity: Entity) => boolean;
  remove: (entityId: string) => void;
  removeMany: (entityIds: string[]) => void;
  rotate: (entityId: string) => void;
  rotateMany: (entityIds: string[]) => boolean;
  move: (entityId: string, pos: Vec) => boolean;
  moveMany: (positions: { id: string; pos: Vec }[]) => boolean;
  setConfig: (entityId: string, config: Record<string, unknown>) => void;
  select: (entityId: string | null) => void;
  setTool: (tool: MachineKind | null) => void;
  setRunning: (running: boolean) => void;
  setDebugMode: (debugMode: boolean) => void;
  setStatus: (nodeId: string, status: NodeStatus, error?: string) => void;
  setIO: (nodeId: string, lastIn?: unknown, lastOut?: unknown) => void;
  pushResult: (nodeId: string, data: unknown) => void;
  clearResults: () => void;
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
  setSearchOpen: (open: boolean) => void;
  clearLogs: () => void;
  loadBlueprints: (blueprints: Blueprint[]) => void;
  setLocale: (locale: Locale) => void;
  startTutorial: () => void;
  setTutorialStep: (step: number) => void;
  skipTutorial: () => void;
  setLevelActive: (id: string | null) => void;
  completeLevel: (id: string, stars: 1 | 2 | 3) => void;
  revealHint: (levelId: string, hintCount: number) => void;
  setLevelPanelOpen: (open: boolean) => void;
  setLevelCompleteInfo: (info: { id: string; stars: 1 | 2 | 3 } | null) => void;
  loadLevelProgress: (progress: Store['levelProgress']) => void;
  setLevelsNudgeVisible: (visible: boolean) => void;
}

export const useStore = create<Store>((set, get) => ({
  entities: {},
  running: false,
  debugMode: false,
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
  searchOpen: false,
  logsUnread: false,
  locale: 'en',
  tutorialActive: false,
  tutorialStep: 0,
  levelActive: null,
  levelProgress: {},
  levelPanelOpen: false,
  levelCompleteInfo: null,
  levelsNudgeVisible: false,

  place: (entity: Entity) => {
    const state = get();
    if (state.running) {
      get().toast(t('toast.stopFactory', state.locale));
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
      get().toast(t('toast.stopFactory', state.locale));
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
      get().toast(t('toast.stopFactory', state.locale));
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

  // Групповой поворот (R по рамке выделения/чертежу на кисти) — атомарно, как
  // moveMany: группа крутится как ЕДИНОЕ ТВЁРДОЕ ТЕЛО вокруг общего центра (не каждый
  // элемент вокруг своей оси на месте — иначе взаимное расположение станков после
  // поворота «разваливается»), геометрия — core/grid.ts::rotateGroupRigid (общая
  // с постановкой чертежа на кисти, game/input.ts).
  rotateMany: (entityIds: string[]) => {
    const state = get();
    if (state.running) {
      get().toast(t('toast.stopFactory', state.locale));
      return false;
    }
    const idSet = new Set(entityIds);
    const group: Entity[] = [];
    for (const id of entityIds) {
      const entity = state.entities[id];
      if (!entity) return false;
      group.push(entity);
    }
    if (group.length === 0) return false;

    const rotated = rotateGroupRigid(group, 1);

    const others: Record<string, Entity> = {};
    for (const [id, entity] of Object.entries(state.entities)) {
      if (!idSet.has(id)) others[id] = entity;
    }
    if (!canPlaceBlueprint(others, rotated)) {
      return false;
    }
    set((s) => {
      const entities = { ...s.entities };
      for (const entity of rotated) entities[entity.id] = entity;
      return { entities };
    });
    return true;
  },

  // Перетаскивание станка/ленты мышкой (баг 16): та же схема проверки, что и rotate —
  // сам станок исключаем из занятости, иначе целевая клетка всегда «занята» им же.
  move: (entityId: string, pos: Vec) => {
    const state = get();
    if (state.running) {
      get().toast(t('toast.stopFactory', state.locale));
      return false;
    }
    const entity = state.entities[entityId];
    if (!entity) return false;
    const newEntity = { ...entity, pos };
    const others = { ...state.entities };
    delete others[entityId];
    if (!canPlace(others, newEntity)) {
      return false;
    }
    set((s) => ({
      entities: { ...s.entities, [entityId]: newEntity },
    }));
    return true;
  },

  // Групповое перетаскивание рамкой выделения (pendingSelection) — атомарно, как
  // placeMany: либо вся группа сдвигается, либо ничего (canPlaceBlueprint уже
  // проверяет и коллизии с миром, и между собой — но между собой чистая трансляция
  // их и так не меняет, реальная проверка тут только против остального мира).
  moveMany: (positions: { id: string; pos: Vec }[]) => {
    const state = get();
    if (state.running) {
      get().toast(t('toast.stopFactory', state.locale));
      return false;
    }
    const idSet = new Set(positions.map((p) => p.id));
    const newEntities: Entity[] = [];
    for (const p of positions) {
      const entity = state.entities[p.id];
      if (!entity) return false;
      newEntities.push({ ...entity, pos: p.pos });
    }
    const others: Record<string, Entity> = {};
    for (const [id, entity] of Object.entries(state.entities)) {
      if (!idSet.has(id)) others[id] = entity;
    }
    if (!canPlaceBlueprint(others, newEntities)) {
      return false;
    }
    set((s) => {
      const entities = { ...s.entities };
      for (const entity of newEntities) entities[entity.id] = entity;
      return { entities };
    });
    return true;
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
    // debugMode сбрасывается на каждый Start/Stop — фабрика никогда не стартует
    // уже «на паузе» из предыдущего прогона.
    set({ running, debugMode: false });
  },

  setDebugMode: (debugMode: boolean) => {
    set({ debugMode });
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

  clearResults: () => {
    set({ results: {}, nodeStatus: {} });
  },

  toast: (text: string) => {
    set((s) => ({
      toasts: [...s.toasts, { id: crypto.randomUUID().slice(0, 8), text, at: Date.now() }].slice(-200),
      logsUnread: !s.logsPanelOpen, // «загорается» кнопка в TopBar, пока панель закрыта
    }));
  },

  dismissToast: (id: string) => {
    set((s) => ({ toasts: s.toasts.filter((toast) => toast.id !== id) }));
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
      get().toast(t('toast.stopFactory', state.locale));
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

  setSearchOpen: (open: boolean) => {
    set({ searchOpen: open });
  },

  clearLogs: () => {
    set({ toasts: [] });
  },

  loadBlueprints: (blueprints: Blueprint[]) => {
    set({ blueprints });
  },

  setLocale: (locale: Locale) => {
    set({ locale });
    if (typeof document !== 'undefined') {
      document.documentElement.lang = HTML_LANG[locale];
    }
  },

  startTutorial: () => {
    set({ tutorialActive: true, tutorialStep: 0 });
  },

  setTutorialStep: (step: number) => {
    set({ tutorialStep: step });
  },

  skipTutorial: () => {
    set({ tutorialActive: false });
  },

  setLevelActive: (id: string | null) => {
    set({ levelActive: id });
  },

  // Мержит через Math.max — переигранный уровень с меньшим числом сущностей не
  // портит уже достигнутый лучший результат; hintsRevealed сохраняется как есть
  // (подсказки уже открытые не «забываются» между попытками).
  completeLevel: (id: string, stars: 1 | 2 | 3) => {
    set((s) => {
      const prev = s.levelProgress[id];
      return {
        levelProgress: {
          ...s.levelProgress,
          [id]: { stars: Math.max(prev?.stars ?? 0, stars) as 1 | 2 | 3, hintsRevealed: prev?.hintsRevealed ?? 0 },
        },
      };
    });
  },

  revealHint: (levelId: string, hintCount: number) => {
    set((s) => {
      const prev = s.levelProgress[levelId];
      const hintsRevealed = Math.min(hintCount, (prev?.hintsRevealed ?? 0) + 1);
      return {
        levelProgress: {
          ...s.levelProgress,
          [levelId]: { stars: prev?.stars ?? 0, hintsRevealed },
        },
      };
    });
  },

  setLevelPanelOpen: (open: boolean) => {
    set({ levelPanelOpen: open });
  },

  setLevelCompleteInfo: (info: { id: string; stars: 1 | 2 | 3 } | null) => {
    set({ levelCompleteInfo: info });
  },

  loadLevelProgress: (progress: Store['levelProgress']) => {
    set({ levelProgress: progress });
  },

  setLevelsNudgeVisible: (visible: boolean) => {
    set({ levelsNudgeVisible: visible });
  },
}));
