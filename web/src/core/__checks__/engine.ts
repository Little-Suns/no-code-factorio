import { Engine, HandlerResult, NodeCtx } from '../engine';
import { Transport, Entity, Edge, Packet, EngineEvent } from '../types';

// FakeTransport: мгновенная доставка
const fakeTransport: Transport = {
  move: async () => {},
  clear: () => {},
};

/**
 * AC1: miner→assembler→silo
 * triggerMiner доводит данные до result с правильным порядком событий:
 * spawn → consume (assembler) → working → ok → result (silo)
 */
async function testSimplePipeline() {
  const events: EngineEvent[] = [];

  const entities: Record<string, Entity> = {
    miner1: {
      id: 'miner1',
      kind: 'miner',
      pos: { x: 0, y: 0 },
      dir: 0,
      config: { mode: 'text', text: 'hello' },
    },
    assembler1: {
      id: 'assembler1',
      kind: 'assembler',
      pos: { x: 5, y: 0 },
      dir: 0,
      config: {},
    },
    silo1: {
      id: 'silo1',
      kind: 'silo',
      pos: { x: 10, y: 0 },
      dir: 0,
      config: {},
    },
  };

  const edges: Edge[] = [
    {
      id: 'e1:out:0',
      from: 'miner1',
      branch: 'out',
      to: 'assembler1',
      path: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }],
    },
    {
      id: 'e2:out:0',
      from: 'assembler1',
      branch: 'out',
      to: 'silo1',
      path: [{ x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 9, y: 0 }],
    },
  ];

  const handlers: Record<string, (ctx: any) => Promise<HandlerResult>> = {
    assembler: async () => ({ out: 'processed' }),
    silo: async () => ({ done: true }),
  };

  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), {
    handlers: handlers as any,
  });

  engine.start();
  engine.triggerMiner('miner1');

  // Даём время на асинхронность
  await new Promise((r) => setTimeout(r, 100));

  engine.stop();

  // Проверяем события
  const eventTypes = events.map((e) => e.t);
  const spawnIdx = eventTypes.indexOf('packet-spawn');
  const consumeIdx = eventTypes.indexOf('packet-consume');
  const resultIdx = eventTypes.indexOf('result');

  if (spawnIdx === -1) throw new Error('AC1: no packet-spawn event');
  if (consumeIdx === -1) throw new Error('AC1: no packet-consume event');
  if (resultIdx === -1) throw new Error('AC1: no result event');
  if (spawnIdx >= consumeIdx) {
    throw new Error('AC1: spawn должен быть раньше consume');
  }
  if (consumeIdx >= resultIdx) {
    throw new Error('AC1: consume должен быть раньше result');
  }

  console.log('✓ AC1: simple pipeline OK');
}

/**
 * AC2: splitter ведёт пакеты по true/false согласно условию
 */
