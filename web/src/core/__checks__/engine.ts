import { Engine, HandlerResult, NodeCtx } from '../engine';
import { Transport, Entity, Edge, Packet, EngineEvent } from '../types';
import { minerHandler } from '../nodes/miner';

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
 * AC2: duplicator ведёт пакеты по true/false согласно условию
 */
async function testDuplicator() {
  const events: EngineEvent[] = [];

  const entities: Record<string, Entity> = {
    miner1: {
      id: 'miner1',
      kind: 'miner',
      pos: { x: 0, y: 0 },
      dir: 0,
      config: { mode: 'text', text: 'data' },
    },
    duplicator1: {
      id: 'duplicator1',
      kind: 'duplicator',
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
      to: 'duplicator1',
      path: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }],
    },
    {
      id: 'e2:true:0',
      from: 'duplicator1',
      branch: 'true',
      to: 'silo_true',
      path: [{ x: 6, y: -1 }, { x: 7, y: -1 }, { x: 8, y: -1 }, { x: 9, y: -1 }],
    },
    {
      id: 'e3:false:0',
      from: 'duplicator1',
      branch: 'false',
      to: 'silo_false',
      path: [{ x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }, { x: 9, y: 1 }],
    },
  ];

  const handlers: Record<string, (ctx: NodeCtx) => Promise<HandlerResult>> = {
    duplicator: async (ctx) => {
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
    throw new Error('AC2: duplicator не отправил пакет в silo_true');
  }

  console.log('✓ AC2: duplicator branching OK');
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
 * AC9 (B5): сундук выпускает пачку ровно на batchSize.
 * Недобор — result-событие с прогрессом у chest (включая накопленные `items`,
 * инспектор должен видеть их все, не только последний); набралось batchSize —
 * ещё один result у chest (`flushed: true`, полный список) и один result у silo
 * с массивом всех накопленных payload'ов.
 */
async function testChestBatch() {
  const events: EngineEvent[] = [];

  const entities: Record<string, Entity> = {
    miner1: { id: 'miner1', kind: 'miner', pos: { x: 0, y: 0 }, dir: 0, config: { mode: 'text', text: 'item-0' } },
    miner2: { id: 'miner2', kind: 'miner', pos: { x: 0, y: 3 }, dir: 0, config: { mode: 'text', text: 'item-1' } },
    miner3: { id: 'miner3', kind: 'miner', pos: { x: 0, y: 6 }, dir: 0, config: { mode: 'text', text: 'item-2' } },
    chest1: { id: 'chest1', kind: 'chest', pos: { x: 5, y: 3 }, dir: 0, config: { batchSize: 3 } },
    silo1: { id: 'silo1', kind: 'silo', pos: { x: 10, y: 3 }, dir: 0, config: {} },
  };

  const edges: Edge[] = [
    { id: 'e1:out:0', from: 'miner1', branch: 'out', to: 'chest1', path: [{ x: 1, y: 0 }, { x: 5, y: 3 }] },
    { id: 'e2:out:0', from: 'miner2', branch: 'out', to: 'chest1', path: [{ x: 1, y: 3 }, { x: 5, y: 3 }] },
    { id: 'e3:out:0', from: 'miner3', branch: 'out', to: 'chest1', path: [{ x: 1, y: 6 }, { x: 5, y: 3 }] },
    { id: 'e4:out:0', from: 'chest1', branch: 'out', to: 'silo1', path: [{ x: 6, y: 3 }, { x: 10, y: 3 }] },
  ];

  const handlers: Record<string, (ctx: NodeCtx) => Promise<HandlerResult>> = {
    chest: async (ctx) => ({ out: ctx.data }),
    silo: async () => ({ done: true }),
  };

  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), {
    handlers: handlers as any,
  });

  engine.start();
  engine.triggerMiner('miner1');
  engine.triggerMiner('miner2');
  engine.triggerMiner('miner3');

  await new Promise((r) => setTimeout(r, 100));
  engine.stop();

  const chestResults = events.filter(
    (e): e is Extract<EngineEvent, { t: 'result' }> => e.t === 'result' && e.nodeId === 'chest1'
  );
  if (chestResults.length !== 3) {
    throw new Error(`AC9: ожидались 2 промежуточных result + 1 flush у chest, получено ${chestResults.length}`);
  }
  const buffered = chestResults.map((e) => (e.data as { buffered: number }).buffered);
  if (buffered[0] !== 1 || buffered[1] !== 2 || buffered[2] !== 3) {
    throw new Error(`AC9: неверный прогресс буфера: ${buffered.join(',')}`);
  }
  // Инспектор должен видеть ВСЕ накопленные items на каждом шаге, а не только последний
  const itemsProgression = chestResults.map((e) => (e.data as { items: unknown[] }).items);
  if (itemsProgression[0].length !== 1 || itemsProgression[1].length !== 2 || itemsProgression[2].length !== 3) {
    throw new Error(`AC9: неверная длина items по шагам: ${itemsProgression.map((i) => i.length).join(',')}`);
  }
  const lastFlush = chestResults[2].data as { flushed?: boolean; items: unknown[] };
  if (lastFlush.flushed !== true) {
    throw new Error('AC9: последний result у chest должен быть помечен flushed: true');
  }
  if (JSON.stringify([...lastFlush.items].sort()) !== JSON.stringify(['item-0', 'item-1', 'item-2'])) {
    throw new Error(`AC9: неверное содержимое финального items: ${JSON.stringify(lastFlush.items)}`);
  }

  const siloResults = events.filter(
    (e): e is Extract<EngineEvent, { t: 'result' }> => e.t === 'result' && e.nodeId === 'silo1'
  );
  if (siloResults.length !== 1) {
    throw new Error(`AC9: ожидался ровно 1 result у silo (пачка на batchSize), получено ${siloResults.length}`);
  }
  const batch = siloResults[0].data as unknown[];
  if (batch.length !== 3) {
    throw new Error(`AC9: пачка должна содержать 3 элемента, получено ${batch.length}`);
  }
  const sorted = [...batch].sort();
  if (JSON.stringify(sorted) !== JSON.stringify(['item-0', 'item-1', 'item-2'])) {
    throw new Error(`AC9: неверное содержимое пачки: ${JSON.stringify(batch)}`);
  }

  console.log('✓ AC9: chest batch exact on batchSize OK');
}

