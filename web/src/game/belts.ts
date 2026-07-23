import { Sprite, Container } from 'pixi.js';
import { TILE } from './app';
import { getTexture } from './assets';
import { useStore } from '../state/store';
import type { Entity } from '../core/types';
import type { GameLayers } from './app';

const beltSprites = new Map<string, Sprite>();

export function initBelts(layers: GameLayers): void {
  // Подписка на изменения entities
  let prevEntities: Record<string, Entity> = {};
  useStore.subscribe((state) => {
    if (state.entities !== prevEntities) {
      prevEntities = state.entities;
      updateBelts(state.entities, layers.belts);
    }
  });
}

function updateBelts(entities: Record<string, Entity>, layer: Container): void {
  const existingIds = new Set(beltSprites.keys());
  const currentBeltIds = new Set<string>();

  // Собрать ID всех лент
  for (const [id, entity] of Object.entries(entities)) {
    if (entity.kind === 'belt') {
      currentBeltIds.add(id);
    }
  }

  // Удалить спрайты удалённых лент
  for (const id of existingIds) {
    if (!currentBeltIds.has(id)) {
      const sprite = beltSprites.get(id);
      if (sprite) {
        layer.removeChild(sprite);
        beltSprites.delete(id);
      }
    }
  }

  // Обновить или создать спрайты существующих лент
  for (const [id, entity] of Object.entries(entities)) {
    if (entity.kind !== 'belt') continue;

    let sprite = beltSprites.get(id);

    if (!sprite) {
      // Создать новый спрайт
      const texture = getTexture('belt', 'idle');
      const tex = Array.isArray(texture) ? texture[0] : texture;
      sprite = new Sprite(tex);
      sprite.anchor.set(0, 0);
      layer.addChild(sprite);
      beltSprites.set(id, sprite);
    }

    // Обновить позицию и поворот
    sprite.position.set(entity.pos.x * TILE, entity.pos.y * TILE);
    sprite.pivot.set(TILE * 0.5, TILE * 0.5);
    sprite.position.x += TILE * 0.5;
    sprite.position.y += TILE * 0.5;
    sprite.angle = entity.dir * 90;
  }
}
