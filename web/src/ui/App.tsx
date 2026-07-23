import React, { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { createApp } from '../game/app';
import { loadAssets } from '../game/assets';
import { initInput } from '../game/input';
import { initMachines } from '../game/machines';
import { initBelts } from '../game/belts';
import { initPackets } from '../game/packets';
import { initFX } from '../game/fx';
import { Hotbar } from './Hotbar';
import { TopBar } from './TopBar';
import { ConfigPanel } from './ConfigPanel';
import { ResultPanel } from './ResultPanel';
import { Toasts } from './Toasts';
import './App.css';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    createApp(canvasRef.current).then(async ({ app, viewport, layers }) => {
      // Загрузить ассеты
      await loadAssets(app.renderer);

      // Инициализировать рендеры
      initMachines(layers);
      initBelts(layers);
      initPackets(app, layers);
      initFX(app, layers);

      // Инициализировать ввод
      initInput(canvasRef.current!, viewport, layers);

      // Приложение готово
      console.log('App ready', app.renderer.width, 'x', app.renderer.height);

      // Дев-хук для e2e-прогонов (не попадает в prod-сборку)
      if (import.meta.env.DEV) {
        const w = window as unknown as Record<string, unknown>;
        w.__store = useStore;
        w.__viewport = viewport;
      }
    });
  }, []);

  // Закрытие панели конфига на Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && e.target === document.body) {
        useStore.getState().select(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="app-container">
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      <div className="ui-overlay">
        <TopBar />
        <ConfigPanel />
        <ResultPanel />
        <Hotbar />
        <Toasts />
      </div>
    </div>
  );
}
