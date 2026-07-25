import { Sprite, Point, Graphics } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { TILE } from './app';
import { getTexture } from './assets';
import { MANIPULATOR_VISUAL_SCALE, SILO_VISUAL_SCALE, SILO_Y_OFFSET, LAB_VISUAL_SCALE_Y, DUPLICATOR_VISUAL_SCALE, ASSEMBLER_VISUAL_SCALE } from './machines';
import { useStore } from '../state/store';
import { t } from '../i18n/dictionaries';
import { footprintTiles, canPlace } from '../core/grid';
import { instantiateBlueprint, canPlaceBlueprint } from '../core/blueprint';
import { findLibraryBlueprint } from '../core/blueprintLibrary';
import { beltShape, makePath, drawTrack } from './belts';
import { rasterizeLine } from './rasterize';
import type { Dir, Entity, MachineKind, Vec } from '../core/types';
import type { GameLayers } from './app';

const GHOST_ALPHA = 0.5;
const TINT_OK = 0x00ff00;
const TINT_BAD = 0xff0000;
const PAN_THRESHOLD = 6; // px: ПКМ с движением больше — это пан, не снос
const DRAG_THRESHOLD = 6; // px: ЛКМ с движением больше — это рамка выделения, не клик по станку
const ENTITY_HL_COLOR = 0x5ad1ff;

// Размеры при dir=0 — для пивота ghost (дублирует core/grid, там getSize приватный)
const SIZES: Record<MachineKind, [number, number]> = {
  belt: [1, 1], miner: [2, 2], furnace: [2, 2], assembler: [2, 2],
  duplicator: [2, 2], mixer: [3, 3], chest: [1, 1], lab: [2, 2],
  silo: [3, 3], accumulator: [2, 2], webhook: [2, 2],
  manipulator: [1, 1],
};

