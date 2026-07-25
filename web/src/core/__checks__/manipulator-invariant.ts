import { buildGraph } from '../graph';
import { Engine } from '../engine';
import { NODE_DEFS } from '../nodes';
import { Entity, EngineEvent, Transport } from '../types';

/**
 * Регрессионные проверки инварианта «манипулятор обязателен для любой передачи
 * лента/станок → silo/chest» (docs/03, CLAUDE.md).
 *
 * Существующие __checks__/graph.ts уже покрывают furnace/assembler как принимающую
 * сторону — этот файл добавляет ИМЕННО silo и chest (конечные узлы «выгрузки»,
 * ради которых инвариант и был написан), причём и на уровне buildGraph (edges),
 * и на уровне полного Engine (нет 'result' без манипулятора, есть — с ним).
 */

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(`Assert failed: ${msg}`);
  }
}

const fakeTransport: Transport = { move: async () => {}, clear: () => {} };

function collectHandlers(): Record<string, any> {
  const handlers: Record<string, any> = {};
  for (const [kind, def] of Object.entries(NODE_DEFS)) {
    if (def.handler) handlers[kind] = def.handler;
  }
  return handlers;
}

console.log('Testing manipulator invariant for silo/chest...');

// Test A: лента впритык к silo, БЕЗ манипулятора → buildGraph не создаёт рабочий edge
// (тупик: to === null), пакет от шахты падает, 'result' от silo никогда не эмитится.
console.log('Test A: miner -> belt -> silo directly (no manipulator) => dead-end, no result');
{
  const miner: Entity = { id: 'miner_a', kind: 'miner', pos: { x: 0, y: 5 }, dir: 0, config: { mode: 'text', text: 'x' } };
  const belt: Entity = { id: 'belt_a', kind: 'belt', pos: { x: 0, y: 4 }, dir: 0, config: {} };
  // silo 3x3 at (-1,1): back row y=3 -> (-1,3),(0,3),(1,3); belt at (0,4) steps to (0,3) = silo back tile.
  const silo: Entity = { id: 'silo_a', kind: 'silo', pos: { x: -1, y: 1 }, dir: 0, config: {} };

  const entities = { miner_a: miner, belt_a: belt, silo_a: silo };
  const edges = buildGraph(entities);

  const minerEdges = edges.filter((e) => e.from === 'miner_a');
  assert(minerEdges.length === 1, `Expected 1 edge from miner_a, got ${minerEdges.length}`);
  assert(minerEdges[0].to === null, `Belt directly touching silo without manipulator must dead-end, got to=${minerEdges[0].to}`);
  assert(
    edges.every((e) => e.to !== 'silo_a'),
    'No edge may point at silo_a without a manipulator on either end'
  );
}
console.log('✓ Test A OK (graph level)');

// Test A2: то же самое, но через полноценный Engine — 'result' не должен появиться никогда.
async function testA2() {
  const miner: Entity = { id: 'miner_a2', kind: 'miner', pos: { x: 10, y: 5 }, dir: 0, config: { mode: 'text', text: 'x' } };
  const belt: Entity = { id: 'belt_a2', kind: 'belt', pos: { x: 10, y: 4 }, dir: 0, config: {} };
  const silo: Entity = { id: 'silo_a2', kind: 'silo', pos: { x: 9, y: 1 }, dir: 0, config: {} };

  const entities = { miner_a2: miner, belt_a2: belt, silo_a2: silo };
  const edges = buildGraph(entities);

  const events: EngineEvent[] = [];
  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), { handlers: collectHandlers() });
  engine.start();
  engine.triggerMiner('miner_a2');
  await new Promise((r) => setTimeout(r, 200));
  engine.stop();

  const resultEvents = events.filter((e) => e.t === 'result');
  assert(resultEvents.length === 0, `Expected 0 'result' events without manipulator, got ${resultEvents.length}`);
  const dropEvents = events.filter((e) => e.t === 'packet-drop' && e.reason === 'dead-end');
  assert(dropEvents.length === 1, `Expected 1 dead-end drop, got ${dropEvents.length}`);
}

