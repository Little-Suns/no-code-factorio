import { Entity, Edge, Packet, Transport, EngineEvent, ItemType } from './types';
import { tpl } from './tpl';
import { NODE_DEFS } from './nodes';

// Контракты NodeCtx/Handler — ровно по docs/05 (B4 пишет хендлеры против них)
export interface LlmRequest { system?: string; prompt: string; tools?: string[]; nodeId?: string }
export interface ProxyRequest { url: string; method?: string; headers?: Record<string, string>; body?: string }

export interface NodeCtx {
  config: Record<string, unknown>;
  data: unknown;                        // payload пакета; у mixer — массив
  tpl(s: string): string;
  llm(req: LlmRequest): Promise<string>;
  proxyFetch(req: ProxyRequest): Promise<{ status: number; body: unknown }>;
  memory?: unknown[];                   // E2: снапшот содержимого сундуков (модуль 'memory')
}

export type HandlerResult =
  | { out: unknown }
  | { branch: 'true' | 'false' | 'pass' | 'rework'; out: unknown }
  | { done: true };

export type Handler = (ctx: NodeCtx) => Promise<HandlerResult>;

export interface EngineDeps {
  llm?: NodeCtx['llm'];
  proxyFetch?: NodeCtx['proxyFetch'];
  webhooks?: (cb: (nodeId: string, body: unknown) => void) => () => void;
  handlers?: Partial<Record<string, Handler>>;
}

/**
 * Движок исполнения фабрики.
 * Управляет жизненным циклом пакетов: spawn → move → deliver → process → emit result.
 */
export class Engine {
  private queues = new Map<string, Promise<void>>();
  private buffers = new Map<string, Map<string, Packet[]>>();
  private abortController = new AbortController();
  private running = new Set<Promise<void>>();
  private intervals: ReturnType<typeof setInterval>[] = [];
  private unsubscribeWebhooks: (() => void) | null = null;
  // Энергослой (E1, усиление): выключен, если на карте нет ни одного аккумулятора (docs/04)
  private energyEnabled = false;
  private energy = { charge: 0, capacity: 0 };

  constructor(
    private entities: Record<string, Entity>,
    private edges: Edge[],
    private transport: Transport,
    private emit: (e: EngineEvent) => void,
    private deps: EngineDeps = {},
  ) {}

  start(): void {
    // Запускаем интервалы для шахт с intervalSec > 0
    for (const entity of Object.values(this.entities)) {
      if (entity.kind === 'miner') {
        const intervalSec = (entity.config['intervalSec'] as number) || 0;
        if (intervalSec > 0) {
          // Без window.* — core обязан работать headless (tsx-проверки под node)
          const id = setInterval(() => {
            if (!this.abortController.signal.aborted) {
              this.triggerMiner(entity.id);
            }
          }, intervalSec * 1000);
          this.intervals.push(id);
        }
      }
    }

    // Подписываемся на вебхуки
    if (this.deps.webhooks) {
      this.unsubscribeWebhooks = this.deps.webhooks((nodeId, body) => {
        if (!this.abortController.signal.aborted) {
          // Найдём шахту с этим ID и спавним пакет с телом
          const miner = this.entities[nodeId];
          if (miner && miner.kind === 'miner') {
            void this.spawnPacket(body, miner);
          }
        }
      });
    }

    // Энергослой: включается, только если на карте есть хотя бы один аккумулятор
    const accumulators = Object.values(this.entities).filter((e) => e.kind === 'accumulator');
    if (accumulators.length > 0) {
      this.energyEnabled = true;
      this.energy.capacity = accumulators.reduce(
        (sum, a) => sum + (Number(a.config['capacity']) || 0),
        0
      );
      this.energy.charge = this.energy.capacity; // полный заряд на старте
      this.emit({ t: 'energy', charge: this.energy.charge, capacity: this.energy.capacity });
    }
  }

  /**
   * Пополнить энергию до максимума («Зарядить» в панели аккумулятора, docs/04).
   * Нет-оп, если энергослой выключен (аккумуляторов на карте нет).
   */
  rechargeEnergy(): void {
    if (!this.energyEnabled) return;
    this.energy.charge = this.energy.capacity;
    this.emit({ t: 'energy', charge: this.energy.charge, capacity: this.energy.capacity });
  }

