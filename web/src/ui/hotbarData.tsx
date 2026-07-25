import type { MachineKind } from '../core/types';

/**
 * Данные Hotbar вынесены из Hotbar.tsx: инлайн-SVG глифы (без иконочных
 * библиотек — правило проекта). Названия и описания станков для тултипа —
 * в общем i18n-словаре (src/i18n/dictionaries.ts, ключи node.<kind>.title /
 * node.<kind>.desc).
 */

// Порядок по приоритету из CLAUDE.md: MVP-ядро (belt, miner, assembler,
// splitter, mixer, silo) → manipulator поднят из «усиления» в конец ядра,
// т.к. он обязателен для ЛЮБОЙ передачи станок↔станок (docs/03) и
// используется в demo.json чаще любого другого усиления (3 инстанса) —
// без него между непримыкающими станками просто нет рабочего Edge. webhook
// (терминал, обобщение убранного telegram) — рядом с silo, тоже терминал.
// Дальше — «усиление» строго по порядку docs/08: электричество (accumulator),
// затем furnace/chest/lab.
export const ALL_TOOLS: MachineKind[] = [
  'belt',
  'miner',
  'assembler',
  'splitter',
  'mixer',
  'silo',
  'manipulator',
  'webhook',
  'accumulator',
  'furnace',
  'chest',
  'lab',
];

export const HOTKEYS: Record<MachineKind, string> = {
  belt: '1',
  miner: '2',
  assembler: '3',
  splitter: '4',
  mixer: '5',
  silo: '6',
  webhook: '7',
  furnace: '8',
  chest: '9',
  lab: '0',
  accumulator: 'e',
  manipulator: 'i',
};

export const TOOL_NAMES: Record<MachineKind, string> = {
  belt: 'Belt',
  miner: 'Miner',
  assembler: 'Assembler',
  splitter: 'Duplicator',
  mixer: 'Mixer',
  silo: 'Silo',
  furnace: 'Furnace',
  chest: 'Chest',
  lab: 'Lab',
  accumulator: 'Accumulator',
  webhook: 'Webhook',
  manipulator: 'Manipulator',
};

// Компактные геометрические глиф-иконки (без иконочных библиотек — правило
// CLAUDE.md). viewBox 24x24, stroke=currentColor — цвет берёт существующие
// правила `.hotbar-icon[data-tool=...]` из Hotbar.css.
const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': 'true' as const,
};

export const TOOL_ICONS: Record<MachineKind, JSX.Element> = {
  belt: (
    <svg viewBox="0 0 24 24" width="22" height="22" {...strokeProps}>
      <path d="M3 8 L9 8" />
      <path d="M13 8 L19 8" />
      <path d="M15 4 L21 8 L15 12" />
      <path d="M3 16 L21 16" strokeDasharray="3 3" />
    </svg>
  ),
  miner: (
    // Бур/добыча: стрела вниз бьёт в грунт, под линией земли — выбитая руда.
    <svg viewBox="0 0 24 24" width="22" height="22" {...strokeProps}>
      <path d="M12 3 L12 14" />
      <path d="M8 11 L12 15 L16 11" />
      <path d="M5 18 L19 18" />
      <path d="M8 20 L7.3 22 M12 20 L12 22.5 M16 20 L16.7 22" />
    </svg>
  ),
  assembler: (
    <svg viewBox="0 0 24 24" width="22" height="22" {...strokeProps}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 4 L12 7 M12 17 L12 20 M4 12 L7 12 M17 12 L20 12" />
      <path d="M6.5 6.5 L8.6 8.6 M15.4 15.4 L17.5 17.5 M6.5 17.5 L8.6 15.4 M15.4 8.6 L17.5 6.5" />
    </svg>
  ),
  splitter: (
    <svg viewBox="0 0 24 24" width="22" height="22" {...strokeProps}>
      <path d="M4 12 L11 12" />
      <path d="M11 12 L19 5" />
      <path d="M11 12 L19 19" />
    </svg>
  ),
  mixer: (
    // Воронка-смеситель: широкий раструб сводит несколько входов в один узкий выход
    // (отдельная фигура, не зеркало splitter, — различима и по форме, не только по цвету).
    <svg viewBox="0 0 24 24" width="22" height="22" {...strokeProps}>
      <path d="M4 5 L20 5 L13.5 13 L13.5 19.5 L10.5 19.5 L10.5 13 Z" />
    </svg>
  ),
  silo: (
    // Ракета: широкие треугольные стабилизаторы + выхлоп снизу — не «перо», а силуэт ракеты.
    <svg viewBox="0 0 24 24" width="22" height="22" {...strokeProps}>
      <path d="M12 3 L16 10 L16 17 L8 17 L8 10 Z" />
      <path d="M8 12 L4 19 L8 17 Z" />
      <path d="M16 12 L20 19 L16 17 Z" />
      <circle cx="12" cy="9.5" r="1.3" fill="currentColor" stroke="none" />
      <path d="M9.5 20 L8.5 23 M12 20 L12 23.5 M14.5 20 L15.5 23" />
    </svg>
  ),
  furnace: (
    <svg viewBox="0 0 24 24" width="22" height="22" {...strokeProps}>
      <path d="M12 4 C9 8 8 10 10 13 C8.5 13.3 8 15 9 16.5 C10.2 18.3 14 18.5 15.3 16.3 C16.6 14 15.3 12.6 14 12 C15 10 13.5 6.5 12 4 Z" />
    </svg>
  ),
  chest: (
    <svg viewBox="0 0 24 24" width="22" height="22" {...strokeProps}>
      <rect x="4" y="9" width="16" height="10" rx="1" />
      <path d="M4 13 L20 13" />
      <path d="M9 9 C9 6 10.5 5 12 5 C13.5 5 15 6 15 9" />
    </svg>
  ),
  lab: (
    <svg viewBox="0 0 24 24" width="22" height="22" {...strokeProps}>
      <path d="M10 3 L10 9 L5 18 C4.6 19 5.3 20 6.3 20 L17.7 20 C18.7 20 19.4 19 19 18 L14 9 L14 3" />
      <path d="M9 3 L15 3" />
      <path d="M7.5 15 L16.5 15" />
    </svg>
  ),
  accumulator: (
    <svg viewBox="0 0 24 24" width="22" height="22" {...strokeProps}>
      <rect x="5" y="7" width="12" height="12" rx="1" />
      <path d="M9 7 L9 4 L15 4 L15 7" />
      <path d="M12.5 10 L10 14 L12 14 L11 18 L14.5 13.5 L12.3 13.5 Z" fill="currentColor" stroke="none" />
    </svg>
  ),
  webhook: (
    <svg viewBox="0 0 24 24" width="22" height="22" {...strokeProps}>
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="17" cy="6" r="2.2" />
      <circle cx="17" cy="18" r="2.2" />
      <path d="M8 17 L15.5 8" />
      <path d="M8.2 18 L14.8 18" />
    </svg>
  ),
  manipulator: (
    <svg viewBox="0 0 24 24" width="22" height="22" {...strokeProps}>
      <path d="M5 20 L5 13 L12 9" />
      <path d="M12 9 L18 6" />
      <path d="M16 4 L19 6 L17 9" />
      <path d="M3 20 L8 20" />
    </svg>
  ),
};
