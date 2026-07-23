# 03 — Модель мира: сетка, размещение, извлечение графа

## Сетка — `core/grid.ts`

- Мир «бесконечный», целые координаты, могут быть отрицательными. Занятость: `Map<string, string>` c ключом `"x,y"` → entityId.
- `footprintTiles(entity): Vec[]` — тайлы сущности с учётом поворота.
- Размеры и порты (при dir = 0, «смотрит вверх», w×h в тайлах). Стороны в локальной системе станка: FRONT — куда указывает `dir`, BACK — противоположная, LEFT/RIGHT — если смотреть по `dir`:

| kind | size | входы | выходы (branch) |
|---|---|---|---|
| belt | 1×1 | любая сторона | FRONT |
| miner | 2×2 | — | FRONT, оба тайла (`out`) |
| furnace | 2×2 | BACK | FRONT (`out`) |
| assembler | 3×3 | BACK | FRONT (`out`) |
| splitter | 2×1 | BACK, оба тайла | FRONT левого тайла = `true`, правого = `false` |
| mixer | 3×3 | BACK + LEFT + RIGHT (все тайлы этих сторон) | FRONT, центральный тайл (`out`) |
| chest | 1×1 | BACK + LEFT + RIGHT | FRONT (`out`) |
| lab | 2×1 | BACK, оба тайла | FRONT левого = `pass`, правого = `rework` |
| silo | 3×3 | BACK, все тайлы | — |
| telegram | 2×2 | BACK, оба тайла | — |
| accumulator | 2×2 | — | — |

`accumulator` (усиление) — энергослой: занимает тайлы, но портов не имеет и в трассировке лент не участвует, `buildGraph` его игнорирует. Запитанность станков считается отдельно (docs/04).

- Хелпер поворота смещения внутри footprint (для тайлов и портов):

```ts
// локальное смещение (0..w-1, 0..h-1) → мировое смещение от pos
function rotOffset(dx: number, dy: number, w: number, h: number, dir: Dir): Vec
// dir=0: (dx,dy)  dir=1: (h-1-dy, dx)  dir=2: (w-1-dx, h-1-dy)  dir=3: (dy, w-1-dx)
```

- `outPorts(entity): { tile: Vec; branch: Branch }[]` — тайлы **снаружи** footprint у выходной стороны; `inTiles(entity): Set<"x,y">` — тайлы footprint, принимающие вход.

## UX размещения — `game/input.ts` (использует grid/store)

- Hotbar (клавиши 1..9 или клик) выбирает `selectedTool`.
- **Ghost**: полупрозрачный спрайт следует за мышью с привязкой к сетке; зелёный tint — все тайлы footprint свободны, красный — нельзя.
- ЛКМ — поставить. **Drag ЛКМ для ленты**: путь мыши растеризуется по тайлам (шаги по 4 направлениям, сперва по оси большего смещения), направление ленты = направление шага; существующая лента перезаписывается.
- `R` — повернуть ghost (или выделенный станок при пустом инструменте). ПКМ / `Delete` — снести под курсором. `Esc` — сброс инструмента/выделения.
- Клик по станку без инструмента → `selectedEntityId` (ConfigPanel).
- При `running` изменения запрещены — тост «Останови фабрику» (docs/01).

## Извлечение графа — `core/graph.ts`

`buildGraph(entities: Record<string, Entity>): Edge[]`

```
для каждого станка m (kind != 'belt'):
  для каждого порта { tile, branch } из outPorts(m):
    trace(tile) → { to, path }
    если path непуст или to найден → Edge { id: `${m.id}:${branch}:${n}`, from: m.id, branch, to, path }

trace(start):
  path = []; cur = start; visited = Set
  пока grid[cur] — belt:
    path.push(cur); visited.add(cur)
    cur = cur + DELTA[belt.dir]
    guard: cur ∈ visited или path.length > 500 → break        // кольцо лент
  если grid[cur] — станок и "x,y" ∈ inTiles(станка) → { to: станок.id, path }
  иначе → { to: null, path }                                   // тупик
```

- **Слияние лент** получается само: трассы разных станков проходят по общим тайлам, пути независимы.
- Порт без ленты вовсе (path пуст, to null) → edge не создаётся; пакеты с этого выхода дропаются сразу (`dead-end`).
- Несколько edges с одного branch (например, miner 2×2 с двумя лентами) → пакет клонируется на каждый.
- **Петля критика** (lab `rework` → назад в assembler) — это нормальный Edge; от вечных кругов защищает `ttl` (docs/04).
- Пересборка: полный `buildGraph` на каждое изменение поля (сотни сущностей — O(n·длина трасс), достаточно).

## Чертежи (усиление)

Инструмент выделения области (клавиша `B`): рамка → сущности области сериализуются с относительными координатами → список чертежей в localStorage + экспорт строкой (base64 JSON) для шеринга. Постановка чертежа = групповой ghost. Отдельная задача в docs/08, в MVP не входит.

## Задачи и acceptance criteria

- B1: `types.ts`, `grid.ts` (footprint, rotOffset, порты, занятость), `__checks__/grid.ts`. AC: asserts на rotOffset для всех 4 dir; footprint сплиттера при dir=1 занимает 1×2; порты splitter дают `true` слева; mixer имеет входы с трёх сторон.
- B2: `graph.ts`, `__checks__/graph.ts`. AC: мир «miner → 3 ленты → assembler» даёт 1 edge с path длиной 3; лента в никуда → `to: null`; кольцо лент не подвешивает trace; lab-петля образует корректный Edge назад.
- A3: input + ghost + hotbar (совместно с docs/06). AC: цепочка «шахта → 5 лент → станок → лента → ракета» собирается мышью за минуту; R и снос работают.
