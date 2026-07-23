export interface Vec {
  x: number;
  y: number;
}

export type Dir = 0 | 1 | 2 | 3; // 0=N(вверх), 1=E, 2=S, 3=W — по часовой

export const DELTA: Record<Dir, Vec> = {
  0: { x: 0, y: -1 },
  1: { x: 1, y: 0 },
  2: { x: 0, y: 1 },
  3: { x: -1, y: 0 },
};

export type MachineKind =
  | 'belt'
  | 'miner' | 'assembler' | 'splitter' | 'mixer' | 'silo' | 'telegram'   // MVP-ядро
  | 'furnace' | 'chest' | 'lab'                              // усиление: станки
  | 'accumulator' | 'pole';                                  // усиление: энергослой (вне графа лент, docs/04)

export interface Entity {
  id: string;                  // crypto.randomUUID().slice(0, 8)
  kind: MachineKind;
  pos: Vec;                    // левый верхний тайл footprint
  dir: Dir;
  config: Record<string, unknown>;
}

export type ItemType = 'text' | 'json' | 'image' | 'verdict' | 'batch' | 'scrap';

export interface Packet {
  id: string;
  data: unknown;
  item: ItemType;
  sizeHint: number;            // JSON.stringify(data).length — визуальный масштаб предмета
  ttl: number;                 // старт 64, минус 1 за станок; 0 → дроп (петли не виснут)
}

export type Branch = 'out' | 'true' | 'false' | 'pass' | 'rework';

export interface Edge {
  id: string;                  // `${from}:${branch}:${n}` — ключ буферов смесителя
  from: string; branch: Branch;
  to: string | null;           // null = тупик (пакет упадёт в конце пути)
  path: Vec[];                 // тайлы лент от выхода к входу
}

export type NodeStatus = 'idle' | 'working' | 'ok' | 'error';

export type EngineEvent =
  | { t: 'packet-spawn'; packet: Packet; at: Vec }
  | { t: 'packet-consume'; packetId: string; nodeId: string }
  | { t: 'packet-drop'; packetId: string; reason: 'dead-end' | 'ttl' | 'error' }
  | { t: 'node-status'; nodeId: string; status: NodeStatus; error?: string }
  | { t: 'node-io'; nodeId: string; lastIn?: unknown; lastOut?: unknown }
  | { t: 'result'; nodeId: string; data: unknown };            // silo/chest: накопить в store

export interface Transport {
  // Резолвится, когда предмет ВИЗУАЛЬНО доехал до конца path. Реализует рендерер.
  move(packetId: string, path: Vec[], item: ItemType, sizeHint: number): Promise<void>;
  clear(): void;               // Stop: убрать все предметы
}