/**
 * AC10 (E1): энергослой — включается только при наличии аккумулятора на карте,
 * недобор заряда держит пакет в очереди с 'Нет питания' (не роняет его как ошибку),
 * rechargeEnergy() разблокирует на следующей 2с-попытке.
 */
async function testEnergyLayer() {
  const events: EngineEvent[] = [];

  const entities: Record<string, Entity> = {
    acc1: { id: 'acc1', kind: 'accumulator', pos: { x: 0, y: 5 }, dir: 0, config: { capacity: 15 } },
    miner1: { id: 'miner1', kind: 'miner', pos: { x: 0, y: 0 }, dir: 0, config: { mode: 'text', text: 'x' } },
    silo1: { id: 'silo1', kind: 'silo', pos: { x: 5, y: 0 }, dir: 0, config: {} },
  };

  const edges: Edge[] = [
    {
      id: 'e1:out:0',
      from: 'miner1',
      branch: 'out',
      to: 'silo1',
      path: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }],
    },
  ];

  const handlers: Record<string, (ctx: NodeCtx) => Promise<HandlerResult>> = {
    silo: async () => ({ done: true }),
  };

  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), {
    handlers: handlers as any,
  });

  engine.start();

  // Стартовый заряд полный (15), эмитится сразу в start()
  const energyEvents = () =>
    events.filter((e): e is Extract<EngineEvent, { t: 'energy' }> => e.t === 'energy');
  const initial = energyEvents()[0];
  if (!initial || initial.charge !== 15 || initial.capacity !== 15) {
    throw new Error(`AC10: неверный старт энергии: ${JSON.stringify(initial)}`);
  }

  // silo — механический, стоит 10: заряда (15) хватает → 15-10=5
  engine.triggerMiner('miner1');
  await new Promise((r) => setTimeout(r, 100));

  const resultsAfterFirst = events.filter((e) => e.t === 'result');
  if (resultsAfterFirst.length !== 1) {
    throw new Error(`AC10: первый пакет должен пройти (заряда хватало), result=${resultsAfterFirst.length}`);
  }

  // Второй пакет: осталось 5, нужно 10 → блокируется с 'Нет питания', не проходит
  engine.triggerMiner('miner1');
  await new Promise((r) => setTimeout(r, 100));

  const noPowerEvents = events.filter(
    (e) => e.t === 'node-status' && e.status === 'error' && e.error === 'Нет питания'
  );
  if (noPowerEvents.length === 0) {
    throw new Error('AC10: второй пакет должен встать с "Нет питания" при недоборе заряда');
  }
  if (events.filter((e) => e.t === 'result').length !== 1) {
    throw new Error('AC10: второй пакет не должен пройти раньше времени (заряда не хватает)');
  }

  // Подзаряжаем — на следующей 2с-попытке пакет должен пройти
  engine.rechargeEnergy();
  await new Promise((r) => setTimeout(r, 2200));
  engine.stop();

  const resultsAfterRecharge = events.filter((e) => e.t === 'result');
  if (resultsAfterRecharge.length !== 2) {
    throw new Error(`AC10: после rechargeEnergy() второй пакет должен пройти, result=${resultsAfterRecharge.length}`);
  }

  console.log('✓ AC10: energy layer — недобор блокирует, recharge разблокирует OK');
}

