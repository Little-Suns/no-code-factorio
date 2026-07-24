# 01 — Архитектура

## Структура репозитория

```
pnpm-workspace.yaml            # packages: web (server — на Python, вне workspace)
web/
  public/
    assets/manifest.json       # спрайты (docs/02), PNG рядом
    demo.json                  # заготовленная фабрика для демо
  src/
    core/                      # ЧИСТЫЙ TS — без pixi/react/zustand
      types.ts                 # канонические типы (ниже)
      grid.ts                  # занятость тайлов, footprint, порты
      graph.ts                 # извлечение Edge[] из мира (docs/03)
      engine.ts                # исполнение (docs/04)
      tpl.ts                   # шаблонизация {{path}}
      nodes/                   # определения станков и хендлеры (docs/05)
      __checks__/              # assert-самопроверки, pnpm --filter web check
    game/                      # PixiJS (docs/02)
      app.ts                   # Application, viewport, слои
      assets.ts                # манифест + плейсхолдеры
      machines.ts  belts.ts    # отрисовка сущностей
      packets.ts               # предметы на лентах + реализация Transport
      input.ts                 # мышь/клавиатура, ghost, размещение
      fx.ts                    # дым, ракета, частицы
    ui/                        # React-оверлей (docs/06)
      App.tsx  Hotbar.tsx  ConfigPanel.tsx  Inspector.tsx  TopBar.tsx
    state/
      store.ts                 # Zustand
      runtime.ts               # владелец Engine (не React)
    main.tsx
server/
  main.py                      # FastAPI: /llm (+мок-режим), /proxy, /webhook + SSE /events (docs/07)
  requirements.txt             # fastapi, uvicorn, httpx
docs/
```

## Канонические типы — `web/src/core/types.ts`

Единственный источник правды. Меняешь — обнови этот док и предупреди остальные треки.

```ts
export interface Vec { x: number; y: number }        // тайлы, y растёт вниз
export type Dir = 0 | 1 | 2 | 3;                     // 0=N(вверх), 1=E, 2=S, 3=W — по часовой
export const DELTA: Record<Dir, Vec> = {
  0: { x: 0, y: -1 }, 1: { x: 1, y: 0 }, 2: { x: 0, y: 1 }, 3: { x: -1, y: 0 },
};

export type MachineKind =
  | 'belt'
  | 'miner' | 'assembler' | 'splitter' | 'mixer' | 'silo' | 'telegram'   // MVP-ядро
  | 'furnace' | 'chest' | 'lab'                              // усиление: станки
  | 'accumulator'                                            // усиление: энергослой (вне графа лент, docs/04)
  | 'webhook'                                                 // усиление: generic HTTP-исход
  | 'manipulator';                                           // усиление: 1×1 передаточный узел (вход BACK → выход FRONT)

export interface Entity {
  id: string;                  // crypto.randomUUID().slice(0, 8)
  kind: MachineKind;
  pos: Vec;                    // левый верхний тайл footprint
  dir: Dir;
  config: Record<string, unknown>;
}

export type ItemType = 'text' | 'json' | 'image' | 'verdict' | 'batch' | 'scrap';

export interface Packet {
  id: string;
  data: unknown;
  item: ItemType;
  sizeHint: number;            // JSON.stringify(data).length — визуальный масштаб предмета
  ttl: number;                 // старт 64, минус 1 за станок; 0 → дроп (петли не виснут)
}

export type Branch = 'out' | 'true' | 'false' | 'pass' | 'rework';

export interface Edge {
  id: string;                  // `${from}:${branch}:${n}` — ключ буферов смесителя
  from: string; branch: Branch;
  to: string | null;           // null = тупик (пакет упадёт в конце пути)
  path: Vec[];                 // тайлы лент от выхода к входу
}

export type NodeStatus = 'idle' | 'working' | 'ok' | 'error';

export type EngineEvent =
  | { t: 'packet-spawn'; packet: Packet; at: Vec }
  | { t: 'packet-consume'; packetId: string; nodeId: string }
  | { t: 'packet-drop'; packetId: string; reason: 'dead-end' | 'ttl' | 'error' }
  | { t: 'node-status'; nodeId: string; status: NodeStatus; error?: string }
  | { t: 'node-io'; nodeId: string; lastIn?: unknown; lastOut?: unknown }
  | { t: 'result'; nodeId: string; data: unknown };            // silo/chest: накопить в store

export interface Transport {
  // Резолвится, когда предмет ВИЗУАЛЬНО доехал до конца path. Реализует рендерер.
  move(packetId: string, path: Vec[], item: ItemType, sizeHint: number): Promise<void>;
  clear(): void;               // Stop: убрать все предметы
}
```

