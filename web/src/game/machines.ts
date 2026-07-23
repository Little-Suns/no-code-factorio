import { Sprite, AnimatedSprite, Container } from 'pixi.js';
import { TILE } from './app';
import { getTexture } from './assets';
import { useStore } from '../state/store';
import type { Entity, MachineKind } from '../core/types';
import type { GameLayers } from './app';

interface MachineSprite {
  container: Container;
  sprite: Sprite | AnimatedSprite;
}

const machineSprites = new Map<string, MachineSprite>();

export function initMachines(layers: GameLayers): void {
  // Подписка на изменения entities
  let prevEntities: Record<string, Entity> = {};
  useStore.subscribe((state) => {
    if (state.entities !== prevEntities) {
      prevEntities = state.entities;
      updateMachines(state.entities, layers.machines);
    }
  });
}

function updateMachines(entities: Record<string, Entity>, layer: Container): void {
  const existingIds = new Set(machineSprites.keys());
  const currentIds = new Set(Object.keys(entities));

  // Удалить спрайты удалённых станков
  for (const id of existingIds) {
    if (!currentIds.has(id)) {
      const machineSprite = machineSprites.get(id);
      if (machineSprite) {
        layer.removeChild(machineSprite.container);
        machineSprites.delete(id);
      }
    }
  }

  // Обновить или создать спрайты существующих станков
  for (const [id, entity] of Object.entries(entities)) {
    if (entity.kind === 'belt') continue; // ленты рендерятся отдельно

    let machineSprite = machineSprites.get(id);

    if (!machineSprite) {
      // Создать новый спрайт
      const container = new Container();
      const textureOrFrames = getTexture(entity.kind, 'idle');
      let sprite: Sprite | AnimatedSprite;

      if (Array.isArray(textureOrFrames)) {
        // Анимированный спрайт
        sprite = new AnimatedSprite(textureOrFrames);
        if (sprite instanceof AnimatedSprite) {
          sprite.play();
        }
      } else {
        // Статический спрайт
        sprite = new Sprite(textureOrFrames);
      }

      sprite.anchor.set(0, 0); // левый верхний угол
      container.addChild(sprite);
      layer.addChild(container);

      machineSprite = { container, sprite };
      machineSprites.set(id, machineSprite);
    }

    // Обновить позицию и поворот
    machineSprite.container.position.set(entity.pos.x * TILE, entity.pos.y * TILE);

    // Поворот вокруг центра footprint
    const getSize = (kind: MachineKind): { w: number; h: number } => {
      switch (kind) {
        case 'belt':
        case 'chest':
          return { w: 1, h: 1 };
        case 'miner':
        case 'furnace':
        case 'accumulator':
        case 'telegram':
          return { w: 2, h: 2 };
        case 'splitter':
        case 'lab':
          return { w: 2, h: 1 };
        case 'assembler':
        case 'mixer':
        case 'silo':
          return { w: 3, h: 3 };
        default:
          return { w: 1, h: 1 };
      }
    };

    const size = getSize(entity.kind);
    const rotatedSize = entity.dir === 1 || entity.dir === 3 ? { w: size.h, h: size.w } : size;

    // Пивот — центр БАЗОВОЙ текстуры (dir=0), позиция — центр повёрнутого footprint:
    // иначе несимметричные станки (2×1) при повороте уезжают из своего footprint
    machineSprite.sprite.pivot.set(size.w * TILE * 0.5, size.h * TILE * 0.5);
    machineSprite.sprite.position.set(rotatedSize.w * TILE * 0.5, rotatedSize.h * TILE * 0.5);
    machineSprite.sprite.angle = entity.dir * 90;
  }
}
