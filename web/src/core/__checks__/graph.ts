import { buildGraph } from '../graph';
import { Entity } from '../types';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(`Assert failed: ${msg}`);
  }
}

console.log('Testing buildGraph...');

// Test 1: miner → 2 ленты → манипулятор → assembler: 2 edge (миner→манипулятор, манипулятор→assembler)
// Манипулятор — обязательный посредник для ЛЮБОЙ передачи станок↔станок (docs/03).
console.log('Test 1: miner → 2 belts → manipulator → assembler');
{
  const miner: Entity = {
    id: 'miner1',
    kind: 'miner',
    pos: { x: 10, y: 20 },
    dir: 0,
    config: {},
  };

  // 2 ленты вверх: (10, 19), (10, 18); манипулятор перед самим assembler: (10, 17)
  const belt1: Entity = {
    id: 'belt1',
    kind: 'belt',
    pos: { x: 10, y: 19 },
    dir: 0,
    config: {},
  };

  const belt2: Entity = {
    id: 'belt2',
    kind: 'belt',
    pos: { x: 10, y: 18 },
    dir: 0,
    config: {},
  };

  const manipulator: Entity = {
    id: 'manip1',
    kind: 'manipulator',
    pos: { x: 10, y: 17 },
    dir: 0,
    config: {},
  };

  // assembler у входа манипулятора (2×2: back-ряд y16 = (9,16),(10,16))
  const assembler: Entity = {
    id: 'asm1',
    kind: 'assembler',
    pos: { x: 9, y: 15 },
    dir: 0,
    config: {},
  };

  const entities = {
    miner1: miner,
    belt1: belt1,
    belt2: belt2,
    manip1: manipulator,
    asm1: assembler,
  };

  const edges = buildGraph(entities);

  // miner → манипулятор: 2 ленты, to = manip1
  const minerEdges = edges.filter((e) => e.from === 'miner1');
  assert(minerEdges.length === 1, `Expected 1 edge from miner, got ${minerEdges.length}`);
  const minerEdge = minerEdges[0];
  assert(minerEdge.to === 'manip1', `Miner edge should point to manip1, got ${minerEdge.to}`);
  assert(
    minerEdge.path.length === 2,
    `Miner→manipulator path should have 2 tiles, got ${minerEdge.path.length}: ${JSON.stringify(minerEdge.path)}`
  );
  assert(minerEdge.branch === 'out', `Branch should be 'out', got ${minerEdge.branch}`);

  // манипулятор → assembler: впритык, path пуст, to = asm1
  const manipEdges = edges.filter((e) => e.from === 'manip1');
  assert(manipEdges.length === 1, `Expected 1 edge from manipulator, got ${manipEdges.length}`);
  const manipEdge = manipEdges[0];
  assert(manipEdge.to === 'asm1', `Manipulator edge should point to asm1, got ${manipEdge.to}`);
  assert(manipEdge.path.length === 0, `Manipulator→assembler path should be empty, got ${manipEdge.path.length}`);
}
console.log('✓ Test 1 OK');

// Test 2: лента в никуда (to = null, path непуст)
console.log('Test 2: belt to nowhere');
{
  const miner: Entity = {
    id: 'miner2',
    kind: 'miner',
    pos: { x: 5, y: 10 },
    dir: 0,
    config: {},
  };

  // Одна лента вверх, больше ничего
  const belt: Entity = {
    id: 'belt_alone',
    kind: 'belt',
    pos: { x: 5, y: 9 },
    dir: 0,
    config: {},
  };

  const entities = {
    miner2: miner,
    belt_alone: belt,
  };

  const edges = buildGraph(entities);
  const minerEdges = edges.filter((e) => e.from === 'miner2');

  assert(minerEdges.length === 1, `Expected 1 edge from miner2, got ${minerEdges.length}`);
  const edge = minerEdges[0];
  assert(edge.to === null, `Edge should end in null (dead-end), got ${edge.to}`);
  assert(edge.path.length > 0, `Path should not be empty for dead-end, got ${edge.path.length}`);
}
console.log('✓ Test 2 OK');

