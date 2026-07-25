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
  lastStatus?: NodeStatus; // для edge-detection перехода в/из 'working' (см. updateMachineStatus)
  manipulatorFlipped?: boolean; // manipulator: зеркальное (дефолт/idle) vs обычное (между захватом и выкладкой)
}

const machineSprites = new Map<string, MachineSprite>();

// manipulator визуально крупнее своего 1×1 footprint — руке нужен размах, чтобы
// читалось как "дотягивается до соседних тайлов"; вылезание за границы клетки
// тут осознанно допустимо (в отличие от остальных станков).
export const MANIPULATOR_VISUAL_SCALE = 1.4;
// Ракета (silo): арт занимает не весь 3×3-кадр (прозрачные поля по краям) — растягиваем
// спрайт, чтобы заполнил клетку. Масштаб вокруг центрального пивота → остаётся по центру.
export const SILO_VISUAL_SCALE = 1.3;
// Арт ракеты сидит низко в кадре (щель сверху, вылезает снизу) — поднимаем спрайт вверх
// в мировых координатах (px), поэтому корректно при любом повороте станка.
export const SILO_Y_OFFSET = 18;

const STATUS_COLORS: Record<NodeStatus, number> = {
  idle: 0x5a5445,     // тускло-жёлтый (idle, дизайн-макет Factory.exe)
  working: 0xf0a030,  // акцентный оранжевый (working)
  ok: 0x5ecf7a,       // зелёный
  error: 0xe2483f,    // красный
};

export function initMachines(layers: GameLayers): void {
  // Подписка на изменения entities. Сразу отрисовываем уже загруженный persist.ts
  // мир (initPersist() в main.tsx отрабатывает синхронно ДО этого вызова) — subscribe
  // реагирует только на будущие set(), поэтому без явного первого вызова уже случившаяся
  // загрузка из localStorage молча пропускалась: поле оставалось пустым до следующего
  // изменения entities (например, постановки станка), которое отрисовывало сразу всё разом.
  let prevEntities: Record<string, Entity> = useStore.getState().entities;
  updateMachines(prevEntities, layers.machines);
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
    case 'manipulator':
      return { w: 1, h: 1 };
    case 'miner':
    case 'furnace':
    case 'accumulator':
    case 'webhook':
    case 'assembler':
    case 'lab':
    case 'duplicator':
      return { w: 2, h: 2 };
    case 'mixer':
    case 'silo':
      return { w: 3, h: 3 };
    default:
      return { w: 1, h: 1 };
  }
}

// Размер ТЕКСТУРЫ в тайлах (может отличаться от футпринта getSize). У assembler спрайт
// авторен на 3×3 с прозрачным бортиком, а футпринт ужат до 2×2 — текстура центрируется
// на футпринте (пивот по этому размеру, позиция по футпринту), арт заполняет 2×2, поля
// вылезают прозрачными. У lab и duplicator футпринт 2×2, а арт авторен 2×1 (128×64) —
// центрируем нативный кадр и растягиваем РАВНОМЕРНО (LAB_VISUAL_SCALE/SPLITTER_VISUAL_SCALE
// ниже), а не по одной оси: сам девайс в кадре — компактный квадрат ~53×50px с прозрачными
// полями со всех сторон (не растянутый на весь 128×64 канвас), поэтому асимметричная
// растяжка по Y всегда искажает пропорции устройства — либо расплющивает в блин (если
// растянуть «не ту» ось после поворота), либо вытягивает в яйцо (см. историю бага:
// scale.set(1, LAB_VISUAL_SCALE_Y) плюс sprite.angle = dir*90 ниже — PixiJS применяет
// scale в локальных осях ДО поворота, поэтому у lab на dir=1/3 «растяжка по Y» после
// поворота на экране становится растяжкой по X). Равномерный зум не зависит от поворота.
function getSpriteSize(kind: MachineKind): { w: number; h: number } {
  if (kind === 'assembler') return { w: 3, h: 3 };
  // lab и duplicator: арт авторен 2×1 (128×64), футпринт 2×2 — нативный размер под pivot
  if (kind === 'lab' || kind === 'duplicator') return { w: 2, h: 1 };
  return getSize(kind);
}

