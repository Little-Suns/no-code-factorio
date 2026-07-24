import { Container, Graphics, Ticker } from 'pixi.js';
import { TILE } from './app';
import { useStore } from '../state/store';
import { DELTA } from '../core/types';
import type { Entity, Dir, Vec } from '../core/types';
import type { GameLayers } from './app';

// Палитра Factory.exe (см. machines.ts / index.html)
const TRACK_FRAME = 0x0a0c0e; // тёмный бортик/рамка
const TRACK_BASE = 0x2a2f37; // тело дорожки
const RAIL_HI = 0x4b525d; // светлая грань рельса (бевел сверху)
const RAIL_SH = 0x181c22; // тёмная грань рельса (бевел снизу)
const BOLT = 0x05070a; // заклёпки на рельсах
const TREAD = 0x21252b; // тёмные поперечные насечки (сегменты ленты)
const CHEVRON = 0x35c8e6; // циан — бегущие шевроны потока (данные)
const CHEVRON_CORE = 0xd6f6ff; // светлое ядро шеврона для контраста

const TRACK_W = TILE * 0.54; // ширина дорожки
const RAIL_W = 3; // толщина рельса-бевела
const SPACING = TILE / 4; // шаг шевронов; делит TILE нацело → непрерывность через стыки
const POOL = TILE / SPACING + 1; // слотов шевронов на тайл (лишние прячутся на краях)
const FLOW_PX_PER_SEC = 34; // скорость потока (в тайл-единицах пути)
const FADE = SPACING * 0.9; // длина плавного появления/исчезновения у краёв тайла

const opposite = (d: Dir): Dir => (((d + 2) % 4) as Dir);

// Мид-точка ребра тайла в локальных координатах (0..TILE) по направлению
const EDGE_MID: Record<Dir, Vec> = {
  0: { x: TILE / 2, y: 0 }, // N
  1: { x: TILE, y: TILE / 2 }, // E
  2: { x: TILE / 2, y: TILE }, // S
  3: { x: 0, y: TILE / 2 }, // W
};

// Угол тайла между двумя перпендикулярными рёбрами — центр дуги поворота
function cornerPoint(a: Dir, b: Dir): Vec {
  const s = new Set<Dir>([a, b]);
  if (s.has(0) && s.has(1)) return { x: TILE, y: 0 }; // N+E
  if (s.has(1) && s.has(2)) return { x: TILE, y: TILE }; // E+S
  if (s.has(2) && s.has(3)) return { x: 0, y: TILE }; // S+W
  return { x: 0, y: 0 }; // W+N
}

interface BeltShape {
  kind: 'straight' | 'corner';
  enter: Dir; // сторона входа потока
  exit: Dir; // сторона выхода = entity.dir
}

/**
 * Форма тайла по соседям: ищем ленту, которая выводит поток В нас.
 * Прямая — если поток входит сзади (или входа нет: старт линии / питание станком).
 * Поворот — если единственный вход сбоку (перпендикулярно направлению).
 * Чистая функция от entities, логику графа не трогает.
 */
function beltShape(entity: Entity, byTile: Map<string, Entity>): BeltShape {
  const exit = entity.dir;
  const back = opposite(exit);
  let sideEnter: Dir | null = null;
  let backEnter = false;

  for (let d = 0; d < 4; d++) {
    const dir = d as Dir;
    if (dir === exit) continue;
    const nb = byTile.get(`${entity.pos.x + DELTA[dir].x},${entity.pos.y + DELTA[dir].y}`);
    if (nb && nb.kind === 'belt' && nb.dir === opposite(dir)) {
      if (dir === back) backEnter = true;
      else sideEnter = dir;
    }
  }

  if (!backEnter && sideEnter !== null) {
    return { kind: 'corner', enter: sideEnter, exit };
  }
  return { kind: 'straight', enter: back, exit };
}

/**
 * Путь центра дорожки t∈[0,1] от enter к exit + угол касательной (направление потока).
 * Прямая — линейно; поворот — дуга радиуса TILE/2. Оба параметризованы так, что
 * тайл проходится за одинаковый «тайл-единицу» пути → шевроны выровнены на стыках.
 */
function makePath(shape: BeltShape): (t: number) => { x: number; y: number; rot: number } {
  const em = EDGE_MID[shape.enter];
  const xm = EDGE_MID[shape.exit];

  if (shape.kind === 'straight') {
    const rot = Math.atan2(xm.y - em.y, xm.x - em.x);
    return (t) => ({ x: em.x + (xm.x - em.x) * t, y: em.y + (xm.y - em.y) * t, rot });
  }

  const c = cornerPoint(shape.enter, shape.exit);
  const r = TILE / 2;
  const a0 = Math.atan2(em.y - c.y, em.x - c.x);
  let d = Math.atan2(xm.y - c.y, xm.x - c.x) - a0;
  while (d <= -Math.PI) d += 2 * Math.PI;
  while (d > Math.PI) d -= 2 * Math.PI;
  return (t) => {
    const a = a0 + d * t;
    const rot = a + (d >= 0 ? Math.PI / 2 : -Math.PI / 2);
    return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a), rot };
  };
}