  /**
   * Оценка расхода энергии станком перед вызовом handler (docs/04):
   * LLM-станки (могут звать ctx.llm) — по формуле от размера payload'а и модулей;
   * механические станки — константа 10.
   */
  private getEnergyCost(node: Entity, packet: Packet): number {
    const LLM_KINDS = new Set(['assembler', 'splitter', 'mixer', 'lab']);
    if (!LLM_KINDS.has(node.kind)) return 10;
    const modules = (node.config['modules'] as unknown[]) || [];
    return (packet.sizeHint / 4 + 400) * (1 + modules.length * 0.5);
  }

  /**
   * Ждёт, пока хватит энергии на станок; списывает и эмитит 'energy' при успехе.
   * Пакет держится в очереди узла (мьютекс уже держит caller, docs/04) — честный
   * видимый backpressure, «Нет питания» на лампе вместо тихого зависания.
   * Возвращает false, если stop() прервал ожидание.
   *
   * Если cost > capacity — ждать бессмысленно: rechargeEnergy() заряжает только
   * до capacity, зарядить выше некуда. Без этой проверки станок висел бы в ретраях
   * навечно (баг, найденный на дефолтной capacity=1000 и обычном тексте статьи —
   * cost для assembler легко превышает 1000). Кидаем — попадёт в общий catch
   * callHandler и обработается как любая другая ошибка хендлера (node-status error
   * + packet-drop), ровно как furnace/lab.
   */
  private async awaitPower(node: Entity, packet: Packet): Promise<boolean> {
    const cost = this.getEnergyCost(node, packet);
    if (cost > this.energy.capacity) {
      throw new Error(
        `Не хватает ёмкости аккумулятора: нужно ~${Math.round(cost)}, есть ${Math.round(this.energy.capacity)}`
      );
    }
    while (this.energy.charge < cost) {
      if (this.abortController.signal.aborted) return false;
      this.emit({ t: 'node-status', nodeId: node.id, status: 'error', error: 'Нет питания' });
      await new Promise((r) => setTimeout(r, 2000));
      if (this.abortController.signal.aborted) return false;
    }
    this.energy.charge -= cost;
    this.emit({ t: 'energy', charge: this.energy.charge, capacity: this.energy.capacity });
    return true;
  }

  /**
   * Снапшот содержимого всех сундуков на карте (модуль 'memory', E2) —
   * то, что уже накопилось в буфере chest (см. deliverToChest), но ещё не уехало пачкой.
   */
  private collectChestMemory(): unknown[] {
    const items: unknown[] = [];
    for (const entity of Object.values(this.entities)) {
      if (entity.kind !== 'chest') continue;
      const buffered = this.buffers.get(entity.id)?.get('items');
      if (buffered) {
        items.push(...buffered.map((p) => p.data));
      }
    }
    return items;
  }

  stop(): void {
    this.abortController.abort();

    // Очищаем интервалы
    for (const id of this.intervals) {
      clearInterval(id);
    }
    this.intervals = [];

    // Отписываемся от вебхуков
    if (this.unsubscribeWebhooks) {
      this.unsubscribeWebhooks();
      this.unsubscribeWebhooks = null;
    }

    // Чистим транспорт
    this.transport.clear();

    // Очищаем буферы смесителя
    this.buffers.clear();

    // Устанавливаем все узлы в idle
    for (const entity of Object.values(this.entities)) {
      this.emit({ t: 'node-status', nodeId: entity.id, status: 'idle' });
    }
  }

  triggerMiner(nodeId: string): void {
    const miner = this.entities[nodeId];
    if (!miner || miner.kind !== 'miner') return;
    if (this.abortController.signal.aborted) return;

    void this.spawnPacket(undefined, miner);
  }

