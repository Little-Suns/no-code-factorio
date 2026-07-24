# No-Code Factorio 🏭

**Фабрика по обработке информации.** No-code платформа (идейно n8n), где пайплайн из AI-агентов строится как фабрика из Factorio: станки — агенты и обработчики, конвейеры — потоки данных, а по лентам в реальном времени едут предметы — куски данных, которые превращаются во что-то новое.

- Шахта «добывает» сырьё: текст, URL, данные из API
- Сборочный станок — **AI-агент с рецептом** (системный промпт: суммаризатор, переводчик, критик…) — реальный вызов LLM
- Разветвитель маршрутизирует предметы по условию или спрашивая мини-LLM
- Химзавод-смеситель ждёт ингредиенты с нескольких лент и соединяет их
- Ракета — финиш: запуск + панель с готовым результатом
- Антенна шлёт результат в **Telegram** или через универсальный узел **Webhook (HTTP)** — в Discord, Slack, GitHub API и любой REST API; шахта принимает **внешние вебхуки** — фабрика дотягивается до реального мира

То, что в n8n — невидимый JSON, здесь — физический процесс: агент «думает» — у станка копится очередь, и bottleneck пайплайна виден глазами без графиков и логов.

## Запуск

```bash
pnpm install && pnpm dev                    # web: http://localhost:5173

cd server && pip install -r requirements.txt
uvicorn main:app --port 8787 --reload       # server: http://localhost:8787
```

`server/.env`: `LLM_API_KEY=...` — ключ OpenRouter или любого другого OpenAI-compatible API (`LLM_BASE_URL`, `LLM_MODEL` настраиваются). Без ключа сервер падает в мок-режим — страховка для демо без Wi-Fi.

## Структура

```
web/      клиент: Vite + React + TS + PixiJS
server/   мини-сервер: Python + FastAPI — LLM-вызовы, прокси, вебхуки
docs/     документация проекта
```

## Документация

| Док | Что внутри |
|---|---|
| [docs/00-vision.md](docs/00-vision.md) | концепция, маппинг станков, демо-сценарий |
| [docs/01-architecture.md](docs/01-architecture.md) | архитектура, канонические типы, контракты |
| [docs/02-rendering.md](docs/02-rendering.md) | PixiJS-рендер, ассет-пайплайн из файлов |
| [docs/03-world-model.md](docs/03-world-model.md) | сетка, размещение, извлечение графа |
| [docs/04-execution-engine.md](docs/04-execution-engine.md) | движок: очереди, смеситель, петли |
| [docs/05-nodes-catalog.md](docs/05-nodes-catalog.md) | каталог станков и рецептов |
| [docs/06-ui-overlay.md](docs/06-ui-overlay.md) | React-интерфейс |
| [docs/07-server.md](docs/07-server.md) | сервер: /llm (+мок-режим), /proxy |
| [docs/08-roadmap.md](docs/08-roadmap.md) | роадмап, задачи, MVP vs усиление |
| [docs/09-n8n-reference.md](docs/09-n8n-reference.md) | выжимка по n8n: что воссоздаём, что нет |
