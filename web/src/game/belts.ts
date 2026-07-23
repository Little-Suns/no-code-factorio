import { Sprite, AnimatedSprite, Container } from 'pixi.js';
import { TILE } from './app';
import { getTexture } from './assets';
import { useStore } from '../state/store';
import type { Entity } from '../core/types';
import type { GameLayers } from './app';

interface BeltSprite {
  sprite: Sprite | AnimatedSprite;
}

const beltSprites = new Map<string, BeltSprite>();

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
      const bs = beltSprites.get(id);
      if (bs) {
        layer.removeChild(bs.sprite);
        beltSprites.delete(id);
      }
    }
  }

  // Обновить или создать спрайты существующих лент
  for (const [id, entity] of Object.entries(entities)) {
    if (entity.kind !== 'belt') continue;

    let beltSprite = beltSprites.get(id);

    if (!beltSprite) {
      // Создать новый спрайт
      const textureOrFrames = getTexture('belt', 'work');
      let sprite: Sprite | AnimatedSprite;

      if (Array.isArray(textureOrFrames)) {
        // Анимированный спрайт
        sprite = new AnimatedSprite(textureOrFrames);
        if (sprite instanceof AnimatedSprite) {
          sprite.animationSpeed = 0.15;
          sprite.play();
        }
      } else {
        // Статический спрайт (плейсхолдер)
        sprite = new Sprite(textureOrFrames);
      }

      sprite.anchor.set(0.5, 0.5);
      layer.addChild(sprite);
      beltSprite = { sprite };
      beltSprites.set(id, beltSprite);
    }

    // Обновить позицию и поворот
    beltSprite.sprite.position.set(
      entity.pos.x * TILE + TILE * 0.5,
      entity.pos.y * TILE + TILE * 0.5
    );
    beltSprite.sprite.angle = entity.dir * 90;
  }
}
