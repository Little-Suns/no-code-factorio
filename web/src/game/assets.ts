import { Texture, Assets, Rectangle, Container, Graphics, Text, Renderer } from 'pixi.js';
import { TILE } from './app';

interface SpriteFrame {
  file: string;
  frames: number;
  fps: number;
}

interface SpriteEntry {
  size: [number, number];
  idle?: string;
  work?: string | SpriteFrame;
}

interface Manifest {
  tileSize: number;
  sprites: Record<string, SpriteEntry>;
}

// Палитра цветов для плейсхолдеров (шестнадцатеричный формат)
const PLACEHOLDER_COLORS: Record<string, number> = {
  belt: 0x7d8a94,
  miner: 0xf0a030,
  furnace: 0xd97b2e,
  assembler: 0x3aa0e0,
  duplicator: 0xe2483f,
  mixer: 0xa06ce0,
  chest: 0xa08a5f,
  lab: 0x5ecf7a,
  silo: 0xef7a3d,
  accumulator: 0xf0d43a,
  webhook: 0xd64f9b,
  manipulator: 0x6fa8c9,
  // предметы
  'item.text': 0xe8e4d8,
  'item.json': 0x4ade80,
  'item.image': 0x7fb3d5,
  'item.verdict': 0xf1c40f,
  'item.batch': 0xb87333,
  'item.scrap': 0x555555,
  // FX
  'fx.smoke': 0x888888,
};

let manifest: Manifest | null = null;
let renderer: Renderer | null = null;

// Кэши текстур
const textureCache = new Map<string, Texture | Texture[]>();
const placeholderCache = new Map<string, Texture>();

export async function loadAssets(r: Renderer): Promise<void> {
  renderer = r;

  try {
    const response = await fetch('/assets/manifest.json');
    if (!response.ok) {
      console.warn('Failed to load manifest.json, using placeholders only');
      manifest = { tileSize: 64, sprites: {} };
      return;
    }
    manifest = await response.json();
  } catch (error) {
    console.warn('Failed to load manifest.json:', error);
    manifest = { tileSize: 64, sprites: {} };
  }

  // Загрузить все спрайты
  if (manifest && manifest.sprites) {
    for (const [key, sprite] of Object.entries(manifest.sprites)) {
      // idle
      if (sprite.idle) {
        try {
          const texture = await Assets.load(`/assets/${sprite.idle}`);
          textureCache.set(`${key}:idle`, texture);
        } catch (error) {
          console.warn(`Failed to load idle texture for ${key}:`, sprite.idle);
        }
      }

      // work
      if (sprite.work) {
        const workEntry = typeof sprite.work === 'string' ? { file: sprite.work, frames: 1, fps: 8 } : sprite.work;
        try {
          const baseTexture = await Assets.load(`/assets/${workEntry.file}`);
          const frames = workEntry.frames ?? 1;
          const textures = sliceAnimationFrames(baseTexture, frames, sprite.size);
          textureCache.set(`${key}:work`, textures);
        } catch (error) {
          console.warn(`Failed to load work texture for ${key}:`, workEntry.file);
        }
      }
    }
  }
}

function sliceAnimationFrames(baseTexture: Texture, frameCount: number, size: [number, number]): Texture[] {
  const frameWidth = (size[0] * TILE);
  const frameHeight = (size[1] * TILE);
  const textures: Texture[] = [];

  for (let i = 0; i < frameCount; i++) {
    const frame = new Rectangle(
      i * frameWidth,
      0,
      frameWidth,
      frameHeight
    );
    const texture = new Texture({
      source: baseTexture.source,
      frame,
    });
    textures.push(texture);
  }

  return textures;
}

export function getTexture(key: string, state: 'idle' | 'work'): Texture | Texture[] {
  const cacheKey = `${key}:${state}`;

  // Проверить кэш
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  // Если idle не найден, вернуть первый кадр work (если есть)
  if (state === 'idle') {
    const workKey = `${key}:work`;
    if (textureCache.has(workKey)) {
      const workTextures = textureCache.get(workKey)!;
      if (Array.isArray(workTextures)) {
        return workTextures[0];
      }
      return workTextures;
    }
  }

  // Генерировать плейсхолдер
  return generatePlaceholder(key);
}

function generatePlaceholder(key: string): Texture {
  if (placeholderCache.has(key)) {
    return placeholderCache.get(key)!;
  }

  if (!renderer) {
    throw new Error('Renderer not initialized for placeholder generation');
  }

  const spriteEntry = manifest?.sprites[key];
  const size = spriteEntry?.size ?? [1, 1];
  const width = size[0] * TILE;
  const height = size[1] * TILE;

  const container = new Container();

  // Скруглённый прямоугольник: станки — светлый металл + акцентный глиф, пакеты/fx — цветная заливка
  const color = PLACEHOLDER_COLORS[key] ?? 0x888888;
  const isMachine = !key.startsWith('item.') && !key.startsWith('fx.');
  const glyphColor = isMachine ? color : 0xffffff;
  const graphics = new Graphics();
  graphics.roundRect(0, 0, width, height, 12);
  if (isMachine) {
    graphics.fill(0x24272d);
    graphics.stroke({ width: 1.5, color: 0x454b53 });
  } else {
    graphics.fill(color);
  }
  container.addChild(graphics);

  // Первая буква (для item.text → T, fx.smoke → S — различимость)
  const letter = (key.split('.').pop() ?? key)[0].toUpperCase();
  const text = new Text({
    text: letter,
    style: {
      fontSize: Math.max(20, Math.min(width, height) * 0.5),
      fill: glyphColor,
      fontWeight: 'bold',
    },
  });
  text.anchor.set(0.5);
  text.position.set(width * 0.5, height * 0.5 - 8);
  container.addChild(text);

  // Стрелка вверх (белый треугольник) — обязательна для станков (docs/02)
  if (!key.startsWith('item.') && !key.startsWith('fx.')) {
    const arrow = new Graphics();
    arrow.moveTo(width * 0.5, height * 0.15);
    arrow.lineTo(width * 0.35, height * 0.35);
    arrow.lineTo(width * 0.65, height * 0.35);
    arrow.closePath();
    arrow.fill(glyphColor);
    container.addChild(arrow);
  }

  // Генерировать текстуру из контейнера
  const generatedTexture = renderer.generateTexture({
    target: container,
    resolution: 1,
  });

  if (!generatedTexture) {
    throw new Error(`Failed to generate placeholder texture for ${key}`);
  }

  // Кэшировать
  placeholderCache.set(key, generatedTexture);

  return generatedTexture;
}