export function initInput(canvas: HTMLCanvasElement, viewport: Viewport, layers: GameLayers): void {
  let ghostSprite: Sprite | null = null;
  let ghostTool: MachineKind | null = null; // для какого инструмента создан ghost
  let ghostDir: Dir = 0;
  let lastMouse = { x: 0, y: 0 };
  let dragStart: Vec | null = null;
  let leftDownPx: { x: number; y: number } | null = null; // для отличия клика от драга рамки (px, не тайлы)
  let rightDown: { x: number; y: number } | null = null;

  // Баг 16: перетаскивание существующего станка/ленты нажатием+движением ЛКМ.
  // moveGrabOffset — смещение точки захвата от pos станка, чтобы при драге станок
  // не «прыгал» так, чтобы pos совпал с курсором, а сохранял исходную точку хвата.
  let movingEntityId: string | null = null;
  let moveGrabOffset: Vec = { x: 0, y: 0 };
  // Групповой драг: если клик пришёлся на станок из уже выделенной рамкой группы
  // (store.pendingSelection) — тащим всю группу, сохраняя относительное расположение.
  let movingGroupIds: string[] = [];
  let groupMoveAnchor: Vec = { x: 0, y: 0 };
  let groupMoveStartPositions: Record<string, Vec> = {};

  // E4: выделение рамкой — просто зажим+растягивание ЛКМ без инструмента/чертежа на кисти
  let selectionBox: Graphics | null = null;
  let entityHighlight: Graphics | null = null;

  // E4: групповой ghost при постановке чертежа (store.stampBlueprintId)
  let groupGhostSprites: Sprite[] = [];
  let groupGhostBlueprintId: string | null = null;

  // Процедурный ghost ленты (тот же рендер, что belts.ts): пул Graphics-тайлов.
  let beltGhostPool: Graphics[] = [];

  const toTile = (clientX: number, clientY: number): Vec => {
    const world = viewport.toWorld(new Point(clientX, clientY));
    return { x: Math.floor(world.x / TILE), y: Math.floor(world.y / TILE) };
  };

  const beltAt = (tile: Vec): string | null => {
    const { entities } = useStore.getState();
    for (const [id, e] of Object.entries(entities)) {
      if (e.kind === 'belt' && e.pos.x === tile.x && e.pos.y === tile.y) return id;
    }
    return null;
  };

  // E4: прямоугольник выделения — рисуется только пока dragStart есть (кнопка зажата)
  const updateSelectionBox = (start: Vec, end: Vec) => {
    if (!selectionBox) {
      selectionBox = new Graphics();
      layers.ghost.addChild(selectionBox);
    }
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x) + 1;
    const h = Math.abs(end.y - start.y) + 1;
    selectionBox.clear();
    selectionBox.rect(minX * TILE, minY * TILE, w * TILE, h * TILE);
    selectionBox.fill({ color: 0xd9a441, alpha: 0.12 });
    selectionBox.stroke({ width: 2, color: 0xd9a441, alpha: 0.9 });
  };

  const clearSelectionBox = () => {
    selectionBox?.destroy();
    selectionBox = null;
  };

  // E4: подсветка станков, попавших в рамку — иначе непонятно, что именно захватилось.
  // Один Graphics на всю подсветку, перерисовывается целиком (как selectionBox).
  const updateEntityHighlight = (entities: Entity[]) => {
    if (entities.length === 0) {
      clearEntityHighlight();
      return;
    }
    if (!entityHighlight) {
      entityHighlight = new Graphics();
      layers.ghost.addChild(entityHighlight);
    }
    entityHighlight.clear();
    for (const e of entities) {
      const tiles = footprintTiles(e);
      const minX = Math.min(...tiles.map((t) => t.x));
      const maxX = Math.max(...tiles.map((t) => t.x));
      const minY = Math.min(...tiles.map((t) => t.y));
      const maxY = Math.max(...tiles.map((t) => t.y));
      entityHighlight.rect(minX * TILE, minY * TILE, (maxX - minX + 1) * TILE, (maxY - minY + 1) * TILE);
      entityHighlight.fill({ color: ENTITY_HL_COLOR, alpha: 0.22 });
      entityHighlight.stroke({ width: 2, color: ENTITY_HL_COLOR, alpha: 0.95 });
    }
  };

  const clearEntityHighlight = () => {
    entityHighlight?.destroy();
    entityHighlight = null;
  };

  // Сущность попадает в чертёж, только если весь её footprint внутри рамки —
  // иначе задетый краем станок сохранился бы «обрезанным» без части входов/выходов.
  const collectSelection = (a: Vec, b: Vec): Entity[] => {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    const { entities } = useStore.getState();
    return Object.values(entities).filter((e) =>
      footprintTiles(e).every((t) => t.x >= minX && t.x <= maxX && t.y >= minY && t.y <= maxY)
    );
  };

  const clearGroupGhost = () => {
    for (const s of groupGhostSprites) s.destroy();
    groupGhostSprites = [];
    groupGhostBlueprintId = null;
  };

  // Групповой ghost чертежа: набор спрайтов вместо одного, тинт общий по canPlaceBlueprint.
  // Спрайты пересоздаются только при смене чертежа — на каждый pointermove просто
  // переставляем позиции (как и одиночный ghost).
  const updateGroupGhost = (blueprintId: string) => {
    const store = useStore.getState();
    const bp = store.blueprints.find((b) => b.id === blueprintId) ?? findLibraryBlueprint(blueprintId);
    if (!bp) {
      clearGroupGhost();
      return;
    }

    if (groupGhostBlueprintId !== blueprintId) {
      clearGroupGhost();
      for (const e of bp.entities) {
        const texture = getTexture(e.kind, 'idle');
        const sprite = new Sprite(Array.isArray(texture) ? texture[0] : texture);
        sprite.alpha = GHOST_ALPHA;
        layers.ghost.addChild(sprite);
        groupGhostSprites.push(sprite);
      }
      groupGhostBlueprintId = blueprintId;
    }

    const origin = toTile(lastMouse.x, lastMouse.y);
    const instantiated = instantiateBlueprint(bp, origin);
    const ok = canPlaceBlueprint(store.entities, instantiated);

    instantiated.forEach((e, i) => {
      const sprite = groupGhostSprites[i];
      if (!sprite) return;
      const [w, h] = SIZES[e.kind];
      const rw = e.dir % 2 === 1 ? h : w;
      const rh = e.dir % 2 === 1 ? w : h;
      // Текстура lab авторена на 2×1, футпринт (SIZES) — 2×2 (см. updateGhost выше и
      // machines.ts) — пивот по размеру текстуры, иначе арт сместился бы к верху клетки
      // нерастянутым, как раньше при 2×1-футпринте.
      const [sw, sh] = e.kind === 'assembler' ? [3, 3] : e.kind === 'lab' || e.kind === 'duplicator' ? [2, 1] : [w, h];
      sprite.visible = true;
      sprite.pivot.set((sw * TILE) / 2, (sh * TILE) / 2);
      sprite.position.set(e.pos.x * TILE + (rw * TILE) / 2, e.pos.y * TILE + (rh * TILE) / 2);
      sprite.angle = e.dir * 90;
      sprite.scale.set(
        e.kind === 'manipulator' ? MANIPULATOR_VISUAL_SCALE : e.kind === 'duplicator' ? DUPLICATOR_VISUAL_SCALE : e.kind === 'assembler' ? ASSEMBLER_VISUAL_SCALE : 1,
        e.kind === 'manipulator' ? -MANIPULATOR_VISUAL_SCALE : e.kind === 'duplicator' ? DUPLICATOR_VISUAL_SCALE : e.kind === 'assembler' ? ASSEMBLER_VISUAL_SCALE : e.kind === 'lab' ? LAB_VISUAL_SCALE_Y : 1
      );
      sprite.tint = ok ? TINT_OK : TINT_BAD;
    });
  };

  const clearBeltGhost = () => {
    for (const g of beltGhostPool) g.visible = false;
  };

  // Ghost ленты процедурным рендером belts.ts: одиночный тайл на ховере (форма
  // считается с учётом уже стоящих лент → сразу показывает поворот), или вся линия
  // с углами при протяжке. ok → обычные цвета ленты (alpha), bad → красный тинт.
  const updateBeltGhost = (tiles: { pos: Vec; dir: Dir }[]) => {
    const store = useStore.getState();

    // byTile: существующие ленты мира + сами ghost-тайлы (ghost поверх) — чтобы
    // форма учитывала стыковку и с миром, и внутри линии.
    const byTile = new Map<string, Entity>();
    for (const e of Object.values(store.entities)) {
      if (e.kind === 'belt') byTile.set(`${e.pos.x},${e.pos.y}`, e);
    }
    for (const t of tiles) {
      byTile.set(`${t.pos.x},${t.pos.y}`, { id: 'ghost', kind: 'belt', pos: t.pos, dir: t.dir, config: {} });
    }

    let ok = true;
    for (const t of tiles) {
      const test: Entity = { id: 'ghost', kind: 'belt', pos: t.pos, dir: t.dir, config: {} };
      if (!(canPlace(store.entities, test) || beltAt(t.pos) !== null)) {
        ok = false;
        break;
      }
    }

    tiles.forEach((t, i) => {
      let g = beltGhostPool[i];
      if (!g) {
        g = new Graphics();
        g.alpha = GHOST_ALPHA;
        layers.ghost.addChild(g);
        beltGhostPool[i] = g;
      }
      const ent: Entity = { id: 'ghost', kind: 'belt', pos: t.pos, dir: t.dir, config: {} };
      const shape = beltShape(ent, byTile);
      drawTrack(g, shape, makePath(shape));
      g.position.set(t.pos.x * TILE, t.pos.y * TILE);
      g.tint = ok ? 0xffffff : TINT_BAD;
      g.visible = true;
    });
    for (let i = tiles.length; i < beltGhostPool.length; i++) beltGhostPool[i].visible = false;
  };

  // Ghost пересоздаётся при смене инструмента, позиция/тинт — на каждый вызов
  const updateGhost = () => {
    const store = useStore.getState();
    const tool = store.selectedTool;

    if (store.stampBlueprintId) {
      if (ghostSprite) ghostSprite.visible = false;
      clearBeltGhost();
      updateGroupGhost(store.stampBlueprintId);
      return;
    }
    clearGroupGhost();

    if (!tool) {
      if (ghostSprite) ghostSprite.visible = false;
      clearBeltGhost();
      return;
    }

    // Лента — свой процедурный ghost (одиночный тайл или вся протянутая линия)
    if (tool === 'belt') {
      if (ghostSprite) ghostSprite.visible = false;
      const end = toTile(lastMouse.x, lastMouse.y);
      let tiles: { pos: Vec; dir: Dir }[];
      if (dragStart) {
        const steps = rasterizeLine(dragStart, end);
        tiles = steps.length === 0
          ? [{ pos: dragStart, dir: ghostDir }]
          : [{ pos: dragStart, dir: steps[0].dir }, ...steps.map((s) => ({ pos: s.tile, dir: s.dir }))];
      } else {
        tiles = [{ pos: end, dir: ghostDir }];
      }
      updateBeltGhost(tiles);
      return;
    }
    clearBeltGhost();

    if (!ghostSprite || ghostTool !== tool) {
      ghostSprite?.destroy();
      const texture = getTexture(tool, 'idle');
      ghostSprite = new Sprite(Array.isArray(texture) ? texture[0] : texture);
      ghostSprite.alpha = GHOST_ALPHA;
      layers.ghost.addChild(ghostSprite);
      ghostTool = tool;
    }

    const tile = toTile(lastMouse.x, lastMouse.y);
    const [w, h] = SIZES[tool];
    const rw = ghostDir % 2 === 1 ? h : w;
    const rh = ghostDir % 2 === 1 ? w : h;
    // Текстура может быть больше или меньше футпринта — пивот по размеру текстуры,
    // позиция по футпринту → текстура центрируется/растягивается на клетках.
    // assembler: спрайт 3×3, футпринт 2×2 (арт с прозрачным бортиком, центрируется).
    // lab: спрайт (арт) 2×1, футпринт теперь 2×2 (докс/03, инвариант к повороту) —
    // тянем по высоте (LAB_VISUAL_SCALE_Y), см. machines.ts.
    const [sw, sh] = tool === 'assembler' ? [3, 3] : tool === 'lab' || tool === 'duplicator' ? [2, 1] : [w, h];

    ghostSprite.visible = true;
    ghostSprite.pivot.set((sw * TILE) / 2, (sh * TILE) / 2);
    ghostSprite.position.set(tile.x * TILE + (rw * TILE) / 2, tile.y * TILE + (rh * TILE) / 2);
    if (tool === 'silo') ghostSprite.position.y -= SILO_Y_OFFSET;
    ghostSprite.angle = ghostDir * 90;
    // manipulator: тот же увеличенный масштаб + дефолтное зеркало, что и у реально
    // поставленного станка (machines.ts) — иначе ghost выглядит как старый мелкий спрайт.
    // lab: та же вертикальная растяжка арта, что и у реально поставленного станка.
    ghostSprite.scale.set(
      tool === 'manipulator' ? MANIPULATOR_VISUAL_SCALE : tool === 'silo' ? SILO_VISUAL_SCALE : tool === 'duplicator' ? DUPLICATOR_VISUAL_SCALE : tool === 'assembler' ? ASSEMBLER_VISUAL_SCALE : 1,
      tool === 'manipulator' ? -MANIPULATOR_VISUAL_SCALE : tool === 'silo' ? SILO_VISUAL_SCALE : tool === 'duplicator' ? DUPLICATOR_VISUAL_SCALE : tool === 'assembler' ? ASSEMBLER_VISUAL_SCALE : tool === 'lab' ? LAB_VISUAL_SCALE_Y : 1
    );

    const test: Entity = { id: 'ghost', kind: tool, pos: tile, dir: ghostDir, config: {} };
    const ok = canPlace(store.entities, test); // лента обрабатывается отдельным ghost выше
    ghostSprite.tint = ok ? TINT_OK : TINT_BAD;
  };

  const placeBelt = (tile: Vec, dir: Dir) => {
    const store = useStore.getState();
    const existing = beltAt(tile);
    if (existing) store.remove(existing); // перезапись ленты (docs/03)
    store.place({ id: crypto.randomUUID().slice(0, 8), kind: 'belt', pos: tile, dir, config: {} });
  };

  canvas.addEventListener('pointermove', (e: PointerEvent) => {
    lastMouse = { x: e.clientX, y: e.clientY };
    const store = useStore.getState();
    // Групповое перетаскивание — то же «упирается в занятое», но атомарно для всей
    // группы (moveMany/canPlaceBlueprint), абсолютная цель всегда от исходных позиций
    // (не накопление за кадр), чтобы не было дрейфа при отклонённых кадрах.
    if (movingGroupIds.length > 0) {
      const raw = toTile(e.clientX, e.clientY);
      const delta = { x: raw.x - groupMoveAnchor.x, y: raw.y - groupMoveAnchor.y };
      if (delta.x !== 0 || delta.y !== 0) {
        const positions = movingGroupIds
          .filter((id) => groupMoveStartPositions[id])
          .map((id) => ({
            id,
            pos: { x: groupMoveStartPositions[id].x + delta.x, y: groupMoveStartPositions[id].y + delta.y },
          }));
        store.moveMany(positions);
      }
      // Рамка подсветки должна ехать вместе с группой — пересчитываем по свежим
      // позициям из стора (moveMany мог отклонить кадр — тогда останется на месте).
      const fresh = useStore.getState();
      updateEntityHighlight(movingGroupIds.map((id) => fresh.entities[id]).filter((e): e is Entity => !!e));
      return;
    }
    // Перетаскивание станка — двигаем сразу в сторе (как rotate: canPlace не пускает
    // в занятую клетку, поэтому лишней проверки/ghost не нужно, драг просто «упирается»).
    if (movingEntityId) {
      const raw = toTile(e.clientX, e.clientY);
      const target = { x: raw.x - moveGrabOffset.x, y: raw.y - moveGrabOffset.y };
      const entity = store.entities[movingEntityId];
      if (entity && (entity.pos.x !== target.x || entity.pos.y !== target.y)) {
        store.move(movingEntityId, target);
      }
      return;
    }
    // Рамка выделения — просто зажатая ЛКМ без инструмента/чертежа на кисти, без отдельного режима
    if (dragStart && !store.selectedTool && !store.stampBlueprintId) {
      const dragEnd = toTile(e.clientX, e.clientY);
      updateSelectionBox(dragStart, dragEnd);
      updateEntityHighlight(collectSelection(dragStart, dragEnd));
    } else {
      updateGhost();
    }
  });

  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button === 0) {
      dragStart = toTile(e.clientX, e.clientY);
      leftDownPx = { x: e.clientX, y: e.clientY };
      const store = useStore.getState();
      // Новый драг рамкой — сбросить подсветку прошлого выделения, если она ещё висела
      if (!store.selectedTool && !store.stampBlueprintId) {
        const hitId = !store.running ? findEntityAtTile(dragStart) : null;
        const group = store.pendingSelection;
        if (hitId && group && group.some((ent) => ent.id === hitId)) {
          // Клик по станку из уже выделенной рамкой группы — тащим всю группу целиком,
          // подсветку не гасим (иначе непонятно, что именно двигается).
          movingGroupIds = group.map((ent) => ent.id);
          groupMoveAnchor = dragStart;
          groupMoveStartPositions = {};
          for (const id of movingGroupIds) {
            const entity = store.entities[id];
            if (entity) groupMoveStartPositions[id] = entity.pos;
          }
        } else {
          clearEntityHighlight();
          // Клик по существующему станку без инструмента на кисти — начало драга
          // перемещения (баг 16), а не рамки выделения. Пока работает — не тащим.
          if (hitId) {
            const entity = store.entities[hitId];
            movingEntityId = hitId;
            moveGrabOffset = { x: dragStart.x - entity.pos.x, y: dragStart.y - entity.pos.y };
          }
        }
      }
    } else if (e.button === 2) {
      rightDown = { x: e.clientX, y: e.clientY };
    }
  });

  canvas.addEventListener('pointerup', (e: PointerEvent) => {
    const store = useStore.getState();

    if (e.button === 0 && dragStart) {
      const dragEnd = toTile(e.clientX, e.clientY);

      if (movingGroupIds.length > 0) {
        // Подсветку/pendingSelection не трогаем — группа остаётся выделенной для
        // повторного перетаскивания или сохранения в чертёж.
        movingGroupIds = [];
        groupMoveStartPositions = {};
        dragStart = null;
        leftDownPx = null;
        updateGhost();
        return;
      }

      if (movingEntityId) {
        // Клик без движения тоже проходит через сюда (target = pos) — то же
        // поведение «клик выделяет станок», что было раньше без драга.
        store.select(movingEntityId);
        movingEntityId = null;
        moveGrabOffset = { x: 0, y: 0 };
        dragStart = null;
        leftDownPx = null;
        updateGhost();
        return;
      }

      if (!store.selectedTool && !store.stampBlueprintId) {
        // Отличаем клик от драга рамки по пиксельному смещению (как ПКМ снос/пан ниже) —
        // иначе одиночный клик по 1x1 станку (belt/chest) захватывался бы рамкой из одного тайла.
        const movedPx = leftDownPx ? Math.hypot(e.clientX - leftDownPx.x, e.clientY - leftDownPx.y) : 0;
        clearSelectionBox();

        if (movedPx >= DRAG_THRESHOLD) {
          const selected = collectSelection(dragStart, dragEnd);
          if (selected.length === 0) {
            store.toast(t('toast.emptySelection', store.locale));
            clearEntityHighlight();
          } else {
            store.setPendingSelection(selected);
            updateEntityHighlight(selected); // подсветка остаётся, пока открыта форма сохранения
          }
        } else {
          clearEntityHighlight();
          store.select(findEntityAtTile(dragEnd)); // клик без движения — выделение станка под курсором
        }

        dragStart = null;
        leftDownPx = null;
        updateGhost();
        return;
      }

      if (store.stampBlueprintId) {
        // Постановка чертежа — origin, как и у обычных станков, берём по началу
        // клика (dragStart), не по release: клик без драга даёт ожидаемый результат,
        // а поведение симметрично store.place() ниже.
        const bp = store.blueprints.find((b) => b.id === store.stampBlueprintId) ?? findLibraryBlueprint(store.stampBlueprintId);
        if (bp) {
          const instantiated = instantiateBlueprint(bp, dragStart);
          store.placeMany(instantiated);
          // stampBlueprintId намеренно не сбрасываем — как и selectedTool у обычных
          // станков, чертёж остаётся «на кисти» для повторной постановки подряд.
        }
        dragStart = null;
        leftDownPx = null;
        updateGhost();
        return;
      }

      if (store.selectedTool === 'belt') {
        const steps = rasterizeLine(dragStart, dragEnd);
        if (steps.length === 0) {
          placeBelt(dragStart, ghostDir); // одиночный клик — одна лента по направлению ghost
        } else {
          placeBelt(dragStart, steps[0].dir); // стартовый тайл — по направлению первого шага
          for (const step of steps) placeBelt(step.tile, step.dir);
        }
      } else if (store.selectedTool) {
        store.place({
          id: crypto.randomUUID().slice(0, 8),
          kind: store.selectedTool,
          pos: dragStart,
          dir: ghostDir,
          config: {},
        });
      }

      dragStart = null;
      leftDownPx = null;
      updateGhost(); // перевалидировать тинт после изменения мира
    } else if (e.button === 2 && rightDown) {
      // Снос ПКМ только без движения (движение = пан вьюпорта)
      const moved = Math.hypot(e.clientX - rightDown.x, e.clientY - rightDown.y);
      if (moved < PAN_THRESHOLD) {
        const id = findEntityAtTile(toTile(e.clientX, e.clientY));
        if (id) useStore.getState().remove(id);
        updateGhost();
      }
      rightDown = null;
    }
  });

  // Клавиатура на window: canvas не фокусируем
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const store = useStore.getState();
    if (store.tutorialActive) return; // обучалка открыта (ui/Tutorial.tsx) — блокирует хоткеи

    if (e.key === 'Escape') {
      store.setTool(null); // сбрасывает selectedTool + stampBlueprintId + selectedEntityId
      store.setPendingSelection(null);
      dragStart = null;
      leftDownPx = null;
      movingEntityId = null;
      moveGrabOffset = { x: 0, y: 0 };
      movingGroupIds = [];
      groupMoveStartPositions = {};
      clearSelectionBox();
      clearEntityHighlight();
      updateGhost();
    } else if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
      if (store.selectedTool) {
        ghostDir = (((ghostDir as number) + 1) % 4) as Dir;
        updateGhost();
      } else if (store.selectedEntityId) {
        store.rotate(store.selectedEntityId);
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (store.pendingSelection && store.pendingSelection.length > 0) {
        // Рамка выделения на кисти (форма сохранения чертежа открыта) — снести всё разом
        store.removeMany(store.pendingSelection.map((ent) => ent.id));
        store.setPendingSelection(null);
        clearEntityHighlight();
      } else if (store.selectedEntityId) {
        store.remove(store.selectedEntityId);
        store.select(null);
      }
    } else if (e.key === 'b' || e.key === 'B' || e.key === 'и' || e.key === 'И') {
      // Панель чертежей — переключатель по B (независимо от рамки выделения, которая тоже на ЛКМ)
      store.setBlueprintPanelOpen(!store.blueprintPanelOpen);
    }
  });

  // Отмена сохранения/закрытие формы (BlueprintPanel) не проходит через события canvas —
  // подсветку снимаем по изменению pendingSelection в сторе.
  let prevPendingSelection = useStore.getState().pendingSelection;
  useStore.subscribe((state) => {
    if (state.pendingSelection !== prevPendingSelection) {
      prevPendingSelection = state.pendingSelection;
      if (!state.pendingSelection) clearEntityHighlight();
    }
  });
}

function findEntityAtTile(tile: Vec): string | null {
  const { entities } = useStore.getState();
  for (const [id, entity] of Object.entries(entities)) {
    if (footprintTiles(entity).some((t) => t.x === tile.x && t.y === tile.y)) {
      return id;
    }
  }
  return null;
}
