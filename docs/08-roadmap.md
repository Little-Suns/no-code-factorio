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
  - **Ревью-фикс (fix/lab-2x2-footprint):** `lab` был описан как 2×1, из-за чего при `dir=1/3` занимал 1×2 — «крив» при повороте вместо стабильного квадрата. Футпринт исправлен на 2×2 сразу в четырёх местах, где он дублировался (`core/grid.ts`, `core/nodes/index.ts`, `game/machines.ts`, `game/input.ts` — включая одиночный ghost и групповой ghost чертежа), плюс комментарий в `game/debugScene.ts` (мёртвый код, размеры там — текстурные, не футпринт). Арт (`lab_idle/work.png`) остался авторен на 2×1 — визуально растягивается по Y (`LAB_VISUAL_SCALE_Y=2`, искажение осознанно, см. комментарий в `machines.ts`). Новые проверки в `__checks__/grid.ts` (footprint/коллизия/порты на 2×2 для всех 4 dir).

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
  - **Актуализация (chore/refresh-demo-factory)**: `telegram` уже был убран из `MachineKind` веткой `feat/remove-telegram` (commit 9730315), и та же ветка целиком удалила вторую фабрику из demo.json — на момент начала этой задачи `origin/main`'s demo.json содержал только одну фабрику (`miner1→assembler→silo`), без второй фабрики и без каких-либо упоминаний telegram. Эта заметка (строка выше) была устаревшей, а не код. Правка ниже — чисто аддитивная: с нуля собрал вторую фабрику вместо удалённой, по мотивам второго сценария из docs/00 (шахта → сплиттер-LLM → внешнее уведомление), но с `webhook` вместо `telegram`: `miner2` (смешанный отзыв) → `manipulator` (оба порта шахты) → `splitter` (mode llm, «Это позитивный отзыв?») → true-ветка → `manipulator` → второй `silo`, false-ветка → `manipulator` → `webhook` (Discord/Slack-совместимый алерт с `{{text}}`). Заодно поправил мок-режим `/llm` (`server/main.py`) — проверка `"YES или NO"` смотрела только в `prompt`, а у splitter-а этот текст сидит в `system`, из-за чего мок всегда падал в generic-ответ → `splitterHandler` всегда парсил его как `false`, и true-ветка была недостижима офлайн; теперь мок проверяет оба поля и отвечает YES/NO случайно. 38 entities, 14 connected edges, `typecheck`/`__checks__/demo.ts` зелёные.

## Трек D — ассеты (вне кода, параллельно)

- [ ] **D1. Спрайты**: сгенерировать набор по таблице docs/02, сложить в `web/public/assets/`, заполнить manifest.json. AC: все станки + 5 предметов покрыты, стиль единый, мир рендерится спрайтами.

## Усиление (только после «живой фабрики», в порядке отдачи на минуту работы)

- [x] **E1. Электричество** (~3ч): аккумулятор (2×2, заряд/ёмкость = токены, кнопка «Зарядить», полоска заряда на спрайте), списание в Engine, шкала в TopBar, «Нет питания» у станка. Питание глобальное (docs/04).
  - engine.ts: `energyEnabled` считается в `start()` по наличию хотя бы одного `accumulator` на карте (сумма `config.capacity` по всем); если аккумуляторов нет — слой выключен, ядро работает как раньше (существующие 9 AC не тронуты). `getEnergyCost`: LLM-станки (assembler/splitter/mixer/lab — все, кто МОГУТ звать `ctx.llm`) — `(sizeHint/4+400)×(1+modules.length×0.5)`; механические (miner/furnace/telegram/silo/chest) — константа 10.
  - `awaitPower`: недобор → `node-status error 'Нет питания'` + retry каждые 2с (не роняет пакет, держит в очереди узла — обычный мьютекс уже блокирует остальные); хватило → списание + `emit('energy')`. `rechargeEnergy()` — публичный метод, заряжает до capacity.
  - Новый вариант `EngineEvent`: `{t:'energy', charge, capacity}` (типы — единственное реальное расширение контракта docs/01 за всю сессию, remaining API не тронут).
  - store/runtime: `store.energy`, `setEnergy`, `runtime.rechargeAccumulator()` — тот же мостик, что `triggerMiner`.
  - UI: TopBar — шкала (⚡ + полоска), видна только если `energy != null`; ConfigPanel — спец-блок accumulator (живой charge/capacity + кнопка «Зарядить», disabled при !running, как у miner-триггера); game/machines.ts — `chargeBar: Graphics` рисуется кодом прямо на спрайте аккумулятора (без отдельной текстуры, docs/02).
  - Попутно нашёл и починил тот же класс бага, что был у furnace/chest/lab: `accumulator` не было в `Hotbar.ALL_TOOLS` — станок нельзя было поставить мышью. Добавлен, хоткей `E` (цифры 0-9 заняты).
  - `__checks__/engine.ts` +1 (AC10: недобор блокирует с 'Нет питания', `rechargeEnergy()` разблокирует на следующей 2с-попытке — единственный тест с реальным ~2.2с ожиданием в сьюте, осознанно, т.к. интервал ретрая фиксирован спекой).
  - `pnpm typecheck` ✓, `pnpm check` ✓ (10 AC engine), `pnpm build` ✓. Браузером по-прежнему не проверял (нет Claude in Chrome в этой сессии).
  - **Ревью-фикс (пост-мортем реальным Engine, не только AC10):** `awaitPower` ждал заряда бесконечно, если `cost` станка превышал `capacity` аккумулятора целиком — `rechargeEnergy()` заряжает только до `capacity`, выше некуда, так что «Зарядить» не спасало. Воспроизведено на **дефолтной** `capacity=1000` из схемы с обычным текстом статьи (~2640 символов, ровно сценарий docs/00) — cost assembler-а ≈1060 > 1000, зависание навсегда. Фикс: `awaitPower` кидает `Error` до входа в ретрай-цикл, если `cost > capacity`, — ловится общим `catch` в `callHandler`, как у furnace/lab (`node-status error` + `packet-drop`), без нового кода обработки. AC12 в `__checks__/engine.ts` (мгновенная ошибка вместо ретраев); AC10 не задет (там `cost <= capacity`).
