// Владелец Engine (не React)
import { Engine, EngineDeps, LlmRequest, ProxyRequest } from '../core/engine';
import { buildGraph } from '../core/graph';
import type { Entity, EngineEvent } from '../core/types';
import { GameTransport, consumePacket, dropPacket } from '../game/packets';
import { rocketLaunch } from '../game/fx';
import { triggerManipulatorGrab, triggerManipulatorRelease } from '../game/machines';
import { useStore } from './store';
import { t, translateEngineError } from '../i18n/dictionaries';
import { LEVELS } from '../core/levels/definitions';
import { computeStars } from '../core/levels/stars';

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

// Уровни/челленджи: снимок песочницы игрока на момент входа в уровень — startLevel()
// подменяет store.entities схемой уровня (с нуля), exitLevel() возвращает этот снимок.
// Настоящая защита от потери данных — guard в state/persist.ts (ncf.world.v1 не
// перезаписывается, пока levelActive) — это лишь быстрый возврат без перезагрузки страницы.
let sandboxSnapshot: Entity[] | null = null;

// Баг «переключились со вкладки и вернулись — предметы копятся, не обрабатываются»:
// wall-clock setInterval шахты (core/engine.ts) не останавливается браузером на скрытой
// вкладке, а анимация пакетов в game/packets.ts держится на Ticker.shared (requestAnimationFrame),
// который на скрытой вкладке просто не вызывается. В итоге шахта продолжает спавнить пакеты,
// а рендер не может их разобрать — растущий backlog. Держим Engine и рендерер синхронно
// на паузе, пока вкладка не видна; уже летящие/стоящие в очереди пакеты не трогаем —
// они доедут как обычно, когда Ticker снова пойдёт (docs/02, docs/04).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    engine?.setPaused(document.hidden);
  });
}

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
          store.toast(t('toast.packetDropped', store.locale, { reason: event.reason }));
          console.log('[drop]', event.packetId, event.reason);
          // Уровень активен — dead-end/ttl очень легко пропустить в потоке тостов
          // (особенно на квесте про lab: два соседних порта pass/rework легко перепутать
          // местами, тогда пакет с вердиктом PASS/REWORK молча теряется, а игрок не
          // понимает, почему схема «рабочая на вид» не засчитывается). Автооткрытие
          // логов делает причину видимой сразу, а не задним числом в LogsPanel.
          if (useStore.getState().levelActive) store.setLogsPanelOpen(true);
        }
        break;

      case 'node-status':
        store.setStatus(event.nodeId, event.status, event.error);
        if (event.status === 'error' && event.error) {
          const kind = store.entities[event.nodeId]?.kind ?? '?';
          const errorText = translateEngineError(event.error, store.locale);
          store.toast(`⚠ ${kind} #${event.nodeId}: ${errorText}`);
          console.warn('[node error]', kind, event.nodeId, event.error);
        }
        break;

      case 'node-io': {
        store.setIO(event.nodeId, event.lastIn, event.lastOut);
        // Лог вход→выход каждого станка: в панель логов (LogsPanel) и в консоль.
        const kind = store.entities[event.nodeId]?.kind ?? '?';
        const label = `${kind} #${event.nodeId}`;
        // silo: финальный node-io (lastIn без lastOut) несёт тот же payload, что и
        // следом идущий 'result' → pushResult (см. engine.ts, ветка 'done'). ResultPanel
        // уже покажет этот результат — не дублируем его ещё и как запись в LogsPanel.
        const isSiloFinalIo = kind === 'silo' && event.lastOut === undefined;
        if (!isSiloFinalIo) {
          const parts: string[] = [];
          if (event.lastIn !== undefined) parts.push(`IN ${logPreview(event.lastIn)}`);
          if (event.lastOut !== undefined) parts.push(`OUT ${logPreview(event.lastOut)}`);
          if (parts.length > 0) {
            store.toast(`${label}: ${parts.join('  →  ')}`);
          }
        }
        console.log('[io]', label, { in: event.lastIn, out: event.lastOut });
        break;
      }

      case 'result': {
        // Результат от silo или chest → pushResult и запустить rocketLaunch
        store.pushResult(event.nodeId, event.data);
        const entity = store.entities[event.nodeId];
        if (entity && entity.kind === 'silo') {
          rocketLaunch(entity);
        }
        // Уровень активен — проверить, не выполнено ли задание этим результатом
        // (см. core/levels/definitions.ts::evaluate — работает по всему store.results,
        // т.к. id узлов игрок создаёт сам, заранее их не знает даже дизайнер уровня).
        // Небольшая задержка перед показом полноэкранной модалки LevelComplete — иначе
        // она перекрывает канвас в тот же кадр, что и dым/смена статуса силоса, и игрок
        // не успевает увидеть сам эффект «доставки» (жалоба «ракета не запускается» —
        // ракета технически срабатывала, но модалка мгновенно закрывала её собой).
        const levelId = useStore.getState().levelActive;
        if (levelId) setTimeout(() => evaluateActiveLevel(levelId), 700);
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
      store.toast(t('toast.placeMiner', store.locale));
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
    // Вкладка уже могла быть скрыта до нажатия Run (напр. запуск из другой вкладки) —
    // синхронизируем паузу сразу, не дожидаясь следующего visibilitychange.
    if (typeof document !== 'undefined') {
      engine.setPaused(document.hidden);
    }
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
 * Найти Level по id и, если evaluate() проходит на текущих store.results, засчитать
 * прохождение (звёзды по числу сущностей на момент успеха + модалка LevelComplete).
 */
function evaluateActiveLevel(levelId: string): void {
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) return;
  const state = useStore.getState();
  if (!level.evaluate(state.results)) return;
  const stars = computeStars(level, Object.keys(state.entities).length);
  state.completeLevel(level.id, stars);
  state.setLevelCompleteInfo({ id: level.id, stars });
}

