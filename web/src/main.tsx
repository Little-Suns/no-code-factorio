import React from 'react';
import ReactDOM from 'react-dom/client';
import { useEffect, useRef } from 'react';
import { createApp } from './game/app';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    createApp(canvasRef.current).then(({ app }) => {
      // Приложение готово
      console.log('App ready', app.renderer.width, 'x', app.renderer.height);
    });
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
// Без StrictMode: двойной mount-эффект инициализировал бы Pixi дважды на одном canvas
root.render(<App />);
