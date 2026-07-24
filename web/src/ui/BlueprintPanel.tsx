import React, { useState } from 'react';
import { useStore } from '../state/store';
import {
  serializeBlueprint,
  exportBlueprintString,
  importBlueprintString,
  Blueprint,
} from '../core/blueprint';
import './BlueprintPanel.css';

export function BlueprintPanel() {
  const blueprints = useStore((state) => state.blueprints);
  const pendingSelection = useStore((state) => state.pendingSelection);
  const blueprintPanelOpen = useStore((state) => state.blueprintPanelOpen);
  const stampBlueprintId = useStore((state) => state.stampBlueprintId);
  const addBlueprint = useStore((state) => state.addBlueprint);
  const removeBlueprint = useStore((state) => state.removeBlueprint);
  const setStampBlueprint = useStore((state) => state.setStampBlueprint);
  const setPendingSelection = useStore((state) => state.setPendingSelection);
  const setBlueprintPanelOpen = useStore((state) => state.setBlueprintPanelOpen);
  const toast = useStore((state) => state.toast);

  const [name, setName] = useState('');
  const [importValue, setImportValue] = useState('');

  // Видимость — по клавише B (blueprintPanelOpen), плюс всегда видна форма сохранения
  // сразу после рамки выделения (pendingSelection сама включает blueprintPanelOpen, см. store.ts).
  if (!blueprintPanelOpen && !pendingSelection) {
    return null;
  }

  const handleClose = () => {
    setBlueprintPanelOpen(false);
  };

  const handleSave = () => {
    if (!pendingSelection) return;
    const finalName = name.trim() || `Чертёж ${blueprints.length + 1}`;
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
    toast(`Чертёж «${blueprint.name}» скопирован строкой`);
  };

  const handleImport = () => {
    const trimmed = importValue.trim();
    if (!trimmed) return;
    try {
      const blueprint = importBlueprintString(trimmed);
      addBlueprint(blueprint);
      setImportValue('');
      toast(`Чертёж «${blueprint.name}» импортирован`);
    } catch {
      toast('Некорректная строка чертежа');
    }
  };

  return (
    <div className="blueprint-panel">
      <div className="blueprint-header">
        <h3 className="blueprint-title">Чертежи</h3>
        <span className="blueprint-hint">Выделить: зажми и потяни ЛКМ</span>
        <button className="blueprint-icon-btn" onClick={handleClose} title="Закрыть (B)">
          ✕
        </button>
      </div>

      {pendingSelection && (
        <div className="blueprint-save-form">
          <input
            className="blueprint-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Чертёж ${blueprints.length + 1}`}
          />
          <div className="blueprint-save-actions">
            <button className="blueprint-btn primary" onClick={handleSave}>
              Сохранить ({pendingSelection.length})
            </button>
            <button className="blueprint-btn" onClick={handleCancelSave}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {blueprints.length > 0 && (
        <div className="blueprint-list">
          {blueprints.map((bp) => (
            <div key={bp.id} className={`blueprint-item ${stampBlueprintId === bp.id ? 'active' : ''}`}>
              <span className="blueprint-name" title={`${bp.entities.length} станков`}>
                {bp.name}
              </span>
              <div className="blueprint-item-actions">
                <button
                  className="blueprint-icon-btn"
                  onClick={() => setStampBlueprint(stampBlueprintId === bp.id ? null : bp.id)}
                  title="Поставить"
                >
                  ✥
                </button>
                <button className="blueprint-icon-btn" onClick={() => handleExport(bp)} title="Экспорт строкой">
                  ↓
                </button>
                <button className="blueprint-icon-btn" onClick={() => removeBlueprint(bp.id)} title="Удалить">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="blueprint-import">
        <input
          className="blueprint-import-input"
          value={importValue}
          onChange={(e) => setImportValue(e.target.value)}
          placeholder="Строка чертежа для импорта"
        />
        <button className="blueprint-btn" onClick={handleImport}>
          Загрузить
        </button>
      </div>
    </div>
  );
}
