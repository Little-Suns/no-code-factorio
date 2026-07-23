# 07 — Сервер (Python)

`server/main.py` — один файл, **FastAPI + uvicorn + httpx**, порт **8787**. Роли: спрятать ключ LLM, дать мок-режим для разработки и демо-страховки, обойти CORS для шахты-URL и антенны-telegram, принять внешние вебхуки. ~150–200 строк.

```
server/
  main.py
  requirements.txt   # fastapi, uvicorn, httpx
  .env               # LLM_API_KEY=... (+ LLM_BASE_URL, LLM_MODEL; в git не коммитить)
```

Запуск:

```bash
cd server
pip install -r requirements.txt
uvicorn main:app --port 8787 --reload --env-file .env
```

**Контракты endpoint'ов не зависят от языка — фронт (`runtime.ts`) их не различает.**

## Endpoints

### `POST /llm` — главный endpoint
Вход: `{ system?: string, prompt: string, tools?: string[] }`. Ответ: `{ text: string, mock?: true }`.

Основной путь — **реальный вызов любого OpenAI-compatible API**, по умолчанию OpenRouter. Конфиг через env:

```
LLM_BASE_URL = https://openrouter.ai/api/v1     # дефолт
LLM_API_KEY  = sk-or-...                        # обязателен для реальных вызовов
LLM_MODEL    = openai/gpt-4o-mini               # дефолт: быстрый и дешёвый
```

```
POST {LLM_BASE_URL}/chat/completions
headers: Authorization: Bearer {LLM_API_KEY}, content-type: application/json
body: { "model": LLM_MODEL, "max_tokens": 1024,
        "messages": [{ "role": "system", "content": system }, { "role": "user", "content": prompt }] }
→ клиенту { "text": resp.choices[0].message.content }
```

`tools` — id модулей станка (усиление E2). `'web-search'` на OpenRouter — добавить суффикс `:online` к модели (`openai/gpt-4o-mini:online`): веб-поиск выполняет сам провайдер, отдельный код не нужен. На провайдере без такой поддержки — вернуть понятную ошибку. Прочие id сервер игнорирует (модуль `memory` подмешивается в prompt на клиенте).

- Ошибка провайдера → `502 { "error": сообщение }`.
- **Fallback: нет `LLM_API_KEY` → мок-режим** (страховка демо без Wi-Fi и разработка без ключа): `await asyncio.sleep(1.5)`, ответ `{ "text": "[mock] " + первые 200 символов prompt, "mock": true }`; prompt с «YES или NO» → случайный `YES`/`NO`; система критика (содержит «PASS») → чередовать `PASS`/`REWORK ...`; с `tools: ['web-search']` → префикс `[mock][web-search]`. Фронт мок-режим не различает.

### `POST /proxy`
Вход: `{ url, method?, headers?, body? }`. Действие: `httpx.AsyncClient(timeout=20)` → запрос.
Ответ: `{ "status": ..., "body": ... }` — body как JSON, при неудаче — текст. Сетевая ошибка → `502 { "error": ... }`. Используется шахтой в режиме URL и антенной-telegram.

### `POST /webhook/{node_id}`
Принимает любое тело (JSON; не-JSON → `{ "raw": text }`). Ответ `200 { "ok": true }`.
Бродкаст всем SSE-клиентам: `data: { "type": "webhook", "nodeId": "...", "body": ... }`. Используется шахтой в режиме webhook.

### `GET /events` (SSE)
`StreamingResponse(media_type='text/event-stream')`. Каждому клиенту — свой `asyncio.Queue`, все очереди в общем `set` (удаление в `finally` по разрыву). Heartbeat: `asyncio.wait_for(queue.get(), timeout=15)`, по таймауту слать `: ping\n\n`. В браузере — один `EventSource` на Engine (обёртка `webhooks` в runtime, docs/04, docs/06).

## Сквозное

- CORS: `CORSMiddleware(allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])` — локальный хакатон.
- Лог: access-лога uvicorn достаточно.
- Env: `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` через `--env-file .env` либо экспорт в шелле.

## Безопасность (зафиксированные допущения)

`/proxy` — открытый SSRF по определению; допустимо **только** на localhost хакатона. Перед публичным деплоем: allowlist доменов + запрет приватных IP. `# ponytail: открытый proxy, allowlist при деплое`. Ключ LLM в браузер не попадает.

## Задачи и acceptance criteria

- C1: сервер целиком (`main.py` + `requirements.txt`). AC:
  1. с `LLM_API_KEY` (OpenRouter): `curl -X POST localhost:8787/llm -d '{"prompt":"привет"}' -H 'content-type: application/json'` → осмысленный текст модели;
  2. без ключа тот же вызов → `{ "text": "[mock] ..." }` через ~1.5 с (fallback);
  3. `curl -X POST localhost:8787/proxy -d '{"url":"https://api.github.com"}' -H 'content-type: application/json'` → `{ "status": 200, "body": {...} }`;
  4. мусорное тело на любом endpoint не роняет процесс (400/502, сервер жив);
  5. открыт `curl -N localhost:8787/events`, в соседнем терминале `curl -X POST localhost:8787/webhook/abc -d '{"x":1}' -H 'content-type: application/json'` → событие приходит в первый curl ≤ 1 с.
