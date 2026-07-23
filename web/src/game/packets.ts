// Transport (контракт docs/01) — полная реализация в A4
import type { Transport } from '../core/types';

export const TILE_MS = 400; // скорость ленты

export class GameTransport implements Transport {
  async move(packetId: string, path: any[], item: any, sizeHint: number): Promise<void> {
    // TODO: A4 — спрайт ведётся по полилинии
  }

  clear(): void {
    // TODO: A4 — снести все спрайты и активные твины
  }
}
