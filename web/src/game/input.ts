import { Sprite, Container, Point } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { TILE } from './app';
import { getTexture } from './assets';
import { useStore } from '../state/store';
import { footprintTiles, canPlace } from '../core/grid';
import { rasterizeLine } from './rasterize';
import type { Entity, Vec } from '../core/types';
import type { GameLayers } from './app';

const GHOST_ALPHA = 0.5;
const TINT_OK = 0x00ff00; // зелёный
const TINT_BAD = 0xff0000; // красный

interface InputState {
  isDragging: boolean;
  dragStart: Vec | null;
  isRightMouseDown: boolean;
  lastMousePos: { x: number; y: number };
}

let inputState: InputState = {
  isDragging: false,
  dragStart: null,
  isRightMouseDown: false,
  lastMousePos: { x: 0, y: 0 },
};

export function initInput(canvas: HTMLCanvasElement, viewport: Viewport, layers: GameLayers): void {
  const ghostContainer = new Container();
  layers.ghost.addChild(ghostContainer);

  let ghostSprite: Sprite | null = null;
  let lastMouseTile: Vec | null = null;

  // Обновление позиции ghost при движении мыши
  const updateGhost = () => {
    const store = useStore.getState();
    if (!store.selectedTool) {
      if (ghostSprite) ghostSprite.visible = false;
      return;
    }

    if (!ghostSprite) {
      const texture = getTexture(store.selectedTool, 'idle');
      const tex = Array.isArray(texture) ? texture[0] : texture;
      ghostSprite = new Sprite(tex);
      ghostSprite.alpha = GHOST_ALPHA;
      ghostContainer.addChild(ghostSprite);
    }

    const mousePos = viewport.toWorld(new Point(inputState.lastMousePos.x, inputState.lastMousePos.y));
    const tilePosX = Math.floor(mousePos.x / TILE);
    const tilePosY = Math.floor(mousePos.y / TILE);
    const currentTile = { x: tilePosX, y: tilePosY };

    if (lastMouseTile && lastMouseTile.x === currentTile.x && lastMouseTile.y === currentTile.y) {
      return;
    }
    lastMouseTile = currentTile;

    ghostSprite.visible = true;
    ghostSprite.position.set(tilePosX * TILE, tilePosY * TILE);

    // Проверка возможности размещения
    const testEntity: Entity = {
      id: 'ghost',
      kind: store.selectedTool,
      pos: currentTile,
      dir: 0,
      config: {},
    };

    const canPlaceHere = canPlace(store.entities, testEntity);
    ghostSprite.tint = canPlaceHere ? TINT_OK : TINT_BAD;
  };

  // Mouse move
  canvas.addEventListener('pointermove', (e: PointerEvent) => {
    inputState.lastMousePos = { x: e.clientX, y: e.clientY };
    updateGhost();
  });

  // Mouse down
  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button === 0) {
      // ЛКМ
      inputState.isDragging = true;
      const mousePos = viewport.toWorld(new Point(e.clientX, e.clientY));
      inputState.dragStart = {
        x: Math.floor(mousePos.x / TILE),
        y: Math.floor(mousePos.y / TILE),
      };
    } else if (e.button === 2) {
      // ПКМ
      inputState.isRightMouseDown = true;
    }
  });

  // Mouse up
  canvas.addEventListener('pointerup', (e: PointerEvent) => {
    const store = useStore.getState();

    if (e.button === 0 && inputState.isDragging && inputState.dragStart) {
      // ЛКМ up
      const mousePos = viewport.toWorld(new Point(e.clientX, e.clientY));
      const dragEnd = {
        x: Math.floor(mousePos.x / TILE),
        y: Math.floor(mousePos.y / TILE),
      };

      if (store.selectedTool === 'belt') {
        // Drag-ленты: растеризация пути
        const path = rasterizeLine(inputState.dragStart, dragEnd);
        for (const step of path) {
          const beltEntity: Entity = {
            id: crypto.randomUUID().slice(0, 8),
            kind: 'belt',
            pos: step.tile,
            dir: step.dir,
            config: {},
          };
          store.place(beltEntity);
        }
      } else if (store.selectedTool) {
        // Обычное размещение станка
        const entity: Entity = {
          id: crypto.randomUUID().slice(0, 8),
          kind: store.selectedTool,
          pos: inputState.dragStart,
          dir: 0,
          config: {},
        };
        store.place(entity);
      }

      inputState.isDragging = false;
      inputState.dragStart = null;
    } else if (e.button === 2 && inputState.isRightMouseDown) {
      // ПКМ up: снос или пан?
      // Пан уже обработан viewport, так что здесь проверяем снос
      if (!inputState.isDragging) {
        const mousePos = viewport.toWorld(new Point(e.clientX, e.clientY));
        const tile = {
          x: Math.floor(mousePos.x / TILE),
          y: Math.floor(mousePos.y / TILE),
        };
        removeEntityAtTile(tile);
      }
      inputState.isRightMouseDown = false;
    }
  });

  // Keyboard
  canvas.addEventListener('keydown', (e: KeyboardEvent) => {
    const store = useStore.getState();

    if (e.key === 'Escape') {
      // Сброс инструмента/выделения
      store.setTool(null);
      store.select(null);
      updateGhost();
    } else if (e.key === 'r' || e.key === 'R') {
      // Поворот
      if (store.selectedEntityId) {
        // Поворот выделенного станка
        store.rotate(store.selectedEntityId);
      } else if (store.selectedTool) {
        // Поворот ghost? Нет, ghost не может быть повёрнут (он всегда dir=0)
        // Пока игнорируем
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      // Снос
      if (store.selectedEntityId) {
        store.remove(store.selectedEntityId);
        store.select(null);
      }
    } else if (e.key >= '1' && e.key <= '9') {
      // Хоткеи для инструментов (будут обрабатываться в Hotbar)
    }
  });

  // Клик по станку для выделения
  canvas.addEventListener('click', (e: PointerEvent) => {
    if (e.button !== 0) return; // только ЛКМ

    const store = useStore.getState();
    if (store.selectedTool) return; // если выбран инструмент, не выделяем

    const mousePos = viewport.toWorld(new Point(e.clientX, e.clientY));
    const tile = {
      x: Math.floor(mousePos.x / TILE),
      y: Math.floor(mousePos.y / TILE),
    };

    const entityId = findEntityAtTile(tile);
    if (entityId) {
      store.select(entityId);
    } else {
      store.select(null);
    }
  });
}

function findEntityAtTile(tile: Vec): string | null {
  const store = useStore.getState();
  for (const [id, entity] of Object.entries(store.entities)) {
    if (footprintTiles(entity).some((t) => t.x === tile.x && t.y === tile.y)) {
      return id;
    }
  }
  return null;
}

function removeEntityAtTile(tile: Vec): void {
  const entityId = findEntityAtTile(tile);
  if (entityId) {
    useStore.getState().remove(entityId);
  }
}
