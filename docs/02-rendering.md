# 02 — Рендеринг (PixiJS)

Главный принцип: **спрайты — данные, не код**. Всё рисуется плейсхолдерами с первого дня; художник подкладывает PNG + строку в манифест — код не меняется.

## Сцена

- PixiJS v8, `Application` с `resizeTo: window`, фон `#3a3226` (тёмный грунт).
- `pixi-viewport`: пан — правая/средняя кнопка или зажатый Space, зум — колесо к курсору, clamp 0.25–2.0.
- Тайл: **64 px** (`TILE = 64` в `game/app.ts`, обязан совпадать с `manifest.tileSize`).
- Слои — контейнеры внутри viewport, снизу вверх: `ground` (сетка: линии alpha 0.08) → `belts` → `items` → `machines` → `fx` → `ghost`.

## Ассет-манифест — `web/public/assets/manifest.json`

```json
{
  "tileSize": 64,
  "sprites": {
    "assembler": { "size": [3, 3], "idle": "assembler_idle.png",
                   "work": { "file": "assembler_work.png", "frames": 4, "fps": 8 } },
    "belt":      { "size": [1, 1], "work": { "file": "belt.png", "frames": 8, "fps": 16 } },
    "item.text": { "size": [0.45, 0.45], "idle": "item_text.png" },
    "fx.smoke":  { "size": [0.5, 0.5], "idle": "smoke.png" }
  }
}
```

Правила:

- Ключи: `MachineKind`, `item.<ItemType>`, `fx.<имя>`.
- `size` в тайлах; для станков обязан совпадать с footprint из docs/03.
- Анимация — **горизонтальная лента кадров**: ширина PNG = `frames × size.w × 64`, высота = `size.h × 64`, прозрачный фон.
- Станки рисуются «смотрящими вверх» (dir = 0); поворот делает код: `sprite.angle = dir * 90`.
- `idle` опционален (кадр 0 из `work`), `work` опционален (статичный станок).

## Реестр ассетов — `game/assets.ts`

```ts
getTexture(key: string, state: 'idle' | 'work'): Texture | Texture[]   // Texture[] = кадры
```

- Загрузка: манифест → `Assets.load` → нарезка кадров (`Texture` + `Rectangle`).
- **Нет ключа или файл не загрузился → программный плейсхолдер** (`Graphics` → `generateTexture`): скруглённый прямоугольник цвета станка + крупная буква + белая стрелка направления (обязательна — иначе ориентация не читается).
- Цвета плейсхолдеров: belt `#8a8f98`, miner `#d9a441`, furnace `#c0653a`, assembler `#4a90d9`, splitter `#d94a6a`, mixer `#9b59d0`, chest `#7f8c8d`, lab `#2abfa4`, silo `#e74c3c`, telegram `#2aabee`, accumulator `#f39c12`, manipulator `#6fa8c9`; предметы: text `#e8e4d8`, json `#4ade80`, image `#7fb3d5`, verdict `#f1c40f`, batch `#b87333`, scrap `#555555`.

## Отрисовка сущностей

- **Станки** (`machines.ts`): контейнер на entity — спрайт (idle / AnimatedSprite work) + статус-лампа (круг 10px в углу: серый idle, жёлтый working, зелёный ok, красный error) по `nodeStatus` из store. Работающий станок переключает idle→work.
- **Ленты** (`belts.ts`): спрайт на тайл; кадры общие для всех лент (синхронная анимация). Плейсхолдер: тайл с шевронами, ticker сдвигает offset — эффект движения.
- **Предметы** (`packets.ts`): спрайт по центру тайла; масштаб от `sizeHint`: `сторона = TILE * clamp(0.3 + sizeHint / 4000, 0.3, 0.65)` — большой документ крупнее короткой фразы.

## Transport (контракт docs/01) — `game/packets.ts`

```ts
const TILE_MS = 400;   // скорость ленты
```

- `move(packetId, path, item, sizeHint)`: спрайт ведётся тикером по полилинии `path` (линейная интерполяция, длительность `path.length * TILE_MS`), по завершении **остаётся на последней точке** и резолвится promise. Спрайт стоит там до `packet-consume` (затор виден) или `packet-drop`.
- `packet-consume` → tween втягивания в станок (scale→0, 150 мс), удалить.
- `packet-drop`: `error` → текстура `item.scrap` + дым, убрать через 2 с; `dead-end`/`ttl` → падение с затуханием.
- `clear()` → снести все спрайты и активные твины (Stop).

## FX — `game/fx.ts`

- Дым: 5–8 частиц (серые круги или `fx.smoke`), подъём + fade 1 с. При `node-status: error`.
- **Ракета (silo)** — кульминация демо: `working` → тряска 200 мс; `ok` → спрайт ракеты улетает вверх с ускорением и огнём, через 1 с возвращается. Плейсхолдер — треугольник. Одновременно UI открывает панель результата (docs/06).
- Звуки (усиление): клик постановки, свист ракеты — `Audio`, файлы в `public/assets/sfx/`, их отсутствие ничего не ломает.

## Список спрайтов для художника (трек D)

| Ключ | Кадры | Размер PNG |
|---|---|---|
| miner | idle + 4 work | 128×128 |
| furnace | idle + 4 work | 128×128 |
| assembler | idle + 4 work | 192×192 |
| splitter (смотрит вверх, 2 тайла шириной) | idle + 4 work | 128×64 |
| mixer | idle + 4 work | 192×192 |
| chest | idle | 64×64 |
| lab | idle + 4 work | 128×64 |
| silo (ракета на площадке) | idle + 6 launch | 192×192 |
| telegram (антенна с тарелкой) | idle + 4 work | 128×128 |
| accumulator (аккумуляторная станция) | idle | 128×128 |
| belt | 8 work | 64×64 × 8 |
| item.text / json / image / verdict / batch / scrap | 1 | 32×32 |
| fx.smoke | 1 | 32×32 |
| ground (опц.) | 1–2 | 64×64 |

Стиль: топ-даун, индустриальный, пиксель-арт или чистый вектор — главное единообразие. Не копировать спрайты Factorio.

Энергослой (усиление): полоску заряда на аккумуляторе рисует код (`Graphics`) — отдельный спрайт не нужен.

## Задачи и acceptance criteria

- A1: сцена + viewport + сетка. AC: 60 fps, зум к курсору, пан правой кнопкой.
- A2: `assets.ts` + плейсхолдеры. AC: без единого PNG всё рисуется с буквами и стрелками; PNG + строка манифеста подменяет спрайт станка без правки кода.
- A4: Transport + анимации + лампы + FX. AC: FakeEngine-скрипт гоняет предмет по 10 тайлам плавно за ~4 с; Stop чистит мгновенно; занятый станок копит предметы у входа; sizeHint меняет размер предмета.