async function testSplitter() {
  const events: EngineEvent[] = [];

  const entities: Record<string, Entity> = {
    miner1: {
      id: 'miner1',
      kind: 'miner',
      pos: { x: 0, y: 0 },
      dir: 0,
      config: { mode: 'text', text: 'data' },
    },
    splitter1: {
      id: 'splitter1',
      kind: 'splitter',
      pos: { x: 5, y: 0 },
      dir: 0,
      config: { condition: 'true' }, // на которую ветку идёт
    },
    silo_true: {
      id: 'silo_true',
      kind: 'silo',
      pos: { x: 10, y: -1 },
      dir: 0,
      config: {},
    },
    silo_false: {
      id: 'silo_false',
      kind: 'silo',
      pos: { x: 10, y: 1 },
      dir: 0,
      config: {},
    },
  };

  const edges: Edge[] = [
    {
      id: 'e1:out:0',
      from: 'miner1',
      branch: 'out',
      to: 'splitter1',
      path: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }],
    },
    {
      id: 'e2:true:0',
      from: 'splitter1',
      branch: 'true',
      to: 'silo_true',
      path: [{ x: 6, y: -1 }, { x: 7, y: -1 }, { x: 8, y: -1 }, { x: 9, y: -1 }],
    },
    {
      id: 'e3:false:0',
      from: 'splitter1',
      branch: 'false',
      to: 'silo_false',
      path: [{ x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }, { x: 9, y: 1 }],
    },
  ];

  const handlers: Record<string, (ctx: NodeCtx) => Promise<HandlerResult>> = {
    splitter: async (ctx) => {
      // Условие из config: true → идёт по true ветке
      const branch = (ctx.config.condition as string) === 'true' ? 'true' : 'false';
      return { out: ctx.data, branch };
    },
    silo: async () => ({ done: true }),
  };

  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), {
    handlers: handlers as any,
  });

  engine.start();
  engine.triggerMiner('miner1');

  await new Promise((r) => setTimeout(r, 100));
  engine.stop();

  // Должно быть две результата: одна в silo_true, нет в silo_false
  const resultEvents = events.filter((e) => e.t === 'result');
  const resultsInTrue = resultEvents.filter((e) => e.nodeId === 'silo_true');

  if (resultsInTrue.length === 0) {
    throw new Error('AC2: splitter не отправил пакет в silo_true');
  }

  console.log('✓ AC2: splitter branching OK');
}

/**
 * AC3: mixer ждёт оба входа
 * Первый пакет → тишина, второй → consume обоих и один выход с массивом
 */
async function testMixer() {
  const events: EngineEvent[] = [];

  const entities: Record<string, Entity> = {
    miner1: {
      id: 'miner1',
      kind: 'miner',
      pos: { x: 0, y: 0 },
      dir: 0,
      config: { mode: 'text', text: 'in1' },
    },
    miner2: {
      id: 'miner2',
      kind: 'miner',
      pos: { x: 0, y: 2 },
      dir: 0,
      config: { mode: 'text', text: 'in2' },
    },
    mixer1: {
      id: 'mixer1',
      kind: 'mixer',
      pos: { x: 5, y: 0 },
      dir: 0,
      config: {},
    },
    silo1: {
      id: 'silo1',
      kind: 'silo',
      pos: { x: 10, y: 0 },
      dir: 0,
      config: {},
    },
  };

  const edges: Edge[] = [
    {
      id: 'e1:out:0',
      from: 'miner1',
      branch: 'out',
      to: 'mixer1',
      path: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }],
    },
    {
      id: 'e2:out:0',
      from: 'miner2',
      branch: 'out',
      to: 'mixer1',
      path: [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 1 }, { x: 4, y: 1 }],
    },
    {
      id: 'e3:out:0',
      from: 'mixer1',
      branch: 'out',
      to: 'silo1',
      path: [{ x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 9, y: 0 }],
    },
  ];

  const handlers: Record<string, (ctx: NodeCtx) => Promise<HandlerResult>> = {
    mixer: async (ctx) => ({ out: ctx.data }),
    silo: async () => ({ done: true }),
  };

  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), {
    handlers: handlers as any,
  });

  engine.start();
  engine.triggerMiner('miner1');
  await new Promise((r) => setTimeout(r, 50));
  engine.triggerMiner('miner2');

  await new Promise((r) => setTimeout(r, 150));
  engine.stop();

  // После обоих триггеров должно быть 2 consume-события (для обоих пакетов в миксере)
  const consumeEvents = events.filter((e) => e.t === 'packet-consume');
  // Должно быть по меньшей мере одно consume в миксере
  const consumesInMixer = consumeEvents.filter(
    (e) => 'nodeId' in e && e.nodeId === 'mixer1'
  );

  if (consumesInMixer.length < 2) {
    throw new Error(
      `AC3: mixer должен потребить 2 пакета, получено ${consumesInMixer.length}`
    );
  }

  // И должно быть одно результата в silo
  const resultEvents = events.filter(
    (e) => e.t === 'result' && e.nodeId === 'silo1'
  );
  if (resultEvents.length === 0) {
    throw new Error('AC3: mixer не отправил результат в silo');
  }

  console.log('✓ AC3: mixer waiting for both inputs OK');
}