## Контракт engine ↔ renderer

- Движок (`core/engine.ts`) **не знает** про Pixi. Ему дают `Transport` и `emit(e: EngineEvent)`.
- Рендерер реализует `Transport` (скорость **400 мс/тайл**, константа `TILE_MS` в `game/packets.ts`) и слушает события.
- Пакет, доехавший до станка, ждёт в очереди — рендерер держит спрайт на последней точке пути до `packet-consume`. Занятый агент → видимый затор. Смеситель → первый ингредиент стоит у входа, ждёт остальных.
- Для headless-проверок движка — `FakeTransport` (мгновенный): треки рендера и движка не блокируют друг друга.

## Поток данных

```
Строительство → store.entities (Zustand)
Run → buildGraph(entities) → Edge[] → new Engine(...) → engine.start()
Источники: кнопка ▶ шахты (runtime.triggerMiner) | интервал шахты (setInterval в Engine)
           | вебхук шахты (подписка deps.webhooks — runtime оборачивает EventSource /events)
emit(...) → store → React-панели; transport.move → анимация Pixi
Stop → engine.stop(): abort цепочек, transport.clear(), статусы idle
```

Во время `running` редактирование поля **заблокировано** (тост «Останови фабрику») — граф неизменен на время исполнения.

## Zustand store — `web/src/state/store.ts`

```ts
interface Store {
  entities: Record<string, Entity>;
  running: boolean;
  selectedTool: MachineKind | null;
  selectedEntityId: string | null;
  nodeStatus: Record<string, { status: NodeStatus; error?: string; lastIn?: unknown; lastOut?: unknown }>;
  results: Record<string, { at: number; data: unknown }[]>;  // silo и chest, максимум 50 на станок
  toasts: { id: string; text: string }[];
  // actions: place, remove, rotate, setConfig, select, setTool, setRunning,
  //          setStatus, setIO, pushResult, toast, loadWorld(entities)
}
```

Рендерер подписывается через `useStore.subscribe` (вне React), UI — хуками.

## Скрипты и окружение

- `web/package.json` scripts: `dev` (vite), `build` (`tsc && vite build`), `typecheck` (`tsc --noEmit`), `check` (`tsx src/core/__checks__/run.ts`, где `run.ts` просто импортирует все файлы `__checks__/`; `tsx` — dev-зависимость только для этого).
- Адрес сервера: `const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8787'` — задаётся в одном месте, `state/runtime.ts`; больше нигде URL не хардкодить.
- Корневой `.gitignore` (создаётся в A1): `node_modules/`, `dist/`, `server/.env`, `__pycache__/`, `.venv/` — ключи API в git не попадают.

## Персистентность

- Автосейв `entities` в `localStorage` под ключом `ncf.world.v1` (debounce 500 мс), восстановление при старте. Чертежи (E4, реализовано) — отдельный ключ `ncf.blueprints.v1`, формат `Blueprint[]` где `Blueprint = { id, name, entities: Entity[] }` (`entities` — координаты относительно bounding box, не мировые; см. `core/blueprint.ts`).
- Export/Import JSON и Load demo (`web/public/demo.json`). Формат: `{ version: 1, entities: Entity[] }`.

## Задачи и acceptance criteria

- Задача B1 (docs/08): `types.ts` ровно по этому доку + `grid.ts`.
- AC: `pnpm -r typecheck` проходит; все слои импортируют типы из `core/types.ts`; `grep -rE "from ['\"](pixi|react|zustand)" web/src/core` пуст.
