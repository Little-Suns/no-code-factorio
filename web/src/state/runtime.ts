// Владелец Engine (не React)
import { Engine, EngineDeps, LlmRequest, ProxyRequest } from '../core/engine';
import { buildGraph } from '../core/graph';
import type { Entity, EngineEvent } from '../core/types';
import { GameTransport } from '../game/packets';
import { rocketLaunch } from '../game/fx';
import { useStore } from './store';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8787';

let engine: Engine | null = null;

/**
 * Fetch wrapper для POST /llm (JSON request + response)
 * При ошибке выбрасывает Error с текстом из body.error
 */
async function createLlmFetch(): Promise<EngineDeps['llm']> {
  return async (req: LlmRequest) => {
    const res = await fetch(`${SERVER_URL}/llm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `LLM error: ${res.status}`);
    }
    const data = await res.json();
    return data.result;
  };
}

/**
 * Fetch wrapper для POST /proxy (request с url/method/headers/body → {status, body})
 */
async function createProxyFetch(): Promise<EngineDeps['proxyFetch']> {
  return async (req: ProxyRequest) => {
    const res = await fetch(`${SERVER_URL}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Proxy error: ${res.status}`);
    }
    const data = await res.json();
    return data;
  };
}

/**
 * Подписка на вебхуки через EventSource /events
 * Возвращает функцию отписки (close)
 */
function createWebhooksSubscription(
  cb: (nodeId: string, body: unknown) => void,
): () => void {
  const eventSource = new EventSource(`${SERVER_URL}/events`);

  const handleMessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'webhook') {
        cb(msg.nodeId, msg.body);
      }
    } catch (e) {
      console.error('Failed to parse webhook event', e);
    }
  };

  eventSource.addEventListener('message', handleMessage);

  return () => {
    eventSource.removeEventListener('message', handleMessage);
    eventSource.close();
  };
}

/**
 * Маппинг EngineEvent на store-actions и сайд-эффекты
 */
function setupEventHandler() {
  return (event: EngineEvent) => {
    const store = useStore.getState();

    switch (event.t) {
      case 'packet-spawn':
        // Событие фиксируем для отладки, но особого экшена нет
        console.debug('Packet spawned', event.packet.id);
        break;

      case 'packet-consume':
        // Пакет потреблен, пакет на конец пути (dropPacket сам рисует)
        break;

      case 'packet-drop':
        // Пакет упал: dropPacket из game/packets рисует лом
        // На ошибку — store.toast (но только на node-status error)
        if (event.reason === 'error') {
          // Дроп по ошибке будет, но тост уже выписан от node-status
        }
        break;

      case 'node-status':
        store.setStatus(event.nodeId, event.status, event.error);
        if (event.status === 'error' && event.error) {
          // Тост только на node-status error
          store.toast(`Node error: ${event.error}`);
        }
        break;

      case 'node-io':
        store.setIO(event.nodeId, event.lastIn, event.lastOut);
        break;

      case 'result': {
        // Результат от silo или chest → pushResult и запустить rocketLaunch
        store.pushResult(event.nodeId, event.data);
        const entity = store.entities[event.nodeId];
        if (entity && entity.kind === 'silo') {
          rocketLaunch(entity);
        }
        break;
      }
    }
  };
}

/**
 * Запуск фабрики
 */
export async function startRun(): Promise<void> {
  if (engine) {
    console.warn('Engine already running');
    return;
  }

  const store = useStore.getState();

  // Проверка: есть ли хотя бы одна шахта
  const hasAnyMiner = Object.values(store.entities).some((e) => e.kind === 'miner');
  if (!hasAnyMiner) {
    store.toast('Поставь шахту');
    return;
  }

  // Строим граф
  const entities = store.entities;
  const edges = buildGraph(entities);

  // Создаём deps
  const deps: EngineDeps = {
    llm: await createLlmFetch(),
    proxyFetch: await createProxyFetch(),
    webhooks: createWebhooksSubscription,
    // handlers будут подставлены ниже
  };

  // Импортируем NODE_DEFS чтобы собрать handlers
  const { NODE_DEFS } = await import('../core/nodes');
  const handlers: Partial<Record<string, any>> = {};
  for (const [kind, def] of Object.entries(NODE_DEFS)) {
    if (def.handler) {
      handlers[kind] = def.handler;
    }
  }
  deps.handlers = handlers;

  // Создаём Transport из game/packets
  const transport = new GameTransport();

  // Создаём Engine
  const emitHandler = setupEventHandler();
  engine = new Engine(entities, edges, transport, emitHandler, deps);

  // Запускаем
  engine.start();
  store.setRunning(true);
}

/**
 * Остановка фабрики
 */
export function stopRun(): void {
  if (!engine) {
    console.warn('Engine not running');
    return;
  }

  engine.stop();
  engine = null;
  useStore.getState().setRunning(false);
}

/**
 * Запуск шахты вручную кнопкой
 */
export function triggerMiner(nodeId: string): void {
  if (!engine) {
    console.warn('Engine not running');
    return;
  }

  engine.triggerMiner(nodeId);
}
