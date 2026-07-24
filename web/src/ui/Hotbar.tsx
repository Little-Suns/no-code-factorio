import React, { useEffect } from 'react';
import { useStore } from '../state/store';
import type { MachineKind } from '../core/types';
import './Hotbar.css';

// Аккумулятор (E1) вне графа лент, но всё равно ставится мышью как обычный станок.
const ALL_TOOLS: MachineKind[] = [
  'belt', 'miner', 'assembler', 'splitter', 'mixer', 'silo', 'telegram',
  'furnace', 'chest', 'lab', 'accumulator', 'webhook', 'manipulator',
];
const HOTKEYS: Record<MachineKind, string> = {
  belt: '1',
  miner: '2',
  assembler: '3',
  splitter: '4',
  mixer: '5',
  silo: '6',
  telegram: '7',
  furnace: '8',
  chest: '9',
  lab: '0',
  accumulator: 'e',
  webhook: 'w',
  manipulator: 'i',
};
const KEY_TO_TOOL: Partial<Record<string, MachineKind>> = Object.fromEntries(
  ALL_TOOLS.map((tool) => [HOTKEYS[tool], tool])
);

const TOOL_NAMES: Record<MachineKind, string> = {
  belt: 'Belt',
  miner: 'Miner',
  assembler: 'Assembler',
  splitter: 'Splitter',
  mixer: 'Mixer',
  silo: 'Silo',
  telegram: 'Telegram',
  furnace: 'Furnace',
  chest: 'Chest',
  lab: 'Lab',
  accumulator: 'Accumulator',
  webhook: 'Webhook',
  manipulator: 'Manipulator',
};

export function Hotbar() {
  const selectedTool = useStore((state) => state.selectedTool);
  const setTool = useStore((state) => state.setTool);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tool = KEY_TO_TOOL[e.key];
      if (tool) {
        setTool(tool);
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool]);

  return (
    <div className="hotbar">
      {ALL_TOOLS.map((tool) => (
        <button
          key={tool}
          className={`hotbar-slot ${selectedTool === tool ? 'active' : ''}`}
          onClick={() => setTool(tool)}
          title={`${TOOL_NAMES[tool]} (${HOTKEYS[tool]})`}
        >
          <div className="hotbar-icon" data-tool={tool}>
            {tool.charAt(0).toUpperCase()}
          </div>
          <span className="hotbar-hotkey">{HOTKEYS[tool]}</span>
        </button>
      ))}
    </div>
  );
}
