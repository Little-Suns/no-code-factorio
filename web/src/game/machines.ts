import { Sprite, AnimatedSprite, Container, Graphics, Ticker } from 'pixi.js';
import { TILE } from './app';
import { getTexture } from './assets';
import { useStore } from '../state/store';
import type { Entity, MachineKind, NodeStatus, Dir } from '../core/types';
import type { GameLayers } from './app';

interface MachineSprite {
  container: Container;
  sprite: Sprite | AnimatedSprite;
  statusLamp: Graphics;
  chargeBar?: Graphics; // только у accumulator (E1)
}

const machineSprites = new Map<string, MachineSprite>();

const STATUS_COLORS: Record<NodeStatus, number> = {
  idle: 0x5a5445,     // тускло-жёлтый (idle, дизайн-макет Factory.exe)
  working: 0xf0a030,  // акцентный оранжевый (working)
  ok: 0x5ecf7a,       // зелёный
  error: 0xe2483f,    // красный
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

  // Подписка на energy (E1) — полоска заряда рисуется кодом прямо на аккумуляторе (docs/02)
  let prevEnergy: { charge: number; capacity: number } | null = null;
  useStore.subscribe((state) => {
    if (state.energy !== prevEnergy) {
      prevEnergy = state.energy;
      updateChargeBars(state.entities, state.energy);
    }
  });

  // Пульсация статус-лампы у работающих станков (дизайн-макет: animation:lamp)
  Ticker.shared.add(() => {
    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 340));
    const status = useStore.getState().nodeStatus;
    for (const [id, ms] of machineSprites) {
      ms.statusLamp.alpha = status[id]?.status === 'working' ? pulse : 1;
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
    case 'webhook':
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
      const idleTextureOrFrames = getTexture(entity.kind, 'idle');
      const workTextureOrFrames = getTexture(entity.kind, 'work');
      let sprite: Sprite | AnimatedSprite;

      // AnimatedSprite нужен, если ЕСТЬ анимация work — иначе status:'working' будет некому
      // подхватить (instanceof AnimatedSprite ниже всегда false для обычного Sprite).
      // idle почти всегда одиночный PNG (не массив), поэтому раньше сюда никогда не попадали.
      if (Array.isArray(workTextureOrFrames)) {
        const initialFrames = Array.isArray(idleTextureOrFrames) ? idleTextureOrFrames : [idleTextureOrFrames];
        const animated = new AnimatedSprite(initialFrames);
        animated.animationSpeed = 0.1; // замедляем анимацию
        animated.gotoAndStop(0); // стоим на idle-кадре, пока status !== 'working'
        sprite = animated;
      } else if (Array.isArray(idleTextureOrFrames)) {
        const animated = new AnimatedSprite(idleTextureOrFrames);
        animated.animationSpeed = 0.1;
        animated.play();
        sprite = animated;
      } else {
        sprite = new Sprite(idleTextureOrFrames);
      }

      sprite.anchor.set(0, 0);
      container.addChild(sprite);

      // Создать статус-лампу (дизайн-макет: небольшой круг в правом верхнем углу)
      const lampW = getSize(entity.kind).w * TILE;
      const statusLamp = new Graphics();
      statusLamp.circle(4, 4, 4);
      statusLamp.fill(STATUS_COLORS.idle);
      statusLamp.position.set(lampW - 12, 6);
      container.addChild(statusLamp);

      // Полоска заряда — только у аккумулятора (E1), рисуется кодом, без отдельного спрайта
      let chargeBar: Graphics | undefined;
      if (entity.kind === 'accumulator') {
        chargeBar = new Graphics();
        container.addChild(chargeBar);
      }

      layer.addChild(container);

      machineSprite = { container, sprite, statusLamp, chargeBar };
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
    machineSprite.statusLamp.circle(4, 4, 4);
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
        // stop() обязателен — иначе AnimatedSprite (после play() в ветке working) продолжает
        // тикать и на следующем кадре сам перезапишет .texture текущим work-кадром.
        machineSprite.sprite.stop();
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

/**
 * Рисует полоску заряда на аккумуляторе (E1): фон + заполнение по charge/capacity.
 * Отдельный спрайт не нужен (docs/02) — просто Graphics поверх idle-текстуры.
 */
function drawChargeBar(bar: Graphics, kind: MachineKind, dir: Dir, charge: number, capacity: number): void {
  const size = getSize(kind);
  const rotatedSize = dir === 1 || dir === 3 ? { w: size.h, h: size.w } : size;
  const barHeight = 6;
  const x = 4;
  const width = rotatedSize.w * TILE - x * 2;
  const y = rotatedSize.h * TILE - barHeight - 4;
  const ratio = capacity > 0 ? Math.max(0, Math.min(1, charge / capacity)) : 0;

  bar.clear();
  bar.rect(x, y, width, barHeight);
  bar.fill(0xe2e5e9);
  if (ratio > 0) {
    bar.rect(x, y, width * ratio, barHeight);
    bar.fill(0xdba852);
  }
}

function updateChargeBars(
  entities: Record<string, Entity>,
  energy: { charge: number; capacity: number } | null
): void {
  for (const [id, machineSprite] of machineSprites.entries()) {
    if (!machineSprite.chargeBar) continue;
    const entity = entities[id];
    if (!entity) continue;

    if (energy) {
      drawChargeBar(machineSprite.chargeBar, entity.kind, entity.dir, energy.charge, energy.capacity);
    } else {
      machineSprite.chargeBar.clear();
    }
  }
}