// Test 3: кольцо лент не подвешивает trace (программа не виснет)
console.log('Test 3: belt ring does not hang');
{
  const miner: Entity = {
    id: 'miner3',
    kind: 'miner',
    pos: { x: 15, y: 15 },
    dir: 0,
    config: {},
  };

  // Колечко из лент: (15,14) → (15,13) → (16,13) → (16,14) → (15,14)
  const belt1: Entity = {
    id: 'b1',
    kind: 'belt',
    pos: { x: 15, y: 14 },
    dir: 0,
    config: {},
  };

  const belt2: Entity = {
    id: 'b2',
    kind: 'belt',
    pos: { x: 15, y: 13 },
    dir: 1,
    config: {},
  };

  const belt3: Entity = {
    id: 'b3',
    kind: 'belt',
    pos: { x: 16, y: 13 },
    dir: 2,
    config: {},
  };

  const belt4: Entity = {
    id: 'b4',
    kind: 'belt',
    pos: { x: 16, y: 14 },
    dir: 3,
    config: {},
  };

  const entities = {
    miner3: miner,
    b1: belt1,
    b2: belt2,
    b3: belt3,
    b4: belt4,
  };

  const startTime = Date.now();
  const edges = buildGraph(entities);
  const elapsed = Date.now() - startTime;

  assert(elapsed < 5000, `buildGraph took too long with ring: ${elapsed}ms`);

  // Шахта 2x2 должна иметь 2 edge (по одному от каждого FRONT порта)
  const minerEdges = edges.filter((e) => e.from === 'miner3');
  assert(minerEdges.length === 2, `Expected 2 edges from miner3 (2x2 has 2 ports), got ${minerEdges.length}`);

  // Кольцо помечено loopFrom и to=null → движок гоняет предмет по петле, а не дропает
  const ringEdge = minerEdges.find((e) => e.loopFrom !== undefined);
  assert(ringEdge !== undefined, 'Ring edge should have loopFrom set');
  assert(ringEdge!.to === null, `Ring edge should be dead-end (to=null), got ${ringEdge!.to}`);
  assert(ringEdge!.loopFrom! >= 0 && ringEdge!.loopFrom! < ringEdge!.path.length,
    `loopFrom should index into path, got ${ringEdge!.loopFrom} of ${ringEdge!.path.length}`);
}
console.log('✓ Test 3 OK');

// Test 4: lab — 'rework' порт через манипулятор назад к assembler
console.log('Test 4: lab rework port with feedback (through manipulator)');
{
  const lab: Entity = {
    id: 'lab1',
    kind: 'lab',
    pos: { x: 20, y: 25 },
    dir: 0,
    config: {},
  };

  // Lab rightPort at (21, 24), лента от порта вверх, манипулятор перед assembler
  const belt1: Entity = {
    id: 'lb1',
    kind: 'belt',
    pos: { x: 21, y: 24 },
    dir: 0,
    config: {},
  };

  const manipulator: Entity = {
    id: 'manip2',
    kind: 'manipulator',
    pos: { x: 21, y: 23 },
    dir: 0,
    config: {},
  };

  const assembler: Entity = {
    id: 'asm2',
    kind: 'assembler',
    pos: { x: 20, y: 21 },
    dir: 0,
    config: {},
  };

  const entities = {
    lab1: lab,
    lb1: belt1,
    manip2: manipulator,
    asm2: assembler,
  };

  const edges = buildGraph(entities);
  const labEdges = edges.filter((e) => e.from === 'lab1');

  assert(labEdges.length > 0, `Lab should have edges, got ${labEdges.length}`);

  const reworkEdge = labEdges.find((e) => e.branch === 'rework');
  if (reworkEdge) {
    assert(reworkEdge.to === 'manip2', `Rework should point to manip2, got ${reworkEdge.to}`);
    assert(reworkEdge.path.length === 1, `Rework path should have 1 belt, got ${reworkEdge.path.length}`);

    const manipEdges = edges.filter((e) => e.from === 'manip2');
    assert(manipEdges.length === 1, `Expected 1 edge from manip2, got ${manipEdges.length}`);
    assert(manipEdges[0].to === 'asm2', `Manipulator should point to asm2, got ${manipEdges[0].to}`);
  }
}
console.log('✓ Test 4 OK');

