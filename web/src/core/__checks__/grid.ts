import { rotOffset, footprintTiles, outPorts, inTiles, canPlace, rotateGroupRigid } from '../grid';
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
console.log('Testing footprint for splitter dir=1...');
const splitterDir1: Entity = {
  id: 'splitter1',
  kind: 'splitter',
  pos: { x: 0, y: 0 },
  dir: 1,
  config: {},
};
const tiles = footprintTiles(splitterDir1);
assert(tiles.length === 4, `footprint splitter (2×2) should have 4 tiles, got ${tiles.length}`);
const tileSet = new Set(tiles.map((t) => `${t.x},${t.y}`));
for (const t of ['0,0', '1,0', '0,1', '1,1']) {
  assert(tileSet.has(t), `splitter 2×2 should contain tile (${t})`);
}

console.log('✓ footprint splitter dir=1 OK');

// порты дублера при dir=0 — оба FRONT-тайла с branch 'out'
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
assert(ports.every((p) => p.branch === 'out'), 'дублер: оба порта должны быть branch out');
const portTiles = new Set(ports.map((p) => `${p.tile.x},${p.tile.y}`));
assert(portTiles.has('0,-1') && portTiles.has('1,-1'),
  `дублер dir=0: порты должны быть на (0,-1) и (1,-1), got ${[...portTiles].join(' ')}`);

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

  // BACK принимает вход на обоих нижних тайлах футпринта (y=1, а не y=0 как было при h=1).
  // При 2×2 BACK+LEFT+RIGHT покрывают весь footprint (см. inTiles) — top row тоже входит,
  // это тот же эффект, что уже был у mixer (её передние углы — тоже входы).
  const labInTiles = inTiles(lab);
  assert(labInTiles.has('0,1'), 'lab BACK input should include (0,1)');
  assert(labInTiles.has('1,1'), 'lab BACK input should include (1,1)');
  assert(labInTiles.has('0,0'), 'lab LEFT column input should include (0,0) — 2×2 side coverage');
  assert(labInTiles.has('1,0'), 'lab RIGHT column input should include (1,0) — 2×2 side coverage');
}
console.log('✓ lab pass/rework ports OK');

// inTiles обобщён на BACK+LEFT+RIGHT для всех станков (кроме belt/miner/accumulator) —
// furnace/assembler/splitter/silo/webhook раньше принимали вход только с BACK,
// манипулятор сбоку (не строго «в спину») не образовывал бы Edge (см. docs/03,
// баг из туториала: горизонтальная цепочка с дефолтным dir=0 у станка-приёмника).
console.log('Testing inTiles accepts LEFT/RIGHT for furnace/assembler (not just BACK)...');
{
  const furnace: Entity = { id: 'furnace-side', kind: 'furnace', pos: { x: 0, y: 0 }, dir: 0, config: {} };
  const furnaceTiles = inTiles(furnace);
  // 2×2 dir=0: LEFT столбец x=0 → (0,0),(0,1); RIGHT столбец x=1 → (1,0),(1,1)
  assert(furnaceTiles.has('0,0'), 'furnace LEFT column should accept input at (0,0)');
  assert(furnaceTiles.has('1,0'), 'furnace RIGHT column should accept input at (1,0)');

  const assembler: Entity = { id: 'asm-side', kind: 'assembler', pos: { x: 0, y: 0 }, dir: 0, config: {} };
  const asmTiles = inTiles(assembler);
  assert(asmTiles.has('0,0') && asmTiles.has('1,0'), 'assembler side columns should accept input');

  // mixer (3×3): поведение не изменилось — центр и front-middle по-прежнему не входы
  const mixerCheck: Entity = { id: 'mixer-side', kind: 'mixer', pos: { x: 0, y: 0 }, dir: 0, config: {} };
  const mixerTiles = inTiles(mixerCheck);
  assert(!mixerTiles.has('1,1'), 'mixer center must remain non-input after generalization');
  assert(!mixerTiles.has('1,0'), 'mixer front-middle must remain non-input after generalization');
}
console.log('✓ inTiles side generalization OK');

// Групповой поворот — единое твёрдое тело вокруг общего центра, не каждая сущность
// вокруг своей оси на месте.
console.log('Testing rotateGroupRigid...');
{
  // Одиночная сущность в группе — частный случай: центр совпадает с пивотом,
  // позиция не меняется, только dir+1 (то же поведение, что у одиночного rotate()).
  const solo: Entity = { id: 'solo', kind: 'belt', pos: { x: 5, y: 5 }, dir: 0, config: {} };
  const [soloRotated] = rotateGroupRigid([solo], 1);
  assert(soloRotated.pos.x === 5 && soloRotated.pos.y === 5, 'single-entity group: position must not change');
  assert(soloRotated.dir === 1, 'single-entity group: dir must still advance by 1');

  // Два станка в ряд (A слева, B справа) — после поворота на 90° по часовой A должен
  // оказаться сверху, B снизу (право → низ при повороте по часовой), не остаться на
  // месте со сменённым dir каждый по отдельности.
  const a: Entity = { id: 'a', kind: 'belt', pos: { x: 0, y: 0 }, dir: 0, config: {} };
  const b: Entity = { id: 'b', kind: 'belt', pos: { x: 2, y: 0 }, dir: 0, config: {} };
  const [aRotated, bRotated] = rotateGroupRigid([a, b], 1);
  assert(aRotated.dir === 1 && bRotated.dir === 1, 'group members should all advance dir by 1');
  assert(
    aRotated.pos.x === 1 && aRotated.pos.y === -1,
    `left member should move to top (1,-1), got (${aRotated.pos.x},${aRotated.pos.y})`
  );
  assert(
    bRotated.pos.x === 1 && bRotated.pos.y === 1,
    `right member should move to bottom (1,1), got (${bRotated.pos.x},${bRotated.pos.y})`
  );

  // 4 шага (360°) — группа должна вернуться ровно в исходное состояние.
  const fullTurn = rotateGroupRigid([a, b], 4);
  assert(
    fullTurn[0].pos.x === a.pos.x && fullTurn[0].pos.y === a.pos.y && fullTurn[0].dir === a.dir,
    'full 360° turn should return to the original position/dir'
  );

  // Коллизия внутри группы после поворота не должна ломать функцию (canPlaceBlueprint
  // — забота вызывающего кода) — сюда просто прогоняем 2×2 станок вместе с 1×1.
  const miner: Entity = { id: 'm', kind: 'miner', pos: { x: 0, y: 0 }, dir: 0, config: {} };
  const belt: Entity = { id: 'bt', kind: 'belt', pos: { x: 2, y: 0 }, dir: 0, config: {} };
  const rotatedMixed = rotateGroupRigid([miner, belt], 1);
  assert(rotatedMixed.length === 2, 'mixed-size group should preserve entity count');
  assert(Number.isInteger(rotatedMixed[0].pos.x) && Number.isInteger(rotatedMixed[0].pos.y), 'rotated positions must stay on the integer grid');
}
console.log('✓ rotateGroupRigid OK');

console.log('grid checks OK');
