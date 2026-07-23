import { Sprite, Point } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { TILE } from './app';
import { getTexture } from './assets';
import { useStore } from '../state/store';
import { footprintTiles, canPlace } from '../core/grid';
import { rasterizeLine } from './rasterize';
import type { Dir, Entity, MachineKind, Vec } from '../core/types';
import type { GameLayers } from './app';

const GHOST_ALPHA = 0.5;
const TINT_OK = 0x00ff00;
const TINT_BAD = 0xff0000;
const PAN_THRESHOLD = 6; // px: ПКМ с движением больше — это пан, не снос

// Размеры при dir=0 — для пивота ghost (дублирует core/grid, там getSize приватный)
const SIZES: Record<MachineKind, [number, number]> = {
  belt: [1, 1], miner: [2, 2], furnace: [2, 2], assembler: [3, 3],
  splitter: [2, 1], mixer: [3, 3], chest: [1, 1], lab: [2, 1],
  silo: [3, 3], telegram: [2, 2], accumulator: [2, 2],
};

export function initInput(canvas: HTMLCanvasElement, viewport: Viewport, layers: GameLayers): void {
  let ghostSprite: Sprite | null = null;
  let ghostTool: MachineKind | null = null; // для какого инструмента создан ghost
  let ghostDir: Dir = 0;
  let lastMouse = { x: 0, y: 0 };
  let dragStart: Vec | null = null;
  let rightDown: { x: number; y: number } | null = null;

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

  // Ghost пересоздаётся при смене инструмента, позиция/тинт — на каждый вызов
  const updateGhost = () => {
    const store = useStore.getState();
    const tool = store.selectedTool;

    if (!tool) {
      if (ghostSprite) ghostSprite.visible = false;
      return;
    }

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

    ghostSprite.visible = true;
    // Пивот — центр базовой текстуры, позиция — центр повёрнутого footprint
    ghostSprite.pivot.set((w * TILE) / 2, (h * TILE) / 2);
    ghostSprite.position.set(tile.x * TILE + (rw * TILE) / 2, tile.y * TILE + (rh * TILE) / 2);
    ghostSprite.angle = ghostDir * 90;

    const test: Entity = { id: 'ghost', kind: tool, pos: tile, dir: ghostDir, config: {} };
    // Лента поверх ленты — валидно (перезапись)
    const ok = canPlace(store.entities, test) || (tool === 'belt' && beltAt(tile) !== null);
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
    updateGhost();
  });

  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button === 0) {
      dragStart = toTile(e.clientX, e.clientY);
    } else if (e.button === 2) {
      rightDown = { x: e.clientX, y: e.clientY };
    }
  });

  canvas.addEventListener('pointerup', (e: PointerEvent) => {
    const store = useStore.getState();

    if (e.button === 0 && dragStart) {
      const dragEnd = toTile(e.clientX, e.clientY);

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
      } else {
        // Без инструмента — выделение станка под курсором
        store.select(findEntityAtTile(dragEnd));
      }

      dragStart = null;
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

    if (e.key === 'Escape') {
      store.setTool(null);
      store.select(null);
      updateGhost();
    } else if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
      if (store.selectedTool) {
        ghostDir = (((ghostDir as number) + 1) % 4) as Dir;
        updateGhost();
      } else if (store.selectedEntityId) {
        store.rotate(store.selectedEntityId);
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (store.selectedEntityId) {
        store.remove(store.selectedEntityId);
        store.select(null);
      }
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
