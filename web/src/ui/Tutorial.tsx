import { useEffect, useState, type CSSProperties } from 'react';
import { useStore } from '../state/store';
import { useT } from '../i18n';
import './Tutorial.css';

/**
 * Обучалка первого запуска: пошаговый тур с подсветкой реальных элементов UI
 * (по атрибуту `data-tutorial="<id>"`, расставлен в Hotbar.tsx/TopBar.tsx).
 * Автостарт/флаг «видел» — state/tutorialPersist.ts. Шаги без `target` — по центру
 * экрана, без подсветки (вступление, общие советы).
 */
interface Step {
  target: string | null;
  titleKey: string;
  descKey: string;
}

const STEPS: Step[] = [
  { target: null, titleKey: 'tutorial.step.welcome.title', descKey: 'tutorial.step.welcome.desc' },
  { target: 'hotbar', titleKey: 'tutorial.step.hotbar.title', descKey: 'tutorial.step.hotbar.desc' },
  { target: null, titleKey: 'tutorial.step.place.title', descKey: 'tutorial.step.place.desc' },
  { target: 'hotbar-manipulator', titleKey: 'tutorial.step.manipulator.title', descKey: 'tutorial.step.manipulator.desc' },
  { target: null, titleKey: 'tutorial.step.config.title', descKey: 'tutorial.step.config.desc' },
  { target: 'run', titleKey: 'tutorial.step.run.title', descKey: 'tutorial.step.run.desc' },
  { target: 'results', titleKey: 'tutorial.step.results.title', descKey: 'tutorial.step.results.desc' },
  { target: 'blueprints', titleKey: 'tutorial.step.blueprints.title', descKey: 'tutorial.step.blueprints.desc' },
  { target: 'logs', titleKey: 'tutorial.step.logs.title', descKey: 'tutorial.step.logs.desc' },
  { target: null, titleKey: 'tutorial.step.done.title', descKey: 'tutorial.step.done.desc' },
];

const SPOT_PAD = 8;
const CARD_WIDTH = 320;
const CARD_MARGIN = 16;
// ponytail: 190 — грубая оценка высоты карточки для «влезает ли снизу»; при переполнении
// клампится по нижней границе окна ниже, так что визуально не съедет за экран даже если
// оценка окажется занижена/завышена.
const CARD_HEIGHT_GUESS = 190;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measureTarget(id: string | null): Rect | null {
  if (!id) return null;
  const el = document.querySelector(`[data-tutorial="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function Tutorial() {
  const t = useT();
  const active = useStore((s) => s.tutorialActive);
  const step = useStore((s) => s.tutorialStep);
  const setTutorialStep = useStore((s) => s.setTutorialStep);
  const skipTutorial = useStore((s) => s.skipTutorial);
  const [rect, setRect] = useState<Rect | null>(null);

  const current = STEPS[step];
  const target = current?.target ?? null;

  useEffect(() => {
    if (!active) return;
    const measure = () => setRect(measureTarget(target));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [active, target]);

  if (!active || !current) return null;

  const isLast = step === STEPS.length - 1;
  const handleNext = () => (isLast ? skipTutorial() : setTutorialStep(step + 1));
  const handlePrev = () => setTutorialStep(Math.max(0, step - 1));

  // «Дырка» подсветки: без цели — точка по центру экрана (box-shadow всё равно
  // закрывает весь вьюпорт тёмным, дырка 0×0 незаметна).
  const spot = rect
    ? { top: rect.top - SPOT_PAD, left: rect.left - SPOT_PAD, width: rect.width + SPOT_PAD * 2, height: rect.height + SPOT_PAD * 2 }
    : { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0 };

  const cardStyle: CSSProperties = rect
    ? {
        top:
          rect.top + rect.height + SPOT_PAD * 2 + CARD_HEIGHT_GUESS <= window.innerHeight
            ? rect.top + rect.height + SPOT_PAD * 2
            : Math.max(CARD_MARGIN, rect.top - SPOT_PAD * 2 - CARD_HEIGHT_GUESS),
        left: Math.min(Math.max(CARD_MARGIN, rect.left), window.innerWidth - CARD_WIDTH - CARD_MARGIN),
      }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="tutorial-overlay">
      <div
        className={`tutorial-spotlight ${rect ? '' : 'no-target'}`}
        style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
      />
      <div className="tutorial-card" style={cardStyle}>
        <div className="tutorial-step-count">{step + 1} / {STEPS.length}</div>
        <h3 className="tutorial-title">{t(current.titleKey)}</h3>
        <p className="tutorial-desc">{t(current.descKey)}</p>
        <div className="tutorial-actions">
          <button className="tutorial-skip" onClick={skipTutorial}>{t('tutorial.skip')}</button>
          <div className="tutorial-nav">
            {step > 0 && (
              <button className="tutorial-prev" onClick={handlePrev}>{t('tutorial.prev')}</button>
            )}
            <button className="tutorial-next" onClick={handleNext}>
              {isLast ? t('tutorial.finish') : t('tutorial.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
