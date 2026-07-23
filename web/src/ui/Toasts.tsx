import React, { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import './Toasts.css';

export function Toasts() {
  const toasts = useStore((state) => state.toasts);
  const [visible, setVisible] = useState<Set<string>>(new Set());

  useEffect(() => {
    const activeToasts = new Set(toasts.map((t) => t.id));
    setVisible(activeToasts);

    // Автоудаление каждого тоста через 4с
    const timers = toasts.map((toast) => {
      return setTimeout(() => {
        setVisible((v) => {
          const next = new Set(v);
          next.delete(toast.id);
          return next;
        });
      }, 4000);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [toasts]);

  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${visible.has(toast.id) ? 'visible' : ''}`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}
