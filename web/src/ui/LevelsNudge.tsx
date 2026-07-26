import { useEffect, useState, type CSSProperties } from 'react';
import { useStore } from '../state/store';
import { useT } from '../i18n';
import './LevelsNudge.css';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measureTarget(): Rect | null {
  const el = document.querySelector('[data-nudge="levels-button"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

const BUBBLE_WIDTH = 240;
const MARGIN = 12;

/**
 * Разовая всплывашка сразу после первого закрытия обучалки (state/tutorialPersist.ts) —
 * указывает на кнопку «🎯 Уровни» в TopBar, чтобы пользователь не терялся в песочнице
 * без понятной следующей цели. Гасится по клику на саму кнопку (через levelPanelOpen)
 * или крестиком — не персистится отдельно, факт «уже показывали» живёт в том же
 * localStorage-флаге ncf.tutorial.seen.v1, что и обучалка.
 */
export function LevelsNudge() {
  const t = useT();
  const visible = useStore((s) => s.levelsNudgeVisible);
  const setVisible = useStore((s) => s.setLevelsNudgeVisible);
  const levelPanelOpen = useStore((s) => s.levelPanelOpen);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!visible) return;
    const measure = () => setRect(measureTarget());
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [visible]);

  // Кнопку нажали (levelPanelOpen стал true) — цель достигнута, гасим подсказку.
  useEffect(() => {
    if (levelPanelOpen) setVisible(false);
  }, [levelPanelOpen, setVisible]);

  if (!visible || !rect) return null;

  const left = Math.min(Math.max(MARGIN, rect.left + rect.width / 2 - BUBBLE_WIDTH / 2), window.innerWidth - BUBBLE_WIDTH - MARGIN);
  const arrowLeft = Math.min(Math.max(16, rect.left + rect.width / 2 - left - 6), BUBBLE_WIDTH - 16);
  const style: CSSProperties = { top: rect.top + rect.height + 10, left };

  return (
    <div className="levels-nudge" style={style}>
      <div className="levels-nudge-arrow" style={{ left: arrowLeft }} />
      <button className="levels-nudge-close" onClick={() => setVisible(false)} title={t('levelsNudge.dismissTitle')}>
        ✕
      </button>
      <p className="levels-nudge-text">{t('levelsNudge.text')}</p>
    </div>
  );
}
