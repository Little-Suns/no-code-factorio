import React, { useState } from 'react';
import { useStore } from '../state/store';
import {
  serializeBlueprint,
  exportBlueprintString,
  importBlueprintString,
  Blueprint,
} from '../core/blueprint';
import { LIBRARY_BLUEPRINTS } from '../core/blueprintLibrary';
import { useT } from '../i18n';
import './BlueprintPanel.css';

// Инлайн-глиф чертежа (без иконочных библиотек — правило CLAUDE.md), в стиле
// геометрических иконок Hotbar (hotbarData.tsx): viewBox 24x24, stroke=currentColor.
function BlueprintGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="1" />
      <path d="M3.5 9.5 L20.5 9.5 M9.5 20.5 L9.5 9.5" />
    </svg>
  );
}

export function BlueprintPanel() {
  const t = useT();
  const blueprints = useStore((state) => state.blueprints);
  const pendingSelection = useStore((state) => state.pendingSelection);
  const blueprintPanelOpen = useStore((state) => state.blueprintPanelOpen);
  const stampBlueprintId = useStore((state) => state.stampBlueprintId);
  // Редактор объекта (ConfigPanel) — тот же правый край, что и мы. Когда он открыт
  // (выбрана существующая сущность), сдвигаемся левее, чтобы не уезжать под него.
  const selectedEntityId = useStore((state) => state.selectedEntityId);
  const entities = useStore((state) => state.entities);
  const configOpen = !!(selectedEntityId && entities[selectedEntityId]);
  const addBlueprint = useStore((state) => state.addBlueprint);
  const removeBlueprint = useStore((state) => state.removeBlueprint);
  const setStampBlueprint = useStore((state) => state.setStampBlueprint);
  const setPendingSelection = useStore((state) => state.setPendingSelection);
  const setBlueprintPanelOpen = useStore((state) => state.setBlueprintPanelOpen);
  const toast = useStore((state) => state.toast);

  const [name, setName] = useState('');
  const [importValue, setImportValue] = useState('');

  // Видимость — тоглом «Чертежи» в TopBar / клавишей B (blueprintPanelOpen); плюс панель
  // всегда всплывает под форму сохранения сразу после рамки выделения (pendingSelection
  // сама включает blueprintPanelOpen, см. store.ts). Закрыто — панель полностью скрыта,
  // без плашки-реоткрывашки: единственная точка показа/скрытия — кнопка в TopBar.
  if (!blueprintPanelOpen && !pendingSelection) {
    return null;
  }

  const handleClose = () => {
    // Видимость — OR(blueprintPanelOpen, pendingSelection): при незакрытой форме
    // сохранения одного лишь сброса flag'а недостаточно, панель не спрячется.
    setBlueprintPanelOpen(false);
    setPendingSelection(null);
  };

  const handleSave = () => {
    if (!pendingSelection) return;
    const finalName = name.trim() || t('bp.namePlaceholder', { n: blueprints.length + 1 });
    addBlueprint(serializeBlueprint(pendingSelection, finalName));
    setPendingSelection(null);
    setName('');
  };

  const handleCancelSave = () => {
    setPendingSelection(null);
    setName('');
  };

  const handleExport = (blueprint: Blueprint) => {
    navigator.clipboard.writeText(exportBlueprintString(blueprint));
    toast(t('toast.blueprintCopied', { name: blueprint.name }));
  };

  const handleImport = () => {
    const trimmed = importValue.trim();
    if (!trimmed) return;
    try {
      const blueprint = importBlueprintString(trimmed);
      addBlueprint(blueprint);
      setImportValue('');
      toast(t('toast.blueprintImported', { name: blueprint.name }));
    } catch {
      toast(t('toast.blueprintInvalid'));
    }
  };

  return (
    <div className={`blueprint-panel ${configOpen ? 'config-open' : ''}`}>
      <div className="blueprint-header">
        <div className="blueprint-header-left">
          <BlueprintGlyph className="blueprint-header-glyph" />
          <h3 className="blueprint-title">{t('bp.title')}</h3>
        </div>
        <button className="blueprint-icon-btn" onClick={handleClose} title={t('bp.collapseTitle')}>
          &#9662;
        </button>
      </div>

      <div className="blueprint-hint">{t('bp.hint')}</div>

      {pendingSelection && (
        <div className="blueprint-save-form">
          <input
            className="blueprint-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('bp.namePlaceholder', { n: blueprints.length + 1 })}
          />
          <div className="blueprint-save-actions">
            <button className="blueprint-btn primary" onClick={handleSave}>
              {t('bp.save', { n: pendingSelection.length })}
            </button>
            <button className="blueprint-btn" onClick={handleCancelSave}>
              {t('bp.cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="blueprint-section-title">
        <span className="blueprint-section-dot mine" />
        {t('bp.myBlueprints')}
      </div>
      <div className="blueprint-list">
        {blueprints.length === 0 ? (
          <div className="blueprint-empty">{t('bp.empty')}</div>
        ) : (
          blueprints.map((bp, i) => (
            <div key={bp.id} className={`blueprint-item ${stampBlueprintId === bp.id ? 'active' : ''}`}>
              <BlueprintGlyph className="blueprint-item-icon" />
              <span className="blueprint-name" title={t('bp.entitiesCountTitle', { n: bp.entities.length })}>
                {bp.name}
              </span>
              <span className="blueprint-count-badge" title={t('bp.entitiesCountTitle', { n: bp.entities.length })}>
                {bp.entities.length}
              </span>
              <div className="blueprint-item-actions">
                <button
                  className="blueprint-icon-btn"
                  data-tutorial={i === 0 ? 'blueprint-stamp' : undefined}
                  onClick={() => setStampBlueprint(stampBlueprintId === bp.id ? null : bp.id)}
                  title={t('bp.stampTitle')}
                >
                  ✥
                </button>
                <button className="blueprint-icon-btn" onClick={() => handleExport(bp)} title={t('bp.exportTitle')}>
                  ↓
                </button>
                <button className="blueprint-icon-btn" onClick={() => removeBlueprint(bp.id)} title={t('bp.removeTitle')}>
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Библиотека — статичные пресеты из коробки (blueprintLibrary.ts), read-only:
          без экспорта/удаления, только «поставить», как обычный инструмент. */}
      <div className="blueprint-section-title">
        <span className="blueprint-section-dot library" />
        {t('bp.library')}
      </div>
      <div className="blueprint-list blueprint-list-library">
        {LIBRARY_BLUEPRINTS.map((bp) => (
          <div key={bp.id} className={`blueprint-item library ${stampBlueprintId === bp.id ? 'active' : ''}`}>
            <BlueprintGlyph className="blueprint-item-icon library" />
            <span className="blueprint-name" title={t('bp.entitiesCountTitle', { n: bp.entities.length })}>
              {bp.name}
            </span>
            <span className="blueprint-count-badge library" title={t('bp.entitiesCountTitle', { n: bp.entities.length })}>
              {bp.entities.length}
            </span>
            <div className="blueprint-item-actions">
              <button
                className="blueprint-icon-btn"
                onClick={() => setStampBlueprint(stampBlueprintId === bp.id ? null : bp.id)}
                title={t('bp.stampTitle')}
              >
                ✥
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="blueprint-import">
        <input
          className="blueprint-import-input"
          value={importValue}
          onChange={(e) => setImportValue(e.target.value)}
          placeholder={t('bp.importPlaceholder')}
        />
        <button className="blueprint-btn" onClick={handleImport}>
          {t('bp.load')}
        </button>
      </div>
    </div>
  );
}
