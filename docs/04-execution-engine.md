# 04 — Движок исполнения

`core/engine.ts`. Чистый TS, без Pixi/React. Событийная модель поверх промисов — **не** тиковая симуляция: анимация ленты = awaitable `transport.move`, затор = очередь промисов у станка.

## Интерфейс

```ts
class Engine {
  constructor(
    entities: Record<string, Entity>,
    edges: Edge[],
    transport: Transport,             // рендерер или FakeTransport
    emit: (e: EngineEvent) => void,
    deps: {
      llm: LlmCall; proxyFetch: ProxyFetch,           // из docs/05 NodeCtx
      // подписка на вебхуки; runtime оборачивает EventSource('/events'), core остаётся headless
      webhooks: (cb: (nodeId: string, body: unknown) => void) => () => void,
    },
  )
  start(): void                       // интервалы шахт
  stop(): void                        // мгновенно всё гасит
  triggerMiner(nodeId: string): void  // кнопка ▶ в UI
}
```

## Жизненный цикл пакета

```
шахта создаёт Packet { data, item: 'text', sizeHint, ttl: 64 } → emit packet-spawn
для каждого edge шахты: клон пакета, независимая async-цепочка:
    await transport.move(id, path, item, sizeHint)     // ~400 мс/тайл
    edge.to == null → emit packet-drop 'dead-end'
    иначе → deliver(edge, packet)
```

`deliver(edge, packet)` — доставка в станок `edge.to`:

1. **Смеситель (mixer)**: пакет кладётся в буфер по `edge.id` (`buffers: Map<nodeId, Map<edgeId, Packet[]>>`). Если ещё не по ≥1 пакету от **каждого** входящего edge узла — цепочка завершается, предмет визуально ждёт у входа (consume не эмитится). Когда комплект собран — по одному из каждого буфера, всем `packet-consume`, и дальше как обычный станок с `data = массив payload'ов`.
2. Остальные станки: встать в **очередь узла** (mutex: `queues: Map<nodeId, Promise<void>>`, работа = `prev.then(...)`). Пока ждём — предмет стоит у входа: честный видимый backpressure.
3. `emit packet-consume`, `emit node-status working`.
4. `ttl <= 0` → `packet-drop 'ttl'`, `node-status ok`, конец (петля критика не зациклится).
5. Вызвать handler станка (docs/05) с `NodeCtx`; `emit node-io { lastIn, lastOut }`.
6. Успех:
   - `{ done }` (silo, и chest при недоборе пачки) → `node-status ok`; silo дополнительно `emit result` (панель результата + ракета).
   - `{ out }` → edges с `branch: 'out'`; `{ branch, out }` (splitter/lab) → edges этого branch. Новый пакет: `data = out`, `item` — по правилу типов (ниже), `sizeHint` пересчитан, `ttl - 1`; `emit packet-spawn`; **новая независимая цепочка** (move → deliver). Станок освобождается сразу после спавна выходов — как печь в Factorio: предмет уехал, станок свободен.
7. Ошибка handler → `node-status error` (+текст), `packet-drop 'error'` (лом + дым). Остальные пакеты живут, фабрика работает.

Правило типа предмета: NodeDef может задать `outItem` явно (lab rework → `verdict`, chest → `batch`); иначе `auto`: `typeof out === 'string'` → `text`, иначе → `json`.

Все цепочки — «fire and track»: промисы в Set, каждая в try/catch с проверкой abort.

## Источники (шахты)

| режим (config шахты) | механика |
|---|---|
| кнопка ▶ | `triggerMiner(nodeId)` из UI — единичный вброс |
| `intervalSec > 0` | `setInterval` в Engine, чистится в stop() |
| mode: `webhook` | `start()` подписывается через `deps.webhooks`; событие `(nodeId, body)` → вброс пакета с `data = body` у этой шахты; отписка в stop() |

Payload шахты: режим `text` — содержимое поля; режим `url` — `proxyFetch(url)` на каждый вброс (шахта тоже проходит статусы working/ok); режим `webhook` — тело пришедшего запроса.

## Stop

`AbortController`: `stop()` → abort. Цепочки проверяют `signal.aborted` после каждого await и тихо умирают. Затем: очистить интервалы, отписаться от вебхуков, сбросить буферы смесителей, `transport.clear()`, `node-status idle` всем. Повторный Run строит новый Engine со свежим снапшотом мира.

## Электричество (усиление, не MVP)

Один ресурс: **электричество = токены LLM**. Если на карте нет ни одного аккумулятора — энергослой выключен, фабрика работает без ограничений (MVP-ядро от энергии не зависит).

Аккумулятор и расход:
- `store.energy = { charge, capacity }` — суммарный заряд аккумуляторов; `capacity` задаётся в конфиге аккумулятора, пополнение — кнопка «Зарядить» в его панели (docs/06). Уровень заряда виден на самом аккумуляторе (полоска, docs/02).
- Расход: перед handler движок списывает оценку — LLM-станки `~(prompt.length / 4 + 400) × (1 + модули × 0.5)`, механические станки — константа 10.
- Заряда не хватает → `node-status error 'Нет питания'`, лампа мигает, пакет ждёт в очереди, повтор каждые 2 с до зарядки или Stop.
- Питание глобальное: аккумулятор есть и заряжен → все станки запитаны.

## Шаблонизация — `core/tpl.ts`

```ts
tpl('Суммаризуй: {{text}}', data)   // {{path.to.field}} → значение; не строка → JSON.stringify; нет → ''
```

Одна функция на регулярке `/\{\{([\w.[\]]+)\}\}/g`.

## FakeTransport

```ts
const fakeTransport: Transport = { move: async () => {}, clear: () => {} };
```

## Задачи и acceptance criteria

- B3: Engine + tpl, `__checks__/engine.ts` на FakeTransport и мок-хендлерах. AC:
  1. miner→assembler→silo: `triggerMiner` доводит данные до `result` (порядок событий: spawn → consume → working → ok → result);
  2. splitter ведёт пакеты по `true`/`false` согласно условию;
  3. **mixer ждёт оба входа**: один пакет — тишина, второй — консьюм обоих и один выход с массивом;
  4. handler-исключение → `node-status error` + `packet-drop 'error'`, следующий пакет проходит;
  5. lab-петля: пакет гоняется по кругу и умирает по ttl, движок не виснет;
  6. `stop()` во время долгого handler → после abort событий нет;
  7. очередь: 3 пакета в станок с handler 50 мс обрабатываются последовательно;
  8. шахта в режиме webhook: вызов колбэка `deps.webhooks` порождает пакет у нужной шахты, отписка вызывается в stop().