/**
 * AC11 (E2): модуль 'memory' у assembler получает снапшот того, что уже накопилось
 * в буфере chest (ещё не уехавшая пачка) — движок собирает его из this.buffers.
 */
async function testAssemblerMemorySnapshot() {
  const entities: Record<string, Entity> = {
    minerA: { id: 'minerA', kind: 'miner', pos: { x: 0, y: 0 }, dir: 0, config: { mode: 'text', text: 'note-A' } },
    minerB: { id: 'minerB', kind: 'miner', pos: { x: 0, y: 3 }, dir: 0, config: { mode: 'text', text: 'note-B' } },
    minerC: { id: 'minerC', kind: 'miner', pos: { x: 0, y: 6 }, dir: 0, config: { mode: 'text', text: 'trigger' } },
    chest1: { id: 'chest1', kind: 'chest', pos: { x: 5, y: 0 }, dir: 0, config: { batchSize: 5 } }, // не наберётся за тест
    assembler1: { id: 'assembler1', kind: 'assembler', pos: { x: 5, y: 6 }, dir: 0, config: { modules: ['memory'] } },
    silo1: { id: 'silo1', kind: 'silo', pos: { x: 10, y: 6 }, dir: 0, config: {} },
  };

  const edges: Edge[] = [
    { id: 'eA:out:0', from: 'minerA', branch: 'out', to: 'chest1', path: [{ x: 1, y: 0 }, { x: 5, y: 0 }] },
    { id: 'eB:out:0', from: 'minerB', branch: 'out', to: 'chest1', path: [{ x: 1, y: 3 }, { x: 5, y: 0 }] },
    { id: 'eC:out:0', from: 'minerC', branch: 'out', to: 'assembler1', path: [{ x: 1, y: 6 }, { x: 5, y: 6 }] },
    { id: 'eD:out:0', from: 'assembler1', branch: 'out', to: 'silo1', path: [{ x: 6, y: 6 }, { x: 10, y: 6 }] },
  ];

  let capturedMemory: unknown[] | undefined;
  const handlers: Record<string, (ctx: NodeCtx) => Promise<HandlerResult>> = {
    assembler: async (ctx) => {
      capturedMemory = ctx.memory;
      return { out: 'ok' };
    },
    silo: async () => ({ done: true }),
  };

  const engine = new Engine(entities, edges, fakeTransport, () => {}, {
    handlers: handlers as any,
  });

  engine.start();

  // Наполняем chest1 двумя пакетами (batchSize=5 — пачка не соберётся, оба остаются в буфере)
  engine.triggerMiner('minerA');
  await new Promise((r) => setTimeout(r, 50));
  engine.triggerMiner('minerB');
  await new Promise((r) => setTimeout(r, 50));

  // Триггерим assembler — он должен увидеть текущий буфер chest как ctx.memory
  engine.triggerMiner('minerC');
  await new Promise((r) => setTimeout(r, 50));
  engine.stop();

  if (!capturedMemory) {
    throw new Error('AC11: ctx.memory не был передан assembler-у с модулем memory');
  }
  const sorted = [...capturedMemory].sort();
  if (JSON.stringify(sorted) !== JSON.stringify(['note-A', 'note-B'])) {
    throw new Error(`AC11: неверный снапшот памяти: ${JSON.stringify(capturedMemory)}`);
  }

  console.log('✓ AC11: assembler memory-снапшот из буфера chest OK');
}

