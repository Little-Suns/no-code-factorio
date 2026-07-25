import { rotOffset, footprintTiles, outPorts, inTiles, canPlace } from '../grid';
import { Entity, Vec } from '../types';

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

// footprint дублера — 2×2 (инвариант к dir)
console.log('Testing footprint for duplicator dir=1...');
const duplicatorDir1: Entity = {
  id: 'duplicator1',
  kind: 'duplicator',
  pos: { x: 0, y: 0 },
  dir: 1,
  config: {},
};
const tiles = footprintTiles(duplicatorDir1);
assert(tiles.length === 4, `footprint duplicator (2×2) should have 4 tiles, got ${tiles.length}`);
const tileSet = new Set(tiles.map((t) => `${t.x},${t.y}`));
for (const t of ['0,0', '1,0', '0,1', '1,1']) {
  assert(tileSet.has(t), `duplicator 2×2 should contain tile (${t})`);
}

console.log('✓ footprint duplicator dir=1 OK');

// порты дублера при dir=0 — оба FRONT-тайла с branch 'out'
console.log('Testing outPorts for duplicator dir=0...');
const duplicatorDir0: Entity = {
  id: 'duplicator0',
  kind: 'duplicator',
  pos: { x: 0, y: 0 },
  dir: 0,
  config: {},
};
const ports = outPorts(duplicatorDir0);
assert(ports.length === 2, `duplicator dir=0 should have 2 output ports, got ${ports.length}`);
assert(ports.every((p) => p.branch === 'out'), 'дублер: оба порта должны быть branch out');
const portTiles = new Set(ports.map((p) => `${p.tile.x},${p.tile.y}`));
assert(portTiles.has('0,-1') && portTiles.has('1,-1'),
  `дублер dir=0: порты должны быть на (0,-1) и (1,-1), got ${[...portTiles].join(' ')}`);

console.log('✓ outPorts duplicator dir=0 OK');

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

// lab: футпринт 2×2 (докс/03 — раньше был 2×1 и на dir=1/3 занимал 1×2, что визуально
// выглядело как "растянутая крив" лаборатория; должен быть квадрат, инвариантный к dir).
console.log('Testing lab footprint is 2×2 and invariant under rotation...');
for (const dir of [0, 1, 2, 3] as const) {
  const lab: Entity = { id: `lab-dir${dir}`, kind: 'lab', pos: { x: 0, y: 0 }, dir, config: {} };
  const tiles = footprintTiles(lab);
  assert(tiles.length === 4, `lab dir=${dir} footprint should have 4 tiles, got ${tiles.length}`);
  const minX = Math.min(...tiles.map((t) => t.x));
  const maxX = Math.max(...tiles.map((t) => t.x));
  const minY = Math.min(...tiles.map((t) => t.y));
  const maxY = Math.max(...tiles.map((t) => t.y));
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  assert(width === 2, `lab dir=${dir} width should be 2, got ${width}`);
  assert(height === 2, `lab dir=${dir} height should be 2, got ${height}`);
}
console.log('✓ lab footprint 2×2 OK');

// lab: занимает все 4 тайла (коллизия) — соседний станок не может встать поверх ни одного из них.
console.log('Testing lab occupies all 4 tiles (collision)...');
{
  const lab: Entity = { id: 'lab-collision', kind: 'lab', pos: { x: 5, y: 5 }, dir: 0, config: {} };
  const world: Record<string, Entity> = { 'lab-collision': lab };
  const overlaps: Vec[] = [
    { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 },
  ];
  for (const pos of overlaps) {
    const other: Entity = { id: 'other', kind: 'belt', pos, dir: 0, config: {} };
    assert(!canPlace(world, other), `belt at (${pos.x},${pos.y}) should collide with lab 2×2`);
  }
  const free: Entity = { id: 'other-free', kind: 'belt', pos: { x: 7, y: 5 }, dir: 0, config: {} };
  assert(canPlace(world, free), 'belt at (7,5) должен быть свободен рядом с lab 2×2');
}
console.log('✓ lab collision OK');

// lab: порты pass/rework на FRONT остаются на прежних местах (левый/правый верхний тайл
// над футпринтом) — расширение вниз (BACK) не должно сдвигать выходы.
console.log('Testing lab pass/rework ports on 2×2 footprint...');
{
  const lab: Entity = { id: 'lab-ports', kind: 'lab', pos: { x: 0, y: 0 }, dir: 0, config: {} };
  const ports = outPorts(lab);
  assert(ports.length === 2, `lab should have 2 output ports, got ${ports.length}`);
  const passPort = ports.find((p) => p.branch === 'pass');
  const reworkPort = ports.find((p) => p.branch === 'rework');
  assert(passPort !== undefined, 'lab should have pass port');
  assert(reworkPort !== undefined, 'lab should have rework port');
  assert(
    passPort!.tile.x === 0 && passPort!.tile.y === -1,
    `pass port should be at (0,-1), got (${passPort!.tile.x},${passPort!.tile.y})`
  );
  assert(
    reworkPort!.tile.x === 1 && reworkPort!.tile.y === -1,
    `rework port should be at (1,-1), got (${reworkPort!.tile.x},${reworkPort!.tile.y})`
  );

  // BACK принимает вход на обоих нижних тайлах футпринта (y=1, а не y=0 как было при h=1)
  const labInTiles = inTiles(lab);
  assert(labInTiles.has('0,1'), 'lab BACK input should include (0,1)');
  assert(labInTiles.has('1,1'), 'lab BACK input should include (1,1)');
  assert(!labInTiles.has('0,0'), 'lab top row (0,0) is not a BACK input tile');
}
console.log('✓ lab pass/rework ports OK');

console.log('grid checks OK');