// Test 5: дублер — оба FRONT-порта дают edges с branch 'out' (по одной копии на выход)
console.log('Test 5: duplicator — two out-branch edges');
{
  const duplicator: Entity = {
    id: 'duplicator1',
    kind: 'duplicator',
    pos: { x: 30, y: 30 },
    dir: 0,
    config: {},
  };

  // Две ленты вверх от двух FRONT-портов (2×2: front-ряд y=29, тайлы (30,29),(31,29))
  const belt1: Entity = { id: 'bt', kind: 'belt', pos: { x: 30, y: 29 }, dir: 0, config: {} };
  const belt2: Entity = { id: 'bf', kind: 'belt', pos: { x: 31, y: 29 }, dir: 0, config: {} };

  const entities = { duplicator1: duplicator, bt: belt1, bf: belt2 };

  const edges = buildGraph(entities);
  const duplicatorEdges = edges.filter((e) => e.from === 'duplicator1');

  assert(duplicatorEdges.length === 2, `Duplicator should have 2 edges, got ${duplicatorEdges.length}`);
  assert(duplicatorEdges.every((e) => e.branch === 'out'), 'дублер: оба edge должны быть branch out');
  assert(duplicatorEdges.every((e) => e.to === null), 'без манипулятора оба выхода — тупики (ленты в никуда)');
}
console.log('✓ Test 5 OK');

// Test 6: порт без ленты и без станка рядом → edge не создаётся
console.log('Test 6: port with no belt and no machine → no edge');
{
  const miner: Entity = {
    id: 'miner4',
    kind: 'miner',
    pos: { x: 40, y: 40 },
    dir: 0,
    config: {},
  };

  // Ничего вверху — порты в пустоту

  const entities = {
    miner4: miner,
  };

  const edges = buildGraph(entities);
  const minerEdges = edges.filter((e) => e.from === 'miner4');

  assert(minerEdges.length === 0, `Miner with no belt should have 0 edges, got ${minerEdges.length}`);
}
console.log('✓ Test 6 OK');

// Test 7: множественные ленты от одного мiner'а — одна лента через манипулятор доходит,
// вторая без манипулятора упирается в тупик (обе ветки одного правила в одном тесте)
console.log('Test 7: multiple ports from 2x2 miner — one via manipulator, one dead-end');
{
  const miner: Entity = {
    id: 'miner6',
    kind: 'miner',
    pos: { x: 50, y: 50 },
    dir: 0,
    config: {},
  };

  // miner выходные порты: (50, 49), (51, 49)
  const manipulator: Entity = {
    id: 'manip4',
    kind: 'manipulator',
    pos: { x: 50, y: 49 },
    dir: 0,
    config: {},
  };

  const beltNoManip: Entity = {
    id: 'b6b',
    kind: 'belt',
    pos: { x: 51, y: 49 },
    dir: 0,
    config: {},
  };

  // Assembler впритык над манипулятором (2×2: back-ряд y48 = (49,48),(50,48))
  const assembler: Entity = {
    id: 'asm4',
    kind: 'assembler',
    pos: { x: 49, y: 47 },
    dir: 0,
    config: {},
  };

  const entities = {
    miner6: miner,
    manip4: manipulator,
    b6b: beltNoManip,
    asm4: assembler,
  };

  const edges = buildGraph(entities);

  const minerEdges = edges.filter((e) => e.from === 'miner6');
  assert(minerEdges.length === 2, `Miner6 should have 2 edges (one per port), got ${minerEdges.length}`);

  const toManip = minerEdges.find((e) => e.to === 'manip4');
  const deadEnd = minerEdges.find((e) => e.to === null);
  assert(toManip !== undefined, 'One port should reach the manipulator directly (path empty)');
  assert(deadEnd !== undefined, 'The other port (pure belt, no manipulator) should dead-end');

  // манипулятор → assembler напрямую (впритык)
  const manipEdges = edges.filter((e) => e.from === 'manip4');
  assert(manipEdges.length === 1, `Expected 1 edge from manip4, got ${manipEdges.length}`);
  assert(manipEdges[0].to === 'asm4', `Manipulator should reach asm4, got ${manipEdges[0].to}`);
}
console.log('✓ Test 7 OK');

