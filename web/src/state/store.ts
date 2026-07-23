import { create } from 'zustand';
import type { Entity, NodeStatus } from '../core/types';
import type { MachineKind } from '../core/types';

export interface Store {
  entities: Record<string, Entity>;
  running: boolean;
  selectedTool: MachineKind | null;
  selectedEntityId: string | null;
  nodeStatus: Record<string, { status: NodeStatus; error?: string; lastIn?: unknown; lastOut?: unknown }>;
  results: Record<string, { at: number; data: unknown }[]>;
  toasts: { id: string; text: string }[];
}

// Заглушка store — полная реализация будет в C2
export const useStore = create<Store>(() => ({
  entities: {},
  running: false,
  selectedTool: null,
  selectedEntityId: null,
  nodeStatus: {},
  results: {},
  toasts: [],
}));
