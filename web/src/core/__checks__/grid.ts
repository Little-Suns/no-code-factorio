import { rotOffset, footprintTiles, outPorts, inTiles } from '../grid';
import { Entity } from '../types';

// Простая функция assert
function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(`Assert failed: ${msg}`);
  }
}

// rotOffset для всех 4 направлений
console.log('Testing rotOffset...');

// dir=0: (dx,dy)
let offset = rotOffset(0, 0, 2, 1, 0);
assert(offset.x === 0 && offset.y === 0, 'rotOffset dir=0: (0,0) → (0,0)');

offset = rotOffset(1, 0, 2, 1, 0);
assert(offset.x === 1 && offset.y === 0, 'rotOffset dir=0: (1,0) → (1,0)');

// dir=1: (h-1-dy, dx)
offset = rotOffset(0, 0, 2, 1, 1);
assert(offset.x === 1 - 1 - 0 && offset.y === 0, 'rotOffset dir=1: (0,0) → (0,0)');

offset = rotOffset(1, 0, 2, 1, 1);
assert(offset.x === 1 - 1 - 0 && offset.y === 1, 'rotOffset dir=1: (1,0) → (0,1)');

// dir=2: (w-1-dx, h-1-dy)
offset = rotOffset(0, 0, 2, 1, 2);
assert(offset.x === 2 - 1 - 0 && offset.y === 1 - 1 - 0, 'rotOffset dir=2: (0,0) → (1,0)');

offset = rotOffset(1, 0, 2, 1, 2);
assert(offset.x === 2 - 1 - 1 && offset.y === 1 - 1 - 0, 'rotOffset dir=2: (1,0) → (0,0)');

// dir=3: (dy, w-1-dx)
offset = rotOffset(0, 0, 2, 1, 3);
assert(offset.x === 0 && offset.y === 2 - 1 - 0, 'rotOffset dir=3: (0,0) → (0,1)');

offset = rotOffset(1, 0, 2, 1, 3);
assert(offset.x === 0 && offset.y === 2 - 1 - 1, 'rotOffset dir=3: (1,0) → (0,0)');

console.log('✓ rotOffset OK');

// footprint сплиттера при dir=1 занимает 1×2
console.log('Testing footprint for splitter dir=1...');
const splitterDir1: Entity = {
  id: 'splitter1',
  kind: 'splitter',
  pos: { x: 0, y: 0 },
  dir: 1,
  config: {},
};
const tiles = footprintTiles(splitterDir1);
assert(tiles.length === 2, `footprint splitter dir=1 should have 2 tiles, got ${tiles.length}`);
// Должны быть (0,0) и (0,1)
const tileSet = new Set(tiles.map((t) => `${t.x},${t.y}`));
assert(tileSet.has('0,0'), 'splitter dir=1 should contain tile (0,0)');
assert(tileSet.has('0,1'), 'splitter dir=1 should contain tile (0,1)');

// Проверим ширину и высоту на примере pos
const minX = Math.min(...tiles.map((t) => t.x));
const maxX = Math.max(...tiles.map((t) => t.x));
const minY = Math.min(...tiles.map((t) => t.y));
const maxY = Math.max(...tiles.map((t) => t.y));
const width = maxX - minX + 1;
const height = maxY - minY + 1;
assert(width === 1, `splitter dir=1 width should be 1, got ${width}`);
assert(height === 2, `splitter dir=1 height should be 2, got ${height}`);

console.log('✓ footprint splitter dir=1 OK');

// порты splitter при dir=0 дают 'true' слева и 'false' справа
console.log('Testing outPorts for splitter dir=0...');
const splitterDir0: Entity = {
  id: 'splitter0',
  kind: 'splitter',
  pos: { x: 0, y: 0 },
  dir: 0,
  config: {},
};
const ports = outPorts(splitterDir0);
assert(ports.length === 2, `splitter dir=0 should have 2 output ports, got ${ports.length}`);

const truePort = ports.find((p) => p.branch === 'true');
const falsePort = ports.find((p) => p.branch === 'false');

assert(truePort !== undefined, 'splitter dir=0 should have true port');
assert(falsePort !== undefined, 'splitter dir=0 should have false port');