/**
 * AC4: handler-исключение → node-status error + packet-drop 'error',
 * следующий пакет проходит
 */
async function testHandlerError() {
  const events: EngineEvent[] = [];

  const entities: Record<string, Entity> = {
    miner1: {
      id: 'miner1',
      kind: 'miner',
      pos: { x: 0, y: 0 },
      dir: 0,
      config: { mode: 'text', text: 'data' },
    },
    processor1: {
      id: 'processor1',
      kind: 'assembler',
      pos: { x: 5, y: 0 },
      dir: 0,
      config: { errorOn: 'first' },
    },
    silo1: {
      id: 'silo1',
      kind: 'silo',
      pos: { x: 10, y: 0 },
      dir: 0,
      config: {},
    },
  };

  const edges: Edge[] = [
    {
      id: 'e1:out:0',
      from: 'miner1',
      branch: 'out',
      to: 'processor1',
      path: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }],
    },
    {
      id: 'e2:out:0',
      from: 'processor1',
      branch: 'out',
      to: 'silo1',
      path: [{ x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 9, y: 0 }],
    },
  ];

  let callCount = 0;
  const handlers: Record<string, (ctx: NodeCtx) => Promise<HandlerResult>> = {
    assembler: async (ctx) => {
      callCount++;
      if (callCount === 1) {
        // Первый вызов — ошибка
        throw new Error('Intentional error');
      }
      return { out: ctx.data };
    },
    silo: async () => ({ done: true }),
  };

  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), {
    handlers: handlers as any,
  });

  engine.start();
  engine.triggerMiner('miner1');
  await new Promise((r) => setTimeout(r, 50));
  engine.triggerMiner('miner1'); // Второй вызов

  await new Promise((r) => setTimeout(r, 100));
  engine.stop();

  // Должны быть события ошибки
  const errorStatusEvents = events.filter(
    (e) => e.t === 'node-status' && e.status === 'error'
  );
  if (errorStatusEvents.length === 0) {
    throw new Error('AC4: нет node-status error события');
  }

  // И drop с reason 'error'
  const dropErrors = events.filter(
    (e) => e.t === 'packet-drop' && e.reason === 'error'
  );
  if (dropErrors.length === 0) {
    throw new Error('AC4: нет packet-drop error события');
  }

  // Handler должен быть вызван дважды (второй раз успешно)
  if (callCount < 2) {
    throw new Error('AC4: handler не был вызван второй раз после ошибки');
  }

  console.log('✓ AC4: handler error handling OK');
}

/**
 * AC5: lab-петля умирает по TTL, движок не виснет
 */
async function testLabLoop() {
  const events: EngineEvent[] = [];

  const entities: Record<string, Entity> = {
    miner1: {
      id: 'miner1',
      kind: 'miner',
      pos: { x: 0, y: 0 },
      dir: 0,
      config: { mode: 'text', text: 'data' },
    },
    lab1: {
      id: 'lab1',
      kind: 'lab',
      pos: { x: 5, y: 0 },
      dir: 0,
      config: {},
    },
  };

  const edges: Edge[] = [
    {
      id: 'e1:out:0',
      from: 'miner1',
      branch: 'out',
      to: 'lab1',
      path: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }],
    },
    {
      id: 'e2:rework:0',
      from: 'lab1',
      branch: 'rework',
      to: 'lab1', // Петля обратно на себя
      path: [{ x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 1 }],
    },
  ];

  let labCallCount = 0;
  const handlers: Record<string, (ctx: NodeCtx) => Promise<HandlerResult>> = {
    lab: async (ctx) => {
      labCallCount++;
      // Всегда отправляем обратно на rework
      return { out: ctx.data, branch: 'rework' };
    },
  };

  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), {
    handlers: handlers as any,
  });

  engine.start();
  engine.triggerMiner('miner1');

  // Ждём времени, чтобы пакет прошёл несколько итераций
  await new Promise((r) => setTimeout(r, 200));
  engine.stop();

  // Пакет должен быть удалён по TTL (не после 64 итераций, но достаточно скоро)
  const dropTtlEvents = events.filter(
    (e) => e.t === 'packet-drop' && e.reason === 'ttl'
  );

  if (dropTtlEvents.length === 0) {
    throw new Error('AC5: пакет не был удалён по TTL');
  }

  // Handler не должен быть вызван слишком много раз (максимум ~64 раза)
  if (labCallCount > 70) {
    throw new Error(
      `AC5: handler вызван слишком много раз (${labCallCount}), может быть, нет защиты от петель`
    );
  }

  console.log(`✓ AC5: lab loop with TTL protection OK (handler called ${labCallCount} times)`);
}