// Кольцевой сектор (дуга-дорожка) в Graphics
function annularSector(g: Graphics, c: Vec, rInner: number, rOuter: number, a0: number, a1: number) {
  let d = a1 - a0;
  while (d <= -Math.PI) d += 2 * Math.PI;
  while (d > Math.PI) d -= 2 * Math.PI;
  const ccw = d < 0;
  g.moveTo(c.x + rOuter * Math.cos(a0), c.y + rOuter * Math.sin(a0));
  g.arc(c.x, c.y, rOuter, a0, a1, ccw);
  g.lineTo(c.x + rInner * Math.cos(a1), c.y + rInner * Math.sin(a1));
  g.arc(c.x, c.y, rInner, a1, a0, !ccw);
  g.closePath();
}

/**
 * Статичная дорожка с детализацией: тёмная рамка → тело → светлые рельсы-бевел по краям
 * → тёмные поперечные насечки (сегменты ленты). Рисуется один раз на форму тайла.
 */
function drawTrack(g: Graphics, shape: BeltShape, path: (t: number) => { x: number; y: number; rot: number }) {
  g.clear();
  const half = TRACK_W / 2;

  if (shape.kind === 'straight') {
    const vertical = shape.exit === 0 || shape.exit === 2;
    if (vertical) {
      g.rect(TILE / 2 - half - 2, 0, TRACK_W + 4, TILE).fill(TRACK_FRAME);
      g.rect(TILE / 2 - half, 0, TRACK_W, TILE).fill(TRACK_BASE);
    } else {
      g.rect(0, TILE / 2 - half - 2, TILE, TRACK_W + 4).fill(TRACK_FRAME);
      g.rect(0, TILE / 2 - half, TILE, TRACK_W).fill(TRACK_BASE);
    }
  } else {
    const c = cornerPoint(shape.enter, shape.exit);
    const em = EDGE_MID[shape.enter];
    const xm = EDGE_MID[shape.exit];
    const a0 = Math.atan2(em.y - c.y, em.x - c.x);
    const a1 = Math.atan2(xm.y - c.y, xm.x - c.x);
    const rMid = TILE / 2;
    annularSector(g, c, rMid - half - 2, rMid + half + 2, a0, a1);
    g.fill(TRACK_FRAME);
    annularSector(g, c, rMid - half, rMid + half, a0, a1);
    g.fill(TRACK_BASE);
  }

  // Поперечные насечки-сегменты вдоль пути (детализация, статично)
  const ticks = 4;
  for (let i = 0; i < ticks; i++) {
    const p = path((i + 0.5) / ticks);
    const nx = Math.cos(p.rot + Math.PI / 2);
    const ny = Math.sin(p.rot + Math.PI / 2);
    g.moveTo(p.x - nx * half * 0.82, p.y - ny * half * 0.82);
    g.lineTo(p.x + nx * half * 0.82, p.y + ny * half * 0.82);
    g.stroke({ width: 2, color: TREAD, alpha: 0.7 });
  }

  // Рельсы-бортики вдоль пути: двухтоновый бевел (светлая грань + тёмная) + заклёпки.
  // Через path() работает единообразно и для прямых, и для дуги.
  const rail = 22;
  for (const side of [-1, 1] as const) {
    // сплошная грань рельса
    for (let i = 0; i <= rail; i++) {
      const p = path(i / rail);
      const nx = Math.cos(p.rot + Math.PI / 2) * side;
      const ny = Math.sin(p.rot + Math.PI / 2) * side;
      const ex = p.x + nx * half;
      const ey = p.y + ny * half;
      if (i === 0) g.moveTo(ex, ey);
      else g.lineTo(ex, ey);
    }
    g.stroke({ width: RAIL_W, color: RAIL_HI, cap: 'round' });
    // тёмная грань чуть внутри
    for (let i = 0; i <= rail; i++) {
      const p = path(i / rail);
      const nx = Math.cos(p.rot + Math.PI / 2) * side;
      const ny = Math.sin(p.rot + Math.PI / 2) * side;
      const ex = p.x + nx * (half - RAIL_W);
      const ey = p.y + ny * (half - RAIL_W);
      if (i === 0) g.moveTo(ex, ey);
      else g.lineTo(ex, ey);
    }
    g.stroke({ width: 1.5, color: RAIL_SH });
    // заклёпки
    const bolts = 4;
    for (let i = 0; i < bolts; i++) {
      const p = path((i + 0.5) / bolts);
      const nx = Math.cos(p.rot + Math.PI / 2) * side;
      const ny = Math.sin(p.rot + Math.PI / 2) * side;
      const bx = p.x + nx * (half - RAIL_W * 0.5);
      const by = p.y + ny * (half - RAIL_W * 0.5);
      g.circle(bx, by, 1.6).fill(BOLT);
    }
  }
}

