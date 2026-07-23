// Реестр ассетов — полная реализация в A2
import type { Texture } from 'pixi.js';

export function getTexture(key: string, state: 'idle' | 'work'): Texture | Texture[] {
  // TODO: А2 — загрузка манифеста и плейсхолдеры
  throw new Error(`Asset ${key} not found`);
}
