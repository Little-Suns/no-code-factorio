# 05 — Каталог станков

`core/nodes/` — файл на станок + `index.ts` с реестром `NODE_DEFS: Record<MachineKind, NodeDef>`.

## Контракты

```ts
export interface NodeDef {
  kind: MachineKind;
  title: string;                        // «Сборочный станок (Агент)»
  size: { w: number; h: number };       // при dir=0; дублирует docs/03 — единственное место в коде
  outItem?: ItemType;                   // явный тип выходного предмета; нет → auto (string→text, иначе json)
  schema: Field[];                      // конфиг-форма (рендерит ui/ConfigPanel)
  handler?: Handler;                    // нет у belt; у miner — источник payload (см. ниже)
}
export interface Field {
  key: string; label: string;
  type: 'text' | 'textarea' | 'number' | 'json' | 'select';
  options?: { value: string; label: string }[];   // для select
  placeholder?: string;
  default?: unknown;                              // значение при постановке станка
}
```

При постановке станка `config` заполняется дефолтами из `schema` (`store.place`) — Run никогда не падает на пустых полях: у каждой ноды рабочий дефолт (у miner — текст-заглушка, у assembler — рецепт «Суммаризатор», у splitter — `true`).

```ts
export type HandlerResult =
  | { out: unknown } | { branch: 'true' | 'false' | 'pass' | 'rework'; out: unknown } | { done: true };
export interface NodeCtx {
  config: Record<string, unknown>;
  data: unknown;                        // payload пакета; у mixer — массив payload'ов
  tpl(s: string): string;               // {{path}} по data (core/tpl.ts)
  llm(req: { system?: string; prompt: string; tools?: string[] }): Promise<string>;  // server /llm (или мок); tools — id модулей
  proxyFetch(req: { url: string; method?: string; headers?: Record<string, string>; body?: string })
    : Promise<{ status: number; body: unknown }>;                          // server /proxy
}
export type Handler = (ctx: NodeCtx) => Promise<HandlerResult>;
```

## MVP-ядро

### miner — Шахта / Input (2×2, outItem: text)
- schema: `mode` (select: `text` «Заданный текст» / `url` «Содержимое URL» / `webhook` «Внешний вебхук»), `text` (textarea), `url` (text), `intervalSec` (number, 0 = только кнопка ▶).
- Источник, входа нет. Payload: mode `text` → содержимое поля; mode `url` → `proxyFetch(url).body` (как текст); mode `webhook` → тело POST на `{server}/webhook/{nodeId}` (ConfigPanel показывает readonly URL + Copy). Вброс — кнопкой ▶, интервалом или вебхуком (docs/04).

### assembler — Сборочный станок / Агент (3×3, outItem: text) — сердце системы
- schema: `recipe` (select: Суммаризатор / Переводчик на английский / Классификатор тональности / Критик / Свой рецепт), `system` (textarea — заполняется пресетом, редактируется).
- Пресеты (`core/nodes/recipes.ts`), формат `{ value, label, system }` — готовые system-промпты:
  - **Суммаризатор**: «Ты сжимаешь текст до 3 предложений, сохраняя суть. Отвечай только результатом, без преамбул.»
  - **Переводчик**: «Переведи текст на английский. Отвечай только переводом.»
  - **Классификатор тональности**: «Определи тональность текста. Ответь одним словом: positive, negative или neutral.»
  - **Критик**: «Назови 3 главные слабости текста и предложи улучшения. Кратко, списком.»
  - **Копирайтер**: «Преврати текст в короткий пост для соцсетей, до 280 знаков, один эмодзи.»
  - **Свой рецепт**: пустой system, пользователь пишет сам.
- handler: `llm({ system: config.system, prompt: typeof data === 'string' ? data : JSON.stringify(data), tools: config.modules })` → `{ out: text }`.
- **Модульные слоты (усиление E2)**: `config.modules: string[]` — до 3 модулей-MCP, вставляются в ConfigPanel (docs/06). `MODULE_DEFS` в `core/nodes/modules.ts`: `{ id, label, energyCost }` — `web-search` (веб-поиск посреди хода, через сервер, docs/07) и `memory` (снапшот содержимого сундуков подмешивается в prompt как RAG-контекст; движок передаёт его в NodeCtx). Каждый модуль повышает расход энергии станка (docs/04).

### splitter — Разветвитель (2×1)
- schema: `mode` (select: `expr` «Условие (JS)» / `llm` «Спросить LLM»), `expr` (text, placeholder `String(data).length > 500`), `question` (textarea, placeholder «Это позитивный отзыв?»).
- handler expr: `new Function('data', 'return (' + expr + ')')` → `{ branch: Boolean(r) ? 'true' : 'false', out: data }`.
- handler llm: `llm({ system: 'Ответь строго YES или NO.', prompt: question + '\n\n' + текст data })`; ответ содержит YES → `true`. Данные не меняет.

### mixer — Химзавод / Смеситель (3×3)
- schema: `mode` (select: `concat` «Склеить» / `llm` «LLM-синтез»), `prompt` (textarea, placeholder «Объедини версии в один пост»).
- `data` приходит массивом (движок собрал по ингредиенту с каждой входящей ленты, docs/04).
- handler concat: `{ out: { parts: data } }` (item json). handler llm: `llm({ system: prompt, prompt: пронумерованные ингредиенты })` → `{ out: text }`.

### silo — Ракета / Output (3×3, терминал)
- schema: пусто. handler: `{ done: true }`; движок эмитит `result` → store, рендер играет запуск, UI открывает панель результата (docs/06).