/**
 * AC12 (фикс бага E1): cost > capacity — ждать нечего, recharge не поможет
 * (заряжает только до capacity). Должна быть мгновенная ошибка станка,
 * а не бесконечный ретрай «Нет питания».
 */
async function testEnergyCapacityInsufficient() {
  const events: EngineEvent[] = [];

  const entities: Record<string, Entity> = {
    // capacity=50 заведомо меньше cost assembler-а даже на короткий текст (sizeHint/4+400 > 400)
    acc1: { id: 'acc1', kind: 'accumulator', pos: { x: 0, y: 5 }, dir: 0, config: { capacity: 50 } },
    miner1: { id: 'miner1', kind: 'miner', pos: { x: 0, y: 0 }, dir: 0, config: { mode: 'text', text: 'x' } },
    assembler1: { id: 'assembler1', kind: 'assembler', pos: { x: 0, y: 2 }, dir: 0, config: { modules: [] } },
  };

  const edges: Edge[] = [
    { id: 'e1:out:0', from: 'miner1', branch: 'out', to: 'assembler1', path: [{ x: 0, y: 1 }] },
  ];

  const handlers: Record<string, (ctx: NodeCtx) => Promise<HandlerResult>> = {
    assembler: async (ctx) => ({ out: `echo:${ctx.data}` }),
  };

  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), {
    llm: async () => 'unused',
    handlers: handlers as any,
  });

  engine.start();
  engine.triggerMiner('miner1');

  // Без capacity-guard'а тут был бы бесконечный цикл 2с-ретраев; ждём заведомо
  // меньше одного ретрая, чтобы убедиться, что ошибка пришла сразу, а не через retry-loop.
  await new Promise((r) => setTimeout(r, 300));
  engine.stop();

  const noPowerRetries = events.filter(
    (e) => e.t === 'node-status' && e.status === 'error' && e.error === 'Нет питания'
  );
  if (noPowerRetries.length > 0) {
    throw new Error('AC12: недостаточная ёмкость не должна уходить в ретрай-цикл "Нет питания"');
  }

  const capacityErrors = events.filter(
    (e) => e.t === 'node-status' && e.status === 'error' && e.error?.includes('ёмкости аккумулятора')
  );
  if (capacityErrors.length !== 1) {
    throw new Error(`AC12: ожидалась ровно одна ошибка про ёмкость аккумулятора, получено ${capacityErrors.length}`);
  }

  const drops = events.filter((e) => e.t === 'packet-drop' && e.reason === 'error');
  if (drops.length !== 1) {
    throw new Error(`AC12: пакет должен дропнуться с reason:'error', drops=${drops.length}`);
  }

  console.log('✓ AC12: недобор ёмкости (не только заряда) — мгновенная ошибка, не вечный ретрай');
}

/**
 * AC13: регрессия бага "miner mode='url' не фетчит, шлёт сырую строку URL как данные".
 * spawnPacket раньше формировал payload сам (config.url как строка), в обход
 * deps.handlers.miner (реальный minerHandler с proxyFetch) — здесь используем
 * настоящий minerHandler через deps.handlers, как это делает runtime.ts в браузере.
 */
