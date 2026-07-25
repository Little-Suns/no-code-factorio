import { useEffect } from 'react';
import { useStore } from '../state/store';
import { ALL_TOOLS, HOTKEYS, TOOL_DESCRIPTIONS, TOOL_ICONS, TOOL_NAMES } from './hotbarData';
import './Hotbar.css';

const KEY_TO_TOOL = Object.fromEntries(ALL_TOOLS.map((tool) => [HOTKEYS[tool], tool]));

export function Hotbar() {
  const selectedTool = useStore((state) => state.selectedTool);
  const setTool = useStore((state) => state.setTool);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Не перехватывать хоткеи, пока фокус в текстовом поле конфига (тот же паттерн,
      // что уже в game/input.ts и TopBar.tsx) — иначе ввод "1"/"e"/"w"/"i" и т.д. в
      // ConfigPanel/BlueprintPanel переключал бы инструмент постановки на карте.
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

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
          title={`${TOOL_NAMES[tool]} (${HOTKEYS[tool]}) — ${TOOL_DESCRIPTIONS[tool]}`}
        >
          <div className="hotbar-icon" data-tool={tool}>
            {TOOL_ICONS[tool]}
          </div>
          <span className="hotbar-hotkey">{HOTKEYS[tool]}</span>
        </button>
      ))}
    </div>
  );
}
