import { Vec, Dir, Entity, MachineKind, Branch } from './types';

// Получить размер станка при dir=0
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
    case 'splitter':
      return { w: 2, h: 2 };
    case 'mixer':
    case 'silo':
      return { w: 3, h: 3 };
    default:
      const _: never = kind;
      throw new Error(`Unknown kind: ${_}`);
  }
}

// Получить размер станка с учётом направления
function getSizeAtDir(kind: MachineKind, dir: Dir): { w: number; h: number } {
  const size = getSize(kind);
  // При dir=1 или 3, ширина и высота меняются местами
  if (dir === 1 || dir === 3) {
    return { w: size.h, h: size.w };
  }
  return size;
}

// Поворот смещения внутри footprint
export function rotOffset(dx: number, dy: number, w: number, h: number, dir: Dir): Vec {
  switch (dir) {
    case 0:
      return { x: dx, y: dy };
    case 1:
      return { x: h - 1 - dy, y: dx };
    case 2:
      return { x: w - 1 - dx, y: h - 1 - dy };
    case 3:
      return { x: dy, y: w - 1 - dx };
  }
}

// Получить все тайлы footprint
export function footprintTiles(entity: Entity): Vec[] {
  const size = getSizeAtDir(entity.kind, entity.dir);
  const tiles: Vec[] = [];
  for (let dy = 0; dy < size.h; dy++) {
    for (let dx = 0; dx < size.w; dx++) {
      tiles.push({ x: entity.pos.x + dx, y: entity.pos.y + dy });
    }
  }
  return tiles;
}

// Получить выходные порты (тайлы снаружи footprint)
export function outPorts(entity: Entity): { tile: Vec; branch: Branch }[] {
  const baseSize = getSize(entity.kind);
  const size = getSizeAtDir(entity.kind, entity.dir);
  const ports: { tile: Vec; branch: Branch }[] = [];

  switch (entity.kind) {
    case 'belt':
      // FRONT (выход)
      for (let dx = 0; dx < baseSize.w; dx++) {
        const offset = rotOffset(dx, -1, baseSize.w, baseSize.h, entity.dir);
        ports.push({
          tile: { x: entity.pos.x + offset.x, y: entity.pos.y + offset.y },
          branch: 'out',
        });
      }
      break;

    case 'miner':
      // FRONT оба тайла (out)
      for (let dx = 0; dx < baseSize.w; dx++) {
        const offset = rotOffset(dx, -1, baseSize.w, baseSize.h, entity.dir);
        ports.push({
          tile: { x: entity.pos.x + offset.x, y: entity.pos.y + offset.y },
          branch: 'out',
        });
      }
      break;

    case 'furnace':
      // FRONT (out)
      for (let dx = 0; dx < baseSize.w; dx++) {
        const offset = rotOffset(dx, -1, baseSize.w, baseSize.h, entity.dir);
        ports.push({
          tile: { x: entity.pos.x + offset.x, y: entity.pos.y + offset.y },
          branch: 'out',
        });
      }
      break;

    case 'assembler':
      // FRONT (out)
      for (let dx = 0; dx < baseSize.w; dx++) {
        const offset = rotOffset(dx, -1, baseSize.w, baseSize.h, entity.dir);
        ports.push({
          tile: { x: entity.pos.x + offset.x, y: entity.pos.y + offset.y },
          branch: 'out',
        });
      }
      break;

    case 'splitter': {
      // Дублер: оба FRONT-тайла — выходы branch 'out'. Движок спавнит клон пакета
      // на каждый 'out'-edge → одна копия на каждый выход.
      const leftOffset = rotOffset(0, -1, baseSize.w, baseSize.h, entity.dir);
      ports.push({
        tile: { x: entity.pos.x + leftOffset.x, y: entity.pos.y + leftOffset.y },
        branch: 'out',
      });
      const rightOffset = rotOffset(1, -1, baseSize.w, baseSize.h, entity.dir);
      ports.push({
        tile: { x: entity.pos.x + rightOffset.x, y: entity.pos.y + rightOffset.y },
        branch: 'out',
      });
      break;
    }

    case 'mixer':
      // FRONT центральный тайл (out)
      // Для 3x3: центр — (1, 1)
      const centerOffset = rotOffset(1, -1, baseSize.w, baseSize.h, entity.dir);
      ports.push({
        tile: { x: entity.pos.x + centerOffset.x, y: entity.pos.y + centerOffset.y },
        branch: 'out',
      });
      break;

    case 'lab':
      // FRONT левого (dx=0) = pass, FRONT правого (dx=1) = rework
      const labLeftOffset = rotOffset(0, -1, baseSize.w, baseSize.h, entity.dir);
      ports.push({
        tile: { x: entity.pos.x + labLeftOffset.x, y: entity.pos.y + labLeftOffset.y },
        branch: 'pass',
      });
      const labRightOffset = rotOffset(1, -1, baseSize.w, baseSize.h, entity.dir);
      ports.push({
        tile: { x: entity.pos.x + labRightOffset.x, y: entity.pos.y + labRightOffset.y },
        branch: 'rework',
      });
      break;

    case 'chest':
      // FRONT (out)
      const chestOffset = rotOffset(0, -1, baseSize.w, baseSize.h, entity.dir);
      ports.push({
        tile: { x: entity.pos.x + chestOffset.x, y: entity.pos.y + chestOffset.y },
        branch: 'out',
      });
      break;

    case 'manipulator':
      // FRONT (единственный выход, 1×1) — передаёт предмет со входа (BACK) без изменений
      const manipulatorOffset = rotOffset(0, -1, baseSize.w, baseSize.h, entity.dir);
      ports.push({
        tile: { x: entity.pos.x + manipulatorOffset.x, y: entity.pos.y + manipulatorOffset.y },
        branch: 'out',
      });
      break;

    // silo, webhook, accumulator — нет выходов
  }

  return ports;
}

