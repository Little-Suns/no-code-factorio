import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';

const root = ReactDOM.createRoot(document.getElementById('root')!);
// Без StrictMode: двойной mount-эффект инициализировал бы Pixi дважды на одном canvas
root.render(<App />);