- [x] **E2. Модули MCP** (~3ч): `MODULE_DEFS`, слоты у assembler в ConfigPanel, `web-search` через `:online`-суффикс модели OpenRouter (сервер, docs/07) + `memory` (снапшот сундуков в prompt). Сильный питч-угол — показать вживую. AC: агент с модулем поиска отвечает на вопрос о сегодняшних событиях; без модуля — нет.
  - `server/main.py` (`/llm`) уже умел `:online`-суффикс и мок-режим для `web-search` — это было сделано ещё в C1, отдельно трогать сервер не пришлось.
  - `core/nodes/modules.ts`: `MODULE_DEFS` — `web-search` и `memory`, оба `energyCost: 0.5` (совпадает с реальной формулой `Engine.getEnergyCost`, а не декоративное число).
  - `assembler.ts`: `tools: modules` уже уходил в `ctx.llm` с B4 — это сервер сам разруливает. Новое — `memory`: сервер её игнорирует (по спеке), поэтому подмешивание в prompt сделано на клиенте, в самом `assemblerHandler`, только если `config.modules.includes('memory')` (без модуля `ctx.memory` игнорируется, даже если она есть в ctx — проверено отдельным AC).
  - `engine.ts`: `NodeCtx.memory?: unknown[]` (второе за сессию реальное расширение контракта, после `EngineEvent.energy`) + `collectChestMemory()` — сканирует все entities `kind==='chest'`, берёт то, что уже накопилось в `this.buffers` (буфер до батча, см. B5/`deliverToChest`), отдаёт в ctx только assembler-у с модулем `memory`.
  - ConfigPanel: сырой JSON-field `modules` у assembler больше не рендерится generic-циклом — вместо него блок переключателей по `MODULE_DEFS` (до 3, дальше клики по новым игнорируются), disabled при running, подпись с `energyCost` в title.
  - `__checks__/nodes.ts` +3 (AC9a tools→llm, AC9b memory→prompt, AC9c без модуля — memory не используется, даже если она в ctx). `__checks__/engine.ts` +1 (AC11 — assembler с `modules:['memory']` реально получает через движок то, что miner'ы успели накопить в chest, до полного батча).
  - `pnpm typecheck` ✓, `pnpm check` ✓ (11 AC engine, 9+3 AC nodes), `pnpm build` ✓. Браузером по-прежнему не проверял.
- [x] **E3 = B5. Станки усиления**: furnace, chest, lab (описаны в треке B, см. запись B5 выше — тот же таск, чекбокс дублируется по нумерации усиления).
- [x] **E4. Чертежи** (~4ч): рамка выделения, localStorage, групповой ghost, экспорт/импорт строкой. По блокам, с typecheck/check после каждого.
  - `core/blueprint.ts` (чистый TS): `serializeBlueprint` нормализует позиции к bounding box сущностей (через `footprintTiles`, не `entity.pos` — иначе повёрнутые станки сдвинули бы box неверно); `instantiateBlueprint` — origin + relative, свежие id на каждую сущность; `canPlaceBlueprint` — коллизии с миром **и** внутри самого набора (импорт — внешние данные, доверять нельзя); export/import строкой — `TextEncoder`/`TextDecoder` + `btoa`/`atob` вместо голого `btoa` (иначе кириллица в имени чертежа ломала бы кодирование). `__checks__/blueprint.ts` — round-trip, коллизии, отказ на битой/чужеродной строке.
  - `store.ts`: `blueprints`, `pendingSelection` (эфемерно, не персистится — ждёт имени в UI), `stampBlueprintId` (взаимоисключающе с `selectedTool`, как и раньше `selectedEntityId`); `placeMany` — атомарная постановка группы (или вся, или ничего), без дозаполнения дефолтов конфига (сущности чертежа уже полностью сконфигурированы). `state/blueprintPersist.ts` — зеркало `persist.ts`, отдельный ключ `ncf.blueprints.v1` (docs/01), т.к. чертежи не часть Export/Import фабрики.
  - `game/input.ts`: рамка выделения — не отдельный режим по клавише `B`, а просто зажим+растягивание ЛКМ, когда нет активного инструмента/чертежа на кисти (после ревью UX: `B`+драг был неинтуитивен); отличается от обычного клика по станку пиксельным сдвигом курсора (`DRAG_THRESHOLD`, приём как у ПКМ-сноса), рамка — `Graphics` в `layers.ghost`; в чертёж попадают только сущности, чей **весь** footprint внутри рамки. Захваченные рамкой станки дополнительно подсвечиваются отдельным `Graphics`-оверлеем (`entityHighlight`) — во время драга и пока открыта форма сохранения в `BlueprintPanel` (снимается по `pendingSelection === null` через подписку на стор). Групповой ghost чертежа — набор спрайтов вместо одного, тинт по `canPlaceBlueprint`, пересобирается только при смене чертежа. `stampBlueprintId` **не сбрасывается** после постановки — как и `selectedTool` у обычных станков, чертёж остаётся «на кисти» для повторной постановки подряд (отличие от изначального плана — решил в пользу симметрии с уже существующим UX, а не документной формулировки).
  - `ui/BlueprintPanel.tsx` + `.css`: без диалогов (`window.prompt` нигде в проекте не используется — сохранил инвариант) — форма сохранения и импорт строкой через обычные контролируемые инпуты. Список — не отдельная вкладка Hotbar (как было в первой редакции docs/06), а самостоятельная плавающая панель слева внизу, зеркало `ResultPanel` по вёрстке. Изначально видимость была чистой производной от `blueprints.length`/`pendingSelection` без своего `isOpen` (см. следующую запись — это изменилось).
  - `pnpm typecheck` ✓, `pnpm check` ✓ (blueprint-чеки + 12 AC engine), `pnpm build` ✓ (полная продакшен-сборка, не только typecheck). Браузером не проверял — Claude in Chrome не смог переподключиться в этой сессии (сервис-воркер расширения завис, воспроизводилось на нескольких попытках и после выбора браузера явно). Стоит прогнать глазами перед демо: `B` → рамка → сохранить → «Поставить» в новом месте → Export/Import строкой.
  - UX-фикс: зажим+растягивание ЛКМ вместо `B`+ЛКМ (интуитивнее), плюс подсветка захваченных рамкой станков (иначе непонятно, что попало в выделение) — см. заметку выше в этом же пункте.
  - UX-фикс: `Del`/`Backspace` при открытой рамке (`pendingSelection` не пуст) сносит разом все захваченные станки — `store.removeMany` (одна проверка `running`/один `set` на группу, а не N тостов от `remove()` при работающей фабрике), приоритет над одиночным `selectedEntityId`.
  - Баг-фикс: удаление рамкой не срабатывало — `autoFocus` на инпуте имени в форме сохранения (`BlueprintPanel.tsx`) перехватывал фокус сразу после драга, и глобальный `keydown` в `game/input.ts` игнорирует клавиши, пока фокус в `<input>`. Убрал `autoFocus` — минимальная правка без побочек (единственное место в проекте, тестов на него нет).
  - UX: клавиша `B` (освободившаяся от рамки выделения — та теперь просто драг ЛКМ) переключает видимость панели чертежей — `store.blueprintPanelOpen` (не персистится, дефолт `false`). `setPendingSelection(entities)` заодно выставляет `blueprintPanelOpen: true`, когда `entities` не `null` — иначе после рамки форма сохранения была бы не видна, пока панель не открыта явно по `B`. В хедере панели добавлена кнопка `✕` (`setBlueprintPanelOpen(false)`), аналог `ResultPanel`.
- [x] **E4b. Библиотека готовых чертежей** (усиление поверх E4, ~1ч): статичный набор пресетов, который ставится тем же путём, что и пользовательские чертежи, но не хранится в localStorage и не редактируется/не удаляется.
  - `core/blueprintLibrary.ts` (чистый TS, тот же тип `Blueprint`): 5 пресетов — «Ячейка обработки» (miner→manipulator→assembler), «Разветвитель на 2 выхода» (splitter→2×(manipulator→chest)), «Смеситель из 2 лент» (2 независимых входа через manipulator→mixer→manipulator→chest), «Линия саммаризатора → силос» (miner→assembler→manipulator→silo), «Предобработка + буфер» (manipulator→furnace→manipulator→chest, batchSize). Геометрия портов/входов посчитана вручную по `core/grid.ts` (outPorts/inTiles), каждый пресет соблюдает инвариант «manipulator обязателен для станок↔станок» на каждой связи.
  - **Ревью-фикс (P2):** у «Ячейки обработки» и «Линии саммаризатора» изначально были подключены ОБА выходных порта майнера (как в `demo.json`) — но `engine.ts` клонирует пакет на каждый live edge, а значит 2 линии miner→assembler означали ДВОЙНОЙ вызов LLM (и двойной пуск ракеты у силоса) на один trigger. Для «рекомендованных» пресетов это нежелательное скрытое удвоение стоимости — оставлена одна линия, второй порт майнера не подключён (dead-end, это допустимо и не ошибка).
  - `game/input.ts`: обе точки lookup чертежа «на кисти» (групповой ghost + постановка по pointerup) — `store.blueprints.find(...) ?? findLibraryBlueprint(id)`, т.к. `stampBlueprintId` — просто строка без привязки к конкретному массиву; библиотека резолвится как fallback после пользовательских чертежей.
  - `ui/BlueprintPanel.tsx`+`.css`: новая секция «Библиотека» под «Мои чертежи» — те же карточки, но только кнопка «Поставить» (без экспорта/удаления, пунктирная левая рамка вместо сплошной). Постановка — `setStampBlueprint(bp.id)`, дальше всё как у обычного чертежа (групповой ghost, `placeMany`, `stampBlueprintId` не сбрасывается после клика).
  - `core/__checks__/blueprintLibrary.ts`: раунд-трип `instantiateBlueprint`/`canPlaceBlueprint` (пустая карта, повторная постановка не коллизит, наложение на себя же детектится) + `buildGraph` на каждый пресет с проверкой РОВНО ожидаемого числа live edges (не `>0`) и связности — все не-belt сущности пресета должны лежать в одной компоненте связности графа live edges.
  - **Ревью-фикс (P1):** первая версия чека была слабой — `liveEdges.length > 0` вместо точного числа, и проверка «каждый live edge касается manipulator» была тавтологией (`buildGraph` по построению никогда не даёт live edge между двумя не-manipulator станками — это свойство `graph.ts`, а не пресета). Ревью эмпирически показало: сдвиг одной ленты в «Смесителе», разрывающий пресет на 2 несвязанные половины, всё равно проходил старый чек с exit 0. Заменено на точные счётчики (`EXPECTED_LIVE_EDGES` по id) + BFS-проверку связности всех станков пресета.
  - Пре-существующая заметка окружения: `tsx src/core/__checks__/run.ts` в этой рабочей копии падает на `ReferenceError: crypto is not defined` (Node 18.20.8, CJS-транспиляция tsx не подтягивает глобальный WebCrypto) — не связано с этой задачей, чертёж-чеки уже требовали `crypto.randomUUID()` до неё. `web/package.json` → `check` теперь сам подставляет `NODE_OPTIONS=--experimental-global-webcrypto`, так что `pnpm --filter web check` работает из коробки без ручного флага.
  - `tsc --noEmit` ✓, `pnpm --filter web check` ✓ — все 5 пресетов дают точное число живых edges (2/4/4/4/3) и единую компоненту связности.

- [x] **Ретема "Factory.exe"** (импорт дизайна из claude.ai/design через `DesignSync`, проект `ec6f227a-50f7-4e2c-817c-dbe37141dea7`, файл `Factory UI.dc.html`): взял из прототипа только дизайн/шрифты/цвета/расположения — не логику (в прототипе была устаревшая модель «режим SELECT + переключатель», которую мы уже осознанно заменили на прямой драг ЛКМ этой же сессией раньше; кнопку SELECT в TopBar не добавлял).
  - `web/index.html`: `:root` — новая тёмная терминальная палитра (фон `#0e1013`, панели `#24272d`/`#2f343b`, рамки `#0a0c0e` 2px, акцент `#f0a030`, `ok`/`error`/`idle` = `#5ecf7a`/`#e2483f`/`#5a5445`), шрифты Press Start 2P (`--f-disp`, только заголовки/CTA/glyph'ы Hotbar) + IBM Plex Mono (всё остальное, и фоллбэк для `--f-disp` — у Press Start 2P нет кириллицы, без фоллбэка русские подписи в этом шрифте молча ехали бы на generic `monospace`). Убрал мёртвые переменные (`--metal*`, `--rivet`, `--rust*`) и Big Shoulders/Manrope. Добавил `::-webkit-scrollbar` и `@keyframes blinkDot` (пульс статус-точки running) в глобальный `<style>`.
  - `game/app.ts`/`assets.ts`/`machines.ts`: тёмный фон канваса и сетки, `PLACEHOLDER_COLORS` и фон/рамка placeholder-тайлов станков, `STATUS_COLORS` лампы — все под новую палитру (то же самое цветовое соответствие kind→цвет, что и в `Hotbar.css`/`ConfigPanel.css`, просто в hex для Pixi `Graphics`).
  - `ui/TopBar.tsx`+`.css`: кнопки «Чертежи»/«Результаты» — переключают `store.blueprintPanelOpen`/`resultPanelOpen` (то же самое, что клавиша `B`, но мышью — и то же самое, чего раньше не было для ResultPanel вообще, см. ниже); энергошкала стала 10 сегментами вместо непрерывной заливки (дизайн-макет); заголовок TopBar намеренно НЕ переименовал в `FACTORY.EXE` из мокапа — оставил `no-code-factorio`, это уже контент/бренд, а не дизайн.
  - `state/store.ts`: добавил `resultPanelOpen`/`setResultPanelOpen` — раньше это было чисто локальное `useState` в `ResultPanel.tsx`, и закрытую панель нечем было переоткрыть вручную (только новый result от silo). Теперь TopBar тоже может её открыть/закрыть, как и `blueprintPanelOpen`.
  - `ui/ResultPanel.tsx`+`.css`: переехала в стор (см. выше), позиция — низ-лево (было низ-право, поменялись местами с BlueprintPanel по дизайн-макету), свёрнутое состояние — не `return null`, а плашка-реоткрывашка «⬓ RESULTS ▲» (как в мокапе) вместо полного исчезновения без возможности вернуть иначе как через новый result.
  - `ui/BlueprintPanel.tsx`+`.css`: переехала низ-право; хинт про выделение — теперь отдельная строка в теле дока, а не втиснут в хедер рядом с заголовком; кнопка закрытия хедера — `▾` (единый со сворачиванием ResultPanel), плюс такая же плашка-реоткрывашка «⬓ BLUEPRINTS ▲»; добавил пустое состояние «Нет чертежей» (было — список просто не рендерился).
  - `ui/ConfigPanel.tsx`+`.css`: раньше рендерился всегда со текстом-заглушкой «Выберите станок», теперь — задвижка `translateX(0/100%)` с transition, полностью уезжающая за экран и не занимающая место фабрики, когда `selectedEntityId == null` (дизайн-макет). Заголовок красится по kind через `data-kind` (то же цветовое соответствие, что в Hotbar).
  - `ui/Hotbar.css`: добавил цвета для furnace/chest/lab/accumulator — раньше в CSS было только 7 из 11 kind'ов, у остальных четырёх глиф молча падал на дефолтный `var(--text)` (несостыковка, не баг по функциональности, но визуальная дыра, которую мокап натолкнул исправить).
  - `pnpm typecheck` ✓, `pnpm check` ✓, `pnpm build` ✓ (полная сборка). Браузером не проверял — Claude in Chrome не смог переподключиться в этой сессии (тот же таймаут `tabs_context_mcp`, что и в предыдущих попытках). Стоит прогнать глазами перед демо: проверить контраст текста на новых тёмных фонах, обе боковые панели (открыть/свернуть/реоткрыть), задвижку конфига, hover-состояния кнопок.

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

## Интеграции (усиление, после «живой фабрики»)

- [x] **F1. Баг-фиксы + generic webhook-узел** (найдено ревью, issue #2 на GitHub): 4 бага пофикшены (`fix/bugs-and-http-node`):
  1. `miner mode='url'` не фетчил — `engine.spawnPacket` формировал payload сам, в обход `minerHandler`/`proxyFetch` (мёртвый код). Теперь `spawnPacket` вызывает `deps.handlers.miner` напрямую (та же логика, что и остальные узлы через `callHandler`); добавлен регрессионный `AC13` в `__checks__/engine.ts`.
  2. Уведомления (`toasts`) копились в сторе бесконечно — `Toasts.tsx` только визуально прятал, не удалял. Добавлен `store.dismissToast(id)`, зовётся из таймера после CSS-transition.
  3. Мок-критик лаборатории (`server/main.py`) гонялся между всеми `lab`-узлами через один общий `_critic_toggle: bool` — теперь `_critic_toggles: dict[nodeId, bool]`; `nodeId` подмешивается в `ctx.llm` автоматически в `engine.ts callHandler` (не часть контракта `Handler`/`NodeCtx`, только внутренняя сборка).
  4. `/llm`/`/proxy` падали в необработанный 500 на валидном не-объектном JSON — добавлена валидация типов тела запроса, ошибка → `400 {error}`.
  - Новый узел **webhook** (Антенна / Webhook, HTTP, 2×2): обобщение `telegram` — `url`/`method`/`headers`/`body`(tpl) настраиваемые, закрывает Discord/Slack/GitHub/email одним узлом вместо пяти специализированных. `{{text}}` резолвится и для голого строкового payload'а (см. docs/05).
  - `pnpm typecheck` ✓, `pnpm check` ✓ (+3 новых AC: webhook-success/error, miner-url regression), `pnpm build` ✓. Браузером не проверял в этой сессии.
- [x] **F2. Hotbar: иконки + тултипы + порядок** (`feat/hotbar-icons-tooltips`): текстовые буквы-заглушки в слотах Hotbar заменены на компактные инлайн-SVG глифы (без иконочных библиотек — правило CLAUDE.md), `title` дополнен коротким описанием роли станка (из docs/05). Данные вынесены в `ui/hotbarData.tsx` (`ALL_TOOLS`/`HOTKEYS`/`TOOL_NAMES`/`TOOL_DESCRIPTIONS`/`TOOL_ICONS`), `Hotbar.tsx` стал тонким.
  - Порядок `ALL_TOOLS` пересобран: `belt, miner, assembler, splitter, mixer, silo` (MVP-ядро CLAUDE.md, `telegram` убран — нет `telegram` как `MachineKind`/узла нигде в `web/src` (заменён на `webhook`); в CLAUDE.md, docs/00/01/02/03/05/07 и README.md слово «Telegram» по-прежнему упоминается исторически/как пример поддерживаемого сервиса — не трогал, вне скоупа этой задачи) → `manipulator` поднят из «усиления» в конец ядра: он обязателен для любой передачи станок↔станок (docs/03) и в `demo.json` встречается 3 раза — чаще любого другого узла усиления, поэтому не имеет смысла прятать его в хвост списка → `webhook` рядом с `silo` (второй терминал-узел) → усиление по приоритету CLAUDE.md: `accumulator`, затем `furnace, chest, lab`. Хоткеи (`HOTKEYS`) не завязаны на порядок массива — не менялись.
  - `pnpm typecheck` (`tsc --noEmit`) ✓, `pnpm build` ✓. Браузером не проверял (в этой сессии нет доступа к живому Chrome) — визуально стоит прогнать глазами перед демо: контраст глифов на активном/неактивном слоте, читаемость тултипа.
- [x] **F3. Баг-фикс: манипулятор у не конечного (mid-line) тайла конвейера не захватывал предмет** (`fix/manipulator-midline-grab`, docs/03): `trace()` в `graph.ts` признавала связь манипулятора с лентой только когда лента упиралась ПРЯМО в него (терминальный тайл); манипулятор, стоящий рядом с mid-line тайлом длинной ленты, вообще не получал edge. Добавлена `manipulatorIntake` — карта "BACK-тайл манипулятора → его id", `trace()` обрывается на любом таком тайле, даже если лента идёт дальше.
  - Ревью-фикс (до мержа): приоритет терминала — если СЛЕДУЮЩИЙ по ходу ленты тайл сам является манипулятором, боковой tap на текущем тайле игнорируется (иначе сосед-манипулятор мог бы украсть уже рабочую терминальную связь). Плюс детерминизм: коллизия двух манипуляторов на одном intake-тайле резолвится по лексикографически меньшему `id`, не по порядку `Object.values(entities)` — иначе один и тот же мир после save/load мог собрать другой граф.
  - MVP-упрощение, задокументировано в docs/03: первый tap по ходу трассы забирает весь поток источника — дальше по той же ленте другим манипуляторам/станкам ничего не долетает; манипулятор с петлёй выхода на свой же intake-тайл может дать `m -> m` self-edge (ограничено `ttl`, не зависание).
  - `__checks__/manipulator-intake.ts`: mid-line grab, terminal-priority (оба порядка вставки M1/M2), контрольный кейс без tapping-манипулятора, коллизия двух манипуляторов на одном intake-тайле, no-op на пустом/чужом intake-тайле. `pnpm typecheck` ✓, `pnpm check` ✓.
- [x] **F4. Локализация UI (RU/EN/ZH)** (`feat/i18n-en-zh`): собственный мини-i18n без внешних зависимостей (CLAUDE.md запрещает новые) — `web/src/i18n/` (словари + чистая `t()`), локаль в Zustand-сторе (`state/store.ts`), персистится отдельным ключом `state/localePersist.ts` (зеркало `persist.ts`), дефолт — язык браузера, иначе `en`. Переключатель — кнопка в `TopBar`.
  - Переведены TopBar/Hotbar/ConfigPanel/ResultPanel/LogsPanel/BlueprintPanel/JsonView, все тосты (`store.ts`/`runtime.ts`/`game/input.ts`), метки `NODE_DEFS`/`RECIPES`/`MODULE_DEFS`. `core/` не тронут: два русских текста ошибок в `engine.ts` (проверяются дословно в `__checks__/engine.ts`) переводятся только на отображении через `translateEngineError()`; `Recipe.system` (LLM-промпты) — бизнес-данные, не переведены намеренно.
  - При ребейзе на актуальный main добавлены переводы для новой секции «Библиотека» в `BlueprintPanel` (`feat/blueprint-library`) и заголовки инструментов Hotbar теперь берутся из `node.<kind>.title` вместо статичного `TOOL_NAMES` (`feat/hotbar-icons-tooltips`); короткие описания станков (`TOOL_DESCRIPTIONS`) пока не переведены — задача на будущее.
  - `pnpm typecheck` ✓ (`tsc --noEmit`), `pnpm build` ✓ (`vite build`). Браузером не проверял в этой сессии.
- [x] **F5. Обучалка первого запуска** (`feat/onboarding-tutorial`, docs/06): пошаговый тур (10 шагов, i18n RU/EN/ZH) со спотлайтом реальных элементов UI — `ui/Tutorial.tsx` (см. docs/06 за деталями реализации подсветки/позиционирования). Автостарт при первом визите (localStorage-флаг `ncf.tutorial.seen.v1`, `state/tutorialPersist.ts`), скип на любом шаге, повторный запуск — кнопка «? TUTORIAL» в TopBar. Пока тур активен — блокирует клики по канвасу и все хоткеи (иначе можно случайно наставить станков или что-то снести под карточкой тура).
  - Побочный баг-фикс (найден при ручной проверке в браузере — старое сохранение из localStorage не давало вообще ничего расставить на карту): `state/persist.ts` грузил персист без фильтрации по известным `kind` — сущность `kind:'telegram'` (узел убран в PR #21, `feat/remove-telegram`) валила `core/grid.ts` (`throw` на exhaustive-switch) при КАЖДОМ пересчёте занятости, т.е. на каждый pointermove/click с выбранным инструментом. Теперь `initPersist()` отсеивает сущности, чьего `kind` нет в `NODE_DEFS`, с предупреждением в консоль — старые сохранения больше не роняют расстановку целиком.
  - `pnpm typecheck` ✓, `pnpm check` ✓ (все 16 AC движка + графа/манипулятора без изменений). Проверено в браузере (chrome-devtools MCP): автостарт, спотлайт на всём хотбаре и на конкретном слоте (manipulator), Skip корректно закрывает тур и сохраняет флаг, Esc/хоткеи/клики по канвасу заблокированы во время тура, размещение станков работает после фикса персиста.
  - Правка (`feat/tutorial-lang-first`): первым шагом тура (11 вместо 10) — выбор языка (RU/EN/中文, кнопки вместо Next/Prev), предвыбран текущий язык. Не через `t()` — до выбора язык может быть неподходящим, заголовок/подсказка захардкожены трёхъязычно. Выбор сразу переключает `locale` и ведёт на шаг 2. Проверено в браузере: свежий визит открывает выбор языка первым, клик по 中文 мгновенно переводит весь UI (TopBar/карточку тура) и переходит на «Добро пожаловать».
  - Правка: добавлен шаг-чеклист «Если ничего не работает» (12 вместо 11, `tutorial.step.debug.*`, `target: 'logs'`) сразу после шага про Логи и перед финалом — напоминает сначала смотреть в Логи на тупики/ошибки и проверять, что КАЖДАЯ граница лента→станок и станок→станок закрыта манипулятором (частая причина «пакеты не едут и нет ошибки при сборке графа», см. docs/03-world-model.md). Дополняет, а не дублирует существующий шаг про сам манипулятор. Хардкод «10/11 шагов» в тексте `tutorial.step.welcome.desc` (все 3 локали) обновлён на 12.
  - Правка (тур стал практическим, 12 → 15 шагов): раньше тур был полностью пассивным — full-screen оверлей блокировал канвас/хотбар (`pointer-events: auto`), а хоткеи гасились `if (store.tutorialActive) return` в пяти местах (`game/input.ts`, `Hotbar.tsx`, `TopBar.tsx`, `App.tsx`, `NodeSearch.tsx`). Данные шагов вынесены в чистый `state/tutorialSteps.ts` (`TUTORIAL_STEPS`/`TutorialStep`, поле `practice?`) — нужно и `Tutorial.tsx`, и хоткей-хендлерам вне React. Пять шагов теперь **практика**: `manipulator`-шаг → `practice: 'connect'` (готовность засекается через `buildGraph().some(e => e.to !== null)`), новые шаги `rotate` (R, диффом `dir`) и `move` (drag, диффом `pos`) вставлены сразу за ним, `blueprints`-шаг → `practice: 'blueprintSave'` (рост `blueprints.length`), новый шаг `blueprintStamp` (штамповка чертежа на карту, диффом числа сущностей + факт клика «Поставить»). Гейт объединён в `tutorialBlocksInput(state)` — блокирует ввод только на НЕ-практик шагах; оверлей на практик-шаге получает класс `.practice` (`pointer-events: none`), карточка тура остаётся кликабельной сама по себе. Next/Finish задизейблены, пока действие не выполнено (снимок мира берётся при входе на шаг, `useEffect([step])`).
  - Заодно поправлен шаг `debug` — раньше был ошибочно завязан на панель Логов, хотя «отладка» в проекте это Pause+Step (docs/04, `TopBar.tsx: handleTogglePause`/`handleStep`). Текст теперь ведёт с Pause/Step (заморозка + один тик за раз), Логи — вторым, второстепенным упоминанием. Добавлен спот `data-tutorial="debug-controls"` на обёртку кнопок Pause+Step в `TopBar.tsx` (раньше шаг целился в `logs`). Хардкод числа шагов в `tutorial.step.welcome.desc` (все 3 локали) обновлён на 15. `pnpm typecheck` ✓; проверено в браузере — canvas/хотбар кликабельны на практик-шагах, `connect`/`rotate` шаги реально засчитываются после выполнения действия и открывают Next.
  - Правка (слишком много текста, 15 → 13 шагов): первые три пассивных шага (`welcome`/`metaphor`/`terms`) склеены в один короткий тизер — заголовок-тег-лайн + одна фраза, без объяснения "что такое платформа" (это и так объясняется устно на демо). Остальные `title`/`desc` по всем 13 шагам и всем 3 локалям (RU/EN/ZH) сокращены до одной короткой фразы каждый, без повторов терминов между соседними шагами. `state/tutorialSteps.ts` — 2 записи удалены из `TUTORIAL_STEPS`; ключи `tutorial.step.metaphor.*`/`tutorial.step.terms.*` удалены из `i18n/dictionaries.ts` (не переиспользовались нигде, кроме самого тура). Хардкода числа шагов в тексте не осталось (`{step+1}/{STEPS.length}` и так динамическое) — обновлять больше нечего. `pnpm typecheck` ✓, `pnpm check` ✓, `pnpm build` ✓. Браузером не проверял (по просьбе в этой сессии).
- [x] **F6. Баг-фикс: chest терял пакеты при fan-out + инспектор буфера сундука** (ветка `bug`): `Engine.spawnPacket` клонировал пакет на каждый исходящий edge шахты через `{ ...packet }` — тем же `id`, что и оригинал. При 2+ подключённых портах шахты (напр. оба ведут в один chest ради батча) `GameTransport.move()` (`game/packets.ts`) на повторный вызов с тем же `packetId` убивает tween предыдущего — первый клон никогда не резолвился и не доставлялся, chest реально получал только последний. Фикс — свежий `id` на каждый клон (как уже делал `callHandler` для выходов станка, тот же класс бага). Заодно `deliverToChest` теперь эмитит `result` и на недоборе, и на флаше батча с полным `items: unknown[]` (раньше — только `{buffered, batchSize}`, без содержимого); `ConfigPanel.tsx` у chest показывает список всех накопленных items вместо одного `lastIn` — иначе выглядело как «сундук хранит только последнее вхождение», хотя движок уже собирал пачку верно.
  - `__checks__/engine.ts` AC9 обновлён под новый флаш-result (3 result у chest вместо 2, с `items`/`flushed`); регрессия на дублирующийся id проверена вручную гоночным Transport-моком (не оставлена в репо — одноразовый repro). `pnpm typecheck` ✓, `pnpm check` ✓ (17 AC). Браузером не проверял — просили не проверять в этой сессии.
- [x] **F7. Пошаговая отладка** (ветка `bug`, docs/04): `Engine.setDebugMode`/`step()` — «ворота» (`debugGate`) на spawn у шахты (и на каждый выходной клон станка отдельно) и consume на входе в станок/chest/mixer; источники новых пакетов (интервал-шахты, вебхуки) тоже блокируются отдельным от `paused` флагом, чтобы не путаться с паузой скрытой вкладки. TopBar: кнопки «⏸ Пауза»/«▶ Продолжить» + «⏭ Шаг» (активны при `running`), i18n RU/EN/ZH.
  - `__checks__/engine.ts` AC17: miner→assembler→silo, ровно 4 ворот на весь путь, поштучная проверка что ничего не едет без `step()`. `pnpm typecheck` ✓, `pnpm check` ✓ (17 AC). Браузером не проверял.
- [x] **F8. Поиск/фокус по узлам** (ветка `bug`, docs/06): `ui/NodeSearch.tsx` — Ctrl+F или кнопка в TopBar, фильтр по `id`/`kind`, выбор летит камерой (`game/camera.ts: focusEntity`, `pixi-viewport.animate()`) и подсвечивает узел пульсирующей рамкой на fx-слое.
  - `pnpm typecheck` ✓, `pnpm build` ✓. Браузером не проверял — просили не проверять в этой сессии.
  - Отменено пользователем и не реализовано: «инспектор потока» (LogsPanel-тумблер, подсветка edge последнего хопа пакета пунктиром) — было сделано и откачено в этой же сессии по прямой просьбе, в репозитории не осталось.
  - Также сделано и откачено в этой же сессии (пользователь передумал): наведение/клик по пакету — тултип с id при наведении, плавное сопровождение камерой по клику — в репозитории не осталось.

## Риски/блокеры

_(агенты пишут сюда)_

- **Пофикшен баг «фабрика иногда зависает при старте»** (репорт: станки/пакеты перестают
  что-либо делать после Run, нерегулярно). Расследование тремя параллельными агентами +
  ревью вторым Plan-агентом сошлось на двух причинах, обе в `web/src/state/runtime.ts`:
  1. TOCTOU race в `startRun()` — модульная переменная `engine` присваивалась только после
     трёх `await` (создание fetch-обёрток, динамический импорт `core/nodes`), и всё это
     время guard `if (engine)` не видел уже стартующий движок. Двойной клик Run или
     удержание Space (у хоткея не было `e.repeat`-гварда — автоповтор ОС слал `keydown`
     пачками) создавали **второй** `Engine`, который переживал первый: первый оставался
     недостижим для `stopRun()`, продолжая слать пакеты/дёргать шахты независимо.
     Фикс — синхронный флаг `starting`, выставляется до первого await, сбрасывается в
     `finally`.
  2. `createLlmFetch`/`createProxyFetch` делали голый `fetch()` без таймаута — если запрос
     к нашему серверу зависал, `await` в `callHandler` (engine.ts) никогда не резолвился,
     и per-node очередь (`enqueuePacket`/`processNode`) блокировалась навсегда для всех
     будущих пакетов этой ноды. Фикс — `fetchWithTimeout` (свой `AbortController` +
     `setTimeout`, без новых зависимостей): 35с для `/llm`, 25с для `/proxy` — с запасом
     над серверными таймаутами 30с/20с (`server/main.py`), чтобы обычно первым срабатывал
     серверный таймаут с внятной JSON-ошибкой.
  - Заодно закрыт соседний race: Stop, нажатый именно в асинхронное окно старта (когда
    `engine` ещё `null`), раньше был no-op'ом, и `startRun()` всё равно поднимал фабрику
    вопреки клику Stop — добавлен флаг `stopRequestedDuringStart`.
  - Побочная утечка: `web/src/game/packets.ts` — массив `tweens` рос неограниченно за
    долгий прогон (запись на каждый пакет никогда не удалялась при штатном завершении,
    только целиком в `clear()`/Stop). Заодно и в `packets.ts`, и в `web/src/game/fx.ts`
    убрали `new Ticker()` на каждый пакет/частицу/фазу ракеты в пользу общего
    `Ticker.shared` (as `machines.ts` уже делал для лампы статуса) — меньше нагрузки под
    трафиком, некому больше течь.
  - Намеренно НЕ тронуто: буферизация `deliverToMixer`/`deliverToChest` в ожидании всех
    входов — штатный бэкпрешер по докам, не баг (со стороны похоже на «зависшие пакеты»,
    если в графе реально есть незапитанная ветка — это ожидаемо).
  - Добавлен `web/src/core/__checks__/stress.ts` (30 параллельных цепочек одновременно;
    один хендлер зависает навсегда — соседние цепочки всё равно должны дойти до результата)
    — раньше ни один чек не гонял больше 2-4 сущностей и не проверял «один зависший
    хендлер не должен парализовать остальных», хотя это ровно то свойство, на которое
    опирается фикс таймаута.
  - `pnpm typecheck` ✓, `pnpm check` ✓ (включая новый stress-чек), `pnpm build` ✓.
    Браузером не проверял — Claude in Chrome не смог переподключиться в этой сессии
    (`tabs_context_mcp` таймаутил на нескольких попытках, как и в паре предыдущих сессий).
    Перед демо стоит руками: быстро дважды кликнуть Run, подержать Space 1-2с, дать
    фабрике поработать подольше — не должно быть предупреждений о повторном движке в
    консоли и залипших станков.

- **Пофикшен второй баг «замораживания» станков/манипулятора** (репорт: после смены
  статуса, невозможности передать пакет дальше или неверного поворота узел визуально
  застревает и перестаёт годиться для следующих пакетов). Две независимые причины:
  1. `game/machines.ts` (`updateMachineStatus`): work-анимация станка ставилась на
     `AnimatedSprite.loop = false` и проигрывалась один раз. Реальный handler (LLM-вызов
     и т.п.) часто идёт дольше одного прохода анимации — станок замирал на последнем
     work-кадре до самого завершения, хотя статус всё ещё `working`. Фикс: `loop = true`
     на входе в `working`, `lastStatus`-гварда (уже была) не даёт повторно дёргать `.play()`.
  2. `core/engine.ts` (`callHandler`): если у узла 0 исходящих edge для branch (частая
     причина — манипулятор развёрнут не в ту сторону, `buildGraph` не создал Edge вовсе,
     docs/03) — `packet-spawn` не эмитился совсем. `triggerManipulatorRelease` в
     `runtime.ts` висит именно на этом событии, поэтому манипулятор навсегда оставался в
     позе "держит предмет". Фикс: при `outEdges.length === 0` эмитим `packet-spawn` +
     `packet-drop('dead-end')`, как при настоящем тупике ленты — манипулятор отыгрывает
     release, пакет наглядно падает вместо тихой пропажи.
  - Регрессия: `core/__checks__/manipulator-invariant.ts` Test E (манипулятор с 0
    исходящих edge — packet-spawn + dead-end drop, не тишина). `pnpm typecheck` ✓,
    `pnpm check` ✓, `pnpm build` ✓. Браузером не проверял (по просьбе в этой сессии).

- **Поправлен систематический разворот арта станков на постановке** (репорт: любой
  инструмент с панели в момент постановки визуально смотрит вправо вместо "прямо").
  Логика постановки/DELTA внутренне согласована (`dir=0` всегда при первом клике,
  без нажатия R) — по всей видимости, сам арт станков (кроме `belt`, у него отдельный
  процедурный рендер в `belts.ts`) нарисован в нейтральной позе лицом вправо (E), а не
  вверх (N), как принято для `dir=0`. Добавлен `machineSpriteAngle()` (`game/machines.ts`,
  экспортирован) — офсет -90° к `sprite.angle` относительно `entity.dir * 90`, применяется
  и к размещённым станкам (`machines.ts`), и к обоим ghost-предпросмотрам (`input.ts`:
  одиночная постановка + групповой ghost чертежа), но НЕ к footprint/occupancy (те считаются
  от `entity.dir` напрямую, смещение чисто визуальное) и НЕ к `belt` (свой рендер,
  внутри цикла и так исключён/явно проверяется по `kind`). Смещение применено вслепую
  по решению пользователя — Claude in Chrome не смог переподключиться в этой сессии
  (`tabs_context_mcp` не отвечал), визуально в браузере не проверено. Стоит посмотреть
  глазами перед демо: поставить любой станок без поворота — должен смотреть "прямо"
  (вверх), а не вправо; если офсет оказался в другую сторону — знак в `machineSpriteAngle`
  надо поменять на `+90` (т.е. `((dir + 1) % 4) * 90`).