// Получить входящие тайлы footprint
//
// Правило одно для всех станков (кроме belt/miner/accumulator, у которых нет
// «сторон» в этом смысле): BACK + LEFT + RIGHT — вся сторона footprint'а,
// противоположная FRONT, и оба боковых ребра. FRONT остаётся строго выходным —
// это единственная граница, намеренно исключённая (иначе выход перестал бы что-то
// значить). Раньше это правило (было только у mixer/chest) распространяем на
// остальные станки: манипулятор/лента, подходящие сбоку, а не строго «в спину»,
// тоже должны считаться валидным входом (см. docs/03 — иначе горизонтальная
// цепочка из туториала не собирается без ручного поворота станка-приёмника).
// При w=h=2 (furnace/assembler/splitter/lab) BACK+LEFT+RIGHT математически
// покрывают весь footprint целиком, включая тайлы под FRONT-портами — это
// тот же эффект, что уже был у mixer (её передние углы тоже во входах, см.
// __checks__/grid.ts), не новая экзотика, а обобщение старого паттерна.
export function inTiles(entity: Entity): Set<string> {
  const baseSize = getSize(entity.kind);
  const tiles = new Set<string>();

  if (entity.kind === 'belt') {
    // Любая сторона принимает весь footprint — любой тайл может быть входом.
    for (const t of footprintTiles(entity)) {
      tiles.add(`${t.x},${t.y}`);
    }
    return tiles;
  }

  if (entity.kind === 'miner' || entity.kind === 'accumulator') {
    // Нет входов
    return tiles;
  }

  // BACK (нижний ряд) + LEFT (левый столбец) + RIGHT (правый столбец) локальных
  // координат. При 1×1 (chest, manipulator) все три схлопываются в один и тот же
  // тайл — вход номинально «с любого соседа», как и раньше.
  const localTiles: [number, number][] = [];
  for (let x = 0; x < baseSize.w; x++) {
    localTiles.push([x, baseSize.h - 1]); // back
  }
  for (let y = 0; y < baseSize.h; y++) {
    localTiles.push([0, y]); // left
    localTiles.push([baseSize.w - 1, y]); // right
  }

  for (const [dx, dy] of localTiles) {
    const rotated = rotOffset(dx, dy, baseSize.w, baseSize.h, entity.dir);
    tiles.add(`${entity.pos.x + rotated.x},${entity.pos.y + rotated.y}`);
  }

  return tiles;
}

// Построить таблицу занятости
export function buildOccupancy(entities: Record<string, Entity>): Map<string, string> {
  const occupancy = new Map<string, string>();
  for (const [, entity] of Object.entries(entities)) {
    for (const tile of footprintTiles(entity)) {
      occupancy.set(`${tile.x},${tile.y}`, entity.id);
    }
  }
  return occupancy;
}

// Проверить возможность размещения
export function canPlace(entities: Record<string, Entity>, entity: Entity): boolean {
  const occupancy = buildOccupancy(entities);
  for (const tile of footprintTiles(entity)) {
    if (occupancy.has(`${tile.x},${tile.y}`)) {
      return false;
    }
  }
  return true;
}

/**
 * Групповой поворот на 90° по часовой вокруг ОБЩЕГО центра группы (bounding box
 * занятых тайлов), а не каждой сущности вокруг своей — иначе взаимное расположение
 * станков после поворота «разваливается» (не совпадает с тем, что игрок видит на
 * экране). Используется и для уже поставленной группы (store.rotateMany), и для
 * чертежа на кисти перед постановкой (game/input.ts) — geometрия одна и та же.
 *
 * Все MachineKind квадратные (w===h при dir=0, см. getSize выше) — поворот на 90°
 * не меняет размер footprint'а, поэтому достаточно повернуть центр каждой сущности
 * вокруг общего пивота ((dx,dy) → (-dy,dx), та же ориентация, что задаёт DELTA) и
 * пересчитать top-left из нового центра. Одиночная сущность в группе — частный
 * случай: её центр совпадает с пивотом, смещения нет — то же поведение, что у
 * одиночного поворота одной сущности.
 */
export function rotateGroupRigid(group: Entity[], steps: number): Entity[] {
  const n = ((steps % 4) + 4) % 4;
  let current = group;
  for (let i = 0; i < n; i++) {
    current = rotateGroupOnce(current);
  }
  return current.map((e) => ({ ...e }));
}

function rotateGroupOnce(group: Entity[]): Entity[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const entity of group) {
    for (const tile of footprintTiles(entity)) {
      minX = Math.min(minX, tile.x);
      minY = Math.min(minY, tile.y);
      maxX = Math.max(maxX, tile.x + 1);
      maxY = Math.max(maxY, tile.y + 1);
    }
  }
  const pivotX = (minX + maxX) / 2;
  const pivotY = (minY + maxY) / 2;

  return group.map((entity) => {
    const tiles = footprintTiles(entity);
    const size = Math.max(...tiles.map((t) => t.x)) - Math.min(...tiles.map((t) => t.x)) + 1;
    const half = size / 2;
    const centerX = entity.pos.x + half;
    const centerY = entity.pos.y + half;
    const dx = centerX - pivotX;
    const dy = centerY - pivotY;
    const newCenterX = pivotX - dy;
    const newCenterY = pivotY + dx;
    return {
      ...entity,
      dir: ((entity.dir + 1) % 4) as Dir,
      pos: { x: Math.round(newCenterX - half), y: Math.round(newCenterY - half) },
    };
  });
}
