// Transport (контракт docs/01) — реализация в A4
import type { Application } from 'pixi.js';
import { Sprite, AnimatedSprite, Ticker } from 'pixi.js';
import type { Transport, ItemType, Vec } from '../core/types';
import { TILE } from './app';
import { getTexture } from './assets';
import type { GameLayers } from './app';

export const TILE_MS = 400; // скорость ленты: 400мс за тайл

type TickFn = (ticker: Ticker) => void;

interface PacketSprite {
  sprite: Sprite;
  tick?: TickFn;
}

let app: Application | null = null;
let layers: GameLayers | null = null;
const packetSprites = new Map<string, PacketSprite>();
// Единый реестр активных tween-колбэков на Ticker.shared (вместо отдельного `new Ticker()`
// на каждый пакет — раньше плодили десятки-сотни независимых тикеров под нагрузкой).
// Нужен, чтобы clear() (Stop) мог снять разом все анимации, а не только "движение по ленте".
const tweens: Array<{ id: string; tick: TickFn }> = [];

function trackTick(id: string, tick: TickFn): void {
  Ticker.shared.add(tick);
  tweens.push({ id, tick });
}

// Снимает tween и с Ticker.shared, и из реестра — без этого запись в tweens пережила бы
// свой tick (утечка: массив рос бы неограниченно за долгий прогон без остановки).
function removeTween(tick: TickFn): void {
  Ticker.shared.remove(tick);
  const idx = tweens.findIndex((t) => t.tick === tick);
  if (idx !== -1) tweens.splice(idx, 1);
}

export function initPackets(appInstance: Application, gameLayers: GameLayers): void {
  app = appInstance;
  layers = gameLayers;

  // Регистрация fakeRun для дев-режима
  if (import.meta.env.DEV) {
    // Динамический импорт чтобы избежать циклических зависимостей
    import('./fakeRun').then(({ fakeRun }) => {
      (window as any).__fakeRun = fakeRun;
    });
  }
}

export class GameTransport implements Transport {
  async move(packetId: string, path: Vec[], item: ItemType, sizeHint: number): Promise<void> {
    if (!app || !layers) {
      throw new Error('Packets not initialized');
    }

    // Пустой путь — мгновенный resolve
    if (!path || path.length === 0) {
      return;
    }

    // Удалить старый спрайт если существует
    if (packetSprites.has(packetId)) {
      const old = packetSprites.get(packetId);
      if (old?.sprite) {
        // destroy() сам снимает с родителя; голый removeChild копил бы спрайты в куче
        old.sprite.destroy();
      }
      if (old?.tick) {
        removeTween(old.tick);
      }
      packetSprites.delete(packetId);
    }

    // Создать спрайт предмета
    const textureOrFrames = getTexture('item.' + item, 'idle');
    let sprite: Sprite;

    if (Array.isArray(textureOrFrames)) {
      sprite = new Sprite(textureOrFrames[0]);
    } else {
      sprite = new Sprite(textureOrFrames);
    }

    // Размер предмета от sizeHint: СТОРОНА в px = TILE * clamp(0.3 + sizeHint/4000, 0.3, 0.65)
    const side = TILE * Math.max(0.3, Math.min(0.65, 0.3 + sizeHint / 4000));
    sprite.width = side;
    sprite.height = side;
    sprite.anchor.set(0.5);

    // Начальная позиция — центр первого тайла пути
    const startPos = path[0];
    sprite.position.set((startPos.x + 0.5) * TILE, (startPos.y + 0.5) * TILE);

    layers.items.addChild(sprite);

    // Анимация по полилинии — колбэк на общем Ticker.shared, не отдельный Ticker
    const duration = path.length * TILE_MS; // мс на весь путь
    let elapsed = 0;

    return new Promise<void>((resolve) => {
      const tick: TickFn = (ticker) => {
        elapsed += ticker.deltaMS;

        if (elapsed >= duration) {
          // Финальная позиция — центр последнего тайла
          const endPos = path[path.length - 1];
          sprite.position.set((endPos.x + 0.5) * TILE, (endPos.y + 0.5) * TILE);
          removeTween(tick);
          packetSprites.set(packetId, { sprite });
          resolve();
          return;
        }

        // Линейная интерполяция по пути
        const progress = elapsed / duration;
        const totalDistance = path.length;
        const currentDistance = progress * totalDistance;
        const segmentIndex = Math.floor(currentDistance);
        const segmentProgress = currentDistance - segmentIndex;

        if (segmentIndex >= path.length - 1) {
          const endPos = path[path.length - 1];
          sprite.position.set((endPos.x + 0.5) * TILE, (endPos.y + 0.5) * TILE);
        } else {
          const from = path[segmentIndex];
          const to = path[segmentIndex + 1];
          const x = (from.x + (to.x - from.x) * segmentProgress + 0.5) * TILE;
          const y = (from.y + (to.y - from.y) * segmentProgress + 0.5) * TILE;
          sprite.position.set(x, y);
        }
      };

      packetSprites.set(packetId, { sprite, tick });
      trackTick(packetId, tick);
    });
  }