// Левый = true (x=0), правый = false (x=1)
// При pos=(0,0), y=-1 для FRONT
assert(
  truePort!.tile.x === 0 && truePort!.tile.y === -1,
  `true port should be at (0,-1), got (${truePort!.tile.x},${truePort!.tile.y})`
);
assert(
  falsePort!.tile.x === 1 && falsePort!.tile.y === -1,
  `false port should be at (1,-1), got (${falsePort!.tile.x},${falsePort!.tile.y})`
);

console.log('✓ outPorts splitter dir=0 OK');

// mixer имеет входы с трёх сторон (BACK, LEFT, RIGHT)
console.log('Testing inTiles for mixer...');
// Ненулевой pos — inTiles обязан вернуть МИРОВЫЕ координаты (ловля бага локальных координат)
const mixer: Entity = {
  id: 'mixer1',
  kind: 'mixer',
  pos: { x: 10, y: 20 },
  dir: 0,
  config: {},
};
const mixerInTiles = inTiles(mixer);
assert(mixerInTiles.size > 0, 'mixer should have input tiles');

// При dir=0, mixer 3×3 на pos (10,20):
// BACK (низ): (10,22), (11,22), (12,22)
// LEFT: (10,20), (10,21), (10,22)
// RIGHT: (12,20), (12,21), (12,22)
const expectedTiles = ['10,20', '10,21', '10,22', '11,22', '12,20', '12,21', '12,22'];
for (const tile of expectedTiles) {
  assert(mixerInTiles.has(tile), `mixer should have input at ${tile}`);
}
assert(!mixerInTiles.has('11,21'), 'mixer center is not an input');
assert(!mixerInTiles.has('11,20'), 'mixer front-middle is not an input');

// belt: inTiles тоже в мировых координатах
const beltFar: Entity = { id: 'b2', kind: 'belt', pos: { x: -3, y: 7 }, dir: 1, config: {} };
assert(inTiles(beltFar).has('-3,7'), 'belt inTiles must be world coords');

console.log('✓ inTiles mixer OK');

// Дополнительная проверка: footprint не выходит за границы
console.log('Testing footprint boundaries...');
const belt: Entity = {
  id: 'belt1',
  kind: 'belt',
  pos: { x: 5, y: 10 },
  dir: 0,
  config: {},
};
const beltTiles = footprintTiles(belt);
assert(beltTiles.length === 1, 'belt should have 1 tile');
assert(beltTiles[0].x === 5 && beltTiles[0].y === 10, 'belt at (5,10) should occupy (5,10)');

console.log('✓ footprint boundaries OK');

// manipulator: 1×1, единственный вход (BACK) + единственный выход (FRONT), меняется с dir
console.log('Testing manipulator ports (1×1)...');
const manipDir0: Entity = { id: 'man0', kind: 'manipulator', pos: { x: 10, y: 10 }, dir: 0, config: {} };
assert(footprintTiles(manipDir0).length === 1, 'manipulator footprint должен быть 1 тайл');

const manipOutDir0 = outPorts(manipDir0);
assert(manipOutDir0.length === 1, `manipulator dir=0 должен иметь 1 выход, получили ${manipOutDir0.length}`);
assert(
  manipOutDir0[0].tile.x === 10 && manipOutDir0[0].tile.y === 9,
  `manipulator dir=0 выход должен быть на (10,9), получили (${manipOutDir0[0].tile.x},${manipOutDir0[0].tile.y})`
);
assert(inTiles(manipDir0).has('10,10'), 'manipulator dir=0 должен принимать вход на своём тайле');

// dir=1 (восток) — выход должен повернуться на восток от той же позиции
const manipDir1: Entity = { id: 'man1', kind: 'manipulator', pos: { x: 10, y: 10 }, dir: 1, config: {} };
const manipOutDir1 = outPorts(manipDir1);
assert(manipOutDir1.length === 1, `manipulator dir=1 должен иметь 1 выход, получили ${manipOutDir1.length}`);
assert(
  manipOutDir1[0].tile.x === 11 && manipOutDir1[0].tile.y === 10,
  `manipulator dir=1 выход должен быть на (11,10), получили (${manipOutDir1[0].tile.x},${manipOutDir1[0].tile.y})`
);

console.log('✓ manipulator ports OK');

console.log('grid checks OK');
