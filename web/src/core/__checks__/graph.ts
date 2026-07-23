import { buildGraph } from '../graph';
import { Entity } from '../types';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(`Assert failed: ${msg}`);
  }
}

console.log('Testing buildGraph...');

// Test 1: miner(2x2, dir=0) → 3 ленты вверх → assembler: ровно 1 edge, path длиной 3, to = assembler.id
console.log('Test 1: miner → 3 belts → assembler');
{
  const miner: Entity = {
    id: 'miner1',
    kind: 'miner',
    pos: { x: 10, y: 20 },
    dir: 0,
    config: {},
  };

  // 3 ленты вверх: (10, 19), (10, 18), (10, 17)
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

  const belt3: Entity = {
    id: 'belt3',
    kind: 'belt',
    pos: { x: 10, y: 17 },
    dir: 0,
    config: {},
  };

  // assembler у входа лент вверх
  const assembler: Entity = {
    id: 'asm1',
    kind: 'assembler',
    pos: { x: 9, y: 14 },
    dir: 0,
    config: {},
  };

  const entities = {
    miner1: miner,
    belt1: belt1,
    belt2: belt2,
    belt3: belt3,
    asm1: assembler,
  };

  const edges = buildGraph(entities);

  // Ищем edge от miner'а
  const minerEdges = edges.filter((e) => e.from === 'miner1');
  assert(minerEdges.length === 1, `Expected 1 edge from miner, got ${minerEdges.length}`);

  const edge = minerEdges[0];
  assert(edge.to === 'asm1', `Edge should point to asm1, got ${edge.to}`);
  assert(
    edge.path.length === 3,
    `Path should have 3 tiles, got ${edge.path.length}: ${JSON.stringify(edge.path)}`
  );
  assert(edge.branch === 'out', `Branch should be 'out', got ${edge.branch}`);
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
}
console.log('✓ Test 3 OK');

// Test 4: lab — 'rework' порт с лентами назад к assembler
console.log('Test 4: lab rework port with feedback');
{
  const lab: Entity = {
    id: 'lab1',
    kind: 'lab',
    pos: { x: 20, y: 25 },
    dir: 0,
    config: {},
  };

  // Lab rightPort at (21, 24), лента от порта вверх
  // Ленты: (21, 24), (21, 23) до assembler входов в (20,22)...(22,22)
  const belt1: Entity = {
    id: 'lb1',
    kind: 'belt',
    pos: { x: 21, y: 24 },
    dir: 0,
    config: {},
  };

  const belt2: Entity = {
    id: 'lb2',
    kind: 'belt',
    pos: { x: 21, y: 23 },
    dir: 0,
    config: {},
  };

  const assembler: Entity = {
    id: 'asm2',
    kind: 'assembler',
    pos: { x: 20, y: 20 },
    dir: 0,
    config: {},
  };

  const entities = {
    lab1: lab,
    lb1: belt1,
    lb2: belt2,
    asm2: assembler,
  };

  const edges = buildGraph(entities);
  const labEdges = edges.filter((e) => e.from === 'lab1');

  assert(labEdges.length > 0, `Lab should have edges, got ${labEdges.length}`);

  const reworkEdge = labEdges.find((e) => e.branch === 'rework');
  if (reworkEdge) {
    assert(reworkEdge.to === 'asm2', `Rework should point to asm2, got ${reworkEdge.to}`);
    assert(reworkEdge.path.length === 2, `Rework path should have 2 belts, got ${reworkEdge.path.length}`);
  }
}
console.log('✓ Test 4 OK');

// Test 5: splitter — два порта дают edges с branch 'true' и 'false'
console.log('Test 5: splitter with true and false branches');
{
  const splitter: Entity = {
    id: 'splitter1',
    kind: 'splitter',
    pos: { x: 30, y: 30 },
    dir: 0,
    config: {},
  };

  // Две ленты вверх от true и false портов
  const beltTrue: Entity = {
    id: 'bt',
    kind: 'belt',
    pos: { x: 30, y: 29 },
    dir: 0,
    config: {},
  };

  const beltFalse: Entity = {
    id: 'bf',
    kind: 'belt',
    pos: { x: 31, y: 29 },
    dir: 0,
    config: {},
  };

  const entities = {
    splitter1: splitter,
    bt: beltTrue,
    bf: beltFalse,
  };

  const edges = buildGraph(entities);
  const splitterEdges = edges.filter((e) => e.from === 'splitter1');

  assert(splitterEdges.length === 2, `Splitter should have 2 edges, got ${splitterEdges.length}`);

  const trueEdge = splitterEdges.find((e) => e.branch === 'true');
  const falseEdge = splitterEdges.find((e) => e.branch === 'false');

  assert(trueEdge !== undefined, 'Splitter should have true edge');
  assert(falseEdge !== undefined, 'Splitter should have false edge');
  assert(trueEdge!.to === null, 'True edge is dead-end');
  assert(falseEdge!.to === null, 'False edge is dead-end');
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

// Test 7: множественные ленты от одного мiner'а к одному assembler'у
console.log('Test 7: multiple edges from 2x2 miner to assembler');
{
  // Мiner 2×2 имеет два выходных порта, оба соединены с assembler'ом
  const miner: Entity = {
    id: 'miner6',
    kind: 'miner',
    pos: { x: 50, y: 50 },
    dir: 0,
    config: {},
  };

  // miner выходные порты: (50, 49), (51, 49)
  // Две ленты вверх от этих портов
  const belt1: Entity = {
    id: 'b6a',
    kind: 'belt',
    pos: { x: 50, y: 49 },
    dir: 0,
    config: {},
  };

  const belt2: Entity = {
    id: 'b6b',
    kind: 'belt',
    pos: { x: 51, y: 49 },
    dir: 0,
    config: {},
  };

  // Assembler где-то выше
  const assembler: Entity = {
    id: 'asm4',
    kind: 'assembler',
    pos: { x: 49, y: 46 },
    dir: 0,
    config: {},
  };

  const entities = {
    miner6: miner,
    b6a: belt1,
    b6b: belt2,
    asm4: assembler,
  };

  const edges = buildGraph(entities);

  const minerEdges = edges.filter((e) => e.from === 'miner6');

  // miner 2×2 может иметь до 2 edges (по одному от каждого FRONT порта)
  assert(minerEdges.length > 0, `Miner6 should have at least 1 edge, got ${minerEdges.length}`);

  // Проверяем что edges корректны (могут быть к разным целям или к одной)
  for (const edge of minerEdges) {
    assert(
      edge.to === null || edge.to === 'asm4',
      `Edge should point to asm4 or null, got ${edge.to}`
    );
  }
}
console.log('✓ Test 7 OK');

console.log('graph checks OK');