async function testMinerUrlThroughSpawnPacket() {
  const events: EngineEvent[] = [];

  const entities: Record<string, Entity> = {
    miner1: {
      id: 'miner1',
      kind: 'miner',
      pos: { x: 0, y: 0 },
      dir: 0,
      config: { mode: 'url', url: 'https://example.com/data' },
    },
    assembler1: {
      id: 'assembler1',
      kind: 'assembler',
      pos: { x: 5, y: 0 },
      dir: 0,
      config: {},
    },
  };

  const edges: Edge[] = [
    { id: 'e1:out:0', from: 'miner1', branch: 'out', to: 'assembler1', path: [{ x: 1, y: 0 }] },
  ];

  let receivedByAssembler: unknown;
  const handlers: Record<string, (ctx: NodeCtx) => Promise<HandlerResult>> = {
    miner: minerHandler,
    assembler: async (ctx) => {
      receivedByAssembler = ctx.data;
      return { out: 'ok' };
    },
  };

  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), {
    proxyFetch: async (req) => {
      if (req.url === 'https://example.com/data' && req.method === 'GET') {
        return { status: 200, body: 'Content from URL' };
      }
      return { status: 404, body: null };
    },
    handlers: handlers as any,
  });

  engine.start();
  engine.triggerMiner('miner1');

  // miner держит минимум working ~2.7с (core/nodes/miner.ts MIN_WORK_MS, тот же
  // принцип, что у silo LAUNCH_MS) — ждём с запасом.
  await new Promise((r) => setTimeout(r, 3200));
  engine.stop();

  if (receivedByAssembler !== 'Content from URL') {
    throw new Error(
      `AC13: assembler должен получить содержимое URL через proxyFetch, получил: ${JSON.stringify(receivedByAssembler)}`
    );
  }

  const minerOkStatus = events.some(
    (e) => e.t === 'node-status' && e.nodeId === 'miner1' && e.status === 'ok'
  );
  if (!minerOkStatus) {
    throw new Error('AC13: miner должен получить node-status ok после успешного fetch');
  }

  console.log("✓ AC13: miner mode='url' идёт через реальный proxyFetch (регрессия бага)");
}

/**
 * AC14 (фикс бага «фоновая вкладка»): setPaused(true) должен останавливать
 * и interval-шахту, и вебхук-шахту — новые пакеты не спавнятся, пока пауза
 * активна (backlog не растёт, пока рендер, привязанный к rAF, тоже стоит).
 * setPaused(false) — обычный поток продолжается, ничего не потеряно навсегда
 * (кроме события вебхука, пришедшего строго во время паузы — это ожидаемо,
 * docs/04 не даёт гарантий доставки вебхуков).
 */
async function testPauseStopsNewSpawns() {
  const events: EngineEvent[] = [];
  let webhookCallback: ((nodeId: string, body: unknown) => void) | null = null;

  const entities: Record<string, Entity> = {
    // intervalSec настолько мал, что за тест таймер тикнет несколько раз —
    // если пауза не держит, увидим лишние packet-spawn от миner1.
    miner1: {
      id: 'miner1',
      kind: 'miner',
      pos: { x: 0, y: 0 },
      dir: 0,
      config: { mode: 'text', text: 'x', intervalSec: 0.03 },
    },
    webhook_miner: {
      id: 'webhook_miner',
      kind: 'miner',
      pos: { x: 0, y: 3 },
      dir: 0,
      config: { mode: 'webhook' },
    },
  };

  const edges: Edge[] = [];

  const mockWebhooks = (cb: (nodeId: string, body: unknown) => void) => {
    webhookCallback = cb;
    return () => {};
  };

  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), {
    webhooks: mockWebhooks,
  });

  engine.start();

  // Пауза сразу — имитируем скрытую вкладку с самого начала прогона.
  engine.setPaused(true);

  await new Promise((r) => setTimeout(r, 150)); // интервал успел бы тикнуть ~5 раз

  const cb = webhookCallback as ((nodeId: string, body: unknown) => void) | null;
  cb?.('webhook_miner', { message: 'while paused' });
  await new Promise((r) => setTimeout(r, 20));

  const spawnsWhilePaused = events.filter((e) => e.t === 'packet-spawn').length;
  if (spawnsWhilePaused > 0) {
    throw new Error(
      `AC14: пока paused=true, новых пакетов быть не должно, получено ${spawnsWhilePaused}`
    );
  }

  // Снимаем паузу — интервал и вебхук снова должны спавнить.
  engine.setPaused(false);
  await new Promise((r) => setTimeout(r, 150));
  cb?.('webhook_miner', { message: 'after resume' });
  await new Promise((r) => setTimeout(r, 20));

  engine.stop();

  const spawnsAfterResume = events.filter((e) => e.t === 'packet-spawn').length;
  if (spawnsAfterResume === 0) {
    throw new Error('AC14: после setPaused(false) шахты должны снова спавнить пакеты');
  }

  console.log('✓ AC14: setPaused(true) держит спавн шахт (interval + webhook), false — резюмирует');
}

