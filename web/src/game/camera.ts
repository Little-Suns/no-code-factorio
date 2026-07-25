// Камера — плавный перелёт viewport к узлу + подсветка (поиск по узлам, docs/06).
import { Graphics, Ticker } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { TILE } from './app';
import type { GameLayers } from './app';
import type { Vec } from '../core/types';

let viewport: Viewport | null = null;
let layers: GameLayers | null = null;

export function initCamera(viewportInstance: Viewport, gameLayers: GameLayers): void {
  viewport = viewportInstance;
  layers = gameLayers;
}

const FLY_MS = 500;
const HIGHLIGHT_MS = 1600;
const HIGHLIGHT_COLOR = 0xffcc33;

/**
 * Плавно наводит камеру на узел (центр его габарита) и рисует пульсирующую рамку
 * поверх него на fx-слое, которая сама гаснет — не завязана на выделение (ConfigPanel
 * можно закрыть, подсветка всё равно доиграет).
 */
export function focusEntity(pos: Vec, size: { w: number; h: number }): void {
  if (!viewport || !layers) return;

  const centerX = (pos.x + size.w / 2) * TILE;
  const centerY = (pos.y + size.h / 2) * TILE;

  viewport.animate({
    time: FLY_MS,
    position: { x: centerX, y: centerY },
    scale: Math.max(viewport.scale.x, 0.8),
    ease: 'easeInOutSine',
    removeOnInterrupt: true,
  });

  const ring = new Graphics();
  layers.fx.addChild(ring);

  const w = size.w * TILE;
  const h = size.h * TILE;
  let elapsed = 0;

  const tick = (t: Ticker) => {
    elapsed += t.deltaMS;
    if (elapsed >= HIGHLIGHT_MS) {
      Ticker.shared.remove(tick);
      layers?.fx.removeChild(ring);
      return;
    }
    // Несколько затухающих пульсаций, не одна монотонная — заметнее на большом чертеже
    const progress = elapsed / HIGHLIGHT_MS;
    const pulse = 0.5 + 0.5 * Math.sin(progress * Math.PI * 5);
    const fade = 1 - progress;
    const pad = 5;
    ring.clear();
    ring.rect(pos.x * TILE - pad, pos.y * TILE - pad, w + pad * 2, h + pad * 2);
    ring.stroke({ width: 3, color: HIGHLIGHT_COLOR, alpha: (0.35 + 0.65 * pulse) * fade });
  };

  Ticker.shared.add(tick);
}
