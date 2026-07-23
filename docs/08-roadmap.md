# 08 — Роадмап и задачи

~48 часов. 4 параллельных трека. Контракты docs/01 (`types.ts`, `Transport`, `EngineEvent`) фиксируются в первые часы и не трогаются — это позволяет трекам не ждать друг друга: рендер гоняется на FakeEngine-скриптах, движок — на FakeTransport, ноды — на LLM-моках сервера.

## Правила нарезки под агентов

- 1 задача = 1 агент-сессия. В промпт: ссылка на `CLAUDE.md`, `docs/01` и профильный док + строка AC.
- Агент не меняет контракты и чужие треки; после задачи отмечает чекбокс здесь + 1–3 строки заметок.
- Блокер → фиксируется в «Риски/блокеры» внизу, не чинится молча в чужом коде.

## Трек A — рендер и ввод (docs/02, 03)

- [x] **A1. Скаффолд + мир** (~2ч): pnpm workspace (web), Vite+React+TS strict, Pixi + pixi-viewport, слои, сетка. AC: `pnpm dev` открывает поле, зум к курсору, пан, 60 fps.
  - Создана структура: pnpm-workspace.yaml, web/package.json с зависимостями (Vite, React 18, PixiJS v8, pixi-viewport, Zustand, tsx); tsconfig.json strict; vite.config.ts.
  - game/app.ts: PixiJS Application (фон #3a3226), Viewport с зумом колесом (к курсору) и паном (правая/средняя кнопка), слои (ground, belts, items, machines, fx, ghost).
  - src/core/types.ts: канонические типы (Vec, Dir, MachineKind, Entity, Packet, Edge, EngineEvent, Transport).
  - main.tsx: React + Canvas для Pixi; заглушки UI, store, assets.
  - .gitignore (node_modules/, dist/, server/.env, __pycache__/, .venv/).
  - pnpm install ✓, typecheck ✓.
- [x] **A2. Реестр ассетов + плейсхолдеры** (~3ч): манифест, generateTexture-плейсхолдеры с буквой и стрелкой, `getTexture`. AC: без PNG всё рисуется; PNG + строка манифеста подменяет спрайт без правки кода.
  - assets.ts: loadAssets + getTexture с кэшем, нарезка кадров, graceful fallback на плейсхолдеры (проверено в браузере — все станки рисуются буквами/стрелками без PNG).
  - debugScene.ts — временная витрина всех MachineKind, убрать в A3.
- [x] **A3. Размещение** (~5ч, после B1): hotbar, ghost с валидацией, клик-постановка, drag-ленты, R, снос, выделение. AC: «шахта → 5 лент → станок → лента → ракета» мышью за минуту.
  - store.ts: реализованы все actions (place/remove/rotate/setConfig/select/setTool/setRunning/setStatus/setIO/pushResult/toast/loadWorld) с проверками canPlace и блокировкой при running.
  - game/input.ts: обработка ввода (ЛКМ для placement, drag для лент, R для поворота, Delete для сноса, выделение по клику).
  - game/rasterize.ts + __checks__/rasterize.ts: растеризация пути drag-ленты по тайлам (сначала по оси большего смещения), 8 проверок.
  - game/machines.ts + game/belts.ts: подписка на store, рендер спрайтами с поворотом.
  - ui/Hotbar.tsx + Hotbar.css: панель внизу с кнопками (belt, miner, assembler, splitter, mixer, silo, telegram), хоткеи 1–7, подсветка выбранного.
  - ui/App.tsx + App.css: монтирование Pixi и React-оверлея с Hotbar.
- [x] **A4. Transport + анимации** (~5ч, по контракту docs/01): движение предметов (400 мс/тайл, масштаб от sizeHint), hold у входа, consume-втягивание, статус-лампы, work-анимации, scrap+дым, `clear()`. AC: FakeEngine-скрипт гоняет предмет по 10 тайлам плавно; Stop чистит мгновенно; затор виден.
  - game/packets.ts: GameTransport с move() (линейная интерполяция по пути, TILE_MS=400), consumePacket (tween scale→0, 150мс), dropPacket (error→scrap, dead-end/ttl→падение), clear().
  - game/fx.ts: smoke() (5-8 частиц, подъём+fade 1с), rocketLaunch() placeholder.
  - game/machines.ts: статус-лампа (круг 10px, idle/working/ok/error), work-анимация переключение на AnimatedSprite.
  - game/belts.ts: AnimatedSprite для belt с синхронной анимацией.
  - game/fakeRun.ts: тестовая функция на window.__fakeRun (дев-режим), buildGraph+createTransport.move интеграция.
  - initPackets/initFX требуют вызова из runtime.ts (B3 интеграция).
- [x] **A5. Ракета + FX-полиш** (~2ч): запуск silo, дым, звуки (опц.). AC: `result` от silo проигрывает запуск ракеты.
  - rocketLaunch(entity): Promise обрабатывает 3 этапа — тряска (200мс, jitter), улёт с огнём (1.2с, easeIn+частицы каждые 50мс, дым в начале), спуск (0.6с после паузы 1с).
  - Guard activeRockets Set от одновременных запусков.
  - Дев-хук window.__rocket = (entityId) => рocketLaunch(...) через async import.
  - typecheck ✓, анимация на Ticker как smoke().

## Трек B — core (docs/03, 04, 05)

- [x] **B1. types + grid** (~2ч, ПЕРВЫМ в проекте): `core/types.ts` ровно по docs/01, `grid.ts`, `__checks__/grid.ts`. AC: см. docs/03.
  - grid.ts: rotOffset/footprintTiles/outPorts/inTiles/buildOccupancy/canPlace; порты снаружи footprint через rotOffset(dx,-1).
  - Ревью-фикс: inTiles возвращал локальные координаты вместо мировых — исправлено, чек усилен ненулевым pos.
- [x] **B2. Извлечение графа** (~3ч): `graph.ts`, `__checks__/graph.ts`. AC: см. docs/03.
  - buildGraph(entities): Edge[] трассирует ленты от outPorts каждого станка, guard от колец (visited + path > 500), детектирует to по inTiles.
  - 7 проверок: miner→3 belts→assembler (path=3), dead-end (to=null), ring не виснет, lab rework feedback, splitter 2 branches, порт в пустоту, multi-edges.
- [x] **B3. Engine + tpl** (~5ч): docs/04 целиком, включая буферы смесителя, ttl-защиту петель и вебхук-подписку, на FakeTransport. AC: 8 проверок из docs/04.
  - core/tpl.ts: функция интерполяции {{path.to.field}} (поддержка вложенных объектов и массивов); core/engine.ts: полный жизненный цикл пакетов с очередями узлов, буферами смесителя, TTL-защитой и AbortController для stop().
  - 8 AC пройдены: simple pipeline, splitter branching, mixer buffering, error handling, loop TTL-death, abort behavior, sequential queue, webhook subscription.
- [x] **B4. Станки ядра** (~4ч): NODE_DEFS + хендлеры miner/assembler/splitter/mixer/silo/telegram + recipes.ts, `__checks__/nodes.ts`. AC: см. docs/05.
  - Реализованы все 6 станков ядра: miner (text/url/webhook), assembler (6 рецептов), splitter (expr/llm), mixer (concat/llm), silo (output), telegram (sendMessage).
  - NODE_DEFS с интерфейсами NodeDef и Field, полный реестр включая furnace/chest/lab/accumulator (заглушки с title/size/schema).
  - getOutItem в engine.ts использует NODE_DEFS.outItem, fallback на auto-правило (string→text).
  - Все 6 AC пройдены: assembler-llm, splitter-expr/llm, mixer-concat/llm, miner-url, telegram (success/error), registry-complete.
- [x] **B5. Станки усиления** (~3ч, только после интеграции): furnace, chest, lab. AC: см. docs/05.
  - furnace: `new Function('data', code)` — быстрый JS-препроцессор без LLM; `undefined` на выходе → throw `'furnace must return a value'`.
  - lab: `llm(...)` с system-критиком, парсит первую строку ответа (PASS/REWORK); PASS → `{branch:'pass', out:data}`; REWORK → `{branch:'rework', out:{draft,critique}}`. outItem для ветки rework (`verdict`) — точечный override в `engine.ts callHandler` (`node.kind==='lab' && branch==='rework'`), т.к. NodeDef.outItem один на кind, а не на branch.
  - chest: буферизация — **не** в handler (он стейтлесс), а в новом `Engine.deliverToChest` (аналог `deliverToMixer`, тот же `this.buffers` Map, только копит N пакетов с одного узла вместо 1 пакета с каждого входа). Недобор → `result`-событие с `{buffered, batchSize}` для инспектора, без spawn/доставки дальше; набор полон → `enqueuePacket` с массивом payload'ов как обычно, handler chest тривиален (`{out: ctx.data}`).
  - Hotbar.tsx: `MVP_TOOLS`(7) → `ALL_TOOLS`(10) + `KEY_TO_TOOL` по HOTKEYS вместо позиционной арифметики по индексу — иначе furnace/chest/lab были бы нерасставляемы в UI, несмотря на рабочий handler (клавиши 8/9/0 уже были заявлены в HOTKEYS, но не подключены).
  - `__checks__/nodes.ts`: +4 (furnace-transform, furnace-undefined-error, lab-pass, lab-rework), `testRegistry` теперь требует handler у всех kind кроме `accumulator`. `__checks__/engine.ts`: +1 (AC9, chest — 3 миксера → chest(batchSize=3) → silo, проверка ровно 2 промежуточных result + 1 финальный с массивом из 3).
  - `pnpm typecheck` ✓, `pnpm check` ✓ (9 AC engine + 12 AC nodes), `pnpm build` ✓. Ручного smoke-теста в браузере не делал (без Claude in Chrome в этой сессии) — стоит прогнать глазами перед демо.

## Трек C — сервер и UI (docs/07, 06)

- [x] **C1. Сервер** (~3ч, рано — моки нужны всем): Python/FastAPI (`server/main.py`), `/llm` с мок-режимом, `/proxy`, `/webhook/{node_id}` + SSE `/events`. AC: 5 проверок из docs/07.
  - FastAPI + uvicorn на порту 8787, CORS для локальной разработки
  - /llm: мок-режим (~1.5s) с YES/NO и web-search; готов для OpenRouter API
  - /proxy: SSRF через httpx, /webhook: SSE broadcast с 15s heartbeat
  - Все 5 AC прошли: мок, GitHub API, ошибки не роняют, SSE-webhook working
- [x] **C2. UI-оверлей** (~5ч, после B4): TopBar, Hotbar (с A3), ConfigPanel+FormRenderer, ResultPanel, Toasts, runtime.ts. AC: 6 проверок из docs/06.
  - state/runtime.ts: ENGINE управляет жизненным циклом (startRun/stopRun/triggerMiner), fetchers для /llm и /proxy, webhooks подписка на /events через EventSource.
  - ui/TopBar.tsx: Run/Stop (Space), Export/Import (JSON), Load demo, счётчик сущностей, зелёный индикатор running.
  - ui/ConfigPanel.tsx: FormRenderer (text/number/textarea/json/select), мощные поля-collapsible lastIn/lastOut, статус-бейдж, кнопка триггера для шахты (disabled при !running), webhook URL с Copy.
  - ui/ResultPanel.tsx: авто-открытие при результате от silo, список результатов с временем, Clear.
  - ui/Toasts.tsx: уведомления в верхний-правый угол, автоудаление 4с.
  - ui/JsonView.tsx: мини-компонент для красивого отображения JSON с Copy.
  - store.ts: место при постановке заполняет config дефолтами из NODE_DEFS[kind].schema.
  - Все эффекты: emit маппит EngineEvent → store actions + sideeffects (rocketLaunch на result, тост на node-status error).
- [x] **C3. Персистентность + демо-заготовка** (~2ч): localStorage-автосейв, Export/Import, Load demo + сборка `web/public/demo.json` (фабрика из демо-сценария docs/00). AC: перезагрузка сохраняет мир; demo.json грузится и запускается.
  - state/persist.ts: initPersist() с debounce 500мс, загрузка при старте, подписка на entities
  - web/public/demo.json: две фабрики (miner1→assembler→silo, miner2→telegram), 21 entity, компактная раскладка (0,0)-(16,11)
  - __checks__/demo.ts: валидация JSON, граф, цепочка miner→assembler→silo

## Трек D — ассеты (вне кода, параллельно)

- [ ] **D1. Спрайты**: сгенерировать набор по таблице docs/02, сложить в `web/public/assets/`, заполнить manifest.json. AC: все станки + 5 предметов покрыты, стиль единый, мир рендерится спрайтами.

## Усиление (только после «живой фабрики», в порядке отдачи на минуту работы)

- [ ] **E1. Электричество** (~3ч): аккумулятор (2×2, заряд/ёмкость = токены, кнопка «Зарядить», полоска заряда на спрайте), списание в Engine, шкала в TopBar, «Нет питания» у станка. Питание глобальное (docs/04).
- [ ] **E2. Модули MCP** (~3ч): `MODULE_DEFS`, слоты у assembler в ConfigPanel, `web-search` через `:online`-суффикс модели OpenRouter (сервер, docs/07) + `memory` (снапшот сундуков в prompt). Сильный питч-угол — показать вживую. AC: агент с модулем поиска отвечает на вопрос о сегодняшних событиях; без модуля — нет.
- [ ] **E3 = B5. Станки усиления**: furnace, chest, lab (описаны в треке B).
- [ ] **E4. Чертежи** (~3ч): рамка выделения, localStorage, групповой ghost, экспорт/импорт строкой. Брать, только если E1–E3 стабильны (docs/03, 06).

## Критический путь и порядок

```
A1 ──► A2 ─────────────► A4 ──► A5
        └► A3 (нужен B1)
B1 ──► B2 ──► B3 ──────────┘        ◄── интеграция A4+B3+B2 = «ЖИВАЯ ФАБРИКА»
        └──► B4 ──► C2 ──► C3 ──► B5/E1/E2
C1 (сразу после A1, независим)
D1 (в любой момент после A2)
```

Точка «**живая фабрика**» — конец первого дня: собрать мышью miner → assembler(мок) → silo, Run, увидеть едущие предметы, затор и ракету. Всё после — реальный LLM, смеситель на сцене, усиление и полиш.

## Чек-лист финала (последние 3 часа)

- [ ] Прогон демо-сценария docs/00 дважды: с ключом и в мок-режиме (fallback)
- [ ] Telegram-бот создан, токен вбит, сообщение долетает на телефон; curl-вебхук отрепетирован
- [ ] `web/public/demo.json` собран и красив (зум-аут выглядит как фабрика)
- [ ] `pnpm -r typecheck` чист, консоль браузера без красного
- [ ] Гифка/скрин в README (по возможности)

## Риски/блокеры

_(агенты пишут сюда)_