interface BeltView {
  container: Container;
  track: Graphics;
  chevrons: Graphics[];
  path: (t: number) => { x: number; y: number; rot: number };
  shapeKey: string;
}

const beltViews = new Map<string, BeltView>();

function makeChevron(): Graphics {
  const g = new Graphics();
  const s = TILE * 0.15;
  // «галочка» в +x (направление задаётся rotation): тёмная подложка + светлое ядро
  g.moveTo(-s * 0.6, -s).lineTo(s * 0.6, 0).lineTo(-s * 0.6, s).stroke({ width: 6, color: TRACK_FRAME, cap: 'round', join: 'round' });
  g.moveTo(-s * 0.6, -s).lineTo(s * 0.6, 0).lineTo(-s * 0.6, s).stroke({ width: 3.5, color: CHEVRON, cap: 'round', join: 'round' });
  g.moveTo(-s * 0.55, -s * 0.55).lineTo(s * 0.4, 0).lineTo(-s * 0.55, s * 0.55).stroke({ width: 1.2, color: CHEVRON_CORE, cap: 'round', join: 'round' });
  return g;
}

let flowDist = 0; // глобальная фаза потока в тайл-единицах пути

export function initBelts(layers: GameLayers): void {
  // См. machines.ts initMachines — тот же баг: без явного первого вызова уже
  // загруженный persist.ts мир не отрисовывался до следующего изменения entities.
  let prevEntities: Record<string, Entity> = useStore.getState().entities;
  updateBelts(prevEntities, layers.belts);
  useStore.subscribe((state) => {
    if (state.entities !== prevEntities) {
      prevEntities = state.entities;
      updateBelts(state.entities, layers.belts);
    }
  });

  // Единый тикер: глобальная фаза → шевроны всех лент выровнены и непрерывны на стыках.
  // Движение вперёд (enter→exit), плавный fade у краёв — без жёсткого появления/исчезновения.
  Ticker.shared.add((ticker) => {
    if (beltViews.size === 0) return;
    flowDist = (flowDist + (ticker.deltaMS / 1000) * FLOW_PX_PER_SEC) % SPACING;
    for (const view of beltViews.values()) {
      for (let k = 0; k < view.chevrons.length; k++) {
        const u = k * SPACING + flowDist; // растёт со временем → поток к выходу
        const ch = view.chevrons[k];
        if (u < 0 || u >= TILE) {
          ch.visible = false;
          continue;
        }
        ch.visible = true;
        // мягкое втекание у входа и вытекание у выхода вместо жёсткого on/off
        const fadeIn = Math.min(1, u / FADE);
        const fadeOut = Math.min(1, (TILE - u) / FADE);
        ch.alpha = Math.min(fadeIn, fadeOut);
        const p = view.path(u / TILE);
        ch.position.set(p.x, p.y);
        ch.rotation = p.rot;
      }
    }
  });
}

function updateBelts(entities: Record<string, Entity>, layer: Container): void {
  const byTile = new Map<string, Entity>();
  for (const e of Object.values(entities)) {
    if (e.kind === 'belt') byTile.set(`${e.pos.x},${e.pos.y}`, e);
  }
  const currentIds = new Set([...byTile.values()].map((e) => e.id));

  for (const id of [...beltViews.keys()]) {
    if (!currentIds.has(id)) {
      const v = beltViews.get(id)!;
      layer.removeChild(v.container);
      v.container.destroy({ children: true });
      beltViews.delete(id);
    }
  }

  // Форма зависит от соседей → пересчитываем всем (ленты меняются только в редакторе).
  for (const entity of byTile.values()) {
    const shape = beltShape(entity, byTile);
    const shapeKey = `${shape.kind}:${shape.enter}:${shape.exit}`;
    let view = beltViews.get(entity.id);

    if (!view) {
      const container = new Container();
      const track = new Graphics();
      container.addChild(track);
      const chevrons: Graphics[] = [];
      for (let i = 0; i < POOL; i++) {
        const ch = makeChevron();
        ch.visible = false;
        container.addChild(ch);
        chevrons.push(ch);
      }
      layer.addChild(container);
      view = { container, track, chevrons, path: makePath(shape), shapeKey: '' };
      beltViews.set(entity.id, view);
    }

    view.container.position.set(entity.pos.x * TILE, entity.pos.y * TILE);

    if (view.shapeKey !== shapeKey) {
      view.path = makePath(shape);
      drawTrack(view.track, shape, view.path);
      view.shapeKey = shapeKey;
    }
  }
}
