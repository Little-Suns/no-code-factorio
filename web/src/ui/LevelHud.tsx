import React, { useState } from 'react';
import { useStore } from '../state/store';
import { LEVELS } from '../core/levels/definitions';
import { exitLevel } from '../state/runtime';
import { useT } from '../i18n';
import './LevelHud.css';

/**
 * Плашка активного уровня — название/описание, подсказки (раскрываются по одной),
 * кнопка выхода. Рендерится только пока store.levelActive != null. Позиция —
 * top-center (top-left/top-right заняты LogsPanel/ConfigPanel), см. docs плана.
 */
export function LevelHud() {
  const t = useT();
  const levelActive = useStore((s) => s.levelActive);
  const progress = useStore((s) => s.levelProgress);
  const revealHint = useStore((s) => s.revealHint);
  const [collapsed, setCollapsed] = useState(false);

  if (!levelActive) return null;
  const level = LEVELS.find((l) => l.id === levelActive);
  if (!level) return null;

  const hintsRevealed = progress[level.id]?.hintsRevealed ?? 0;

  if (collapsed) {
    return (
      <button className="level-hud-reopen" onClick={() => setCollapsed(false)} title={t(level.titleKey)}>
        🎯 {t(level.titleKey)} ▾
      </button>
    );
  }

  return (
    <div className="level-hud">
      <div className="level-hud-header">
        <span className="level-hud-title">🎯 {t(level.titleKey)}</span>
        <div className="level-hud-header-actions">
          <button className="level-hud-icon-btn" onClick={() => setCollapsed(true)} title={t('level.hud.collapseTitle')}>
            ▴
          </button>
          <button className="level-hud-exit" onClick={() => exitLevel()} title={t('level.hud.exitTitle')}>
            {t('level.hud.exit')}
          </button>
        </div>
      </div>
      <p className="level-hud-desc">{t(level.descKey)}</p>
      <div className="level-hud-hints">
        {level.hintKeys.slice(0, hintsRevealed).map((key, i) => (
          <div key={key} className="level-hud-hint">
            <span className="level-hud-hint-index">{i + 1}.</span> {t(key)}
          </div>
        ))}
        {hintsRevealed < level.hintKeys.length && (
          <button
            className="level-hud-hint-btn"
            onClick={() => revealHint(level.id, level.hintKeys.length)}
          >
            {t('level.hud.showHint', { n: hintsRevealed + 1, total: level.hintKeys.length })}
          </button>
        )}
      </div>
    </div>
  );
}
