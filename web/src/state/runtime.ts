// Владелец Engine (не React)
import { Engine, EngineDeps, LlmRequest, ProxyRequest } from '../core/engine';
import { buildGraph } from '../core/graph';
import type { Entity, EngineEvent } from '../core/types';
import { GameTransport, consumePacket, dropPacket } from '../game/packets';
import { rocketLaunch } from '../game/fx';
import { triggerManipulatorGrab, triggerManipulatorRelease } from '../game/machines';
import { useStore } from './store';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8787';

let engine: Engine | null = null;
// TOCTOU-guard: engine присваивается только после нескольких await в startRun() —
// пока идёт этот асинхронный запуск, `engine` всё ещё null, и повторный вызов (двойной клик
// Run, удержание Space) проходил бы старую проверку `if (engine)` и создавал второй Engine,
// который потом некому было бы остановить. `starting` закрывает окно синхронно.
let starting = false;
// Если Stop нажали именно в это окно — engine ещё не существует, stopRun() не может его
// остановить. Флаг просит startRun() не поднимать фабрику вовсе, когда асинхронная часть
// закончится, вместо того чтобы молча проигнорировать клик Stop.
let stopRequestedDuringStart = false;

/**
 * Таймаут на fetch к нашему серверу — если он зависнет (не апстрим-LLM, а именно наш /llm
 * или /proxy), await в handler'е ноды никогда не резолвится, и per-node очередь в
 * engine.ts (enqueuePacket/processNode) блокируется навсегда для всех будущих пакетов этой
 * ноды. Таймаут гарантирует, что запрос всегда завершится ошибкой за конечное время.
 */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch wrapper для POST /llm (JSON request + response)
 * При ошибке выбрасывает Error с текстом из body.error
 */
async function createLlmFetch(): Promise<EngineDeps['llm']> {
  return async (req: LlmRequest) => {
    // Сервер сам таймаутит апстрим-LLM за 30с (server/main.py) — здесь запас в 5с,
    // чтобы обычно первым срабатывал серверный таймаут с внятной JSON-ошибкой,
    // а наш таймаут был просто страховкой на случай, если завис сам сервер/сеть.
    const res = await fetchWithTimeout(`${SERVER_URL}/llm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }, 35000);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `LLM error: ${res.status}`);
    }
    const data = await res.json();
    return data.text; // контракт сервера docs/07: { text, mock? }
  };
}

/**
 * Fetch wrapper для POST /proxy (request с url/method/headers/body → {status, body})
 */
async function createProxyFetch(): Promise<EngineDeps['proxyFetch']> {
  return async (req: ProxyRequest) => {
    // Сервер сам таймаутит целевой URL за 20с — запас в 5с по той же логике, что у /llm.
    const res = await fetchWithTimeout(`${SERVER_URL}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }, 25000);
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
 * Превью значения для лога: строка как есть, объект — JSON; всё усекается,
 * чтобы длинный текст/документ не разносил панель логов и консоль.
 */
function logPreview(value: unknown, max = 160): string {
  if (value === undefined) return '∅';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  const oneLine = s.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine;
}

/**
 * Маппинг EngineEvent на store-actions и сайд-эффекты
 */
function setupEventHandler() {
  return (event: EngineEvent) => {
    const store = useStore.getState();

    switch (event.t) {
      case 'packet-spawn': {
        // Спрайт предмета создаёт transport.move; здесь только манипулятор:
        // событие не несёт nodeId — ищем манипулятор по совпадению позиции.
        const source = Object.values(store.entities).find(
          (e) => e.kind === 'manipulator' && e.pos.x === event.at.x && e.pos.y === event.at.y
        );
        if (source) triggerManipulatorRelease(source.id);
        break;
      }

      case 'packet-consume': {
        // Втягивание предмета в станок (scale→0)
        consumePacket(event.packetId);
        const entity = store.entities[event.nodeId];
        if (entity && entity.kind === 'manipulator') triggerManipulatorGrab(event.nodeId);
        break;
      }

      case 'packet-drop':
        // error → лом+дым; dead-end/ttl → падение с fade (тост даёт node-status error)
        dropPacket(event.packetId, event.reason);
        if (event.reason !== 'error') {
          store.toast(`✕ пакет упал (${event.reason})`);
          console.log('[drop]', event.packetId, event.reason);
        }
        break;

      case 'node-status':
        store.setStatus(event.nodeId, event.status, event.error);
        if (event.status === 'error' && event.error) {
          const kind = store.entities[event.nodeId]?.kind ?? '?';
          store.toast(`⚠ ${kind} #${event.nodeId}: ${event.error}`);
          console.warn('[node error]', kind, event.nodeId, event.error);
        }
        break;

      case 'node-io': {
        store.setIO(event.nodeId, event.lastIn, event.lastOut);
        // Лог вход→выход каждого станка: в панель логов (LogsPanel) и в консоль.
        const kind = store.entities[event.nodeId]?.kind ?? '?';
        const label = `${kind} #${event.nodeId}`;
        const parts: string[] = [];
        if (event.lastIn !== undefined) parts.push(`IN ${logPreview(event.lastIn)}`);
        if (event.lastOut !== undefined) parts.push(`OUT ${logPreview(event.lastOut)}`);
        if (parts.length > 0) {
          store.toast(`${label}: ${parts.join('  →  ')}`);
          console.log('[io]', label, { in: event.lastIn, out: event.lastOut });
        }
        break;
      }

      case 'result': {
        // Результат от silo или chest → pushResult и запустить rocketLaunch
        store.pushResult(event.nodeId, event.data);
        const entity = store.entities[event.nodeId];
        if (entity && entity.kind === 'silo') {
          rocketLaunch(entity);
        }
        break;
      }

      case 'energy':
        store.setEnergy(event.charge, event.capacity);
        break;
    }
  };
}

/**
 * Запуск фабрики
 */
export async function startRun(): Promise<void> {
  if (engine || starting) {
    console.warn('Engine already running or starting');
    return;
  }
  starting = true;
  stopRequestedDuringStart = false;

  try {
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

    // Stop успел прийти, пока мы асинхронно собирали deps — не поднимаем фабрику вовсе,
    // иначе клик Stop потерялся бы (engine ещё не существовал, stopRun() был no-op'ом).
    if (stopRequestedDuringStart) {
      return;
    }

    // Создаём Transport из game/packets
    const transport = new GameTransport();

    // Создаём Engine
    const emitHandler = setupEventHandler();
    engine = new Engine(entities, edges, transport, emitHandler, deps);

    // Запускаем
    engine.start();
    store.setRunning(true);
  } finally {
    starting = false;
  }
}

/**
 * Остановка фабрики
 */
export function stopRun(): void {
  if (starting) {
    // Engine ещё не создан — попросим startRun() не запускать его, когда он закончит сборку
    stopRequestedDuringStart = true;
    return;
  }

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

/**
 * Пополнить энергию до максимума (кнопка «Зарядить» у аккумулятора).
 */
export function rechargeAccumulator(): void {
  if (!engine) {
    console.warn('Engine not running');
    return;
  }

  engine.rechargeEnergy();
}