// lab: девайс в кадре 128×64 — компактный квадрат ~53×50px по центру с прозрачными
// полями по бокам (шире, чем duplicator, но тот же принцип) — равномерный зум,
// без искажения пропорций и без зависимости от поворота.
export const LAB_VISUAL_SCALE = 2;
// duplicator (дублер): в кадре 128×64 сам механизм — компактный квадрат ~64×64 по центру
// с прозрачными полями по бокам. Y-растяжка (как lab) искажала бы квадрат в прямоугольник —
// вместо этого центрируем нативный кадр (getSpriteSize=2×1, пивот по нему) и увеличиваем
// РАВНОМЕРНО, чтобы девайс дорос до клетки 2×2 без искажения (по образцу assembler/silo).
export const DUPLICATOR_VISUAL_SCALE = 2;
// assembler: спрайт авторен на 3×3, футпринт ужат до 2×2 (3624a4c), но масштаб под это
// сжатие никогда не добавили — текстура рисовалась в НАТИВНЫЕ 192×192 и вылезала за
// пределы своей клетки на ~32px на сторону (позиция по футпринту, пивот по текстуре
// без scale). Даунскейл 2/3, чтобы 3×3-арт вписался в 2×2-клетку — тот же принцип,
// что и у silo (там наоборот апскейл под прозрачные поля), просто в другую сторону.
export const ASSEMBLER_VISUAL_SCALE = 2 / 3;

