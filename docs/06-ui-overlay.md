# 06 — UI-оверлей (React)

React поверх canvas. Оверлеи — absolute-элементы с `pointer-events: auto`, корень оверлея — `pointer-events: none` (клики проходят в Pixi). Стили — один CSS-файл, тёмная индустриальная палитра (панели `#1d1d22`, акцент `#d9a441`), без UI-библиотек.

## Компоненты — `web/src/ui/`

### App.tsx
Монтирует Pixi (`game/app.ts`) в `<div ref>`, поверх — TopBar, Hotbar, ConfigPanel, ResultPanel, Toasts.

### Hotbar.tsx (низ по центру, стиль инвентаря Factorio)
- Слоты в порядке: belt, miner, assembler, splitter, mixer, silo, telegram, затем furnace, chest, lab (усиление — можно скрыть за флагом). Хоткеи 1..9, 0.
- Иконка — мини-плейсхолдер цвета станка (или спрайт из реестра), подпись — title из `NODE_DEFS`, выбранный слот подсвечен.
- Клик/хоткей → `store.setTool(kind)`; повторно или Esc → сброс.

### TopBar.tsx (верх)
- ▶ Run / ⏹ Stop (Space): Run строит граф + Engine и запускает (docs/01 «Поток данных»); Stop гасит.
- Кнопки: Export (скачать JSON), Import (файл), Load demo (`fetch('/demo.json')` → `store.loadWorld`).
- Индикатор: число сущностей, зелёная точка running. Усиление E1: полоска энергии (budget/used); E4: две шкалы — ток (восстанавливается) и топливо (+ кнопка «Подкинуть угля»).

### ConfigPanel.tsx (правый drawer, открыт при `selectedEntityId != null`)
- Заголовок: title + kind + закрыть (Esc).
- **FormRenderer** по `NODE_DEFS[kind].schema`: `text`/`number` → `<input>`, `textarea` → `<textarea rows=6>` (моноширинный), `json` → textarea с JSON-валидацией on-blur (красная рамка), `select` → `<select>`; выбор пресета рецепта у assembler подставляет `system` в textarea. Изменения → `store.setConfig`.
- Спец-блоки: miner — кнопка «▶ Вбросить» (активна при running, зовёт `runtime.triggerMiner(id)`); miner в режиме webhook — readonly URL `{server}/webhook/{id}` + кнопка Copy; assembler (усиление E2) — блок «Модули»: 3 слота-переключателя из `MODULE_DEFS` с иконками и подписью расхода энергии → `config.modules`.
- Низ: статус-бейдж по `nodeStatus`, текст последней ошибки, свёртки «Последний вход» / «Последний выход» с `<JsonView>`.

### ResultPanel.tsx — кульминация демо
- Открывается автоматически при событии `result` от silo (и по клику на silo/chest): список `store.results[id]` новыми вверх, каждая запись — время + `<JsonView>`; финальный текст крупно. Кнопки Copy и «Очистить».

### JsonView (общий мини-компонент)
`<pre>{JSON.stringify(value, null, 2)}</pre>` (строки — как есть), ограничение высоты, кнопка Copy. Без библиотек.

### Toasts.tsx (правый верхний угол)
`store.toasts`, автоудаление 4 с. Источники: ошибки станков («Агент: HTTP 500»), «Останови фабрику», итог Import.

## Связка с движком — `web/src/state/runtime.ts` (не React)

Единственный владелец Engine: `startRun()` / `stopRun()` / `triggerMiner(id)`; создаёт Engine с Transport из `game/packets.ts` и deps (`llm`, `proxyFetch` — обёртки над fetch к серверу; `webhooks` — обёртка над `EventSource('/events')`), события маппит в store-actions. React про Engine не знает.

## Чертежи (усиление)

Кнопка/клавиша `B` → режим выделения рамкой (рисует Pixi ghost-слой) → «Сохранить чертёж» (имя) → список чертежей в отдельной вкладке Hotbar; постановка — групповой ghost. Export/Import чертежа строкой base64 через диалог.

## Задачи и acceptance criteria

- C2: компоненты + runtime.ts. AC:
  1. рецепт «Суммаризатор» у assembler подставляет system-промпт, правки переживают перезагрузку (localStorage);
  2. кнопка «▶ Вбросить» у шахты запускает пакет; при остановленной фабрике — disabled;
  3. ошибка станка видна тостом и бейджем;
  4. запуск ракеты открывает ResultPanel с финальным текстом, Copy работает;
  5. Run блокирует редактирование поля, Stop возвращает;
  6. Export→Import восстанавливает фабрику 1-в-1;
  7. у шахты-вебхука отображается URL с настоящим id, Copy работает.
- A3 (совместно с docs/03): Hotbar — выбор, хоткеи, подсветка.
