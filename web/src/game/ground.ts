import { TilingSprite, type Application } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { TILE, type GameLayers } from './app';
import { getTexture } from './assets';

// Тот же запас, что и GRID_MARGIN_TILES в app.ts — фон должен покрывать видимую
// область с тем же буфером, что и сетка, иначе при быстрой панораме мелькнёт край.
const GROUND_MARGIN_TILES = 16;

/**
 * Тайловый фон земли (dirt.png из манифеста) под сеткой. Вызывать после loadAssets —
 * до этого текстура ещё не в кэше assets.ts и getTexture вернул бы серый плейсхолдер.
 */
export function initGround(app: Application, viewport: Viewport, layers: GameLayers): () => void {
  const rawTexture = getTexture('ground', 'idle');
  const texture = Array.isArray(rawTexture) ? rawTexture[0] : rawTexture;
  texture.source.addressMode = 'repeat'; // Assets.load грузит с clamp-to-edge по умолчанию
  const sprite = new TilingSprite({ texture, width: 0, height: 0 });
  layers.ground.addChildAt(sprite, 0); // под линиями сетки, которые уже лежат в этом слое

  let scheduled = false;
  const redraw = () => {
    scheduled = false;
    const left = Math.floor(viewport.left / TILE) - GROUND_MARGIN_TILES;
    const right = Math.ceil(viewport.right / TILE) + GROUND_MARGIN_TILES;
    const top = Math.floor(viewport.top / TILE) - GROUND_MARGIN_TILES;
    const bottom = Math.ceil(viewport.bottom / TILE) + GROUND_MARGIN_TILES;

    sprite.position.set(left * TILE, top * TILE);
    sprite.width = (right - left) * TILE;
    sprite.height = (bottom - top) * TILE;
    // Компенсация смещения спрайта — иначе узор "плывёт" относительно мира при панораме.
    sprite.tilePosition.set(-sprite.x, -sprite.y);
  };

  const scheduleRedraw = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(redraw);
  };

  redraw();
  viewport.on('moved', scheduleRedraw);
  viewport.on('zoomed', scheduleRedraw);
  app.renderer.on('resize', scheduleRedraw);

  return redraw;
}