/**
 * AC15: кольцо лент (edge.to=null + loopFrom) — предмет гоняется по петле, НЕ дропается.
 */
async function testBeltLoop() {
  const events: EngineEvent[] = [];
  let moveCount = 0;
  const countingTransport: Transport = {
    move: async () => { moveCount++; await new Promise((r) => setTimeout(r, 10)); },
    clear: () => {},
  };

  const entities: Record<string, Entity> = {
    miner1: { id: 'miner1', kind: 'miner', pos: { x: 0, y: 0 }, dir: 0, config: { mode: 'text', text: 'x' } },
  };
  // Кольцо: to=null, но loopFrom задан → движок зацикливает
  const edges: Edge[] = [
    {
      id: 'e1:out:0',
      from: 'miner1',
      branch: 'out',
      to: null,
      path: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 1 }],
      loopFrom: 0,
    },
  ];

  const engine = new Engine(entities, edges, countingTransport, (e) => events.push(e), {});
  engine.start();
  engine.triggerMiner('miner1');

  await new Promise((r) => setTimeout(r, 80)); // несколько кругов
  engine.stop();
  await new Promise((r) => setTimeout(r, 20));

  const drops = events.filter((e) => e.t === 'packet-drop' && e.reason === 'dead-end');
  if (drops.length > 0) {
    throw new Error('AC15: зацикленный предмет НЕ должен дропаться как dead-end');
  }
  if (moveCount < 2) {
    throw new Error(`AC15: предмет должен гоняться по петле (несколько move), было ${moveCount}`);
  }
  console.log(`✓ AC15: belt loop — предмет циркулирует, не дропается (${moveCount} кругов)`);
}

/**
 * AC16: дублер (два выхода одной branch 'out') — движок спавнит клон на КАЖДЫЙ edge,
 * обе копии доходят независимо (оба silo получают result).
 */
async function testDuplicatorTwoCopies() {
  const events: EngineEvent[] = [];

  const entities: Record<string, Entity> = {
    miner1: { id: 'miner1', kind: 'miner', pos: { x: 0, y: 0 }, dir: 0, config: { mode: 'text', text: 'x' } },
    dup1: { id: 'dup1', kind: 'duplicator', pos: { x: 5, y: 0 }, dir: 0, config: {} },
    siloA: { id: 'siloA', kind: 'silo', pos: { x: 10, y: -1 }, dir: 0, config: {} },
    siloB: { id: 'siloB', kind: 'silo', pos: { x: 10, y: 1 }, dir: 0, config: {} },
  };
  // Два выхода дублера — оба branch 'out'
  const edges: Edge[] = [
    { id: 'e1:out:0', from: 'miner1', branch: 'out', to: 'dup1', path: [{ x: 1, y: 0 }, { x: 4, y: 0 }] },
    { id: 'e2:out:0', from: 'dup1', branch: 'out', to: 'siloA', path: [{ x: 6, y: -1 }, { x: 9, y: -1 }] },
    { id: 'e2:out:1', from: 'dup1', branch: 'out', to: 'siloB', path: [{ x: 6, y: 1 }, { x: 9, y: 1 }] },
  ];

  const handlers: Record<string, (ctx: NodeCtx) => Promise<HandlerResult>> = {
    duplicator: async (ctx) => ({ out: ctx.data }),
    silo: async () => ({ done: true }),
  };

  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), { handlers: handlers as any });
  engine.start();
  engine.triggerMiner('miner1');
  await new Promise((r) => setTimeout(r, 120));
  engine.stop();

  const results = events.filter((e): e is Extract<EngineEvent, { t: 'result' }> => e.t === 'result');
  const gotA = results.some((e) => e.nodeId === 'siloA');
  const gotB = results.some((e) => e.nodeId === 'siloB');
  if (!gotA || !gotB) {
    throw new Error(`AC16: обе копии должны дойти (siloA=${gotA}, siloB=${gotB})`);
  }
  // Спавнов от дублера должно быть 2 (по клону на каждый выход), с разными id
  const dupSpawns = events.filter((e): e is Extract<EngineEvent, { t: 'packet-spawn' }> =>
    e.t === 'packet-spawn' && e.at.x === 5 && e.at.y === 0);
  const ids = new Set(dupSpawns.map((e) => e.packet.id));
  if (ids.size < 2) {
    throw new Error(`AC16: дублер должен спавнить 2 клона с разными id, получено ${ids.size}`);
  }
  console.log('✓ AC16: duplicator — обе копии независимо доходят до выходов');
}