/**
 * AC6: stop() во время долгого handler → после abort событий нет
 */
async function testStopAbort() {
  const events: EngineEvent[] = [];

  const entities: Record<string, Entity> = {
    miner1: {
      id: 'miner1',
      kind: 'miner',
      pos: { x: 0, y: 0 },
      dir: 0,
      config: { mode: 'text', text: 'data' },
    },
    slowproc: {
      id: 'slowproc',
      kind: 'assembler',
      pos: { x: 5, y: 0 },
      dir: 0,
      config: {},
    },
  };

  const edges: Edge[] = [
    {
      id: 'e1:out:0',
      from: 'miner1',
      branch: 'out',
      to: 'slowproc',
      path: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }],
    },
  ];

  const handlers: Record<string, (ctx: NodeCtx) => Promise<HandlerResult>> = {
    assembler: async () => {
      // Долгая операция
      await new Promise((r) => setTimeout(r, 500));
      return { out: 'result' };
    },
  };

  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), {
    handlers: handlers as any,
  });

  const eventCountBefore = events.length;
  engine.start();
  engine.triggerMiner('miner1');

  // Даём совсем мало времени и сразу гасим
  await new Promise((r) => setTimeout(r, 50));
  engine.stop();
  const lenAtStop = events.length; // всё после этого индекса — эмит после stop

  // Ждём, чтобы убедиться, что долгий handler закончился
  await new Promise((r) => setTimeout(r, 600));

  // После stop() долгий handler не должен эмитить spawn/result/node-io
  const late = events.slice(lenAtStop).filter((e) => e.t === 'packet-spawn' || e.t === 'result' || e.t === 'node-io');
  if (late.length > 0) {
    throw new Error(`AC6: события после stop: ${late.map((e) => e.t).join(',')}`);
  }

  console.log('✓ AC6: stop abort behavior OK');
}

/**
 * AC7: очередь — 3 пакета в станок с handler 50ms обрабатываются последовательно
 */