/**
 * Вход в уровень: останавливает текущий прогон, откладывает песочницу игрока в сторону
 * (sandboxSnapshot — см. также guard в state/persist.ts), даёт уровню чистый мир и
 * чистые results (без этого evaluate() уровня мог бы ложно сработать на результатах от
 * предыдущей попытки/уровня — store.results не привязан к nodeId уровня, id рантаймовые).
 */
export function startLevel(id: string): void {
  const store = useStore.getState();
  if (store.tutorialActive) return; // не стартовать поверх обучалки
  if (engine || starting) stopRun();
  sandboxSnapshot = Object.values(useStore.getState().entities);
  store.loadWorld([]);
  store.clearResults();
  store.setTool(null); // сбрасывает selectedTool + stampBlueprintId + selectedEntityId
  store.setPendingSelection(null);
  store.setLevelActive(id);
}

/**
 * Выход из уровня (кнопка «Выйти» в LevelHud, «В меню» в LevelComplete): возвращает
 * ранее отложенную песочницу, останавливает прогон, если шёл.
 */
export function exitLevel(): void {
  const store = useStore.getState();
  if (engine || starting) stopRun();
  store.loadWorld(sandboxSnapshot ?? []);
  sandboxSnapshot = null;
  store.clearResults();
  store.setLevelActive(null);
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

/**
 * Дебаг-режим (кнопки Пауза/Шаг в TopBar, docs/04): паузит источники новых пакетов
 * и ставит уже летящие/входящие пакеты на ворота движка. Стор — источник истины для UI
 * (кнопки читают store.debugMode), engine.setDebugMode() — зеркало на стороне движка.
 */
export function setDebugMode(enabled: boolean): void {
  if (!engine) {
    console.warn('Engine not running');
    return;
  }
  engine.setDebugMode(enabled);
  useStore.getState().setDebugMode(enabled);
}

/**
 * Один шаг отладки (кнопка «Шаг»): пропускает ровно одно ожидающее событие движка.
 */
export function stepDebug(): void {
  if (!engine) {
    console.warn('Engine not running');
    return;
  }
  engine.step();
}
