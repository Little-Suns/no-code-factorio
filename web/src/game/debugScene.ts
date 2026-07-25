import { Sprite } from 'pixi.js';
import { TILE } from './app';
import { getTexture } from './assets';
import type { GameLayers } from './app';
import type { MachineKind } from '../core/types';

const MACHINE_KINDS: MachineKind[] = [
  'belt', 'miner', 'assembler', 'duplicator', 'mixer', 'silo',
  'furnace', 'chest', 'lab', 'accumulator', 'webhook', 'manipulator',
];

// Размеры ТЕКСТУРЫ (в тайлах, для раскладки витрины) — НЕ футпринт/логический размер
// станка (тот — единственный источник правды в core/grid.ts). Уже расходится с реальным
// футпринтом у assembler ([3,3] тут vs {w:2,h:2} в grid.ts) — эта таблица только про то,
// как разложить idle-спрайты по сетке дебаг-витрины. Файл нигде не импортируется (мёртвый
// код A2, дебаг-витрина убрана из основного рендера в A3) — если понадобится реанимировать,
// сверься с core/grid.ts/core/nodes/index.ts, а не правь по аналогии эту таблицу.
const MACHINE_SIZES: Record<MachineKind, [number, number]> = {
  belt: [1, 1],
  miner: [2, 2],
  assembler: [3, 3],
  duplicator: [2, 1],
  mixer: [3, 3],
  silo: [3, 3],
  furnace: [2, 2],
  chest: [1, 1],
  lab: [2, 1],
  accumulator: [2, 2],
  webhook: [2, 2],
  manipulator: [1, 1],
};

export function mountDebugScene(layers: GameLayers): void {
  // Выкладываем спрайты сеткой (4 в ряд)
  const perRow = 4;
  let row = 0;
  let col = 0;

  for (const kind of MACHINE_KINDS) {
    const [width, height] = MACHINE_SIZES[kind];

    // Используем idle текстуру
    const textureOrFrames = getTexture(kind, 'idle');
    const texture = Array.isArray(textureOrFrames) ? textureOrFrames[0] : textureOrFrames;
    const sprite = new Sprite(texture);

    // Позиционируем по сетке с отступом между машинами
    const x = col * 5 * TILE;
    const y = row * 5 * TILE;
    sprite.position.set(x, y);

    layers.machines.addChild(sprite);

    // Перейти к следующей позиции
    col++;
    if (col >= perRow) {
      col = 0;
      row++;
    }
  }
}