  /**
   * Создаёт пакет из шахты и для каждого исходящего edge запускает цепочку доставки.
   * Payload определяется через minerHandler (deps.handlers.miner) — единая логика
   * с core/nodes/miner.ts, иначе mode='url' (proxyFetch) тут же расходится с ней
   * и остаётся нереализованным (баг: url молча улетал как сырая строка).
   */
  private async spawnPacket(webhookBody: unknown, miner: Entity): Promise<void> {
    let data: unknown;
    const handler = this.deps.handlers?.['miner'];

    if (handler) {
      const ctx: NodeCtx = {
        data: webhookBody,
        config: miner.config,
        tpl: (s: string) => tpl(s, webhookBody),
        llm: this.deps.llm ?? (async () => { throw new Error('LLM недоступен (нет deps.llm)'); }),
        proxyFetch: this.deps.proxyFetch ?? (async () => { throw new Error('proxyFetch недоступен'); }),
      };
      this.emit({ t: 'node-status', nodeId: miner.id, status: 'working' });
      try {
        const result = await handler(ctx);
        data = 'out' in result ? result.out : undefined;
      } catch (e) {
        if (!this.abortController.signal.aborted) {
          this.emit({
            t: 'node-status',
            nodeId: miner.id,
            status: 'error',
            error: e instanceof Error ? e.message : String(e),
          });
        }
        return;
      }
      if (this.abortController.signal.aborted) return;
      this.emit({ t: 'node-status', nodeId: miner.id, status: 'ok' });
    } else {
      // Защитный фолбэк на случай отсутствия handler'а в deps (напр. тесты без него) —
      // повторяет только text/webhook, т.к. url без proxyFetch реализовать нечем.
      const mode = (miner.config['mode'] as string) || 'text';
      data = mode === 'webhook' ? webhookBody : miner.config['text'] || '';
    }

    // Создаём базовый пакет
    const packet: Packet = {
      id: `pkt-${crypto.randomUUID().slice(0, 8)}`,
      data,
      item: 'text',
      sizeHint: JSON.stringify(data).length,
      ttl: 64,
    };

    this.emit({
      t: 'packet-spawn',
      packet,
      at: miner.pos,
    });

    // Для каждого исходящего edge: клонируем пакет и запускаем доставку
    const outgoingEdges = this.edges.filter((e) => e.from === miner.id);
    for (const edge of outgoingEdges) {
      const clonedPacket = { ...packet };
      const chain = this.deliverPacket(edge, clonedPacket);
      this.running.add(chain);
      chain.finally(() => this.running.delete(chain));
    }
  }

  /**
   * Цепочка доставки пакета по одному edge (move → deliver).
   */
  private async deliverPacket(edge: Edge, packet: Packet): Promise<void> {
    try {
      // Ждём, пока предмет доехал до конца пути
      await this.transport.move(packet.id, edge.path, packet.item, packet.sizeHint);

      if (this.abortController.signal.aborted) return;

      // Если это тупик — дропим
      if (edge.to === null) {
        this.emit({
          t: 'packet-drop',
          packetId: packet.id,
          reason: 'dead-end',
        });
        return;
      }

      // Иначе — доставляем в узел
      this.deliver(edge, packet);
    } catch (e) {
      if (!this.abortController.signal.aborted) {
        console.error('deliverPacket error:', e);
      }
    }
  }

  /**
   * Обработка пакета в узле.
   * Для смесителя — буферизация, иначе — очередь.
   */
  private deliver(edge: Edge, packet: Packet): void {
    const toNode = this.entities[edge.to!];
    if (!toNode) return;

    // Смеситель и сундук — специальная обработка (буферизация)
    if (toNode.kind === 'mixer') {
      this.deliverToMixer(toNode, edge, packet);
    } else if (toNode.kind === 'chest') {
      this.deliverToChest(toNode, packet);
    } else {
      // Остальные узлы — в очередь
      this.enqueuePacket(toNode, packet);
    }
  }

  /**
   * Доставка в сундук: копит пакеты во внутреннем буфере движка до batchSize (docs/05).
   * Недобор — станок не встаёт в очередь и не спавнит выход, но эмитит result
   * с прогрессом (видно в инспекторе, docs/00: «+result для инспектора»).
   * Полный набор — пропускается через обычный enqueuePacket/handler станка,
   * data при этом уже массив накопленных payload'ов.
   */
  private deliverToChest(chest: Entity, packet: Packet): void {
    if (!this.buffers.has(chest.id)) {
      this.buffers.set(chest.id, new Map());
    }
    const chestBuffer = this.buffers.get(chest.id)!;
    if (!chestBuffer.has('items')) {
      chestBuffer.set('items', []);
    }
    const items = chestBuffer.get('items')!;

    this.emit({ t: 'packet-consume', packetId: packet.id, nodeId: chest.id });
    this.emit({ t: 'node-status', nodeId: chest.id, status: 'working' });

    items.push(packet);

    const batchSize = Math.max(1, Number(chest.config['batchSize']) || 5);

    if (items.length < batchSize) {
      this.emit({ t: 'node-io', nodeId: chest.id, lastIn: packet.data });
      this.emit({ t: 'result', nodeId: chest.id, data: { buffered: items.length, batchSize } });
      this.emit({ t: 'node-status', nodeId: chest.id, status: 'ok' });
      return;
    }

    // Полная пачка собрана — сбрасываем буфер, дальше как обычный станок
    chestBuffer.set('items', []);
    const mergedPacket: Packet = {
      id: `pkt-${crypto.randomUUID().slice(0, 8)}`,
      data: items.map((p) => p.data),
      item: 'batch',
      sizeHint: items.reduce((sum, p) => sum + p.sizeHint, 0),
      ttl: Math.min(...items.map((p) => p.ttl)) - 1,
    };

    this.enqueuePacket(chest, mergedPacket);
  }