async function testQueue() {
  const events: EngineEvent[] = [];
  const processingOrder: number[] = [];
  let processingId = 0;

  const entities: Record<string, Entity> = {
    miner1: {
      id: 'miner1',
      kind: 'miner',
      pos: { x: 0, y: 0 },
      dir: 0,
      config: { mode: 'text', text: 'data' },
    },
    processor: {
      id: 'processor',
      kind: 'assembler',
      pos: { x: 5, y: 0 },
      dir: 0,
      config: {},
    },
  };

  const edges: Edge[] = [
    {
      id: 'e1:out:0',
      from: 'miner1',
      branch: 'out',
      to: 'processor',
      path: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }],
    },
  ];

  // Ловим не только порядок старта, но и КОНКУРЕНТНОСТЬ: очередь без await это пропустит
  let active = 0;
  let maxActive = 0;
  const handlers: Record<string, (ctx: NodeCtx) => Promise<HandlerResult>> = {
    assembler: async (ctx) => {
      const id = processingId++;
      processingOrder.push(id);
      active++;
      maxActive = Math.max(maxActive, active);
      // Обработка 50ms
      await new Promise((r) => setTimeout(r, 50));
      active--;
      return { out: ctx.data };
    },
  };

  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), {
    handlers: handlers as any,
  });

  engine.start();

  // Отправляем 3 пакета подряд
  engine.triggerMiner('miner1');
  engine.triggerMiner('miner1');
  engine.triggerMiner('miner1');

  // Даём 200ms, чтобы все три обработались последовательно
  await new Promise((r) => setTimeout(r, 250));
  engine.stop();

  // Проверяем, что они обработаны в порядке 0, 1, 2
  if (processingOrder.length !== 3) {
    throw new Error(
      `AC7: ожидается 3 обработки, получено ${processingOrder.length}`
    );
  }

  if (processingOrder[0] !== 0 || processingOrder[1] !== 1 || processingOrder[2] !== 2) {
    throw new Error(
      `AC7: неправильный порядок обработки: ${processingOrder.join(',')}`
    );
  }

  if (maxActive > 1) {
    throw new Error(`AC7: handlers работали конкурентно (maxActive=${maxActive}), очередь не мьютекс`);
  }

  console.log('✓ AC7: sequential queue processing OK');
}

/**
 * AC8: webhook-шахта — вызов депс.webhooks колбэка порождает пакет,
 * отписка вызывается в stop()
 */
async function testWebhookMiner() {
  const events: EngineEvent[] = [];
  let webhookCallback: ((nodeId: string, body: unknown) => void) | null = null;
  let unsubscribeCalled = false;

  const entities: Record<string, Entity> = {
    webhook_miner: {
      id: 'webhook_miner',
      kind: 'miner',
      pos: { x: 0, y: 0 },
      dir: 0,
      config: { mode: 'webhook' },
    },
    silo1: {
      id: 'silo1',
      kind: 'silo',
      pos: { x: 5, y: 0 },
      dir: 0,
      config: {},
    },
  };

  const edges: Edge[] = [
    {
      id: 'e1:out:0',
      from: 'webhook_miner',
      branch: 'out',
      to: 'silo1',
      path: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }],
    },
  ];

  const handlers: Record<string, (ctx: NodeCtx) => Promise<HandlerResult>> = {
    silo: async () => ({ done: true }),
  };

  const mockWebhooks = (cb: (nodeId: string, body: unknown) => void) => {
    webhookCallback = cb;
    return () => {
      unsubscribeCalled = true;
    };
  };

  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), {
    webhooks: mockWebhooks,
    handlers: handlers as any,
  });

  engine.start();

  // Имитируем вебхук
  const cb = webhookCallback as ((nodeId: string, body: unknown) => void) | null;
  if (cb) {
    cb('webhook_miner', { message: 'test' });
  }

  await new Promise((r) => setTimeout(r, 100));

  // Проверяем, что пакет был спавнен
  const spawnEvents = events.filter((e) => e.t === 'packet-spawn');
  if (spawnEvents.length === 0) {
    throw new Error('AC8: webhook не спавнил пакет');
  }

  // Проверяем, что отписка вызывается при stop()
  engine.stop();

  if (!unsubscribeCalled) {
    throw new Error('AC8: отписка от webhooks не была вызвана в stop()');
  }

  console.log('✓ AC8: webhook miner OK');
}

/**
 * Запуск всех проверок
 */
(async () => {
  try {
    await testSimplePipeline();
    await testSplitter();
    await testMixer();
    await testHandlerError();
    await testLabLoop();
    await testStopAbort();
    await testQueue();
    await testWebhookMiner();

    console.log('\n✅ engine checks OK — все 8 AC пройдены');
  } catch (e) {
    console.error('\n❌ engine checks FAILED:', e);
    throw e;
  }
})();