function updateMachines(entities: Record<string, Entity>, layer: Container): void {
  const existingIds = new Set(machineSprites.keys());
  const currentIds = new Set(Object.keys(entities));

  // Удалить спрайты удалённых станков
  for (const id of existingIds) {
    if (!currentIds.has(id)) {
      const machineSprite = machineSprites.get(id);
      if (machineSprite) {
        // destroy, не removeChild — иначе Container+Sprite+Graphics утекают навсегда
        // (та же конвенция, что у belts.ts)
        machineSprite.container.destroy({ children: true });
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
        animated.loop = false; // один проход, не зацикливаем — иначе "переигрывает" пока working держится
        animated.gotoAndStop(0); // стоим на idle-кадре, пока status !== 'working'
        sprite = animated;
      } else if (Array.isArray(idleTextureOrFrames)) {
        const animated = new AnimatedSprite(idleTextureOrFrames);
        animated.animationSpeed = 0.1;
        animated.loop = false;
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
      // manipulator: изначально зеркальное положение — обычное (немирорированное) появляется
      // только между захватом и выкладкой (см. triggerManipulatorGrab/Release)
      if (entity.kind === 'manipulator') {
        machineSprite.manipulatorFlipped = true;
      }
      machineSprites.set(id, machineSprite);
    }

    // Обновить позицию и поворот
    machineSprite.container.position.set(entity.pos.x * TILE, entity.pos.y * TILE);

    const size = getSize(entity.kind); // футпринт (позиция/лампа)
    const spriteSize = getSpriteSize(entity.kind); // размер текстуры в тайлах (пивот)
    const rotatedSize = entity.dir === 1 || entity.dir === 3 ? { w: size.h, h: size.w } : size;

    // Пивот — центр ТЕКСТУРЫ, позиция — центр ФУТПРИНТА: текстура центрируется на футпринте
    // (у assembler 3×3-арт садится по центру 2×2, лишний прозрачный бортик вылезает наружу).
    machineSprite.sprite.pivot.set(spriteSize.w * TILE * 0.5, spriteSize.h * TILE * 0.5);
    machineSprite.sprite.position.set(rotatedSize.w * TILE * 0.5, rotatedSize.h * TILE * 0.5);
    if (entity.kind === 'silo') machineSprite.sprite.position.y -= SILO_Y_OFFSET;
    machineSprite.sprite.angle = entity.dir * 90;
    // manipulator: зеркалим по Y, пока развёрнут на "выкладку" (см. triggerManipulatorGrab/Release) —
    // поворот на 180° ставил руку "вверх ногами", зеркало держит её в исходной ориентации.
    if (entity.kind === 'manipulator') {
      const mirrored = machineSprite.manipulatorFlipped ? -1 : 1;
      machineSprite.sprite.scale.set(MANIPULATOR_VISUAL_SCALE, mirrored * MANIPULATOR_VISUAL_SCALE);
    } else if (entity.kind === 'silo') {
      machineSprite.sprite.scale.set(SILO_VISUAL_SCALE);
    } else if (entity.kind === 'lab') {
      // квадратный девайс по центру кадра — равномерный зум, без искажения
      machineSprite.sprite.scale.set(LAB_VISUAL_SCALE);
    } else if (entity.kind === 'duplicator') {
      // квадратный девайс по центру кадра — равномерный зум, без искажения
      machineSprite.sprite.scale.set(DUPLICATOR_VISUAL_SCALE);
    } else if (entity.kind === 'assembler') {
      // 3×3-арт в 2×2-клетке — равномерный даунскейл, иначе вылезает на соседние тайлы
      machineSprite.sprite.scale.set(ASSEMBLER_VISUAL_SCALE);
    }
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

    // nodeStatus — общий объект на ВСЕ станки; store пересоздаёт его при событии
    // у ЛЮБОГО узла (setStatus всегда делает новый объект), а эта функция вызывается
    // на каждое такое изменение и проходит по ВСЕМ entries — включая те, чей статус
    // не менялся. Без этой проверки чужой packet-consume/working/ok посреди фабрики
    // раз за разом заново дёргал .play()/сброс кадра у уже работающего станка —
    // анимация постоянно перезапускалась с нуля и не успевала доиграть до конца.
    if (machineSprite.lastStatus === status) continue;
    machineSprite.lastStatus = status;

    // manipulator анимируется по своей схеме (захват/поворот/выкладка —
    // triggerManipulatorGrab/Release, вызывается из runtime.ts по packet-consume/spawn),
    // а не по generic idle↔working, иначе оба механизма дрались бы за один AnimatedSprite.
    if (entity.kind === 'manipulator') continue;

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

// Заметно быстрее общего animationSpeed 0.1 (миnер/assembler/silo) — короткий
// резкий жест захвата/выкладки, а не медленная работа станка (GRAB_MS в
// core/nodes/manipulator.ts подогнан под эту же скорость).
const MANIPULATOR_ANIM_SPEED = 0.4;

/**
 * Манипулятор: захват предмета — первые 8 кадров work-анимации (man.gif), затем
 * зеркалим по X (переход от «забора» с BACK к «выкладке» на FRONT — одна и та же
 * рука-анимация переиспользуется на обе фазы; зеркало вместо поворота на 180°,
 * иначе рука встаёт "вверх ногами"). Вызывается из runtime.ts по packet-consume
 * (nodeId есть в событии напрямую).
 */
export function triggerManipulatorGrab(nodeId: string): void {
  const machineSprite = machineSprites.get(nodeId);
  if (!machineSprite || !(machineSprite.sprite instanceof AnimatedSprite)) return;

  const frames = getTexture('manipulator', 'work');
  if (!Array.isArray(frames) || frames.length < 16) return;

  const sprite = machineSprite.sprite;
  sprite.stop();
  sprite.loop = false;
  sprite.animationSpeed = MANIPULATOR_ANIM_SPEED;
  sprite.textures = frames.slice(0, 8);
  sprite.onComplete = () => {
    // Дефолт (idle) — зеркальное положение; после захвата — обычное (см. создание спрайта выше)
    machineSprite.manipulatorFlipped = false;
    sprite.scale.y = Math.abs(sprite.scale.y);
  };
  sprite.gotoAndPlay(0);
}

/**
 * Манипулятор: выкладка предмета — последние 8 кадров, затем возврат в исходный
 * поворот и статичный idle-кадр (готов к следующему циклу). Вызывается из
 * runtime.ts по packet-spawn (у события нет nodeId — совпадение по позиции).
 */
export function triggerManipulatorRelease(nodeId: string): void {
  const machineSprite = machineSprites.get(nodeId);
  if (!machineSprite || !(machineSprite.sprite instanceof AnimatedSprite)) return;

  const frames = getTexture('manipulator', 'work');
  if (!Array.isArray(frames) || frames.length < 16) return;

  const sprite = machineSprite.sprite;
  sprite.stop();
  sprite.loop = false;
  sprite.animationSpeed = MANIPULATOR_ANIM_SPEED;
  sprite.textures = frames.slice(8, 16);
  sprite.onComplete = () => {
    // Возврат к дефолтному зеркальному положению — готов к следующему циклу
    machineSprite.manipulatorFlipped = true;
    sprite.scale.y = -Math.abs(sprite.scale.y);
    const idle = getTexture('manipulator', 'idle');
    if (!Array.isArray(idle)) {
      sprite.texture = idle;
    }
  };
  sprite.gotoAndPlay(0);
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
