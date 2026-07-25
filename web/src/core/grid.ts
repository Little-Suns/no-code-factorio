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
export function inTiles(entity: Entity): Set<string> {
  const baseSize = getSize(entity.kind);
  const tiles = new Set<string>();

  // Для каждого направления, определяем какие локальные координаты принимают вход
  // Потом разворачиваем их согласно entity.dir

  let inputDirs: { side: 'front' | 'back' | 'left' | 'right'; localTiles: [number, number][] }[] = [];

  switch (entity.kind) {
    case 'belt':
      // Любая сторона принимает весь footprint
      // Смысл в том, что любой тайл может быть входом
      for (const t of footprintTiles(entity)) {
        tiles.add(`${t.x},${t.y}`);
      }
      return tiles;

    case 'miner':
    case 'accumulator':
      // Нет входов
      return tiles;

    case 'furnace':
      // BACK входы
      inputDirs = [
        { side: 'back', localTiles: [[0, baseSize.h - 1], [1, baseSize.h - 1]] },
      ];
      break;

    case 'assembler':
      // BACK входы (весь нижний ряд, 2×2)
      inputDirs = [
        {
          side: 'back',
          localTiles: [[0, baseSize.h - 1], [1, baseSize.h - 1]],
        },
      ];
      break;

    case 'splitter':
      // BACK оба тайла
      inputDirs = [{ side: 'back', localTiles: [[0, baseSize.h - 1], [1, baseSize.h - 1]] }];
      break;

    case 'mixer':
      // BACK + LEFT + RIGHT (все тайлы этих сторон)
      const mixerBack: [number, number][] = [];
      const mixerLeft: [number, number][] = [];
      const mixerRight: [number, number][] = [];
      for (let x = 0; x < baseSize.w; x++) {
        mixerBack.push([x, baseSize.h - 1]);
      }
      for (let y = 0; y < baseSize.h; y++) {
        mixerLeft.push([0, y]);
        mixerRight.push([baseSize.w - 1, y]);
      }
      inputDirs = [
        { side: 'back', localTiles: mixerBack },
        { side: 'left', localTiles: mixerLeft },
        { side: 'right', localTiles: mixerRight },
      ];
      break;

    case 'chest':
      // BACK + LEFT + RIGHT
      inputDirs = [
        { side: 'back', localTiles: [[0, baseSize.h - 1]] },
        { side: 'left', localTiles: [[0, 0]] },
        { side: 'right', localTiles: [[baseSize.w - 1, 0]] },
      ];
      break;

    case 'lab':
      // BACK оба тайла
      inputDirs = [{ side: 'back', localTiles: [[0, baseSize.h - 1], [1, baseSize.h - 1]] }];
      break;

    case 'silo':
      // BACK все тайлы
      const siloBack: [number, number][] = [];
      for (let x = 0; x < baseSize.w; x++) {
        siloBack.push([x, baseSize.h - 1]);
      }
      inputDirs = [{ side: 'back', localTiles: siloBack }];
      break;

    case 'webhook':
      // BACK оба тайла
      inputDirs = [{ side: 'back', localTiles: [[0, baseSize.h - 1], [1, baseSize.h - 1]] }];
      break;

    case 'manipulator':
      // BACK (1×1, как chest — при единственном тайле footprint сторона номинальна:
      // вход физически принимается с любого соседнего тайла, наружу отдаёт только FRONT)
      inputDirs = [{ side: 'back', localTiles: [[0, 0]] }];
      break;
  }

  // Локальные координаты → поворот → мировые (смещение от pos)
  for (const { localTiles } of inputDirs) {
    for (const [dx, dy] of localTiles) {
      const rotated = rotOffset(dx, dy, baseSize.w, baseSize.h, entity.dir);
      tiles.add(`${entity.pos.x + rotated.x},${entity.pos.y + rotated.y}`);
    }
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
