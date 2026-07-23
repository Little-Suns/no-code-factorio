import { Sprite, AnimatedSprite, Container, Graphics } from 'pixi.js';
import { TILE } from './app';
import { getTexture } from './assets';
import { useStore } from '../state/store';
import type { Entity, MachineKind, NodeStatus } from '../core/types';
import type { GameLayers } from './app';

interface MachineSprite {
  container: Container;
  sprite: Sprite | AnimatedSprite;
  statusLamp: Graphics;
}

const machineSprites = new Map<string, MachineSprite>();

const STATUS_COLORS: Record<NodeStatus, number> = {
  idle: 0x888888,     // серый
  working: 0xffd700,  // жёлтый
  ok: 0x00cc00,       // зелёный
  error: 0xff0000,    // красный
};

export function initMachines(layers: GameLayers): void {
  // Подписка на изменения entities
  let prevEntities: Record<string, Entity> = {};
  useStore.subscribe((state) => {
    if (state.entities !== prevEntities) {
      prevEntities = state.entities;
      updateMachines(state.entities, layers.machines);
    }
  });

  // Подписка на nodeStatus для обновления лампы и анимаций
  let prevNodeStatus: Record<string, any> = {};
  useStore.subscribe((state) => {
    if (state.nodeStatus !== prevNodeStatus) {
      prevNodeStatus = state.nodeStatus;
      updateMachineStatus(state.entities, state.nodeStatus);
    }
  });
}

function getSize(kind: MachineKind): { w: number; h: number } {
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
        sprite = new AnimatedSprite(textureOrFrames);
        if (sprite instanceof AnimatedSprite) {
          sprite.animationSpeed = 0.1; // замедляем анимацию
          sprite.play();
        }
      } else {
        sprite = new Sprite(textureOrFrames);
      }

      sprite.anchor.set(0, 0);
      container.addChild(sprite);

      // Создать статус-лампу (круг 10px в углу)
      const statusLamp = new Graphics();
      statusLamp.circle(5, 5, 5);
      statusLamp.fill(STATUS_COLORS.idle);
      statusLamp.position.set(5, 5); // в верхний левый угол
      container.addChild(statusLamp);

      layer.addChild(container);

      machineSprite = { container, sprite, statusLamp };
      machineSprites.set(id, machineSprite);
    }

    // Обновить позицию и поворот
    machineSprite.container.position.set(entity.pos.x * TILE, entity.pos.y * TILE);

    const size = getSize(entity.kind);
    const rotatedSize = entity.dir === 1 || entity.dir === 3 ? { w: size.h, h: size.w } : size;

    machineSprite.sprite.pivot.set(size.w * TILE * 0.5, size.h * TILE * 0.5);
    machineSprite.sprite.position.set(rotatedSize.w * TILE * 0.5, rotatedSize.h * TILE * 0.5);
    machineSprite.sprite.angle = entity.dir * 90;
  }
}

function updateMachineStatus(
  entities: Record<string, Entity>,
  nodeStatus: Record<string, { status: NodeStatus; error?: string; lastIn?: unknown; lastOut?: unknown }>
): void {
  for (const [nodeId, statusInfo] of Object.entries(nodeStatus)) {
    const machineSprite = machineSprites.get(nodeId);
    if (!machineSprite) continue;

    const { status } = statusInfo;
    const entity = entities[nodeId];
    if (!entity || entity.kind === 'belt') continue;

    // Обновить лампу
    machineSprite.statusLamp.clear();
    machineSprite.statusLamp.circle(5, 5, 5);
    machineSprite.statusLamp.fill(STATUS_COLORS[status]);

    // Переключить спрайт на work-анимацию если working
    if (status === 'working') {
      const workTextures = getTexture(entity.kind, 'work');
      if (Array.isArray(workTextures) && machineSprite.sprite instanceof AnimatedSprite) {
        machineSprite.sprite.textures = workTextures;
        machineSprite.sprite.play();
      }
    } else {
      // Вернуться на idle
      const idleTexture = getTexture(entity.kind, 'idle');
      if (machineSprite.sprite instanceof AnimatedSprite) {
        if (Array.isArray(idleTexture)) {
          machineSprite.sprite.textures = idleTexture;
          machineSprite.sprite.gotoAndStop(0);
        } else {
          machineSprite.sprite.texture = idleTexture;
        }
      } else if (!Array.isArray(idleTexture)) {
        machineSprite.sprite.texture = idleTexture;
      }
    }
  }
}
