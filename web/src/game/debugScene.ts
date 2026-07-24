import { Sprite } from 'pixi.js';
import { TILE } from './app';
import { getTexture } from './assets';
import type { GameLayers } from './app';
import type { MachineKind } from '../core/types';

const MACHINE_KINDS: MachineKind[] = [
  'belt', 'miner', 'assembler', 'splitter', 'mixer', 'silo', 'telegram',
  'furnace', 'chest', 'lab', 'accumulator',
];

// Размеры каждой машины в тайлах
const MACHINE_SIZES: Record<MachineKind, [number, number]> = {
  belt: [1, 1],
  miner: [2, 2],
  assembler: [3, 3],
  splitter: [2, 1],
  mixer: [3, 3],
  silo: [3, 3],
  telegram: [2, 2],
  furnace: [2, 2],
  chest: [1, 1],
  lab: [2, 1],
  accumulator: [2, 2],
  webhook: [2, 2],
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