/**
 * AC17 (фиксы код-ревью): webhook-шахта без payload (ручной триггер) — data=undefined
 * не роняет spawnPacket (JSON.stringify(undefined) возвращал undefined, .length кидал
 * TypeError вне try/catch), а клоны на два выхода шахты получают РАЗНЫЕ id
 * (общий id вешал одну из веток в GameTransport.move — замена спрайта без resolve).
 */
async function testMinerUndefinedDataFreshIds() {
  const events: EngineEvent[] = [];

  const entities: Record<string, Entity> = {
    miner1: { id: 'miner1', kind: 'miner', pos: { x: 0, y: 0 }, dir: 0, config: { mode: 'webhook' } },
    siloA: { id: 'siloA', kind: 'silo', pos: { x: 5, y: 0 }, dir: 0, config: {} },
    siloB: { id: 'siloB', kind: 'silo', pos: { x: 5, y: 5 }, dir: 0, config: {} },
  };
  const edges: Edge[] = [
    { id: 'eA:out:0', from: 'miner1', branch: 'out', to: 'siloA', path: [{ x: 1, y: 0 }] },
    { id: 'eB:out:1', from: 'miner1', branch: 'out', to: 'siloB', path: [{ x: 1, y: 1 }] },
  ];
  // Стаб вместо реального minerHandler: тот держит MIN_WORK_MS≈2.7с визуальной паузы,
  // а суть та же — mode='webhook' без payload возвращает { out: ctx.data } = undefined.
  const handlers: Record<string, (ctx: any) => Promise<HandlerResult>> = {
    miner: async (ctx) => ({ out: ctx.data }),
    silo: async () => ({ done: true }),
  };

  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), {
    handlers: handlers as any,
  });

  engine.start();
  engine.triggerMiner('miner1'); // ручной триггер → webhookBody === undefined

  await new Promise((r) => setTimeout(r, 100));
  engine.stop();

  const spawns = events.filter((e) => e.t === 'packet-spawn');
  if (spawns.length === 0) {
    throw new Error('AC17: spawn с data=undefined должен пройти без TypeError');
  }
  const consumes = events.filter((e): e is Extract<EngineEvent, { t: 'packet-consume' }> =>
    e.t === 'packet-consume');
  const ids = new Set(consumes.map((e) => e.packetId));
  if (ids.size < 2) {
    throw new Error(`AC17: клоны на два выхода шахты должны иметь разные id, получено ${ids.size}`);
  }

  console.log('✓ AC17: miner undefined-data spawn + свежие id клонов на каждый выход');
}

/**
 * AC18: режим отладки (setDebugMode/step) — пакет проходит РОВНО по одному gate за step(),
 * дальше ничего не движется, пока не нажали Step; setDebugMode(false) снимает режим.
 * Пайплайн miner→assembler→silo даёт ровно 4 ворот: spawn у шахты, consume у assembler,
 * spawn assembler→silo, consume у silo (после которого сразу идёт result, без своих ворот).
 */