// Test 8: два «настоящих» станка вплотную друг к другу без манипулятора — edge не создаётся вообще
console.log('Test 8: two real stations directly adjacent without manipulator → no edge');
{
  const furnace: Entity = {
    id: 'furnace1',
    kind: 'furnace',
    pos: { x: 60, y: 60 },
    dir: 0,
    config: {},
  };

  // assembler вплотную к FRONT furnace (furnace 2×2 у (60,60), FRONT — y=59;
  // assembler 2×2 c BACK-рядом на y=59 → pos.y = 59 - (2-1) = 58)
  const assembler: Entity = {
    id: 'asm5',
    kind: 'assembler',
    pos: { x: 59, y: 58 },
    dir: 0,
    config: {},
  };

  const entities = { furnace1: furnace, asm5: assembler };
  const edges = buildGraph(entities);
  const furnaceEdges = edges.filter((e) => e.from === 'furnace1');

  assert(furnaceEdges.length === 0, `Direct station↔station adjacency without manipulator should yield 0 edges, got ${furnaceEdges.length}`);
}
console.log('✓ Test 8 OK');

// Test 9: манипулятор между двумя станками вплотную (без лент вообще) — оба edge валидны, path пуст
console.log('Test 9: manipulator sandwiched between two stations (no belts)');
{
  const furnace: Entity = {
    id: 'furnace2',
    kind: 'furnace',
    pos: { x: 70, y: 70 },
    dir: 0,
    config: {},
  };

  // манипулятор вплотную к FRONT furnace (furnace 2×2, FRONT y=69)
  const manipulator: Entity = {
    id: 'manip5',
    kind: 'manipulator',
    pos: { x: 70, y: 69 },
    dir: 0,
    config: {},
  };

  // assembler вплотную к FRONT манипулятора (манипулятор 1×1 у (70,69), FRONT y=68;
  // assembler 2×2 c BACK-рядом на y=68 → pos.y = 68 - (2-1) = 67)
  const assembler: Entity = {
    id: 'asm6',
    kind: 'assembler',
    pos: { x: 69, y: 67 },
    dir: 0,
    config: {},
  };

  const entities = { furnace2: furnace, manip5: manipulator, asm6: assembler };
  const edges = buildGraph(entities);

  const furnaceEdges = edges.filter((e) => e.from === 'furnace2');
  assert(furnaceEdges.length === 1, `Expected 1 edge from furnace2, got ${furnaceEdges.length}`);
  assert(furnaceEdges[0].to === 'manip5', `furnace2 should reach manip5, got ${furnaceEdges[0].to}`);
  assert(furnaceEdges[0].path.length === 0, `furnace2→manip5 path should be empty, got ${furnaceEdges[0].path.length}`);

  const manipEdges = edges.filter((e) => e.from === 'manip5');
  assert(manipEdges.length === 1, `Expected 1 edge from manip5, got ${manipEdges.length}`);
  assert(manipEdges[0].to === 'asm6', `manip5 should reach asm6, got ${manipEdges[0].to}`);
  assert(manipEdges[0].path.length === 0, `manip5→asm6 path should be empty, got ${manipEdges[0].path.length}`);
}
console.log('✓ Test 9 OK');

console.log('graph checks OK');