  /**
   * Доставка в смеситель: буферизация до получения от всех входов.
   */
  private deliverToMixer(mixer: Entity, edge: Edge, packet: Packet): void {
    // Получаем буфер смесителя
    if (!this.buffers.has(mixer.id)) {
      this.buffers.set(mixer.id, new Map());
    }
    const mixerBuffers = this.buffers.get(mixer.id)!;

    // Получаем входящие edge этого смесителя
    const incomingEdges = this.edges.filter((e) => e.to === mixer.id);
    if (incomingEdges.length === 0) {
      // Если не входов — обработаем как обычно
      this.enqueuePacket(mixer, packet);
      return;
    }

    // Кладём пакет в буфер по edge.id
    if (!mixerBuffers.has(edge.id)) {
      mixerBuffers.set(edge.id, []);
    }
    mixerBuffers.get(edge.id)!.push(packet);

    // Проверяем, собрана ли полная комплектация (по одному пакету от каждого входа)
    let isReady = true;
    const packets: Packet[] = [];

    for (const inEdge of incomingEdges) {
      const buf = mixerBuffers.get(inEdge.id);
      if (!buf || buf.length === 0) {
        isReady = false;
        break;
      }
      packets.push(buf[0]); // Берём первый пакет
    }

    if (!isReady) {
      // Ждём остальные пакеты
      return;
    }

    // Полный комплект собран — обрабатываем
    // Удаляем из буферов
    for (const inEdge of incomingEdges) {
      const buf = mixerBuffers.get(inEdge.id)!;
      buf.shift();
    }

    // Эмитим consume для всех пакетов
    for (const p of packets) {
      this.emit({
        t: 'packet-consume',
        packetId: p.id,
        nodeId: mixer.id,
      });
    }

    // Создаём объединённый пакет с массивом данных
    const mergedPacket: Packet = {
      id: `pkt-${crypto.randomUUID().slice(0, 8)}`,
      data: packets.map((p) => p.data),
      item: 'json',
      sizeHint: packets.reduce((sum, p) => sum + p.sizeHint, 0),
      ttl: Math.min(...packets.map((p) => p.ttl)) - 1,
    };

    // Обрабатываем объединённый пакет через очередь узла (второй комплект ждёт первый)
    this.enqueuePacket(mixer, mergedPacket);
  }

  /**
   * Добавляем пакет в очередь узла (мьютекс). Очередь ЖДЁТ завершения handler —
   * иначе «последовательность» фиктивна и заторов не будет.
   */
  private enqueuePacket(node: Entity, packet: Packet): void {
    const prevPromise = this.queues.get(node.id) ?? Promise.resolve();
    const newPromise = prevPromise.then(async () => {
      if (this.abortController.signal.aborted) return;
      await this.processNode(node, packet);
    });

    this.queues.set(node.id, newPromise);
  }

  /**
   * Обработка пакета в узле: consume → handler → spawn output / done / error.
   */
  private async processNode(node: Entity, packet: Packet): Promise<void> {
    // Эмитим consume
    this.emit({
      t: 'packet-consume',
      packetId: packet.id,
      nodeId: node.id,
    });

    // Эмитим working
    this.emit({
      t: 'node-status',
      nodeId: node.id,
      status: 'working',
    });

    // Проверяем TTL
    if (packet.ttl <= 0) {
      this.emit({
        t: 'packet-drop',
        packetId: packet.id,
        reason: 'ttl',
      });
      this.emit({
        t: 'node-status',
        nodeId: node.id,
        status: 'ok',
      });
      return;
    }

    // Вызываем handler узла (async, в try/catch) — ЖДЁМ его для мьютекса очереди
    await this.callHandler(node, packet);
  }