async function testDebugStepMode() {
  const events: EngineEvent[] = [];

  const entities: Record<string, Entity> = {
    miner1: { id: 'miner1', kind: 'miner', pos: { x: 0, y: 0 }, dir: 0, config: { mode: 'text', text: 'x' } },
    assembler1: { id: 'assembler1', kind: 'assembler', pos: { x: 5, y: 0 }, dir: 0, config: {} },
    silo1: { id: 'silo1', kind: 'silo', pos: { x: 10, y: 0 }, dir: 0, config: {} },
  };
  const edges: Edge[] = [
    { id: 'e1:out:0', from: 'miner1', branch: 'out', to: 'assembler1', path: [{ x: 1, y: 0 }, { x: 4, y: 0 }] },
    { id: 'e2:out:0', from: 'assembler1', branch: 'out', to: 'silo1', path: [{ x: 6, y: 0 }, { x: 9, y: 0 }] },
  ];
  const handlers: Record<string, (ctx: NodeCtx) => Promise<HandlerResult>> = {
    assembler: async () => ({ out: 'processed' }),
    silo: async () => ({ done: true }),
  };

  const engine = new Engine(entities, edges, fakeTransport, (e) => events.push(e), {
    handlers: handlers as any,
  });

  engine.start();
  engine.setDebugMode(true);
  engine.triggerMiner('miner1');

  await new Promise((r) => setTimeout(r, 40));
  if (events.length > 0) {
    throw new Error(`AC18: в debug-режиме ничего не должно случиться до первого step(), получено ${events.length} событий`);
  }

  engine.step(); // ворота A: spawn у шахты
  await new Promise((r) => setTimeout(r, 30));
  let spawns = events.filter((e) => e.t === 'packet-spawn').length;
  if (spawns !== 1) throw new Error(`AC18: после 1-го step ожидался 1 packet-spawn, получено ${spawns}`);
  if (events.some((e) => e.t === 'packet-consume')) {
    throw new Error('AC18: consume не должен случиться раньше своего step()');
  }

  engine.step(); // ворота B: consume у assembler
  await new Promise((r) => setTimeout(r, 30));
  const consumesAtAssembler = events.filter(
    (e) => e.t === 'packet-consume' && e.nodeId === 'assembler1'
  ).length;
  if (consumesAtAssembler !== 1) {
    throw new Error(`AC18: после 2-го step ожидался consume у assembler1, получено ${consumesAtAssembler}`);
  }
  if (events.some((e) => e.t === 'result')) {
    throw new Error('AC18: result не должен появиться раньше 4-го step()');
  }

  engine.step(); // ворота C: spawn assembler → silo
  await new Promise((r) => setTimeout(r, 30));
  spawns = events.filter((e) => e.t === 'packet-spawn').length;
  if (spawns !== 2) throw new Error(`AC18: после 3-го step ожидались 2 packet-spawn, получено ${spawns}`);

  engine.step(); // ворота D: consume у silo → сразу done/result
  await new Promise((r) => setTimeout(r, 30));
  const siloResults = events.filter((e) => e.t === 'result' && e.nodeId === 'silo1');
  if (siloResults.length !== 1) {
    throw new Error(`AC18: после 4-го step ожидался result у silo1, получено ${siloResults.length}`);
  }

  // setDebugMode(false) снимает режим — дальнейшие вбросы идут без ворот, как обычно
  engine.setDebugMode(false);
  events.length = 0;
  engine.triggerMiner('miner1');
  await new Promise((r) => setTimeout(r, 60));
  if (!events.some((e) => e.t === 'result' && e.nodeId === 'silo1')) {
    throw new Error('AC18: после setDebugMode(false) пайплайн должен снова доезжать до result без step()');
  }

  engine.stop();
  console.log('✓ AC18: debug pause/step OK');
}

/**
 * Запуск всех проверок
 */
(async () => {
  try {
    await testSimplePipeline();
    await testDuplicator();
    await testMixer();
    await testHandlerError();
    await testLabLoop();
    await testStopAbort();
    await testQueue();
    await testWebhookMiner();
    await testChestBatch();
    await testEnergyLayer();
    await testAssemblerMemorySnapshot();
    await testEnergyCapacityInsufficient();
    await testMinerUrlThroughSpawnPacket();
    await testPauseStopsNewSpawns();
    await testBeltLoop();
    await testDuplicatorTwoCopies();
    await testMinerUndefinedDataFreshIds();
    await testDebugStepMode();

    console.log('\n✅ engine checks OK — все 18 AC пройдены');
  } catch (e) {
    console.error('\n❌ engine checks FAILED:', e);
    throw e;
  }
})();
