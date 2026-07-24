// FX — дым, ракета, частицы, реализация в A4-A5
import { Graphics, Ticker } from 'pixi.js';
import type { Application } from 'pixi.js';
import { TILE } from './app';
import type { Entity } from '../core/types';
import type { GameLayers } from './app';

let app: Application | null = null;
let layers: GameLayers | null = null;

// Guard от одновременного запуска анимации на одной ракете
const activeRockets = new Set<string>();

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

// easeIn функция для ускорения (t^2)
function easeIn(t: number): number {
  return t * t;
}

export function rocketLaunch(entity: Entity): Promise<void> {
  if (!app || !layers) return Promise.resolve();

  // Guard от одновременного запуска
  if (activeRockets.has(entity.id)) {
    return Promise.resolve();
  }
  activeRockets.add(entity.id);

  return new Promise<void>((resolve) => {
    // Размер silo: 3x3 тайла, центр = (pos.x + 1.5, pos.y + 1.5) в тайлах
    const centerWorldX = (entity.pos.x + 1.5) * TILE;
    const centerWorldY = (entity.pos.y + 1.5) * TILE;

    // Размер ракеты: ~1.5 тайла = 96px
    const rocketSize = TILE * 1.5;

    // Создать спрайт ракеты (треугольник, указывает вверх)
    const rocket = new Graphics();
    rocket.moveTo(0, -rocketSize / 2); // вершина вверх
    rocket.lineTo(rocketSize / 2, rocketSize / 2); // нижний правый
    rocket.lineTo(-rocketSize / 2, rocketSize / 2); // нижний левый
    rocket.closePath();
    rocket.fill(0xff4444); // красный цвет ракеты
    rocket.position.set(centerWorldX, centerWorldY);

    if (!layers) {
      activeRockets.delete(entity.id);
      resolve();
      return;
    }

    layers.fx.addChild(rocket);

    // Этап 1: Тряска (200 мс) — все фазы ракеты тоже на Ticker.shared, не на своих Ticker
    let shakeDuration = 0;
    const shakeTime = 200;

    const shakeTick = (t: Ticker) => {
      shakeDuration += t.deltaMS;
      if (shakeDuration >= shakeTime) {
        Ticker.shared.remove(shakeTick);
        startLiftoff();
        return;
      }
      // Небольшой jitter: ±4 пикселя
      rocket.position.x = centerWorldX + (Math.random() - 0.5) * 8;
      rocket.position.y = centerWorldY + (Math.random() - 0.5) * 8;
    };

    Ticker.shared.add(shakeTick);

    // Этап 2: Улёт (1.2 сек)
    function startLiftoff(): void {
      if (!layers) return;

      rocket.position.set(centerWorldX, centerWorldY);

      // Дым в начале улёта
      smoke(centerWorldX, centerWorldY);

      let liftoffDuration = 0;
      const liftoffTime = 1200; // 1.2 сек
      let lastFireTime = 0;

      const liftoffTick = (t: Ticker) => {
        liftoffDuration += t.deltaMS;

        if (liftoffDuration >= liftoffTime) {
          Ticker.shared.remove(liftoffTick);
          // Ракета скрылась за кадром, ждём 1 сек перед возвращением
          rocket.visible = false;
          setTimeout(() => {
            startDescent();
          }, 1000);
          return;
        }

        const progress = liftoffDuration / liftoffTime;
        const easeProgress = easeIn(progress); // ускорение

        // Подъём с ускорением — улетает далеко за экран (docs/02)
        const maxHeight = TILE * 14;
        rocket.position.y = centerWorldY - easeProgress * maxHeight;

        // Огонь каждые ~50 мс
        lastFireTime += t.deltaMS;
        if (lastFireTime >= 50) {
          lastFireTime = 0;
          const fireParticles = 2 + Math.floor(Math.random() * 2);
          for (let i = 0; i < fireParticles; i++) {
            const fire = new Graphics();
            const fireRadius = Math.random() * 3 + 1;
            fire.circle(0, 0, fireRadius);
            fire.fill(0xff7733); // оранжевый огонь

            fire.position.set(
              rocket.position.x + (Math.random() - 0.5) * 15,
              rocket.position.y + rocketSize / 2 + Math.random() * 10
            );

            layers?.fx.addChild(fire);

            // Быстрое затухание огня за 300 мс
            let fireElapsed = 0;
            const fireDuration = 300;

            const fireTick = (ft: Ticker) => {
              fireElapsed += ft.deltaMS;
              if (fireElapsed >= fireDuration) {
                Ticker.shared.remove(fireTick);
                layers?.fx.removeChild(fire);
                return;
              }
              fire.alpha = 1 - fireElapsed / fireDuration;
              fire.position.y += ft.deltaMS / 20; // слегка оседает
            };

            Ticker.shared.add(fireTick);
          }
        }
      };

      Ticker.shared.add(liftoffTick);
    }

    // Этап 3: Спуск (0.6 сек) — после 1 сек паузы
    function startDescent(): void {
      if (!layers) {
        activeRockets.delete(entity.id);
        resolve();
        return;
      }

      // Ракета появляется сверху
      const topY = centerWorldY - TILE * 3;
      rocket.position.set(centerWorldX, topY);
      rocket.visible = true;
      rocket.alpha = 1;

      let descentDuration = 0;
      const descentTime = 600; // 0.6 сек

      const descentTick = (t: Ticker) => {
        descentDuration += t.deltaMS;

        if (descentDuration >= descentTime) {
          Ticker.shared.remove(descentTick);
          layers?.fx.removeChild(rocket);
          activeRockets.delete(entity.id);
          resolve();
          return;
        }

        rocket.position.y = topY + (descentDuration / descentTime) * (TILE * 3);
      };

      Ticker.shared.add(descentTick);
    }
  });
}