// Test B: лента впритык к chest, БЕЗ манипулятора → тот же дедлок/тупик.
console.log('Test B: miner -> belt -> chest directly (no manipulator) => dead-end, no result');
{
  const miner: Entity = { id: 'miner_b', kind: 'miner', pos: { x: 20, y: 5 }, dir: 0, config: {} };
  const belt: Entity = { id: 'belt_b', kind: 'belt', pos: { x: 20, y: 4 }, dir: 0, config: {} };
  // chest 1x1 at (20,3): belt at (20,4) steps to (20,3) = chest tile.
  const chest: Entity = { id: 'chest_b', kind: 'chest', pos: { x: 20, y: 3 }, dir: 0, config: {} };

  const entities = { miner_b: miner, belt_b: belt, chest_b: chest };
  const edges = buildGraph(entities);

  const minerEdges = edges.filter((e) => e.from === 'miner_b');
  assert(minerEdges.length === 1, `Expected 1 edge from miner_b, got ${minerEdges.length}`);
  assert(minerEdges[0].to === null, `Belt directly touching chest without manipulator must dead-end, got to=${minerEdges[0].to}`);
  assert(
    edges.every((e) => e.to !== 'chest_b'),
    'No edge may point at chest_b without a manipulator on either end'
  );
}
console.log('✓ Test B OK (graph level)');

// Test B2: станок вплотную к chest (0 лент вообще) — тоже 0 edges (не только тупик,
// а вообще ничего, т.к. path.length===0 && to===null).
console.log('Test B2: assembler directly adjacent to chest, 0 belts, no manipulator => 0 edges');
{
  const assembler: Entity = { id: 'asm_b2', kind: 'assembler', pos: { x: 30, y: 5 }, dir: 0, config: {} };
  // assembler 2x2 FRONT at y=4 (x=30,31); chest 1x1 sitting right there.
  const chest: Entity = { id: 'chest_b2', kind: 'chest', pos: { x: 30, y: 4 }, dir: 0, config: {} };

  const entities = { asm_b2: assembler, chest_b2: chest };
  const edges = buildGraph(entities);
  const asmEdges = edges.filter((e) => e.from === 'asm_b2');
  assert(asmEdges.length === 0, `Direct assembler->chest adjacency without manipulator must yield 0 edges, got ${asmEdges.length}`);
}
console.log('✓ Test B2 OK');

// Test C: тот же belt-в-silo случай, но теперь ЧЕРЕЗ манипулятор — должен нормально работать
// (позитивный контроль: инвариант не превращается в «вообще ничего не доставляется»).
async function testC() {
  const miner: Entity = { id: 'miner_c', kind: 'miner', pos: { x: 0, y: 5 }, dir: 0, config: { mode: 'text', text: 'hello' } };
  const belt: Entity = { id: 'belt_c', kind: 'belt', pos: { x: 0, y: 4 }, dir: 0, config: {} };
  const manip: Entity = { id: 'manip_c', kind: 'manipulator', pos: { x: 0, y: 3 }, dir: 0, config: {} };
  // silo 3x3 at (-1,0): back row y=2 -> (-1,2),(0,2),(1,2); manipulator FRONT (dir=0) at (0,2).
  const silo: Entity = { id: 'silo_c', kind: 'silo', pos: { x: -1, y: 0 }, dir: 0, config: {} };

  const entities = { miner_c: miner, belt_c: belt, manip_c: manip, silo_c: silo };
  const edges = buildGraph(entities);

  const minerEdges = edges.filter((e) => e.from === 'miner_c');
  assert(minerEdges.length === 1 && minerEdges[0].to === 'manip_c', 'miner_c should reach manip_c');
  const manipEdges = edges.filter((e) => e.from === 'manip_c');
  assert(manipEdges.length === 1 && manipEdges[0].to === 'silo_c', 'manip_c should reach silo_c');

  const events: EngineEvent[] = [];
  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), { handlers: collectHandlers() });
  engine.start();
  engine.triggerMiner('miner_c');
  // siloHandler держит working ~2.7с (LAUNCH_MS) перед 'result' — ждём с запасом.
  await new Promise((r) => setTimeout(r, 3200));
  engine.stop();

  const resultEvents = events.filter((e) => e.t === 'result');
  assert(resultEvents.length === 1, `Expected exactly 1 'result' via manipulator-mediated chain, got ${resultEvents.length}`);
  assert(
    (resultEvents[0] as any).data === 'hello',
    `Result payload mismatch, got ${JSON.stringify((resultEvents[0] as any).data)}`
  );
}

(async () => {
  try {
    await testA2();
    console.log('✓ Test A2 OK (engine level, no manipulator => no result)');
    await testC();
    console.log('✓ Test C OK (engine level, via manipulator => result delivered)');
    console.log('manipulator-invariant checks OK');
  } catch (e) {
    console.error('\n❌ manipulator-invariant checks FAILED:', e);
    throw e;
  }
})();
