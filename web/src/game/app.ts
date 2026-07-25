import { Application, Container, Graphics } from 'pixi.js';
import { Viewport } from 'pixi-viewport';

export const TILE = 64; // px на тайл, обязан совпадать с manifest.tileSize

export interface GameLayers {
  ground: Container;
  belts: Container;
  items: Container;
  machines: Container;
  fx: Container;
  ghost: Container;
}

export async function createApp(canvas: HTMLCanvasElement): Promise<{ app: Application; viewport: Viewport; layers: GameLayers }> {
  const app = new Application();
  await app.init({
    canvas,
    resizeTo: window,
    backgroundColor: 0x181b1f, // тёмный грунт terminal-темы (дизайн-макет Factory.exe)
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  const viewport = new Viewport({
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    events: app.renderer.events,
  });
  app.stage.addChild(viewport);

  viewport
    .drag({ mouseButtons: 'middle-right' }) // пан — правая/средняя кнопка (docs/02)
    .wheel() // зум колесом к курсору (дефолт плагина)
    .clampZoom({ minScale: 0.25, maxScale: 2.0 });

  // ПКМ занята паном — контекстное меню мешает
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Слои внутри viewport, снизу вверх (docs/02)
  const layers: GameLayers = {
    ground: new Container(),
    belts: new Container(),
    items: new Container(),
    machines: new Container(),
    fx: new Container(),
    ghost: new Container(),
  };
  Object.values(layers).forEach((layer) => viewport.addChild(layer));

  const redrawGrid = initGrid(viewport, layers.ground);

  // resizeTo обновляет рендерер; viewport надо оповещать отдельно
  app.renderer.on('resize', (w: number, h: number) => {
    viewport.resize(w, h);
    redrawGrid();
  });

  return { app, viewport, layers };
}

const GRID_COLOR = 0x262b31;
// Запас вокруг видимой области в тайлах — редрав (раз в кадр, по событиям камеры)
// успевает дорисовать сетку до того, как край станет виден при панораме/зуме.
const GRID_MARGIN_TILES = 16;

/**
 * Сетка перерисовывается под видимую область viewport (а не статичным фиксированным
 * куском поля) — иначе при уходе камерой достаточно далеко сетка обрывается.
 * Редрав троттлится через requestAnimationFrame: 'moved'/'zoomed' летят на каждый
 * pointermove/wheel-тик, полный rebuild Graphics на каждый из них был бы лишним.
 */
function initGrid(viewport: Viewport, container: Container): () => void {
  const grid = new Graphics();
  container.addChild(grid);

  let scheduled = false;
  const redraw = () => {
    scheduled = false;
    const left = Math.floor(viewport.left / TILE) - GRID_MARGIN_TILES;
    const right = Math.ceil(viewport.right / TILE) + GRID_MARGIN_TILES;
    const top = Math.floor(viewport.top / TILE) - GRID_MARGIN_TILES;
    const bottom = Math.ceil(viewport.bottom / TILE) + GRID_MARGIN_TILES;

    grid.clear();
    for (let x = left; x <= right; x++) {
      grid.moveTo(x * TILE, top * TILE).lineTo(x * TILE, bottom * TILE);
    }
    for (let y = top; y <= bottom; y++) {
      grid.moveTo(left * TILE, y * TILE).lineTo(right * TILE, y * TILE);
    }
    // pixelLine — иначе при zoom out ширина линии (в мировых координатах) уходит
    // в субпиксель и сетка визуально пропадает.
    grid.stroke({ width: 1, color: GRID_COLOR, alpha: 0.9, pixelLine: true });
  };

  const scheduleRedraw = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(redraw);
  };

  redraw();
  viewport.on('moved', scheduleRedraw);
  viewport.on('zoomed', scheduleRedraw);

  return redraw;
}
