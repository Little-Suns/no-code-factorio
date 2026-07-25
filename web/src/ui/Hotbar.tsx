import { useEffect } from 'react';
import { useStore } from '../state/store';
import type { MachineKind } from '../core/types';
import { ALL_TOOLS, HOTKEYS, TOOL_ICONS } from './hotbarData';
import { useT } from '../i18n';
import './Hotbar.css';

// Явная аннотация обязательна: без неё Object.fromEntries выводит тип со значением
// `MachineKind` (не `MachineKind | undefined`), и `KEY_TO_TOOL[e.key]` ниже типизируется
// как гарантированно существующий ключ — хотя для немаппленной клавиши это `undefined`
// в рантайме, и на этом стоит проверка `if (tool)`.
const KEY_TO_TOOL: Partial<Record<string, MachineKind>> = Object.fromEntries(
  ALL_TOOLS.map((tool) => [HOTKEYS[tool], tool])
);

// Заголовки и описания станков берём из общего i18n-словаря (ключи node.<kind>.title /
// node.<kind>.desc) — тот же title, что и в заголовке ConfigPanel, чтобы не дублировать
// перевод в двух местах.
const TOOL_NAME_KEYS: Record<MachineKind, string> = {
  belt: 'node.belt.title',
  miner: 'node.miner.title',
  assembler: 'node.assembler.title',
  splitter: 'node.splitter.title',
  mixer: 'node.mixer.title',
  silo: 'node.silo.title',
  furnace: 'node.furnace.title',
  chest: 'node.chest.title',
  lab: 'node.lab.title',
  accumulator: 'node.accumulator.title',
  webhook: 'node.webhook.title',
  manipulator: 'node.manipulator.title',
};

const TOOL_DESC_KEYS: Record<MachineKind, string> = {
  belt: 'node.belt.desc',
  miner: 'node.miner.desc',
  assembler: 'node.assembler.desc',
  splitter: 'node.splitter.desc',
  mixer: 'node.mixer.desc',
  silo: 'node.silo.desc',
  furnace: 'node.furnace.desc',
  chest: 'node.chest.desc',
  lab: 'node.lab.desc',
  accumulator: 'node.accumulator.desc',
  webhook: 'node.webhook.desc',
  manipulator: 'node.manipulator.desc',
};

export function Hotbar() {
  const t = useT();
  const selectedTool = useStore((state) => state.selectedTool);
  const setTool = useStore((state) => state.setTool);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Не перехватывать хоткеи, пока фокус в текстовом поле конфига (тот же паттерн,
      // что уже в game/input.ts и TopBar.tsx) — иначе ввод "1"/"e"/"w"/"i" и т.д. в
      // ConfigPanel/BlueprintPanel переключал бы инструмент постановки на карте.
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      // Обучалка открыта (ui/Tutorial.tsx) — блокирует хоткеи наравне с кликами по канвасу.
      if (useStore.getState().tutorialActive) return;

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
    <div className="hotbar" data-tutorial="hotbar">
      {ALL_TOOLS.map((tool) => (
        <button
          key={tool}
          className={`hotbar-slot ${selectedTool === tool ? 'active' : ''}`}
          onClick={() => setTool(tool)}
          aria-label={`${t(TOOL_NAME_KEYS[tool])} (${HOTKEYS[tool]})`}
          data-tutorial={tool === 'manipulator' ? 'hotbar-manipulator' : undefined}
        >
          <div className="hotbar-icon" data-tool={tool}>
            {TOOL_ICONS[tool]}
          </div>
          <span className="hotbar-hotkey">{HOTKEYS[tool]}</span>
          <div className="hotbar-tooltip" role="tooltip">
            <span className="hotbar-tooltip-title">
              {t(TOOL_NAME_KEYS[tool])} <span className="hotbar-tooltip-key">{HOTKEYS[tool]}</span>
            </span>
            <span className="hotbar-tooltip-desc">{t(TOOL_DESC_KEYS[tool])}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
