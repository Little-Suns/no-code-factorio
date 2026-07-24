// Стресс-тест движка: много независимых цепочек одновременно + один зависший хендлер.
// Мотивация: расследование бага "фабрика иногда зависает при старте" (docs/08) показало,
// что все существующие проверки engine.ts гоняют 2-4 сущности и единичные пакеты — сценарий
// "много станков и пакетов разом" и "один зависший fetch к /llm" никогда не проверялись.
import { Engine, HandlerResult, NodeCtx } from '../engine';
import { Transport, Entity, Edge, EngineEvent } from '../types';

const fakeTransport: Transport = {
  move: async () => {},
  clear: () => {},
};

// Строит CHAIN_COUNT независимых цепочек miner_i → assembler_i → silo_i, каждая со своим
// текстом-пейлоадом 'payload-i' — удобно адресовать конкретную цепочку в хендлере по ctx.data.
function buildParallelChains(chainCount: number): { entities: Record<string, Entity>; edges: Edge[] } {
  const entities: Record<string, Entity> = {};
  const edges: Edge[] = [];

  for (let i = 0; i < chainCount; i++) {
    const minerId = `stress-miner-${i}`;
    const asmId = `stress-asm-${i}`;
    const siloId = `stress-silo-${i}`;

    entities[minerId] = { id: minerId, kind: 'miner', pos: { x: 0, y: i }, dir: 0, config: { mode: 'text', text: `payload-${i}` } };
    entities[asmId] = { id: asmId, kind: 'assembler', pos: { x: 5, y: i }, dir: 0, config: {} };
    entities[siloId] = { id: siloId, kind: 'silo', pos: { x: 10, y: i }, dir: 0, config: {} };

    edges.push({
      id: `stress-e-${i}-1`,
      from: minerId,
      branch: 'out',
      to: asmId,
      path: [{ x: 1, y: i }, { x: 2, y: i }, { x: 3, y: i }, { x: 4, y: i }],
    });
    edges.push({
      id: `stress-e-${i}-2`,
      from: asmId,
      branch: 'out',
      to: siloId,
      path: [{ x: 6, y: i }, { x: 7, y: i }, { x: 8, y: i }, { x: 9, y: i }],
    });
  }

  return { entities, edges };
}

/**
 * Stress A: много независимых цепочек, запущенных в одном тике (как будто много шахт
 * с intervalSec одновременно сработали). FakeTransport резолвится мгновенно, так что если
 * между независимыми нодами есть случайная сериализация/дедлок — 300мс не хватит на все.
 */
async function testManyParallelChainsComplete() {
  const CHAIN_COUNT = 30;
  const events: EngineEvent[] = [];
  const { entities, edges } = buildParallelChains(CHAIN_COUNT);

  const handlers: Record<string, (ctx: NodeCtx) => Promise<HandlerResult>> = {
    assembler: async () => ({ out: 'processed' }),
    silo: async () => ({ done: true }),
  };

  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), {
    handlers: handlers as any,
  });

  engine.start();
  for (let i = 0; i < CHAIN_COUNT; i++) {
    engine.triggerMiner(`stress-miner-${i}`);
  }

  await new Promise((r) => setTimeout(r, 300));
  engine.stop();

  const results = events.filter((e) => e.t === 'result');
  if (results.length !== CHAIN_COUNT) {
    throw new Error(
      `Stress A: ожидалось ${CHAIN_COUNT} result-событий, получено ${results.length} — похоже на дедлок/потерю пакетов под нагрузкой`
    );
  }

  console.log(`✓ Stress A: ${CHAIN_COUNT} независимых цепочек завершились одновременно, без дедлока`);
}

/**
 * Stress B: один хендлер зависает навсегда (симулирует ровно тот баг, который чинит
 * client-side timeout в runtime.ts — fetch к /llm без AbortController). Остальные
 * независимые цепочки не должны от этого пострадать — per-node очередь (queues в
 * engine.ts) обязана изолировать зависший узел от всех остальных.
 */
async function testStuckHandlerDoesNotBlockSiblings() {
  const CHAIN_COUNT = 15;
  const events: EngineEvent[] = [];
  const { entities, edges } = buildParallelChains(CHAIN_COUNT);

  const handlers: Record<string, (ctx: NodeCtx) => Promise<HandlerResult>> = {
    assembler: async (ctx: NodeCtx) => {
      if (ctx.data === 'payload-0') {
        // Никогда не резолвится — как зависший fetch без таймаута
        return new Promise<HandlerResult>(() => {});
      }
      return { out: 'processed' };
    },
    silo: async () => ({ done: true }),
  };

  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), {
    handlers: handlers as any,
  });

  engine.start();
  for (let i = 0; i < CHAIN_COUNT; i++) {
    engine.triggerMiner(`stress-miner-${i}`);
  }

  await new Promise((r) => setTimeout(r, 300));
  engine.stop();

  const completedSilos = new Set(
    events.filter((e): e is Extract<EngineEvent, { t: 'result' }> => e.t === 'result').map((e) => e.nodeId)
  );

  if (completedSilos.has('stress-silo-0')) {
    throw new Error('Stress B: зависшая цепочка (chain 0, хендлер никогда не резолвится) не должна была дойти до result');
  }
  for (let i = 1; i < CHAIN_COUNT; i++) {
    if (!completedSilos.has(`stress-silo-${i}`)) {
      throw new Error(`Stress B: цепочка ${i} не завершилась — зависшая нода в другой цепочке заблокировала соседей`);
    }
  }

  console.log(`✓ Stress B: зависший хендлер в одной ноде не заблокировал ${CHAIN_COUNT - 1} соседних цепочек`);
}

(async () => {
  try {
    await testManyParallelChainsComplete();
    await testStuckHandlerDoesNotBlockSiblings();

    console.log('\n✅ stress checks OK — под нагрузкой и с зависшим хендлером дедлока нет');
  } catch (e) {
    console.error('\n❌ stress checks FAILED:', e);
    throw e;
  }
})();
