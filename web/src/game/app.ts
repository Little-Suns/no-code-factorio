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

  // resizeTo обновляет рендерер; viewport надо оповещать отдельно
  app.renderer.on('resize', (w: number, h: number) => viewport.resize(w, h));

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

  drawGrid(layers.ground);

  return { app, viewport, layers };
}

function drawGrid(container: Container): void {
  // ponytail: статичная сетка ±64 тайла; бесконечная перерисовка по камере — если станет тесно
  const grid = new Graphics();
  const size = 64;
  for (let x = -size; x <= size; x++) {
    grid.moveTo(x * TILE, -size * TILE).lineTo(x * TILE, size * TILE);
  }
  for (let y = -size; y <= size; y++) {
    grid.moveTo(-size * TILE, y * TILE).lineTo(size * TILE, y * TILE);
  }
  grid.stroke({ width: 1, color: 0x262b31, alpha: 0.9 });
  container.addChild(grid);
}