### telegram — Антенна / Отправка в Telegram (2×2, терминал)
- schema: `botToken` (text), `chatId` (text), `text` (textarea, tpl — «Готово: {{text}}»).
- handler: `proxyFetch({ url: 'https://api.telegram.org/bot' + botToken + '/sendMessage', method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: tpl(config.text) }) })` → `{ done: true }`; не-200 или `ok: false` в ответе Telegram → throw с описанием.
- Токен живёт в config сущности (localStorage) — удобно на демо; **экспорт фабрики с токеном в git не коммитить**.

### belt — Конвейер (1×1)
- Не станок: без handler и schema, участвует только в трассировке (docs/03).

## Усиление (после ядра)

### furnace — Печь / Препроцессор без LLM (2×2)
- schema: `code` (textarea, placeholder `return String(data).replace(/<[^>]+>/g, '')`).
- handler: `new Function('data', code)`; `undefined` → ошибка «furnace must return a value». Быстрый, «не думает».

### chest — Сундук / Буфер (1×1, outItem: batch)
- schema: `batchSize` (number, дефолт 5).
- handler: копит во внутреннем буфере движка; недобор → `{ done: true }` (+`result` для инспектора); набралось → `{ out: массив }` — пачка едет дальше (batch-обработка агентом-аналитиком).

### lab — Лаборатория / Критик (2×2)
- schema: `criteria` (textarea, placeholder «Текст вежлив, без воды, до 500 знаков»), outItem на ветке rework: verdict.
- handler: `llm({ system: 'Ты критик. По критериям ответь первой строкой PASS или REWORK, далее замечания.', prompt: criteria + текст })`. PASS → `{ branch: 'pass', out: data }`; иначе → `{ branch: 'rework', out: { draft: data, critique } }` — лента rework строится назад в assembler: петля «написал → проверил → переписал». От вечного круга защищает ttl.

### webhook — Антенна / Webhook, HTTP (2×2, терминал)
- schema: `url` (text), `method` (select GET/POST/PUT/DELETE, дефолт POST), `headers` (json, дефолт `{"content-type":"application/json"}`), `body` (textarea, tpl-шаблон, дефолт `{"content": "{{text}}"}`).
- Обобщение telegram: тот же `proxyFetch`, но без зашитого под один сервис URL/формата тела. Один узел закрывает Discord (Incoming Webhook: `{"content": "..."}`), Slack (Incoming Webhook: `{"text": "..."}`), GitHub API (issues/comments — `url: api.github.com/repos/.../issues`, `headers: {authorization: "Bearer ..."}`), email-провайдеры (Resend/SendGrid) и любой REST API.
- `{{text}}` в body резолвится, даже если payload пришёл голой строкой (обычный случай для outItem `text` у miner/assembler) — handler оборачивает такую строку в `{ text: ... }` перед рендером шаблона, только объект — используется как есть (доступны его собственные поля через `{{path.to.field}}`).
- handler: не-2xx статус ответа → throw (лом+дым, как у остальных узлов).
- Токен/URL живут в config (localStorage) — тот же принцип, что у telegram (docs/09: без credentials-системы).

### manipulator — Манипулятор (1×1)
- Без schema, без config.
- handler: чистый passthrough — `{ out: data }`, данные не меняются.
- **Обязательный посредник для любой передачи станок↔станок** (см. docs/03) — без манипулятора хотя бы на одном конце связи (лента→станок, станок→лента, станок вплотную к станку) `buildGraph` НЕ создаёт рабочий Edge: лента-путь без манипулятора на конце превращается в тупик (`to: null`, пакет падает), а два станка вплотную без манипулятора между ними не связаны вообще (0 edges). Исключение — belt↔belt (просто конвейер, манипулятор не нужен).
- Вход принимается с любого соседнего тайла (при footprint 1×1 сторона BACK/LEFT/RIGHT неразличима, см. docs/03), выход — только FRONT (`dir`).
- Визуал (`man.gif` → `manipulator_work.png`, 16 кадров) — не generic idle↔work по `status`, а своя схема на 8+8 кадров (`game/machines.ts`): `packet-consume` → кадры 0–7 (захват), по завершении спрайт зеркалится по X (`scale.x *= -1` — не поворот на 180°, иначе рука встаёт «вверх ногами»), `packet-spawn` от той же позиции → кадры 8–15 (выкладка), затем зеркало снимается и статичный idle-кадр. `GRAB_MS` в `core/nodes/manipulator.ts` держит handler ровно на длительность фазы захвата, иначе зеркалирование срабатывало бы раньше, чем доиграет анимация.

## Безопасность (осознанные хакатон-допущения)

`new Function` исполняет код пользователя в его же браузере — приемлемо. `/proxy` — открытый SSRF, только localhost (docs/07). Ключ LLM живёт на сервере, в браузер не попадает.

## Задачи и acceptance criteria

- B4 (ядро): NODE_DEFS + хендлеры miner/assembler/splitter/mixer/silo/telegram + recipes.ts, `__checks__/nodes.ts` (llm/proxyFetch — моки). AC:
  1. assembler зовёт llm с system из конфига и оборачивает ответ в `{ out }`;
  2. splitter-expr ветвит по условию, splitter-llm парсит YES/NO;
  3. mixer-concat склеивает массив, mixer-llm нумерует ингредиенты в prompt;
  4. miner-url тянет payload через proxyFetch (мок);
  5. telegram собирает корректный URL и body sendMessage (мок proxyFetch), кидает на `ok: false`;
  6. реестр покрывает все MachineKind кроме belt.
- B5 (усиление): furnace, chest, lab + их проверки (furnace падает на undefined; chest выпускает пачку ровно на batchSize; lab ветвит по PASS/REWORK).