  clear(): void {
    if (!layers) return;

    // Снять все активные tween-колбэки с Ticker.shared
    for (const { tick } of tweens) {
      Ticker.shared.remove(tick);
    }
    tweens.length = 0;

    // Удалить все спрайты (на случай, если чей-то tick не попал в реестр)
    for (const { sprite, tick } of packetSprites.values()) {
      if (tick) Ticker.shared.remove(tick);
      sprite.destroy();
    }
    packetSprites.clear();
  }
}

// Экспортированные функции для работы с пакетами (вызывает runtime)

export function consumePacket(packetId: string, nodePos?: Vec): void {
  if (!layers) return;

  const ps = packetSprites.get(packetId);
  if (!ps) return;

  const sprite = ps.sprite;
  if (ps.tick) {
    removeTween(ps.tick);
  }

  // Tween втягивания: scale→0 за 150 мс
  let elapsed = 0;
  const duration = 150;
  const startScale = sprite.scale.x;

  const tick: TickFn = (ticker) => {
    elapsed += ticker.deltaMS;
    if (elapsed >= duration) {
      removeTween(tick);
      sprite.destroy();
      packetSprites.delete(packetId);
      return;
    }
    const progress = elapsed / duration;
    sprite.scale.set(startScale * (1 - progress));
  };

  packetSprites.set(packetId, { sprite, tick });
  trackTick(packetId, tick);
}

export function dropPacket(packetId: string, reason: 'error' | 'dead-end' | 'ttl'): void {
  if (!layers) return;

  const ps = packetSprites.get(packetId);
  if (!ps) return;

  const sprite = ps.sprite;
  if (ps.tick) {
    removeTween(ps.tick);
  }

  if (reason === 'error') {
    // Текстура item.scrap, убрать через 2с (дым будет добавлен позже в FX интеграции)
    const scrapTexture = getTexture('item.scrap', 'idle');
    const tex = Array.isArray(scrapTexture) ? scrapTexture[0] : scrapTexture;
    const side = Math.max(sprite.width, sprite.height); // сохранить размер после смены текстуры
    sprite.texture = tex;
    sprite.width = side;
    sprite.height = side;
    packetSprites.set(packetId, { sprite });

    // Удалить через 2с
    setTimeout(() => {
      if (packetSprites.has(packetId)) {
        sprite.destroy();
        packetSprites.delete(packetId);
      }
    }, 2000);
  } else {
    // dead-end / ttl — падение с затуханием
    let elapsed = 0;
    const duration = 1000; // 1 сек
    const startY = sprite.position.y;
    const startAlpha = sprite.alpha;

    const tick: TickFn = (ticker) => {
      elapsed += ticker.deltaMS;
      if (elapsed >= duration) {
        removeTween(tick);
        sprite.destroy();
        packetSprites.delete(packetId);
        return;
      }
      const progress = elapsed / duration;
      sprite.position.y = startY + progress * TILE; // падение на тайл
      sprite.alpha = startAlpha * (1 - progress);
    };

    packetSprites.set(packetId, { sprite, tick });
    trackTick(packetId, tick);
  }
}

export function createTransport(): Transport {
  return new GameTransport();
}