  /**
   * Вызов handler узла.
   */
  private async callHandler(node: Entity, packet: Packet): Promise<void> {
    try {
      if (this.abortController.signal.aborted) return;

      // Энергослой: недобор держит пакет в очереди («Нет питания»), не роняет его как ошибку
      if (this.energyEnabled) {
        const powered = await this.awaitPower(node, packet);
        if (!powered || this.abortController.signal.aborted) return;
        this.emit({ t: 'node-status', nodeId: node.id, status: 'working' });
      }

      const handlers = this.deps.handlers || {};
      const handler = handlers[node.kind];

      let result: HandlerResult;
      if (handler) {
        const ctx: NodeCtx = {
          data: packet.data,
          config: node.config,
          tpl: (s: string) => tpl(s, packet.data),
          // nodeId подмешивается автоматически (не часть контракта Handler/NodeCtx) —
          // серверу нужен стабильный ключ для мок-критика lab (docs/07), т.к. без него
          // общий процесс-wide флаг гонялся между всеми lab-узлами разом
          llm: this.deps.llm
            ? (req: LlmRequest) => this.deps.llm!({ ...req, nodeId: node.id })
            : (async () => { throw new Error('LLM недоступен (нет deps.llm)'); }),
          proxyFetch: this.deps.proxyFetch ?? (async () => { throw new Error('proxyFetch недоступен'); }),
        };
        // Модуль 'memory' (E2): снапшот содержимого сундуков как RAG-контекст
        const modules = (node.config['modules'] as string[]) || [];
        if (node.kind === 'assembler' && modules.includes('memory')) {
          ctx.memory = this.collectChestMemory();
        }
        result = await handler(ctx);
      } else {
        // Дефолт-заглушка: просто пропускаем данные
        result = { out: packet.data };
      }

      if (this.abortController.signal.aborted) return;

      // Обработка результата (union по docs/05; ошибки — через throw в catch ниже)
      if ('done' in result) {
        // Конец (silo, chest)
        this.emit({
          t: 'node-status',
          nodeId: node.id,
          status: 'ok',
        });
        this.emit({
          t: 'node-io',
          nodeId: node.id,
          lastIn: packet.data,
        });

        // Для silo эмитим result
        if (node.kind === 'silo') {
          this.emit({
            t: 'result',
            nodeId: node.id,
            data: packet.data,
          });
        }
      } else {
        // Выход (assembler, splitter, etc.)
        const branch = 'branch' in result ? result.branch : 'out';
        // lab/rework — явный outItem verdict (docs/05), для остальных веток — обычное правило
        let outItem = this.getOutItem(node, result.out);
        if (node.kind === 'lab' && branch === 'rework') {
          outItem = 'verdict';
        }
        const newPacket: Packet = {
          id: `pkt-${crypto.randomUUID().slice(0, 8)}`,
          data: result.out,
          item: outItem,
          sizeHint: JSON.stringify(result.out).length,
          ttl: packet.ttl - 1,
        };

        this.emit({
          t: 'node-io',
          nodeId: node.id,
          lastIn: packet.data,
          lastOut: result.out,
        });

        this.emit({
          t: 'packet-spawn',
          packet: newPacket,
          at: node.pos,
        });

        // Находим исходящие edge с соответствующим branch
        const outEdges = this.edges.filter(
          (e) => e.from === node.id && e.branch === branch
        );

        // Запускаем доставку по каждому edge
        for (const edge of outEdges) {
          const chain = this.deliverPacket(edge, newPacket);
          this.running.add(chain);
          chain.finally(() => this.running.delete(chain));
        }

        this.emit({
          t: 'node-status',
          nodeId: node.id,
          status: 'ok',
        });
      }
    } catch (e) {
      if (!this.abortController.signal.aborted) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        this.emit({
          t: 'node-status',
          nodeId: node.id,
          status: 'error',
          error: errorMsg,
        });
        this.emit({
          t: 'packet-drop',
          packetId: packet.id,
          reason: 'error',
        });
      }
    }
  }

  /**
   * Определение типа выходного предмета.
   * Правило: если явно задан outItem в NODE_DEFS — используем.
   * Иначе auto: string → 'text', иное → 'json'.
   */
  private getOutItem(node: Entity, out: unknown): ItemType {
    const nodeDef = NODE_DEFS[node.kind];
    if (nodeDef?.outItem) {
      return nodeDef.outItem;
    }
    // Auto-правило
    if (typeof out === 'string') {
      return 'text';
    }
    return 'json';
  }
}
