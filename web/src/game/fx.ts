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

    // Анимация: подъём + fade 1с
    const ticker = new Ticker();
    let elapsed = 0;
    const duration = 1000;
    const startY = particle.position.y;

    ticker.add(() => {
      elapsed += ticker.deltaMS;
      if (elapsed >= duration) {
        ticker.stop();
        layers?.fx.removeChild(particle);
        return;
      }
      const progress = elapsed / duration;
      particle.position.y = startY - progress * TILE * 0.5; // подъём
      particle.alpha = 1 - progress; // fade
    });

    ticker.start();
  }
}

export function rocketLaunch(entity: Entity): Promise<void> {
  if (!app || !layers) return Promise.resolve();

  // Тряска 200мс на спрайт станка
  return new Promise<void>((resolve) => {
    // NOTE: тряска будет реализована в machines.ts при working→ok переходе
    // Здесь же — animation для улёта ракеты (демо эффект)
    setTimeout(() => {
      resolve();
    }, 200);
  });
}
