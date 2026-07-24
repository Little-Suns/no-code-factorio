// FX — дым, ракета, частицы, реализация в A4-A5
import { Graphics, Ticker } from 'pixi.js';
import type { Application } from 'pixi.js';
import { TILE } from './app';
import type { Entity } from '../core/types';
import type { GameLayers } from './app';

let app: Application | null = null;
let layers: GameLayers | null = null;

export function initFX(appInstance: Application, gameLayers: GameLayers): void {
  app = appInstance;
  layers = gameLayers;

  // Дев-хук для ручного запуска ракеты (динамический импорт против циклической зависимости)
  if (import.meta.env.DEV) {
    (window as any).__rocket = async (entityId: string) => {
      const { useStore } = await import('../state/store');
      const entity = useStore.getState().entities[entityId];
      if (entity) {
        return rocketLaunch(entity);
      }
      return Promise.resolve();
    };
  }
}

export function smoke(worldX: number, worldY: number): void {
  if (!app || !layers) return;

  // 5-8 серых частиц
  const particleCount = Math.floor(Math.random() * 4) + 5; // 5-8
  for (let i = 0; i < particleCount; i++) {
    const particle = new Graphics();
    const radius = Math.random() * 4 + 2; // 2-6 px
    particle.circle(0, 0, radius);
    particle.fill(0x888888);

    // Случайная позиция вокруг центра
    const angle = (Math.random() * Math.PI * 2);
    const distance = Math.random() * 10;
    particle.position.set(
      worldX + Math.cos(angle) * distance,
      worldY + Math.sin(angle) * distance
    );

    layers.fx.addChild(particle);

    // Анимация: подъём + fade 1с — колбэк на общем Ticker.shared (не отдельный Ticker
    // на каждую частицу, дорого под нагрузкой — дым сыплется пачками по 5-8 штук разом)
    let elapsed = 0;
    const duration = 1000;
    const startY = particle.position.y;

    const tick = (t: Ticker) => {
      elapsed += t.deltaMS;
      if (elapsed >= duration) {
        Ticker.shared.remove(tick);
        layers?.fx.removeChild(particle);
        return;
      }
      const progress = elapsed / duration;
      particle.position.y = startY - progress * TILE * 0.5; // подъём
      particle.alpha = 1 - progress; // fade
    };

    Ticker.shared.add(tick);
  }
}

/**
 * Запуск ракеты (silo, result-событие). Никакого отдельного спрайта «ракеты» —
 * анимация играет у самого станка на карте (machines.ts уже переключает его
 * на work-кадры, пока status === 'working'/'ok' идёт своим чередом через engine).
 * Здесь только дымовой пуф в момент запуска — чисто декоративные частицы.
 */
export function rocketLaunch(entity: Entity): Promise<void> {
  if (!app || !layers) return Promise.resolve();

  const centerWorldX = (entity.pos.x + 1.5) * TILE;
  const centerWorldY = (entity.pos.y + 1.5) * TILE;
  smoke(centerWorldX, centerWorldY);

  return Promise.resolve();
}
