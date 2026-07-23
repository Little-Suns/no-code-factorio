import React, { useEffect } from 'react';
import { useStore } from '../state/store';
import type { MachineKind } from '../core/types';
import './Hotbar.css';

const MVP_TOOLS: MachineKind[] = ['belt', 'miner', 'assembler', 'splitter', 'mixer', 'silo', 'telegram'];
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
  accumulator: '',
};

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
};

export function Hotbar() {
  const selectedTool = useStore((state) => state.selectedTool);
  const setTool = useStore((state) => state.setTool);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '9') {
        const tool = MVP_TOOLS[parseInt(e.key) - 1];
        if (tool) {
          setTool(tool);
          e.preventDefault();
        }
      } else if (e.key === '0') {
        // Пока не поддерживаем усиление
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool]);

  return (
    <div className="hotbar">
      {MVP_TOOLS.map((tool) => (
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
