import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useStore } from '../state/store';
import { useT, LOCALES, LOCALE_NAMES } from '../i18n';
import { TUTORIAL_STEPS as STEPS } from '../state/tutorialSteps';
import { buildGraph } from '../core/graph';
import './Tutorial.css';

/**
 * Обучалка первого запуска: пошаговый тур с подсветкой реальных элементов UI
 * (по атрибуту `data-tutorial="<id>"`, расставлен в Hotbar.tsx/TopBar.tsx).
 * Автостарт/флаг «видел» — state/tutorialPersist.ts. Шаги без `target` — без
 * подсветки и без затемнения фона (вступление, общие советы, а также place/rotate/move —
 * у них цель это произвольная точка/станок на канвасе, а не фиксированный DOM-узел), карточка
 * в левом верхнем углу под TopBar, не по центру — иначе перекрывала бы канвас, где как раз
 * нужно что-то сделать. Первый шаг — выбор языка
 * (не через t(), т.к. до выбора язык может быть неподходящим): дальше весь тур
 * идёт уже на выбранном.
 *
 * Практик-шаги (`step.practice`, см. state/tutorialSteps.ts) требуют реального
 * действия на канвасе — сравниваем снимок мира на входе на шаг с текущим (см.
 * snapshotRef ниже) и держим Next выключенным, пока действие не выполнено.
 */

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
  const locale = useStore((s) => s.locale);
  const setLocale = useStore((s) => s.setLocale);
  const entities = useStore((s) => s.entities);
  const blueprints = useStore((s) => s.blueprints);
  const stampBlueprintId = useStore((s) => s.stampBlueprintId);
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

  // Снимок мира на входе на шаг — практика считается выполненной, если что-то
  // изменилось относительно него (см. practiceDone). Снимаем заново на каждый
  // step, поэтому повторный заход на шаг снова требует свежего действия — ок,
  // это осознанное упрощение (см. промпт задачи), не баг.
  const snapshotRef = useRef<{
    dir: Record<string, number>;
    pos: Record<string, { x: number; y: number }>;
    bpCount: number;
    entityCount: number;
  } | null>(null);
  const [stampSeen, setStampSeen] = useState(false);
  // rotate/move: сработало хоть раз с момента входа на шаг, а не «отличается от
  // снимка ПРЯМО СЕЙЧАС» — иначе поворот на 360° (4×R, обратно в исходный dir)
  // или перемещение станка обратно на исходный тайл не засчитывались бы, хотя
  // действие было выполнено.
  const [changedSeen, setChangedSeen] = useState(false);

  useEffect(() => {
    snapshotRef.current = {
      dir: Object.fromEntries(Object.entries(entities).map(([id, e]) => [id, e.dir])),
      pos: Object.fromEntries(Object.entries(entities).map(([id, e]) => [id, e.pos])),
      bpCount: blueprints.length,
      entityCount: Object.keys(entities).length,
    };
    setStampSeen(false);
    setChangedSeen(false);
    // eslint: намеренно только `step` — снимок берём исключительно при входе на шаг
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (current?.practice === 'blueprintStamp' && stampBlueprintId) setStampSeen(true);
  }, [current?.practice, stampBlueprintId]);

  useEffect(() => {
    const practice = current?.practice;
    const snap = snapshotRef.current;
    if (!snap) return;
    if (practice === 'rotate' && Object.entries(entities).some(([id, e]) => snap.dir[id] !== undefined && snap.dir[id] !== e.dir)) {
      setChangedSeen(true);
    } else if (
      practice === 'move' &&
      Object.entries(entities).some(([id, e]) => snap.pos[id] && (snap.pos[id].x !== e.pos.x || snap.pos[id].y !== e.pos.y))
    ) {
      setChangedSeen(true);
    }
  }, [entities, current?.practice]);

  const practiceDone = useMemo(() => {
    const practice = current?.practice;
    const snap = snapshotRef.current;
    if (!practice || !snap) return true;
    switch (practice) {
      case 'rotate':
      case 'move':
        return changedSeen;
      case 'place':
        return Object.keys(entities).length > snap.entityCount;
      case 'connect':
        return buildGraph(entities).some((edge) => edge.to !== null);
      case 'blueprintSave':
        return blueprints.length > snap.bpCount;
      case 'blueprintStamp':
        return stampSeen && Object.keys(entities).length > snap.entityCount;
      default:
        return true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.practice, entities, blueprints, stampSeen, changedSeen]);

  if (!active || !current) return null;

  const isLast = step === STEPS.length - 1;
  const handleNext = () => (isLast ? skipTutorial() : setTutorialStep(step + 1));
  const handlePrev = () => setTutorialStep(Math.max(0, step - 1));
  const handlePickLang = (loc: (typeof LOCALES)[number]) => {
    setLocale(loc);
    setTutorialStep(step + 1);
  };

  // Обводка цели рисуется всегда, когда цель есть (даже на practice-шагах —
  // manipulator/blueprints/blueprintStamp всё равно показывают, НА какую кнопку
  // смотреть). А вот тёмный фон (box-shadow на 9999px) — только на чисто
  // информационных шагах без practice: на practice-шагах нужно РАБОТАТЬ с
  // канвасом/панелями у себя за спиной, full-screen затемнение вокруг цели
  // всё равно прятало бы то, что реально нужно кликать (canvas при rotate/move,
  // саму панель чертежей при blueprintSave/blueprintStamp). На шагах вообще без
  // цели (welcome/place/config/done) раньше был баг похуже: дырка 0×0 в центре —
  // экран темнел полностью без видимого просвета.
  const spot = rect
    ? { top: rect.top - SPOT_PAD, left: rect.left - SPOT_PAD, width: rect.width + SPOT_PAD * 2, height: rect.height + SPOT_PAD * 2 }
    : null;

  // Карточка: рядом с целью — только на информационных шагах (там фон и так
  // читаемый, есть смысл её приблизить к подсвеченной кнопке). На practice-шагах
  // и шагах без цели — фиксированный угол под TopBar, не мёртвый центр экрана
  // и не поверх канваса/панели, с которой нужно работать.
  const cardNearTarget = !!rect && !current.practice;
  const cardStyle: CSSProperties = cardNearTarget
    ? {
        top:
          rect!.top + rect!.height + SPOT_PAD * 2 + CARD_HEIGHT_GUESS <= window.innerHeight
            ? rect!.top + rect!.height + SPOT_PAD * 2
            : Math.max(CARD_MARGIN, rect!.top - SPOT_PAD * 2 - CARD_HEIGHT_GUESS),
        left: Math.min(Math.max(CARD_MARGIN, rect!.left), window.innerWidth - CARD_WIDTH - CARD_MARGIN),
      }
    : { top: 72, left: CARD_MARGIN };

  return (
    <div className={`tutorial-overlay ${current.practice ? 'practice' : ''}`}>
      {spot && (
        <div
          className={`tutorial-spotlight ${current.practice ? 'no-dim' : ''}`}
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        />
      )}
      <div className="tutorial-card" style={cardStyle}>
        <div className="tutorial-step-count">{step + 1} / {STEPS.length}</div>
        {current.lang ? (
          <>
            <h3 className="tutorial-title">Choose language · Выберите язык · 选择语言</h3>
            <p className="tutorial-desc">
              Switchable anytime via the 🌐 button
              <br />
              Сменить можно в любой момент кнопкой 🌐
              <br />
              随时可通过 🌐 按钮切换
            </p>
            <div className="tutorial-actions">
              <button className="tutorial-skip" onClick={skipTutorial}>{t('tutorial.skip')}</button>
              <div className="tutorial-nav">
                {LOCALES.map((loc) => (
                  <button
                    key={loc}
                    className={`tutorial-lang-option ${locale === loc ? 'active' : ''}`}
                    onClick={() => handlePickLang(loc)}
                  >
                    {LOCALE_NAMES[loc]}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <h3 className="tutorial-title">{t(current.titleKey)}</h3>
            <p className="tutorial-desc">{t(current.descKey)}</p>
            {current.practice === 'connect' && (
              // Схема "станок → лента → манипулятор(стрелка внутрь) → станок" — единственный
              // шаг, где абстрактной подсветки DOM-кнопки недостаточно: тут нужно один раз
              // явно показать геометрию (куда именно ставить манипулятор и куда должна
              // смотреть его стрелка), а не только текстом.
              <div className="tutorial-diagram" aria-hidden="true">
                <div className="td-cell td-machine">A</div>
                <div className="td-cell td-belt">▸</div>
                <div className="td-cell td-belt">▸</div>
                <div className="td-cell td-manip">▸</div>
                <div className="td-cell td-machine">B</div>
                <div className="td-caption">{t('tutorial.diagram.machine')}</div>
                <div className="td-caption" />
                <div className="td-caption">{t('tutorial.diagram.belt')}</div>
                <div className="td-caption td-caption-accent">{t('tutorial.diagram.manipulator')}</div>
                <div className="td-caption">{t('tutorial.diagram.machine')}</div>
              </div>
            )}
            {current.practice && (
              <p className={`tutorial-practice-status ${practiceDone ? 'done' : 'pending'}`}>
                {practiceDone ? t('tutorial.practice.done') : t('tutorial.practice.pending')}
              </p>
            )}
            <div className="tutorial-actions">
              <button className="tutorial-skip" onClick={skipTutorial}>{t('tutorial.skip')}</button>
              <div className="tutorial-nav">
                {step > 0 && (
                  <button className="tutorial-prev" onClick={handlePrev}>{t('tutorial.prev')}</button>
                )}
                <button className="tutorial-next" onClick={handleNext} disabled={!!current.practice && !practiceDone}>
                  {isLast ? t('tutorial.finish') : t('tutorial.next')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
