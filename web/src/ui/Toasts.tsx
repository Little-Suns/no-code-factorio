import React, { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import './Toasts.css';

export function Toasts() {
  const toasts = useStore((state) => state.toasts);
  const dismissToast = useStore((state) => state.dismissToast);
  const [visible, setVisible] = useState<Set<string>>(new Set());

  useEffect(() => {
    const activeToasts = new Set(toasts.map((t) => t.id));
    setVisible(activeToasts);

    // Через 4с скрываем (CSS-transition fade+slide, 300мс), затем реально убираем
    // из стора — раньше стор не чистился вовсе, toasts рос бесконечно за сессию
    const timers = toasts.flatMap((toast) => [
      setTimeout(() => {
        setVisible((v) => {
          const next = new Set(v);
          next.delete(toast.id);
          return next;
        });
      }, 4000),
      setTimeout(() => dismissToast(toast.id), 4300),
    ]);

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [toasts, dismissToast]);

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
